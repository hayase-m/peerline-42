import { redirect } from 'next/navigation';
import { CohortDashboard } from '@/components/cohort-dashboard';
import { clearCohortCache, getCohortDashboard } from '@/lib/cohort';
import { demoDashboard } from '@/lib/demo-data';
import { FortyTwoApiError } from '@/lib/forty-two-api';
import type { CohortDashboardData } from '@/lib/forty-two-types';
import { normalizePoolMonth, normalizePoolYear } from '@/lib/pool';
import { readSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

interface DashboardPageProps {
  searchParams: Promise<{
    year?: string;
    month?: string;
    demo?: string;
    refresh?: string;
  }>;
}

function getDemoData(
  poolYear: string | null,
  poolMonth: string | null,
): CohortDashboardData {
  return {
    ...demoDashboard,
    cohort: {
      ...demoDashboard.cohort,
      poolYear: poolYear ?? demoDashboard.cohort.poolYear,
      poolMonth: poolMonth ?? demoDashboard.cohort.poolMonth,
    },
  };
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const params = await searchParams;
  const poolYear = normalizePoolYear(params.year);
  const poolMonth = normalizePoolMonth(params.month);
  const demoMode = params.demo === '1';

  if (demoMode) {
    return <CohortDashboard data={getDemoData(poolYear, poolMonth)} demoMode />;
  }

  const session = await readSession();

  if (!session) {
    redirect('/?error=session');
  }

  let data: CohortDashboardData | null = null;
  let errorMessage: string | null = null;

  if (params.refresh === '1') {
    clearCohortCache();
  }

  try {
    data = await getCohortDashboard(session.accessToken, {
      year: poolYear ?? undefined,
      month: poolMonth ?? undefined,
    });
  } catch (error) {
    const isUnauthorized =
      error instanceof FortyTwoApiError && error.status === 401;

    if (isUnauthorized) {
      redirect('/?error=session');
    }

    errorMessage =
      error instanceof Error
        ? error.message
        : '同期データを取得できませんでした。';
  }

  if (!data) {
    const retryQuery = new URLSearchParams();

    if (poolYear) {
      retryQuery.set('year', poolYear);
    }

    if (poolMonth) {
      retryQuery.set('month', poolMonth);
    }

    const retryHref =
      retryQuery.size === 0
        ? '/dashboard'
        : '/dashboard?' + retryQuery.toString();

    return (
      <main className="dashboard-error">
        <div className="brand">
          <span className="brand-mark">P/42</span>
          <span>Peerline</span>
        </div>
        <div className="error-panel">
          <p className="eyebrow">Data unavailable</p>
          <h1>同期データを読み込めませんでした</h1>
          <p>{errorMessage}</p>
          <a className="button button-primary" href={retryHref}>
            もう一度読み込む
          </a>
        </div>
      </main>
    );
  }

  return <CohortDashboard data={data} demoMode={false} />;
}
