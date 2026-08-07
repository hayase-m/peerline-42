import '@fontsource-variable/noto-sans-jp';
import '@fontsource-variable/space-grotesk';
import '@/app/globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Peerline — 42 cohort dashboard',
  description: 'Piscine同期の進捗とキャンパス状況を確認するローカルダッシュボード',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
