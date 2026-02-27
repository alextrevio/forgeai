import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/register",
  "/docs",
  "/onboarding",
  "/sitemap.xml",
  "/icon.svg",
];

// Prefixes that are always public
const PUBLIC_PREFIXES = [
  "/_next",
  "/api",
  "/favicon",
  "/apple-touch-icon",
  "/og-image",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow all public prefixes (static assets, API, etc.)
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Allow all public routes
  if (PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.next();
  }

  // For protected routes, we can't check localStorage from middleware (server-side),
  // so we just let them through. Client-side auth guards in each page handle the redirect.
  return NextResponse.next();
}

export const config = {
  // Match all routes except static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
