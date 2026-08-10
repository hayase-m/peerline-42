import type { PoolMonthOption } from '@/lib/pool';

export interface FortyTwoImage {
  link: string | null;
  versions?: {
    large?: string | null;
    medium?: string | null;
    small?: string | null;
    micro?: string | null;
  };
}

export interface FortyTwoCampus {
  id: number;
  name: string;
  time_zone?: string;
}

export interface FortyTwoCampusUser {
  id: number;
  user_id: number;
  campus_id: number;
  is_primary: boolean;
}

export interface FortyTwoCursus {
  id: number;
  name: string;
  slug: string;
}

export interface FortyTwoUserRef {
  id: number;
  login: string;
  url?: string;
}

export interface FortyTwoCursusUser {
  id: number;
  begin_at: string | null;
  end_at: string | null;
  grade: string | null;
  level: number;
  skills?: Array<{ id: number; name: string; level: number }>;
  cursus_id: number;
  blackholed_at?: string | null;
  user: FortyTwoUserRef;
  cursus: FortyTwoCursus;
}

export interface FortyTwoProjectUser {
  id: number;
  occurrence: number;
  final_mark: number | null;
  status: string;
  'validated?'?: boolean | null;
  current_team_id?: number | null;
  project: {
    id: number;
    name: string;
    slug: string;
    parent_id?: number | null;
  };
  cursus_ids?: number[];
  created_at?: string;
  updated_at?: string;
  marked_at?: string | null;
  user?: FortyTwoUserRef;
}

export interface FortyTwoUser {
  id: number;
  login: string;
  first_name?: string;
  last_name?: string;
  usual_full_name?: string;
  usual_first_name?: string | null;
  displayname: string;
  kind?: string;
  image?: FortyTwoImage;
  image_url?: string | null;
  pool_month: string | null;
  pool_year: string | null;
  location: string | null;
  alumnized_at?: string | null;
  updated_at?: string | null;
  'alumni?'?: boolean;
  'active?'?: boolean;
  cursus_users?: FortyTwoCursusUser[];
  projects_users?: FortyTwoProjectUser[];
  campus?: FortyTwoCampus[];
  campus_users?: FortyTwoCampusUser[];
}

export type PeerStatus =
  | 'active'
  | 'frozen'
  | 'blackholed'
  | 'ended'
  | 'not-enrolled';

export interface PeerSummary {
  id: number;
  login: string;
  name: string;
  image: string | null;
  level: number | null;
  grade: string | null;
  status: PeerStatus;
  isOnCampus: boolean;
  blackholedAt: string | null;
  beginAt: string | null;
}

export interface CohortDashboardData {
  viewer: {
    login: string;
    name: string;
    image: string | null;
  };
  cohort: {
    poolMonth: string;
    poolYear: string;
    campusId: number | null;
    campusName: string;
    cursusId: number | null;
    viewerPoolMonth: string;
    viewerPoolYear: string;
    yearOptions: string[];
    monthOptions: PoolMonthOption[];
  };
  peers: PeerSummary[];
  generatedAt: string;
}

export interface CohortSubmission {
  id: number;
  login: string;
  name: string;
  image: string | null;
  project: string;
  finalMark: number | null;
  validated: boolean | null;
  markedAt: string;
}

export interface CohortTimeline {
  since: string;
  submissions: CohortSubmission[];
}

export interface PeerProject {
  id: number;
  name: string;
  status: string;
  finalMark: number | null;
  validated: boolean | null;
  updatedAt: string | null;
}

export interface PeerDetail {
  login: string;
  name: string;
  image: string | null;
  level: number | null;
  grade: string | null;
  isOnCampus: boolean;
  projects: PeerProject[];
}
