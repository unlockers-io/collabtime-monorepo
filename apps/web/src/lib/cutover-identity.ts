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

const isAuthorizedProbeRequest = (request: Request, bearer: string, host: string): boolean => {
  const url = new URL(request.url);
  return (
    request.method === "GET" &&
    request.headers.get("host") === host &&
    url.pathname === "/api/internal/cutover-identity" &&
    url.search === "" &&
    timingSafeEqual(digest(request.headers.get("authorization") ?? ""), digest(`Bearer ${bearer}`))
  );
};

const createCutoverIdentityHandler =
  (readRedisServerInfo: () => Promise<string>) =>
  async (request: Request): Promise<Response> => {
    const config = readProbeConfig();
    if (config === null || !isAuthorizedProbeRequest(request, config.bearer, config.host)) {
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

export { createCutoverIdentityHandler };
