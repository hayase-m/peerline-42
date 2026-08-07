# Peerline

Piscineの年月が同じ42ユーザーについて、次の情報をローカルで確認するWebアプリです。

- 42cursusのlevelとgrade
- 在籍状態（在籍中／フリーズ中／Blackhole到達／本課程修了／本課程未登録）
- 現在キャンパス内にいるか
- プロジェクトの進行状態と評価
- 42プロフィールへのリンク
- Piscineの年月の切り替え（自分の期以外も閲覧できる）

対象は自分のprimaryキャンパスの学生です。

## 在籍状態の判定

42 APIはフリーズ状態を公開しておらず、`blackholed_at` も更新が遅れることがあるため、次の順で判定しています。

1. 42cursusに未登録 → 本課程未登録
2. `alumni?` → 本課程修了
3. `end_at` あり → Blackhole到達（`blackholed_at` がなければ本課程修了）
4. `active? = false` → フリーズ中
5. `blackholed_at` が過去で、かつ最終活動から180日以上経過 → Blackhole到達
6. それ以外 → 在籍中

## 必要なもの

- Node.js 22以上
- 42アカウント
- 42 API v2アプリ

## 42 APIアプリの登録

1. [42 APIアプリ登録画面](https://profile.intra.42.fr/oauth/applications/new)を開きます。
2. アプリ名に `Peerline local` など識別できる名前を指定します。
3. Redirect URIに次を指定します。

   ```text
   http://localhost:3002/api/auth/callback
   ```

4. scopeは `public` のみで動作します。
5. 作成後に表示されるUIDとSECRETを控えます。SECRETは共有しないでください。

## ローカル設定

```bash
npm install
cp .env.example .env.local
openssl rand -hex 32
```

`.env.local` を編集します。

```dotenv
FORTYTWO_CLIENT_ID=42 APIアプリのUID
FORTYTWO_CLIENT_SECRET=42 APIアプリのSECRET
FORTYTWO_REDIRECT_URI=http://localhost:3002/api/auth/callback
SESSION_SECRET=opensslで生成した文字列
```

## 起動

```bash
npm run dev
```

[http://localhost:3002](http://localhost:3002)を開き、42アカウントを接続します。

認証情報を設定する前でも、トップページの「デモを見る」から画面を確認できます。

開発サーバーと本番サーバーはいずれも `127.0.0.1` だけで待ち受けます。同じネットワーク上の別端末からはアクセスできません。

## 自動起動

`launchd/jp.hayase.peerline42.plist` を `~/Library/LaunchAgents` に登録すると、Macへのログイン後に本番サーバーが自動起動します。ソースを変更した場合は、ビルド後にサービスを再起動します。

```bash
npm run build
launchctl kickstart -k gui/$(id -u)/jp.hayase.peerline42
```

状態は次のコマンドで確認できます。

```bash
launchctl print gui/$(id -u)/jp.hayase.peerline42
```

## 確認コマンド

```bash
npm run lint
npm run typecheck
npm run build
```

## 取得とキャッシュ

42 APIはリクエスト間隔を0.5秒以上あける必要があり、1レスポンスにも数秒かかります。そのため次の方針で取得しています。

- 同時実行は2まで、リクエスト間隔は600ms（それ以上はスパム判定で429になる）
- 1ページ目の `X-Total` から総ページ数を求め、残りのページは並列に取得する
- 年単位の一覧は15分、cursus情報は5分キャッシュする。月の切り替えはキャッシュから表示する
- 画面右下の「再取得」でキャッシュを破棄して取り直す

## データの扱い

- Client Secretとアクセストークンはブラウザへ渡しません。
- アクセストークンは暗号化したHTTP-only Cookieに保存します。
- 42 APIから取得したメールアドレス、電話番号、wallet、端末名は画面やAPI応答に含めません。
- キャンパス状況は端末名を表示せず、キャンパス内／外だけを表示します。
- アプリ独自のデータベースや外部サービスには保存しません。
