import { NextResponse, type NextRequest } from "next/server";
import { readToken, SESSION_COOKIE } from "@/lib/auth/token";

const PUBLIC_PATHS = ["/sign-in", "/api/cron"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)))
    return NextResponse.next();

  const signedIn =
    (await readToken(request.cookies.get(SESSION_COOKIE)?.value)) !== null;
  if (signedIn) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search =
    pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  const response = NextResponse.redirect(url);
  if (request.cookies.has(SESSION_COOKIE))
    response.cookies.delete(SESSION_COOKIE);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt)$).*)",
  ],
};
