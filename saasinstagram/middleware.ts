import { NextRequest, NextResponse } from 'next/server';
import {
  checkRateLimit,
  getClientIp,
  AUTH_RATE_LIMIT,
  API_RATE_LIMIT,
  AI_RATE_LIMIT,
  WEBHOOK_RATE_LIMIT,
} from '@/lib/security/rateLimit';

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/privacy-policy',
  '/terms-of-service',
  '/data-deletion',
  '/api/webhooks',
  '/api/stripe/webhook',
  '/api/meta/callback',
  '/_next',
  '/favicon.ico',
  '/logo.png',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

/** Security headers applied to every response */
function applySecurityHeaders(response: NextResponse): NextResponse {
  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');
  // Prevent MIME sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');
  // Force HTTPS
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Permissions policy
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // XSS protection (legacy browsers)
  response.headers.set('X-XSS-Protection', '1; mode=block');
  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://connect.facebook.net https://apis.google.com https://accounts.google.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://graph.facebook.com https://*.fbcdn.net https://*.cdninstagram.com https://lh3.googleusercontent.com https://lh4.googleusercontent.com https://lh5.googleusercontent.com https://lh6.googleusercontent.com https://*.googleusercontent.com",
      "connect-src 'self' https://*.firebaseapp.com https://*.googleapis.com https://api.stripe.com https://graph.facebook.com wss://*.firebaseio.com https://accounts.google.com https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.us.sentry.io",
      "frame-src https://js.stripe.com https://www.facebook.com https://accounts.google.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );
  return response;
}

function rateLimitResponse(result: ReturnType<typeof checkRateLimit>): NextResponse {
  const res = NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    { status: 429 }
  );
  res.headers.set('X-RateLimit-Limit', String(result.limit));
  res.headers.set('X-RateLimit-Remaining', String(result.remaining));
  res.headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));
  res.headers.set('Retry-After', String(Math.ceil((result.resetAt - Date.now()) / 1000)));
  return applySecurityHeaders(res);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIp(request);

  // ─── Rate limiting on API routes ─────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    let config = API_RATE_LIMIT;
    let bucketKey = `api:${ip}`;

    if (pathname.startsWith('/api/auth/')) {
      config = AUTH_RATE_LIMIT;
      bucketKey = `auth:${ip}`;
    } else if (pathname.startsWith('/api/webhooks/')) {
      config = WEBHOOK_RATE_LIMIT;
      bucketKey = `webhook:${ip}`;
    } else if (
      pathname.startsWith('/api/messages') ||
      pathname.startsWith('/api/conversations') ||
      pathname.startsWith('/api/ai') ||
      pathname.startsWith('/api/automations')
    ) {
      config = AI_RATE_LIMIT;
      bucketKey = `ai:${ip}`;
    }

    const result = checkRateLimit(bucketKey, config);
    if (!result.success) {
      return rateLimitResponse(result);
    }

    // Add rate limit headers to successful API responses
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', String(result.limit));
    response.headers.set('X-RateLimit-Remaining', String(result.remaining));
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));
    return applySecurityHeaders(response);
  }

  // ─── Public paths — skip auth check ──────────────────────────────────────
  if (isPublicPath(pathname) || pathname === '/') {
    return applySecurityHeaders(NextResponse.next());
  }

  // ─── Auth check for dashboard routes ─────────────────────────────────────
  const sessionCookie = request.cookies.get('session');
  if (!sessionCookie?.value) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
