'use client';

/**
 * Helpers shared by the admin screens only (the `_shared` folder is private to
 * the route tree — Next.js does not route underscore-prefixed directories).
 *
 * Wire shapes are NOT this file's business: src/lib/api/adminInternship.ts owns
 * them and returns exactly what each endpoint sends, so nothing here needs to
 * guess whether a payload is an array, `{items}` or `{rows}`.
 */

import type {
  EligibilityEvaluation,
  EligibilityState,
  InternProfile,
  Program,
  ProofType,
  RewardType,
  RulePeriod,
  TaskCadence,
  Track,
  VideoTier,
} from '@/lib/api/types';
import { isPopulated } from '@/lib/api/types';

/** `useAsync` holds null until the first load lands — this is the read for a list. */
export function asList<T>(value: T[] | null | undefined): T[] {
  return value ?? [];
}

// ── documents with endpoint-added extras (not in the shared types) ────────

/** GET /interns decorates each profile with its pending-review count. */
export type { AdminInternRow as InternRow } from '@/lib/api/adminInternship';

/** GET /programs decorates each program with enrolment counts. */
export interface ProgramRow extends Program {
  internCount?: number;
  activeInternCount?: number;
  templateCount?: number;
}

/** The engine returns more per rule than the shared EligibilityEvaluation type. */
export interface EvaluationRow extends EligibilityEvaluation {
  rulePeriod?: RulePeriod;
  autoGrant?: boolean;
  rewardType?: RewardType | null;
  rewardCashValue?: number;
  computedStatus?: EligibilityState;
  overridden?: boolean;
  overrideNote?: string | null;
}

// ── formatting ───────────────────────────────────────────────────────────

const IST = 'Asia/Kolkata';

export function fmtDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fmtNumber(value?: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '0';
  return value.toLocaleString('en-IN');
}

export function fmtMoney(value?: number | null): string {
  return `₹${fmtNumber(value)}`;
}

/** Current month in IST as "YYYY-MM" — matches eligibilityEngine.currentPeriod(). */
export function currentPeriod(): string {
  // en-CA renders ISO-ordered dates, so slicing is safe.
  return new Date().toLocaleDateString('en-CA', { timeZone: IST }).slice(0, 7);
}

/** Recent periods, newest first — for the period pickers. */
export function recentPeriods(count = 6): string[] {
  const now = currentPeriod();
  const [y, m] = now.split('-').map(Number);
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

/** ISO timestamp → value for an <input type="date">. */
export function toDateInput(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/** Best available human name for an intern profile, populated or not. */
export function internLabel(
  ref: string | { fullName?: string; email?: string } | null | undefined
): string {
  if (!ref) return 'Unknown intern';
  if (typeof ref === 'string') return ref;
  return ref.fullName || ref.email || 'Unknown intern';
}

/**
 * Display name of a possibly-populated ref. Takes `unknown` because the same
 * field arrives as an id string, a populated document, or absent, depending on
 * the endpoint — an un-populated ref has no name to show, hence the dash.
 */
export function nameOf(ref: unknown): string {
  if (!ref || typeof ref !== 'string') {
    if (ref && typeof ref === 'object') {
      const doc = ref as { name?: string; title?: string };
      return doc.name || doc.title || '—';
    }
    return '—';
  }
  return '—';
}

export function programNames(programIds: InternProfile['programIds'] | undefined): string {
  if (!programIds?.length) return '—';
  const named = programIds.filter(isPopulated).map((p) => p.name);
  return named.length ? named.join(', ') : `${programIds.length} program(s)`;
}

/** Comma/newline/space separated paste → clean lowercase email list. */
export function parseEmails(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\s,;]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes('@'))
    )
  );
}

// ── enum option lists (labels for selects) ───────────────────────────────

export const TRACKS: Track[] = ['campus', 'content', 'marketing'];
export const PROOF_TYPES: ProofType[] = [
  'screenshot',
  'link',
  'text',
  'username',
  'video-metric',
  'file',
];
export const CADENCES: TaskCadence[] = ['one-time', 'daily-streak', 'recurring'];
export const REWARD_TYPES: RewardType[] = [
  'cash',
  'goodie',
  'gift',
  'certificate',
  'perk',
  'coins',
];
export const RULE_PERIODS: RulePeriod[] = ['one-time', 'monthly', 'multi-month'];
export const ELIGIBILITY_STATES: EligibilityState[] = [
  'not_yet_eligible',
  'eligible',
  'earned',
  'forfeited',
];

export function titleCase(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── video tiers ──────────────────────────────────────────────────────────

/**
 * The single highest tier a view count qualifies for. Mirrors
 * videoEvaluationService.recordMetrics — tiers never stack — so the reviewer can
 * see what a metric entry will lock before saving it.
 */
export function tierForViews(tiers: VideoTier[] | undefined, views: number): VideoTier | null {
  if (!tiers?.length || !Number.isFinite(views)) return null;
  const qualifying = tiers.filter((t) => views >= (t.minViews ?? 0));
  if (!qualifying.length) return null;
  return qualifying.reduce((best, t) => ((t.minViews ?? 0) > (best.minViews ?? 0) ? t : best));
}
