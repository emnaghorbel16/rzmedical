import { NextRequest, NextResponse } from 'next/server';

const BLOCKED_ORIGINS = ['gcdigital.es'];
const BLOCKED_REFERERS = ['gcdigital.es'];

export function middleware(req: NextRequest) {
  const origin = req.headers.get('origin') || '';
  const referer = req.headers.get('referer') || '';
  const host = req.headers.get('host') || '';

  const isBlocked =
    BLOCKED_ORIGINS.some((b) => origin.includes(b)) ||
    BLOCKED_REFERERS.some((b) => referer.includes(b)) ||
    BLOCKED_ORIGINS.some((b) => host.includes(b));

  if (isBlocked) {
    return new NextResponse(JSON.stringify({ error: 'Access denied.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return NextResponse.next();
}

export const config = {
  // Protège toutes les routes y compris les API routes Next.js
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
