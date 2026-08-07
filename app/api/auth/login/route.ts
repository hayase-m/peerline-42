import { NextResponse } from 'next/server';
import { getFortyTwoOAuthConfig } from '@/lib/config';
import { createOAuthState } from '@/lib/session';

export async function GET(request: Request) {
  const config = getFortyTwoOAuthConfig();

  if (!config) {
    return NextResponse.redirect(
      new URL('/?error=missing_config', request.url),
    );
  }

  const state = await createOAuthState();
  const authorizeUrl = new URL(
    'https://api.intra.42.fr/oauth/authorize',
  );
  authorizeUrl.searchParams.set('client_id', config.clientId);
  authorizeUrl.searchParams.set('redirect_uri', config.redirectUri);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', 'public');
  authorizeUrl.searchParams.set('state', state);

  return NextResponse.redirect(authorizeUrl);
}
