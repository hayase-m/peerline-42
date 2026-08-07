import Link from 'next/link';
import { getFortyTwoOAuthConfig } from '@/lib/config';
import { readSession } from '@/lib/session';

const errorMessages: Record<string, string> = {
  missing_config:
    '42 APIの認証情報が未設定です。下の手順で.env.localを設定してください。',
  access_denied: '42アカウントとの接続がキャンセルされました。',
  invalid_state: '認証の有効期限が切れました。もう一度接続してください。',
  token_exchange:
    '42 APIとの認証を完了できませんでした。Client IDとRedirect URIを確認してください。',
  session: 'セッションの有効期限が切れました。もう一度接続してください。',
};

interface HomeProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const [{ error }, session] = await Promise.all([
    searchParams,
    readSession(),
  ]);
  const isConfigured = getFortyTwoOAuthConfig() !== null;
  const errorMessage = error ? errorMessages[error] : null;
  const connectionStatus = session
    ? '接続済み'
    : isConfigured
      ? '設定済み'
      : '未設定';

  return (
    <main className="home-shell">
      <header className="home-header">
        <Link className="brand" href="/" aria-label="Peerline home">
          <span className="brand-mark">P/42</span>
          <span>Peerline</span>
        </Link>
        <span className="local-chip">local</span>
      </header>

      <div className="home-content">
        <section className="home-overview">
          <div>
            <h1>42同期ダッシュボード</h1>
            <p>
              Piscine年月が同じユーザーのlevel、プロジェクト、
              在籍状態、キャンパス内状況を確認します。
            </p>
          </div>
          <div className="home-actions">
            {session ? (
              <Link className="button button-primary" href="/dashboard">
                ダッシュボードを開く
              </Link>
            ) : (
              <Link
                className="button button-primary"
                href={isConfigured ? '/api/auth/login' : '#setup'}
              >
                {isConfigured ? '42アカウントを接続' : '設定手順を見る'}
              </Link>
            )}
            <Link className="button button-ghost" href="/dashboard?demo=1">
              デモを見る
            </Link>
          </div>
        </section>

        {errorMessage ? (
          <p className="inline-alert" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <section className="connection-panel" id="setup">
          <header>
            <div>
              <h2>42 API接続</h2>
              <p>
                認証情報はローカルに置き、Client Secretは
                ブラウザへ渡しません。
              </p>
            </div>
            <span
              className={
                connectionStatus === '未設定'
                  ? 'connection-status is-unset'
                  : 'connection-status'
              }
            >
              {connectionStatus}
            </span>
          </header>

          {!isConfigured ? (
            <ol className="connection-steps">
              <li>
                <span>1</span>
                <div>
                  <strong>42 APIアプリを登録</strong>
                  <a
                    href="https://profile.intra.42.fr/oauth/applications/new"
                    target="_blank"
                    rel="noreferrer"
                  >
                    登録画面を開く ↗
                  </a>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>Redirect URIを設定</strong>
                  <code>http://localhost:3002/api/auth/callback</code>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>.env.localに認証情報を入力</strong>
                  <p>
                    FORTYTWO_CLIENT_ID、FORTYTWO_CLIENT_SECRET、
                    SESSION_SECRETを設定して再起動します。
                  </p>
                </div>
              </li>
            </ol>
          ) : (
            <div className="connection-ready">
              <span className="presence-dot is-online" />
              OAuth接続を開始できます。
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
