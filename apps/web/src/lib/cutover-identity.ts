import { createHash, timingSafeEqual } from "node:crypto";

const MAX_LIFETIME_MS = 15 * 60 * 1000;
const headers = { "Cache-Control": "no-store" };
const digest = (value: string) => createHash("sha256").update(value).digest();

const readProbeConfig = () => {
  const bearer = process.env.CUTOVER_IDENTITY_BEARER;
  const expiresAt = Number(process.env.CUTOVER_IDENTITY_EXPIRES_AT);
  const host = process.env.VERCEL_URL;
  const remaining = expiresAt - Date.now();
  if (
    bearer === undefined ||
    bearer.length < 32 ||
    host === undefined ||
    host === "" ||
    !Number.isSafeInteger(expiresAt) ||
    remaining <= 0 ||
    remaining > MAX_LIFETIME_MS
  ) {
    return null;
  }
  return { bearer, host };
};

const isAuthorizedProbeRequest = (request: Request, method: "GET" | "HEAD"): boolean => {
  const config = readProbeConfig();
  if (config === null) {
    return false;
  }
  const url = new URL(request.url);
  return (
    request.method === method &&
    request.headers.get("host") === config.host &&
    url.pathname === "/api/internal/cutover-identity" &&
    url.search === "" &&
    timingSafeEqual(
      digest(request.headers.get("authorization") ?? ""),
      digest(`Bearer ${config.bearer}`),
    )
  );
};

const handleCutoverIdentityReadiness = (request: Request): Response =>
  new Response(null, { headers, status: isAuthorizedProbeRequest(request, "HEAD") ? 204 : 404 });

const createCutoverIdentityHandler =
  (readRedisServerInfo: () => Promise<string>) =>
  async (request: Request): Promise<Response> => {
    if (!isAuthorizedProbeRequest(request, "GET")) {
      return new Response(null, { headers, status: 404 });
    }

    try {
      const info = await readRedisServerInfo();
      const runId = /^run_id:(?<runId>[a-f0-9]{40})\r?$/mv.exec(info)?.groups?.runId;
      if (runId === undefined) {
        return new Response(null, { headers, status: 503 });
      }
      return Response.json({ redisRunIdSha256: digest(runId).toString("hex") }, { headers });
    } catch {
      return new Response(null, { headers, status: 503 });
    }
  };

export { createCutoverIdentityHandler, handleCutoverIdentityReadiness };
