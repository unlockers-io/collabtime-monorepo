import crypto from "crypto";

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

/**
 * Create an HMAC signature for the given data.
 */
const createSignature = (data: string, secret: string): string => {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
};

/**
 * Verify an HMAC signature.
 */
const verifySignature = (data: string, signature: string, secret: string): boolean => {
  const expectedSignature = createSignature(data, secret);
  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    // Buffers of different lengths will throw
    return false;
  }
};

type TokenPayload = {
  spaceId: string;
  clientIp: string;
  expiresAt: number;
  version: string;
};

/**
 * Create a signed access token for a space.
 * Token format: base64(payload).signature
 */
const createSpaceAccessToken = async (
  spaceId: string,
  clientIp: string
): Promise<string> => {
  const secret = getSigningSecret();
  const expiresAt = Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

  const payload: TokenPayload = {
    spaceId,
    clientIp,
    expiresAt,
    version: TOKEN_VERSION,
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createSignature(payloadStr, secret);

  return `${payloadStr}.${signature}`;
};

type VerificationResult =
  | { valid: true; payload: TokenPayload }
  | { valid: false; reason: string };

/**
 * Verify a space access token.
 * Checks signature, expiration, and optionally the client IP.
 */
const verifySpaceAccessToken = async (
  token: string,
  expectedSpaceId: string,
  clientIp?: string
): Promise<VerificationResult> => {
  try {
    const secret = getSigningSecret();
    const parts = token.split(".");

    if (parts.length !== 2) {
      return { valid: false, reason: "Invalid token format" };
    }

    const [payloadStr, signature] = parts;

    if (!payloadStr || !signature) {
      return { valid: false, reason: "Missing token parts" };
    }

    // Verify signature
    if (!verifySignature(payloadStr, signature, secret)) {
      return { valid: false, reason: "Invalid signature" };
    }

    // Decode and parse payload
    const payloadJson = Buffer.from(payloadStr, "base64url").toString("utf-8");
    const payload = JSON.parse(payloadJson) as TokenPayload;

    // Verify version
    if (payload.version !== TOKEN_VERSION) {
      return { valid: false, reason: "Token version mismatch" };
    }

    // Verify space ID
    if (payload.spaceId !== expectedSpaceId) {
      return { valid: false, reason: "Space ID mismatch" };
    }

    // Verify expiration
    if (Date.now() > payload.expiresAt) {
      return { valid: false, reason: "Token expired" };
    }

    // Optionally verify client IP (for stricter security)
    // Note: This might cause issues with mobile users changing networks
    // Disable by not passing clientIp parameter
    if (clientIp && payload.clientIp !== clientIp) {
      return { valid: false, reason: "IP address mismatch" };
    }

    return { valid: true, payload };
  } catch (error) {
    console.error("[Space Access] Token verification error:", error);
    return { valid: false, reason: "Token verification failed" };
  }
};

/**
 * Check if a request has valid access to a space via cookie.
 */
const hasSpaceAccess = async (
  request: Request,
  spaceId: string,
  strictIpCheck = false
): Promise<boolean> => {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return false;

  const cookieName = `${SPACE_ACCESS_COOKIE_PREFIX}${spaceId}`;
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const accessCookie = cookies.find((c) => c.startsWith(`${cookieName}=`));

  if (!accessCookie) return false;

  const token = accessCookie.split("=")[1];
  if (!token) return false;

  const clientIp = strictIpCheck
    ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      undefined
    : undefined;

  const result = await verifySpaceAccessToken(token, spaceId, clientIp);
  return result.valid;
};

export {
  SPACE_ACCESS_COOKIE_PREFIX,
  createSpaceAccessToken,
  verifySpaceAccessToken,
  hasSpaceAccess,
};
