import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

// Refreshes the Supabase auth session cookies for /admin requests so admin
// sessions don't silently expire after ~1h (the access token TTL). Without
// this, cookies are only ever read, never rewritten with refreshed tokens.
async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not remove: triggers a token refresh (and cookie rewrite via setAll)
  // when the access token is close to expiry.
  await supabase.auth.getUser();

  return response;
}

export default async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin')) {
    return updateSession(request);
  }
  return intlMiddleware(request);
}

export const config = {
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
