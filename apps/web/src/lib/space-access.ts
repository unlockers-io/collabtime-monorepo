import crypto from "node:crypto";

import { log } from "@/lib/observability";

const SPACE_ACCESS_COOKIE_PREFIX = "space-access-";
const TOKEN_EXPIRY_DAYS = 7;
const TOKEN_VERSION = "v1";

/**
 * Get the signing secret from environment.
 * Falls back to BETTER_AUTH_SECRET if a dedicated secret isn't set.
 */
const getSigningSecret = (): string => {
  const secret = process.env.SPACE_ACCESS_SECRET ?? process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("Missing SPACE_ACCESS_SECRET or BETTER_AUTH_SECRET environment variable");
  }
  return secret;
};

const createSignature = (data: string, secret: string): string => {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
};

const verifySignature = (data: string, signature: string, secret: string): boolean => {
  const expectedSignature = createSignature(data, secret);
  // Timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch {
    // Buffers of different lengths throw
    return false;
  }
};

type TokenPayload = {
  expiresAt: number;
  spaceId: string;
  version: string;
};

/**
 * Create a signed access token for a space.
 * Token format: base64(payload).signature
 */
const createSpaceAccessToken = (spaceId: string): string => {
  const secret = getSigningSecret();
  const expiresAt = Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

  const payload: TokenPayload = {
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
 * Verify a space access token.
 * Checks signature and expiration.
 */
const verifySpaceAccessToken = (token: string, expectedSpaceId: string): VerificationResult => {
  try {
    const secret = getSigningSecret();
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
    const payload = JSON.parse(payloadJson) as TokenPayload;

    if (payload.version !== TOKEN_VERSION) {
      return { reason: "Token version mismatch", valid: false };
    }

    if (payload.spaceId !== expectedSpaceId) {
      return { reason: "Space ID mismatch", valid: false };
    }

    if (Date.now() > payload.expiresAt) {
      return { reason: "Token expired", valid: false };
    }

    return { payload, valid: true };
  } catch (error) {
    log.error({ error, message: "Space access token verification failed", route: "space-access" });
    return { reason: "Token verification failed", valid: false };
  }
};

export { SPACE_ACCESS_COOKIE_PREFIX, createSpaceAccessToken, verifySpaceAccessToken };
