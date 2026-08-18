import crypto from "node:crypto";

import { z } from "zod";

import { log } from "@/lib/observability";

const SPACE_ACCESS_COOKIE_PREFIX = "space-access-";
const TOKEN_EXPIRY_DAYS = 7;
// v2 binds the grant to the credential it was issued against. v1 tokens carried
// no credential field and are rejected, so guests re-enter the password once.
const TOKEN_VERSION = "v2";

let warnedAboutFallback = false;

const getSigningSecret = (): string => {
  const dedicated = process.env.SPACE_ACCESS_SECRET;
  if (dedicated !== undefined && dedicated !== "") {
    return dedicated;
  }
  const fallback = process.env.BETTER_AUTH_SECRET;
  if (fallback === undefined || fallback === "") {
    throw new Error("Missing SPACE_ACCESS_SECRET or BETTER_AUTH_SECRET environment variable");
  }
  if (!warnedAboutFallback) {
    warnedAboutFallback = true;
    log.warn({
      message:
        "SPACE_ACCESS_SECRET not set; signing space tokens with BETTER_AUTH_SECRET. Set a dedicated secret to isolate blast radius.",
      route: "space-access",
    });
  }
  return fallback;
};

const createSignature = (data: string, secret: string): string => {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
};

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

type TokenPayload = z.infer<typeof tokenPayloadSchema>;

/**
 * A fingerprint of the stored hash, not the hash itself: the payload is only
 * base64url, so it is readable by anyone holding the cookie.
 */
const credentialFingerprint = (accessPasswordHash: string, secret: string): string =>
  createSignature(`credential:${accessPasswordHash}`, secret).slice(0, 32);

const createSpaceAccessToken = (spaceId: string, accessPasswordHash: string): string => {
  const secret = getSigningSecret();
  const expiresAt = Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

  const payload: TokenPayload = {
    credential: credentialFingerprint(accessPasswordHash, secret),
    expiresAt,
    spaceId,
    version: TOKEN_VERSION,
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createSignature(payloadStr, secret);

  return `${payloadStr}.${signature}`;
};

type VerificationResult = { payload: TokenPayload; valid: true } | { reason: string; valid: false };

/**
 * Takes the space's current password hash, so a grant is a claim about the
 * credential as it stands now rather than 7 days ago. Rotating or clearing the
 * password therefore revokes outstanding cookies with no revocation list.
 * `null` means no credential exists, so no grant against it can be valid.
 */
const verifySpaceAccessToken = (
  token: string,
  expectedSpaceId: string,
  accessPasswordHash: string | null,
): VerificationResult => {
  try {
    const secret = getSigningSecret();

    if (accessPasswordHash === null || accessPasswordHash === "") {
      return { reason: "No space credential", valid: false };
    }
    const parts = token.split(".");

    if (parts.length !== 2) {
      return { reason: "Invalid token format", valid: false };
    }

    const [payloadStr, signature] = parts;

    if (!payloadStr || !signature) {
      return { reason: "Missing token parts", valid: false };
    }

    if (!verifySignature(payloadStr, signature, secret)) {
      return { reason: "Invalid signature", valid: false };
    }

    const payloadJson = Buffer.from(payloadStr, "base64url").toString("utf8");
    const payload = tokenPayloadSchema.parse(JSON.parse(payloadJson));

    if (payload.version !== TOKEN_VERSION) {
      return { reason: "Token version mismatch", valid: false };
    }

    if (payload.spaceId !== expectedSpaceId) {
      return { reason: "Space ID mismatch", valid: false };
    }

    if (Date.now() > payload.expiresAt) {
      return { reason: "Token expired", valid: false };
    }

    if (payload.credential !== credentialFingerprint(accessPasswordHash, secret)) {
      return { reason: "Credential changed", valid: false };
    }

    return { payload, valid: true };
  } catch (error) {
    log.error({ error, message: "Space access token verification failed", route: "space-access" });
    return { reason: "Token verification failed", valid: false };
  }
};

export { SPACE_ACCESS_COOKIE_PREFIX, createSpaceAccessToken, verifySpaceAccessToken };
