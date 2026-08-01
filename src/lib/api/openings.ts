import { API_BASE_URL } from '@/config/env';
import { api } from './client';

/**
 * Public hiring API — internship openings and applications.
 *
 * Two ways in, on purpose:
 *   - `fetchOpenings*` run on the SERVER (no token, no client bundle) so the
 *     listing pages are real HTML for crawlers and shareable links.
 *   - `applyToOpening` / `getMyApplications` run in the browser through the
 *     authed `api` client, because applying requires a TalkDrill account.
 */

export type LocationType = 'wfh' | 'onsite' | 'hybrid';
export type StipendKind = 'range' | 'fixed' | 'performance' | 'unpaid';
export type ApplicationStatus =
  | 'submitted'
  | 'shortlisted'
  | 'interviewing'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  /** Registered interest in a role whose deadline had passed. */
  | 'waitlisted';

/**
 * `application` = a live submission. `interest` = a waitlist entry captured
 * after the deadline, so the team can come back when the role reopens. The
 * server decides this from the opening's state; the client never sends it.
 */
export type SubmissionKind = 'application' | 'interest';

export interface MoneyRange {
  min?: number;
  max?: number;
}

export interface Stipend {
  kind: StipendKind;
  currency?: string;
  period?: 'month' | 'week' | 'total';
  min?: number;
  max?: number;
  fixedPay?: MoneyRange;
  incentivePay?: MoneyRange;
  note?: string;
}

export interface OpeningSection {
  heading: string;
  body?: string;
  bullets?: string[];
}

export interface OpeningQuestion {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'url' | 'select';
  options?: string[];
  required?: boolean;
  maxLength?: number;
  helperText?: string;
}

export interface OpeningCard {
  _id?: string;
  slug: string;
  title: string;
  category?: string;
  track?: 'campus' | 'content' | 'marketing' | null;
  locationType: LocationType;
  city?: string;
  employmentTypes?: string[];
  duration?: string;
  startsImmediately?: boolean;
  startDate?: string;
  applyBy?: string;
  postedAt?: string;
  stipend: Stipend;
  jobOffer?: { available?: boolean; min?: number; max?: number; currency?: string };
  openings?: number;
  skills?: string[];
  perks?: string[];
  activelyHiring?: boolean;
  isOpen: boolean;
}

export interface Opening extends OpeningCard {
  startWindow?: { from?: string; to?: string };
  about?: string;
  responsibilities?: string[];
  whoCanApply?: string[];
  otherRequirements?: string[];
  womenRestartWelcome?: boolean;
  sections?: OpeningSection[];
  questions?: OpeningQuestion[];
  seo?: { metaTitle?: string; metaDescription?: string };
}

export interface MyApplicationSummary {
  status: ApplicationStatus;
  appliedAt: string;
  decisionNote?: string | null;
  kind?: SubmissionKind;
}

export interface MyApplication {
  _id: string;
  kind?: SubmissionKind;
  status: ApplicationStatus;
  appliedAt: string;
  decidedAt?: string | null;
  decisionNote?: string | null;
  fullName: string;
  email: string;
  phone?: string | null;
  city?: string | null;
  college?: string | null;
  opening: {
    slug: string;
    title: string;
    category?: string | null;
    locationType: LocationType;
    duration?: string;
    stipend: Stipend;
  } | null;
}

/* ------------------------------------------------------------ SERVER READS */

interface Envelope<T> {
  message: string;
  variant: string;
  myData?: T;
}

/**
 * Server-side fetch. Revalidates every 5 minutes so a newly published opening
 * appears without a redeploy, while crawlers and repeat visitors still get a
 * cached, fast page.
 */
async function serverGet<T>(path: string, revalidate = 300): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1${path}`, {
      // A browser-ish UA: the backend's bot shield blocks unknown agents, and
      // Next's default fetch UA is exactly that.
      headers: { Accept: 'application/json', 'User-Agent': 'TalkDrill-Internship-SSR' },
      next: { revalidate },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Envelope<T>;
    if (json.variant === 'error') return null;
    return json.myData ?? null;
  } catch {
    // A listing page must still render its shell if the API is briefly down.
    return null;
  }
}

export async function fetchOpenings(): Promise<OpeningCard[]> {
  const data = await serverGet<{ openings: OpeningCard[] }>('/internship/public/openings');
  return data?.openings ?? [];
}

export async function fetchOpening(slug: string): Promise<Opening | null> {
  const data = await serverGet<{ opening: Opening }>(
    `/internship/public/openings/${encodeURIComponent(slug)}`
  );
  return data?.opening ?? null;
}

export async function fetchOpeningSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  const data = await serverGet<{ slugs: { slug: string; updatedAt: string }[] }>(
    '/internship/public/openings-index'
  );
  return data?.slugs ?? [];
}

/* ------------------------------------------------------- CLIENT (authed) */

/** Browser-side read of one opening, including this viewer's application state. */
export async function getOpeningWithMine(
  slug: string
): Promise<{ opening: Opening; myApplication: MyApplicationSummary | null }> {
  const res = await api<{ opening: Opening; myApplication: MyApplicationSummary | null }>(
    `/internship/public/openings/${encodeURIComponent(slug)}`
  );
  return res.myData!;
}

export interface ApplyPayload {
  slug: string;
  fullName: string;
  phone?: string;
  city?: string;
  college?: string;
  graduationYear?: number;
  /** Required for a live role; optional when registering interest in a closed one. */
  pitch?: string;
  answers?: Record<string, string>;
  resumeUrl?: string;
  portfolioUrl?: string;
  socialHandles?: { instagram?: string; youtube?: string; linkedin?: string; other?: string };
  availableFrom?: string;
  confirmsDuration: boolean;
}

/** Copy differs entirely between applying and joining a waitlist. */
export const SUBMISSION_STATUS_LABEL: Record<
  ApplicationStatus,
  { label: string; color: 'info' | 'warning' | 'success' | 'error' | 'default' }
> = {
  submitted: { label: 'Under review', color: 'info' },
  shortlisted: { label: 'Shortlisted', color: 'warning' },
  interviewing: { label: 'Interviewing', color: 'warning' },
  accepted: { label: 'Accepted', color: 'success' },
  rejected: { label: 'Not selected', color: 'error' },
  withdrawn: { label: 'Withdrawn', color: 'default' },
  waitlisted: { label: 'On the waitlist', color: 'default' },
};

export async function applyToOpening(payload: ApplyPayload): Promise<MyApplication> {
  const res = await api<{ application: MyApplication }>('/internship/applications', {
    method: 'POST',
    body: payload,
  });
  return res.myData!.application;
}

export async function getMyApplications(): Promise<MyApplication[]> {
  const res = await api<{ applications: MyApplication[] }>('/internship/applications/mine');
  return res.myData?.applications ?? [];
}

export async function withdrawApplication(id: string): Promise<void> {
  await api(`/internship/applications/${id}/withdraw`, { method: 'POST' });
}

/* ---------------------------------------------------------------- FORMAT */

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** "₹6,000 - 11,000 /month" · "₹2,000 /month" · "Performance based" */
export function formatStipend(s?: Stipend): string {
  if (!s) return 'Unpaid';
  if (s.kind === 'performance') return 'Performance based';
  if (s.kind === 'unpaid') return 'Unpaid';
  const per = s.period === 'week' ? '/week' : s.period === 'total' ? ' total' : '/month';
  if (s.kind === 'fixed' || s.max === undefined || s.max === s.min) {
    return s.min === undefined ? 'Unpaid' : `${inr(s.min)} ${per}`;
  }
  return `${inr(s.min ?? 0)} - ${(s.max ?? 0).toLocaleString('en-IN')} ${per}`;
}

export const LOCATION_LABEL: Record<LocationType, string> = {
  wfh: 'Work from home',
  onsite: 'In office',
  hybrid: 'Hybrid',
};

/** "26 Mar '26" — matches how the listings themselves are written. */
export function formatListingDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}

/** "Posted 3 weeks ago" */
export function relativeFromNow(iso?: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}
