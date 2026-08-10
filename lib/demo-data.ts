import type {
  CohortDashboardData,
  CohortTimeline,
  PeerDetail,
  PeerStatus,
} from '@/lib/forty-two-types';
import { poolYearOptions } from '@/lib/pool';

const demoPeers: Array<{
  login: string;
  name: string;
  level: number | null;
  grade: string | null;
  status: PeerStatus;
  isOnCampus: boolean;
}> = [
  {
    login: 'aoki',
    name: 'Aoi Aoki',
    level: 11.42,
    grade: 'Advanced',
    status: 'active',
    isOnCampus: true,
  },
  {
    login: 'chiba',
    name: 'Kai Chiba',
    level: 9.86,
    grade: 'Cadet',
    status: 'active',
    isOnCampus: false,
  },
  {
    login: 'endo',
    name: 'Rin Endo',
    level: 8.21,
    grade: 'Cadet',
    status: 'active',
    isOnCampus: true,
  },
  {
    login: 'fujita',
    name: 'Sora Fujita',
    level: 7.74,
    grade: 'Cadet',
    status: 'active',
    isOnCampus: false,
  },
  {
    login: 'goto',
    name: 'Nao Goto',
    level: 6.93,
    grade: 'Cadet',
    status: 'active',
    isOnCampus: true,
  },
  {
    login: 'hayashi',
    name: 'Mio Hayashi',
    level: 5.68,
    grade: 'Cadet',
    status: 'active',
    isOnCampus: false,
  },
  {
    login: 'inoue',
    name: 'Yui Inoue',
    level: 4.12,
    grade: 'Cadet',
    status: 'blackholed',
    isOnCampus: false,
  },
  {
    login: 'kato',
    name: 'Ren Kato',
    level: 3.47,
    grade: 'Cadet',
    status: 'active',
    isOnCampus: true,
  },
  {
    login: 'mori',
    name: 'Haru Mori',
    level: 2.81,
    grade: 'Cadet',
    status: 'frozen',
    isOnCampus: false,
  },
  {
    login: 'noda',
    name: 'Rei Noda',
    level: null,
    grade: null,
    status: 'not-enrolled',
    isOnCampus: false,
  },
  {
    login: 'ono',
    name: 'Rui Ono',
    level: 12.08,
    grade: 'Graduate',
    status: 'ended',
    isOnCampus: false,
  },
  {
    login: 'saito',
    name: 'Jun Saito',
    level: 8.93,
    grade: 'Cadet',
    status: 'active',
    isOnCampus: true,
  },
  {
    login: 'kimura',
    name: 'Aoi Kimura',
    level: 2.14,
    grade: 'Novice',
    status: 'blackholed',
    isOnCampus: false,
  },
];

export const demoDashboard: CohortDashboardData = {
  viewer: {
    login: 'you',
    name: 'Your Name',
    image: null,
  },
  cohort: {
    poolMonth: 'september',
    poolYear: '2024',
    campusId: 26,
    campusName: 'Tokyo',
    cursusId: 21,
    viewerPoolMonth: 'september',
    viewerPoolYear: '2024',
    yearOptions: poolYearOptions('2024'),
    monthOptions: [
      { month: 'february', count: 96 },
      { month: 'september', count: 13 },
    ],
  },
  peers: demoPeers.map((peer, index) => ({
    id: index + 1,
    ...peer,
    image: null,
    blackholedAt:
      peer.status === 'blackholed' ? '2026-06-18T00:00:00.000Z' : null,
    beginAt: peer.level === null ? null : '2024-10-07T00:00:00.000Z',
  })),
  generatedAt: '2026-08-03T05:00:00.000Z',
};

const demoSubmissions: Array<[string, string, string, number]> = [
  ['saito', 'Inception', '2026-08-03T10:24:00.000Z', 100],
  ['inoue', 'CPP Module 04', '2026-08-03T07:05:00.000Z', 80],
  ['kato', 'minishell', '2026-08-02T12:40:00.000Z', 100],
  ['mori', 'Philosophers', '2026-08-02T09:10:00.000Z', 0],
  ['fujita', 'NetPractice', '2026-08-01T15:32:00.000Z', 100],
  ['chiba', 'push_swap', '2026-08-01T11:18:00.000Z', 84],
];

export const demoTimeline: CohortTimeline = {
  since: '2026-07-04T00:00:00.000Z',
  submissions: demoSubmissions.map(([login, project, markedAt, mark], index) => {
    const peer = demoDashboard.peers.find((item) => item.login === login);

    return {
      id: index + 1,
      login,
      name: peer?.name ?? login,
      image: null,
      project,
      finalMark: mark,
      validated: mark >= 80,
      markedAt,
    };
  }),
};

export function getDemoPeerDetail(login: string): PeerDetail {
  const peer = demoDashboard.peers.find((item) => item.login === login);

  return {
    login,
    name: peer?.name ?? login,
    image: null,
    level: peer?.level ?? null,
    grade: peer?.grade ?? null,
    isOnCampus: peer?.isOnCampus ?? false,
    projects: [
      {
        id: 1,
        name: 'ft_transcendence',
        status: 'in_progress',
        finalMark: null,
        validated: null,
        updatedAt: '2026-08-02T14:32:00.000Z',
      },
      {
        id: 2,
        name: 'CPP Module 09',
        status: 'finished',
        finalMark: 100,
        validated: true,
        updatedAt: '2026-07-24T11:10:00.000Z',
      },
      {
        id: 3,
        name: 'Inception',
        status: 'finished',
        finalMark: 100,
        validated: true,
        updatedAt: '2026-06-18T04:20:00.000Z',
      },
      {
        id: 4,
        name: 'webserv',
        status: 'finished',
        finalMark: 85,
        validated: true,
        updatedAt: '2026-05-29T08:45:00.000Z',
      },
    ],
  };
}
