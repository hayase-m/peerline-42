'use client';

import type { CSSProperties } from 'react';
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/avatar';
import { getDemoPeerDetail, demoTimeline } from '@/lib/demo-data';
import type {
  CohortDashboardData,
  CohortSubmission,
  CohortTimeline,
  PeerDetail,
  PeerProject,
  PeerStatus,
  PeerSummary,
} from '@/lib/forty-two-types';
import { poolMonthLabel } from '@/lib/pool';

const statusLabels: Record<PeerStatus, string> = {
  active: '在籍中',
  frozen: 'フリーズ中',
  blackholed: 'Blackhole到達',
  ended: '本課程修了',
  'not-enrolled': '本課程未登録',
};

const projectStatusLabels: Record<string, string> = {
  in_progress: '進行中',
  finished: '完了',
  searching_a_group: 'チーム募集中',
  waiting_for_correction: '評価待ち',
  parent: '親プロジェクト',
};

type FilterValue = 'all' | 'on-campus' | PeerStatus;
type SortValue = 'level-desc' | 'level-asc' | 'login';

interface CohortDashboardProps {
  data: CohortDashboardData;
  demoMode: boolean;
}

function medianLevel(peers: PeerSummary[]): number | null {
  const levels = peers
    .flatMap((peer) => (peer.level === null ? [] : [peer.level]))
    .sort((left, right) => left - right);

  if (levels.length === 0) {
    return null;
  }

  const middle = Math.floor(levels.length / 2);

  return levels.length % 2 === 0
    ? (levels[middle - 1] + levels[middle]) / 2
    : levels[middle];
}

function formatUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatTimelineDay(value: string): string {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(value));
}

function formatTimelineTime(value: string): string {
  return new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function groupByDay(
  submissions: CohortSubmission[],
): Array<[string, CohortSubmission[]]> {
  const groups = new Map<string, CohortSubmission[]>();

  for (const submission of submissions) {
    const day = submission.markedAt.slice(0, 10);
    groups.set(day, [...(groups.get(day) ?? []), submission]);
  }

  return [...groups.entries()];
}

function projectMark(project: PeerProject): string {
  if (project.finalMark !== null) {
    return String(project.finalMark);
  }

  return '—';
}

export function CohortDashboard({
  data,
  demoMode,
}: CohortDashboardProps) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [sort, setSort] = useState<SortValue>('level-desc');
  const [selectedPeer, setSelectedPeer] = useState<PeerSummary | null>(null);
  const [detail, setDetail] = useState<PeerDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const requestSequence = useRef(0);
  const router = useRouter();
  const [isSwitchingCohort, startCohortTransition] = useTransition();
  const [timelineState, setTimelineState] = useState<{
    key: string;
    data: CohortTimeline | null;
    error: string | null;
  } | null>(null);

  const maxLevel = useMemo(
    () =>
      Math.max(
        1,
        ...data.peers.map((peer) => peer.level ?? 0),
      ),
    [data.peers],
  );
  const median = useMemo(() => medianLevel(data.peers), [data.peers]);
  const onCampusCount = data.peers.filter((peer) => peer.isOnCampus).length;

  const visiblePeers = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return data.peers
      .filter((peer) => {
        const matchesQuery =
          normalizedQuery.length === 0 ||
          peer.login.toLowerCase().includes(normalizedQuery) ||
          peer.name.toLowerCase().includes(normalizedQuery);
        const matchesFilter =
          filter === 'all' ||
          (filter === 'on-campus'
            ? peer.isOnCampus
            : peer.status === filter);

        return matchesQuery && matchesFilter;
      })
      .sort((left, right) => {
        if (sort === 'login') {
          return left.login.localeCompare(right.login);
        }

        const leftLevel = left.level ?? -1;
        const rightLevel = right.level ?? -1;
        return sort === 'level-desc'
          ? rightLevel - leftLevel
          : leftLevel - rightLevel;
      });
  }, [data.peers, deferredQuery, filter, sort]);

  const poolYear = data.cohort.poolYear;
  const poolMonthValue = data.cohort.poolMonth;
  const timelineKey = poolYear + ':' + poolMonthValue;

  // 一覧の表示を待たせないよう、提出履歴は描画後に取得する。
  useEffect(() => {
    if (demoMode) {
      return;
    }

    const controller = new AbortController();
    const [year, month] = timelineKey.split(':');

    fetch(
      '/api/timeline?year=' +
        encodeURIComponent(year) +
        '&month=' +
        encodeURIComponent(month),
      { signal: controller.signal },
    )
      .then(async (response) => {
        const body = (await response.json()) as
          | CohortTimeline
          | { message?: string };

        if (!response.ok) {
          throw new Error(
            'message' in body && body.message
              ? body.message
              : '提出履歴を取得できませんでした。',
          );
        }

        setTimelineState({
          key: timelineKey,
          data: body as CohortTimeline,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

        setTimelineState({
          key: timelineKey,
          data: null,
          error:
            error instanceof Error
              ? error.message
              : '提出履歴を取得できませんでした。',
        });
      });

    return () => controller.abort();
  }, [demoMode, timelineKey]);

  const isTimelineReady =
    demoMode || timelineState?.key === timelineKey;
  const timeline = demoMode
    ? demoTimeline
    : isTimelineReady
      ? (timelineState?.data ?? null)
      : null;
  const timelineError = isTimelineReady
    ? (timelineState?.error ?? null)
    : null;
  const isLoadingTimeline = !isTimelineReady;

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSelectedPeer(null);
      }
    }

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  async function openPeer(peer: PeerSummary) {
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    setSelectedPeer(peer);
    setDetail(null);
    setDetailError(null);
    setIsLoadingDetail(true);

    if (demoMode) {
      setDetail(getDemoPeerDetail(peer.login));
      setIsLoadingDetail(false);
      return;
    }

    try {
      const cursusQuery =
        data.cohort.cursusId === null
          ? ''
          : '?cursusId=' + data.cohort.cursusId;
      const response = await fetch(
        '/api/peers/' + encodeURIComponent(peer.login) + cursusQuery,
      );
      const body = (await response.json()) as
        | PeerDetail
        | { message?: string };

      if (!response.ok) {
        throw new Error(
          'message' in body && body.message
            ? body.message
            : 'プロジェクト情報を取得できませんでした。',
        );
      }

      if (requestSequence.current === sequence) {
        setDetail(body as PeerDetail);
      }
    } catch (error) {
      if (requestSequence.current === sequence) {
        setDetailError(
          error instanceof Error
            ? error.message
            : 'プロジェクト情報を取得できませんでした。',
        );
      }
    } finally {
      if (requestSequence.current === sequence) {
        setIsLoadingDetail(false);
      }
    }
  }

  function closeDetail() {
    requestSequence.current += 1;
    setSelectedPeer(null);
    setDetail(null);
  }

  function openCohort(
    poolYear: string,
    poolMonth: string,
    refresh = false,
  ) {
    const query = new URLSearchParams({
      year: poolYear,
      month: poolMonth,
    });

    if (demoMode) {
      query.set('demo', '1');
    }

    if (refresh) {
      query.set('refresh', '1');
    }

    closeDetail();
    startCohortTransition(() => {
      router.push('/dashboard?' + query.toString());
      router.refresh();
    });
  }

  function refreshCohort() {
    openCohort(data.cohort.poolYear, data.cohort.poolMonth, true);
  }

  const poolMonth = poolMonthLabel(data.cohort.poolMonth);
  const monthOptions = data.cohort.monthOptions.some(
    (option) => option.month === data.cohort.poolMonth,
  )
    ? data.cohort.monthOptions
    : [
        { month: data.cohort.poolMonth, count: data.peers.length },
        ...data.cohort.monthOptions,
      ];
  const isViewerCohort =
    data.cohort.poolYear === data.cohort.viewerPoolYear &&
    data.cohort.poolMonth === data.cohort.viewerPoolMonth;

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <Link className="brand" href="/" aria-label="Peerline home">
          <span className="brand-mark">P/42</span>
          <span>Peerline</span>
        </Link>
        <div className="viewer">
          {demoMode ? <span className="demo-chip">DEMO DATA</span> : null}
          <div className="viewer-copy">
            <strong>{data.viewer.login}</strong>
            <span>{data.viewer.name}</span>
          </div>
          <Avatar
            image={data.viewer.image}
            name={data.viewer.name}
            size="small"
          />
          {demoMode ? (
            <Link className="text-button" href="/">
              デモを閉じる
            </Link>
          ) : (
            <form action="/api/auth/logout" method="post">
              <button className="text-button" type="submit">
                切断
              </button>
            </form>
          )}
        </div>
      </header>

      <section className="dashboard-intro">
        <div>
          <p className="section-label">Piscine同期</p>
          <h1>
            {data.cohort.poolYear}年{poolMonth}
          </h1>
          <p className="cohort-caption">
            {data.cohort.campusName}キャンパスのPiscine同期
            {isViewerCohort ? null : (
              <span className="cohort-note">自分の期以外を表示中</span>
            )}
          </p>
        </div>

        <div className="cohort-stats" aria-label="同期の概要">
          <div>
            <span>PEERS</span>
            <strong>{data.peers.length}</strong>
          </div>
          <div>
            <span>ON CAMPUS</span>
            <strong>{onCampusCount}</strong>
          </div>
          <div>
            <span>MEDIAN LV.</span>
            <strong>{median?.toFixed(2) ?? '—'}</strong>
          </div>
        </div>
      </section>

      <section
        className={
          isSwitchingCohort ? 'cohort-board is-loading' : 'cohort-board'
        }
      >
        <div className="board-toolbar">
          <div className="cohort-switch" aria-label="表示するPiscine">
            <label className="select-field cohort-year">
              <span className="sr-only">Piscineの年</span>
              <select
                value={data.cohort.poolYear}
                disabled={isSwitchingCohort}
                onChange={(event) =>
                  openCohort(event.target.value, data.cohort.poolMonth)
                }
              >
                {data.cohort.yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>

            <label className="select-field cohort-month">
              <span className="sr-only">Piscineの月</span>
              <select
                value={data.cohort.poolMonth}
                disabled={isSwitchingCohort}
                onChange={(event) =>
                  openCohort(data.cohort.poolYear, event.target.value)
                }
              >
                {monthOptions.map((option) => (
                  <option key={option.month} value={option.month}>
                    {poolMonthLabel(option.month)}（{option.count}）
                  </option>
                ))}
              </select>
            </label>

            {isViewerCohort ? null : (
              <button
                className="cohort-reset"
                type="button"
                disabled={isSwitchingCohort}
                onClick={() =>
                  openCohort(
                    data.cohort.viewerPoolYear,
                    data.cohort.viewerPoolMonth,
                  )
                }
              >
                自分の期
              </button>
            )}
          </div>

          <label className="search-field">
            <span className="sr-only">名前またはloginで検索</span>
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="名前またはloginで検索"
            />
          </label>

          <label className="select-field">
            <span className="sr-only">表示する状態</span>
            <select
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value as FilterValue)
              }
            >
              <option value="all">すべての状態</option>
              <option value="on-campus">キャンパス内</option>
              <option value="active">在籍中</option>
              <option value="frozen">フリーズ中</option>
              <option value="blackholed">Blackhole到達</option>
              <option value="ended">本課程修了</option>
              <option value="not-enrolled">本課程未登録</option>
            </select>
          </label>

          <label className="select-field">
            <span className="sr-only">並び順</span>
            <select
              value={sort}
              onChange={(event) =>
                setSort(event.target.value as SortValue)
              }
            >
              <option value="level-desc">levelが高い順</option>
              <option value="level-asc">levelが低い順</option>
              <option value="login">login順</option>
            </select>
          </label>
        </div>

        <div className="peer-list-heading" aria-hidden="true">
          <span>PEER</span>
          <span>PROGRESS</span>
          <span>STATUS</span>
          <span>LEVEL</span>
          <span />
        </div>

        <div className="peer-list">
          {visiblePeers.map((peer, index) => {
            const progress =
              peer.level === null ? 0 : (peer.level / maxLevel) * 100;
            const style = {
              '--peer-progress': progress + '%',
              '--peer-delay': Math.min(index, 12) * 24 + 'ms',
            } as CSSProperties;

            return (
              <button
                className="peer-row"
                key={peer.id}
                onClick={() => openPeer(peer)}
                style={style}
                type="button"
              >
                <span className="peer-identity">
                  <Avatar image={peer.image} name={peer.name} />
                  <span>
                    <strong>{peer.login}</strong>
                    <small>{peer.name}</small>
                  </span>
                </span>
                <span className="peer-lane" aria-hidden="true">
                  <i />
                </span>
                <span className={'status-pill status-' + peer.status}>
                  {statusLabels[peer.status]}
                </span>
                <span className="level-cell">
                  <strong>
                    {peer.level === null ? '—' : peer.level.toFixed(2)}
                  </strong>
                  <small>{peer.grade ?? 'NO CURSUS'}</small>
                </span>
                <span className="presence-cell">
                  <i
                    className={
                      peer.isOnCampus
                        ? 'presence-dot is-online'
                        : 'presence-dot'
                    }
                  />
                  {peer.isOnCampus ? 'campus内' : 'off campus'}
                  <b aria-hidden="true">↗</b>
                </span>
              </button>
            );
          })}
        </div>

        {visiblePeers.length === 0 ? (
          <div className="empty-state">
            <strong>
              {data.peers.length === 0
                ? 'この期の同期が見つかりません'
                : '一致する同期がいません'}
            </strong>
            <p>
              {data.peers.length === 0
                ? 'Piscineの年月を変更してください。'
                : '検索語または表示する状態を変更してください。'}
            </p>
          </div>
        ) : null}

        <footer className="board-footer">
          <span>
            {isSwitchingCohort
              ? '読み込み中'
              : visiblePeers.length + '人を表示'}
          </span>
          <span>
            更新 {formatUpdatedAt(data.generatedAt)}
            {demoMode ? null : (
              <button
                className="refresh-button"
                type="button"
                disabled={isSwitchingCohort}
                onClick={() => refreshCohort()}
              >
                再取得
              </button>
            )}
          </span>
        </footer>
      </section>

      <section className="timeline-board">
        <div className="timeline-heading">
          <div>
            <p className="section-label">Recent submissions</p>
            <h2>最近の提出</h2>
          </div>
          <span>直近30日・採点済み</span>
        </div>

        {isLoadingTimeline ? (
          <div className="project-loading" aria-live="polite">
            <i />
            <span>提出履歴を取得中</span>
          </div>
        ) : null}

        {timelineError ? (
          <p className="detail-error" role="alert">
            {timelineError}
          </p>
        ) : null}

        {timeline && timeline.submissions.length === 0 ? (
          <div className="empty-state">
            <strong>直近30日の提出はありません</strong>
            <p>別の期を選ぶと、その期の提出履歴を表示します。</p>
          </div>
        ) : null}

        {timeline
          ? groupByDay(timeline.submissions).map(([day, items]) => (
              <div className="timeline-day" key={day}>
                <h3>{formatTimelineDay(items[0].markedAt)}</h3>
                {items.map((item) => {
                  const peer = data.peers.find(
                    (candidate) => candidate.login === item.login,
                  );

                  return (
                    <button
                      className="timeline-row"
                      key={item.id}
                      type="button"
                      onClick={() => (peer ? openPeer(peer) : undefined)}
                    >
                      <span className="timeline-time">
                        {formatTimelineTime(item.markedAt)}
                      </span>
                      <span className="timeline-identity">
                        <Avatar image={item.image} name={item.name} />
                        <span>
                          <strong>{item.login}</strong>
                          <small>{item.project}</small>
                        </span>
                      </span>
                      <span
                        className={
                          item.validated === false
                            ? 'timeline-mark is-failed'
                            : 'timeline-mark'
                        }
                      >
                        {item.finalMark === null ? '—' : item.finalMark}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          : null}
      </section>

      {selectedPeer ? (
        <>
          <button
            className="drawer-backdrop"
            type="button"
            aria-label="詳細を閉じる"
            onClick={closeDetail}
          />
          <aside
            className="peer-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="peer-detail-title"
          >
            <button
              className="drawer-close"
              type="button"
              onClick={closeDetail}
              aria-label="詳細を閉じる"
            >
              ×
            </button>
            <div className="drawer-profile">
              <Avatar
                image={selectedPeer.image}
                name={selectedPeer.name}
                size="large"
              />
              <div>
                <p className="eyebrow">Peer detail</p>
                <h2 id="peer-detail-title">{selectedPeer.login}</h2>
                <p>{selectedPeer.name}</p>
                <a
                  className="intra-profile-link"
                  href={
                    'https://profile.intra.42.fr/users/' +
                    encodeURIComponent(selectedPeer.login)
                  }
                  rel="noreferrer"
                  target="_blank"
                >
                  42プロフィールを開く
                  <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>

            <div className="drawer-summary">
              <div>
                <span>LEVEL</span>
                <strong>
                  {selectedPeer.level?.toFixed(2) ?? '—'}
                </strong>
              </div>
              <div>
                <span>STATUS</span>
                <strong>{statusLabels[selectedPeer.status]}</strong>
              </div>
              <div>
                <span>LOCATION</span>
                <strong>
                  {selectedPeer.isOnCampus ? 'キャンパス内' : 'キャンパス外'}
                </strong>
              </div>
            </div>

            <div className="project-section">
              <div className="project-heading">
                <h3>プロジェクト</h3>
                {detail ? <span>{detail.projects.length}</span> : null}
              </div>

              {isLoadingDetail ? (
                <div className="project-loading" aria-live="polite">
                  <i />
                  <span>プロジェクトを取得中</span>
                </div>
              ) : null}

              {detailError ? (
                <p className="detail-error" role="alert">
                  {detailError}
                </p>
              ) : null}

              {detail && detail.projects.length === 0 ? (
                <div className="drawer-empty">
                  表示できるプロジェクトはありません。
                </div>
              ) : null}

              {detail?.projects.map((project) => (
                <div className="project-row" key={project.id}>
                  <span
                    className={
                      project.status === 'in_progress'
                        ? 'project-state is-current'
                        : 'project-state'
                    }
                  />
                  <div>
                    <strong>{project.name}</strong>
                    <span>
                      {projectStatusLabels[project.status] ??
                        project.status.replaceAll('_', ' ')}
                    </span>
                  </div>
                  <b
                    className={
                      project.validated === false ? 'is-failed' : undefined
                    }
                  >
                    {projectMark(project)}
                  </b>
                </div>
              ))}
            </div>
          </aside>
        </>
      ) : null}
    </main>
  );
}
