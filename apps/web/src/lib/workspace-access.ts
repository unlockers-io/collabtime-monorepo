import crypto from "node:crypto";

import { envAuthConfig } from "@repo/auth/env-config";
import { cookies } from "next/headers";
import { z } from "zod";

import { getAuthEnv, getEnv } from "@/lib/env";
import { log } from "@/lib/observability";

const SPACE_ACCESS_COOKIE_PREFIX = "space-access-";
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

// v2 binds the grant to the credential it was issued against.
const TOKEN_VERSION = "v2";

let warnedAboutFallback = false;

const getSigningSecret = (): string => {
  const dedicated = getEnv("SPACE_ACCESS_SECRET");

  if (dedicated !== undefined) {
    return dedicated;
  }

  const fallback = getEnv("BETTER_AUTH_SECRET");

  if (fallback === undefined) {
    throw new Error("Missing SPACE_ACCESS_SECRET or BETTER_AUTH_SECRET environment variable");
  }

  if (!warnedAboutFallback) {
    warnedAboutFallback = true;
    log.warn({
      message:
        "SPACE_ACCESS_SECRET not set; signing space tokens with BETTER_AUTH_SECRET. Set a dedicated secret to isolate blast radius.",
      route: "workspace-access",
    });
  }

  return fallback;
};

const createSignature = (data: string, secret: string): string =>
  crypto.createHmac("sha256", secret).update(data).digest("base64url");

const verifySignature = (data: string, signature: string, secret: string): boolean => {
  const expectedSignature = createSignature(data, secret);

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
};

const tokenPayloadSchema = z.object({
  credential: z.string(),
  expiresAt: z.number(),
  spaceId: z.string(),
  version: z.literal(TOKEN_VERSION),
});

/**
 * A fingerprint of the stored hash, not the hash itself: the payload is only
 * base64url, so it is readable by anyone holding the cookie.
 */
const credentialFingerprint = (accessPasswordHash: string, secret: string): string =>
  createSignature(`credential:${accessPasswordHash}`, secret).slice(0, 32);

const createAccessToken = (spaceId: string, accessPasswordHash: string): string => {
  const secret = getSigningSecret();

  const payload: z.infer<typeof tokenPayloadSchema> = {
    credential: credentialFingerprint(accessPasswordHash, secret),
    expiresAt: Date.now() + TOKEN_TTL_SECONDS * 1000,
    spaceId,
    version: TOKEN_VERSION,
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url");

  return `${payloadStr}.${createSignature(payloadStr, secret)}`;
};

const verifyAccessToken = (
  token: string,
  spaceId: string,
  accessPasswordHash: string | null,
): boolean => {
  if (accessPasswordHash === null || accessPasswordHash === "") {
    return false;
  }

  try {
    const secret = getSigningSecret();
    const parts = token.split(".");
    const [payloadStr = "", signature = ""] = parts;

    if (
      parts.length !== 2 ||
      payloadStr === "" ||
      signature === "" ||
      !verifySignature(payloadStr, signature, secret)
    ) {
      return false;
    }

    const payload = tokenPayloadSchema.parse(
      JSON.parse(Buffer.from(payloadStr, "base64url").toString("utf8")),
    );

    return (
      payload.spaceId === spaceId &&
      Date.now() <= payload.expiresAt &&
      payload.credential === credentialFingerprint(accessPasswordHash, secret)
    );
  } catch (error) {
    log.error({
      error,
      message: "Space access token verification failed",
      route: "workspace-access",
    });

    return false;
  }
};

const accessCookieName = (spaceId: string): string => `${SPACE_ACCESS_COOKIE_PREFIX}${spaceId}`;

const issueAccessCookie = (spaceId: string, accessPasswordHash: string) => ({
  httpOnly: true,
  maxAge: TOKEN_TTL_SECONDS,
  name: accessCookieName(spaceId),
  sameSite: "lax" as const,
  secure: envAuthConfig(getAuthEnv()).useSecureCookies,
  value: createAccessToken(spaceId, accessPasswordHash),
});

const parseAccessCookies = (
  cookieHeader: string | null,
): Array<{ spaceId: string; token: string }> => {
  if (cookieHeader === null || cookieHeader === "") {
    return [];
  }

  const accessCookies: Array<{ spaceId: string; token: string }> = [];

  for (const part of cookieHeader.split(";")) {
    const separatorIndex = part.indexOf("=");
    const name = part.slice(0, Math.max(separatorIndex, 0)).trim();

    if (separatorIndex === -1 || !name.startsWith(SPACE_ACCESS_COOKIE_PREFIX)) {
      continue;
    }

    const rawValue = part.slice(separatorIndex + 1).trim();
    let token = rawValue;

    try {
      token = decodeURIComponent(rawValue);
    } catch {
      // Malformed percent-encoding; verify the raw value as-is.
    }

    accessCookies.push({ spaceId: name.slice(SPACE_ACCESS_COOKIE_PREFIX.length), token });
  }

  return accessCookies;
};

const readAccessToken = async (spaceId: string): Promise<string | undefined> => {
  const cookieStore = await cookies();

  return cookieStore.get(accessCookieName(spaceId))?.value;
};

export { issueAccessCookie, parseAccessCookies, readAccessToken, verifyAccessToken };
