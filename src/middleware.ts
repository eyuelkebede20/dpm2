import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/') {
    const sessionCookie =
      request.cookies.get('dpm_session') ||
      request.cookies.get('dpm.session_token') ||
      request.cookies.get('better-auth.session_token');

    if (sessionCookie?.value) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js).*)',
  ],
};
