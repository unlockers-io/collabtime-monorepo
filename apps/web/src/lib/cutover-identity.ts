import { createHash, timingSafeEqual } from "node:crypto";

const MAX_LIFETIME_MS = 15 * 60 * 1000;
const headers = { "Cache-Control": "no-store" };
const digest = (value: string) => createHash("sha256").update(value).digest();

const createCutoverIdentityHandler =
  (readRedisServerInfo: () => Promise<string>) =>
  async (request: Request): Promise<Response> => {
    const bearer = process.env.CUTOVER_IDENTITY_BEARER;
    const expiresAt = Number(process.env.CUTOVER_IDENTITY_EXPIRES_AT);
    const host = process.env.VERCEL_URL;
    const remaining = expiresAt - Date.now();
    if (
      request.method !== "GET" ||
      bearer === undefined ||
      bearer.length < 32 ||
      host === undefined ||
      host === "" ||
      request.headers.get("host") !== host ||
      new URL(request.url).pathname !== "/api/internal/cutover-identity" ||
      new URL(request.url).search !== "" ||
      !Number.isSafeInteger(expiresAt) ||
      remaining <= 0 ||
      remaining > MAX_LIFETIME_MS ||
      !timingSafeEqual(
        digest(request.headers.get("authorization") ?? ""),
        digest(`Bearer ${bearer}`),
      )
    ) {
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
