export interface FortyTwoOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function getFortyTwoOAuthConfig(): FortyTwoOAuthConfig | null {
  const clientId = process.env.FORTYTWO_CLIENT_ID;
  const clientSecret = process.env.FORTYTWO_CLIENT_SECRET;
  const redirectUri =
    process.env.FORTYTWO_REDIRECT_URI ??
    'http://localhost:3002/api/auth/callback';

  if (!clientId || !clientSecret || !process.env.SESSION_SECRET) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
}
