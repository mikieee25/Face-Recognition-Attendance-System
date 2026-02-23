import { NextRequest, NextResponse } from "next/server";

const KIOSK_ALLOWED_PATHS = ["/kiosk"];

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    // Base64url decode the payload segment
    const payload = parts[1];
    // Pad to a multiple of 4 characters
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    // Replace base64url chars with standard base64
    const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(base64);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get("access_token")?.value;
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === "/login";

  // No token and not on login page → redirect to /login
  if (!token && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Token exists and on login page → redirect based on role
  if (token && isLoginPage) {
    const payload = decodeJwtPayload(token);
    const role = payload?.role as string | undefined;
    if (role === "kiosk") {
      return NextResponse.redirect(new URL("/kiosk", request.url));
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Token exists and NOT on login page → check kiosk role
  if (token && !isLoginPage) {
    const payload = decodeJwtPayload(token);
    const role = payload?.role as string | undefined;

    if (
      role === "kiosk" &&
      !KIOSK_ALLOWED_PATHS.some((p) => pathname.startsWith(p))
    ) {
      return NextResponse.redirect(new URL("/kiosk", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
