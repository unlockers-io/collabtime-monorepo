import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSpaceBySubdomain, type CachedSpace } from "./lib/subdomain-cache";

const MAIN_DOMAIN = "collabtime.io";
const LOCALHOST_DOMAIN = "localhost";

const getSubdomain = (host: string): string | null => {
  // Handle localhost (no subdomains in dev)
  if (host.includes(LOCALHOST_DOMAIN)) {
    return null;
  }

  // Handle production domain
  if (host.endsWith(`.${MAIN_DOMAIN}`)) {
    const subdomain = host.replace(`.${MAIN_DOMAIN}`, "");
    // Ignore www
    if (subdomain === "www") {
      return null;
    }
    return subdomain;
  }

  return null;
};

/**
 * Build the redirect URL for the main domain.
 * Uses HTTPS in production, HTTP in development.
 */
const getMainDomainRedirectUrl = (): string => {
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const domain =
    process.env.NODE_ENV === "production" ? MAIN_DOMAIN : "localhost:3000";
  return `${protocol}://${domain}`;
};

/**
 * Fallback lookup via API for cache misses.
 * This is a backup when Redis cache doesn't have the subdomain.
 */
const lookupSpaceViaApi = async (
  request: NextRequest,
  subdomain: string
): Promise<CachedSpace | null> => {
  const baseUrl = request.nextUrl.origin;
  const encodedSubdomain = encodeURIComponent(subdomain);
  const lookupUrl = new URL(
    `/api/spaces/lookup?subdomain=${encodedSubdomain}`,
    baseUrl
  );

  try {
    const response = await fetch(lookupUrl, {
      headers: {
        "x-middleware-lookup": "true",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data?.space ?? null;
  } catch {
    return null;
  }
};

export const middleware = async (request: NextRequest) => {
  const host = request.headers.get("host") ?? "";
  const subdomain = getSubdomain(host);

  // No subdomain - continue normally
  if (!subdomain) {
    return NextResponse.next();
  }

  try {
    // Try to get space from Redis cache first (edge-compatible)
    let space = await getSpaceBySubdomain(subdomain);

    // Cache miss - fallback to API lookup
    // Note: This still has the self-fetch issue but only on cache misses
    // The cache will be populated by the API route after the first lookup
    if (!space) {
      space = await lookupSpaceViaApi(request, subdomain);
    }

    if (!space) {
      // Space not found - redirect to main domain
      return NextResponse.redirect(new URL("/", getMainDomainRedirectUrl()));
    }

    // Rewrite to team page
    const url = request.nextUrl.clone();
    url.pathname = `/${space.teamId}`;

    // Pass space context via headers
    const res = NextResponse.rewrite(url);
    res.headers.set("x-space-id", space.id);
    res.headers.set("x-space-subdomain", subdomain);
    res.headers.set("x-space-is-private", String(space.isPrivate));

    return res;
  } catch (error) {
    console.error("[Middleware] Error looking up space:", error);
    return NextResponse.next();
  }
};

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - api routes (except lookup)
     * - static files
     * - _next
     * - favicon
     */
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|og).*)",
  ],
};
