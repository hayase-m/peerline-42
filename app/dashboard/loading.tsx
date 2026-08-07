export default function DashboardLoading() {
  return (
    <main className="dashboard-loading">
      <div className="brand">
        <span className="brand-mark">P/42</span>
        <span>Peerline</span>
      </div>
      <div className="loading-panel" aria-live="polite">
        <i className="loading-spinner" />
        <p className="eyebrow">Loading cohort</p>
        <h1>42 APIから同期データを取得中</h1>
        <p>
          初回は10秒ほどかかります。取得後は15分間キャッシュするので、
          月の切り替えはすぐに表示されます。
        </p>
      </div>
    </main>
  );
}
