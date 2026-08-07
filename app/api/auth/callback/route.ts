import { NextResponse } from 'next/server';
import { getFortyTwoOAuthConfig } from '@/lib/config';
import { setSession, verifyOAuthState } from '@/lib/session';

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

function redirectWithError(request: Request, error: string) {
  return NextResponse.redirect(
    new URL('/?error=' + encodeURIComponent(error), request.url),
  );
}

export async function GET(request: Request) {
  const config = getFortyTwoOAuthConfig();
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const providerError = url.searchParams.get('error');

  if (providerError) {
    return redirectWithError(request, 'access_denied');
  }

  if (!config) {
    return redirectWithError(request, 'missing_config');
  }

  if (!code || !state || !(await verifyOAuthState(state))) {
    return redirectWithError(request, 'invalid_state');
  }

  const tokenResponse = await fetch(
    'https://api.intra.42.fr/oauth/token',
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
        state,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!tokenResponse.ok) {
    return redirectWithError(request, 'token_exchange');
  }

  const token = (await tokenResponse.json()) as TokenResponse;

  if (!token.access_token || !token.expires_in) {
    return redirectWithError(request, 'token_exchange');
  }

  await setSession(token.access_token, token.expires_in);
  return NextResponse.redirect(new URL('/dashboard', request.url));
}
