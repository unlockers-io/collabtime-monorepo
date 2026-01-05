import { NextResponse } from "next/server";

/**
 * Minimal middleware for path-style routing.
 * Subdomains are not supported - all routes use collabtime.io/{teamId} format.
 */
export const middleware = () => {
  return NextResponse.next();
};

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - api routes
     * - static files
     * - _next
     * - favicon
     */
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|og).*)",
  ],
};
