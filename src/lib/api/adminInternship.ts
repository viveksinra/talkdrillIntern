import { api } from './client';
import { buildQuery } from './internship';
import type {
  AdminInternDetail,
  AssignmentBulkResult,
  BulkApproveResult,
  DashboardSummary,
  EligibilityRule,
  EligibilityRuleInput,
  EligibilityStatus,
  EnrollResult,
  InternEnrollment,
  InternProfile,
  InternStatus,
  LedgerEntry,
  Paged,
  PointsSummary,
  Program,
  ProgramEligibilityResponse,
  ProgramInput,
  RecomputeResult,
  Redemption,
  RedemptionStatus,
  Reward,
  RewardInput,
  Submission,
  SubmissionQueueItem,
  TaskTemplate,
  TaskTemplateInput,
  Track,
  VideoSubmission,
  VideoSubmissionStatus,
  EligibilityState,
} from './types';
// Public-hiring shapes live in ./openings (the public pages read them too) — the
// admin side reuses them rather than re-declaring a second Opening type.
import type { Opening } from './openings';

/**
 * Admin internship API (backend: routes/api/v1/admin/internship.js, whole router
 * behind auth + requireTeamAdmin). Requires an admin principal — an intern token
 * gets 403 here, so call these only inside <RequireAdmin>.
 *
 * This module is the ONLY place that knows the wire shape. The backend is not
 * uniform — some lists are bare arrays, the paginated ones are
 * `{ items, total, limit, skip }`, the eligibility board is `{ program, period,
 * rows }` and the bulk endpoints return detail arrays plus counts. Each function
 * below declares what it actually returns and unwraps it here, so no screen has
 * to guess.
 */

/** Reads a `{ items, total }` payload, tolerating an empty 200. */
function paged<T>(data: Paged<T> | null | undefined): Paged<T> {
  return { items: data?.items ?? [], total: data?.total ?? 0 };
}

// ── programs (batches/cohorts) ───────────────────────────────────────────

export async function listPrograms(
  params: { track?: Track; isActive?: boolean } = {}
): Promise<Program[]> {
  const res = await api<Program[]>(`/admin/internship/programs${buildQuery(params)}`);
  return res.myData ?? [];
}

export async function createProgram(body: ProgramInput): Promise<Program> {
  const res = await api<Program>('/admin/internship/programs', { method: 'POST', body });
  return res.myData!;
}

export async function updateProgram(id: string, body: ProgramInput): Promise<Program> {
  const res = await api<Program>(`/admin/internship/programs/${id}`, { method: 'PUT', body });
  return res.myData!;
}

export async function deleteProgram(id: string): Promise<void> {
  await api(`/admin/internship/programs/${id}`, { method: 'DELETE' });
}

/**
 * Bulk-enrol by email — creates InternProfiles, or links emails already on file.
 * `created`/`updated` are the email lists themselves, not counts.
 */
export async function enrollInterns(programId: string, emails: string[]): Promise<EnrollResult> {
  const res = await api<EnrollResult>(`/admin/internship/programs/${programId}/enroll`, {
    method: 'POST',
    body: { emails },
  });
  const d = res.myData;
  return {
    created: d?.created ?? [],
    updated: d?.updated ?? [],
    invalid: d?.invalid ?? [],
    createdCount: d?.createdCount ?? d?.created?.length ?? 0,
    updatedCount: d?.updatedCount ?? d?.updated?.length ?? 0,
  };
}

export async function setLeaderboardEnabled(
  programId: string,
  enabled: boolean
): Promise<Program> {
  const res = await api<Program>(`/admin/internship/programs/${programId}/leaderboard`, {
    method: 'PATCH',
    body: { enabled },
  });
  return res.myData!;
}

// ── task templates ───────────────────────────────────────────────────────

export async function listTaskTemplates(
  params: { track?: Track; programId?: string; isActive?: boolean } = {}
): Promise<TaskTemplate[]> {
  const res = await api<TaskTemplate[]>(`/admin/internship/task-templates${buildQuery(params)}`);
  return res.myData ?? [];
}

export async function createTaskTemplate(body: TaskTemplateInput): Promise<TaskTemplate> {
  const res = await api<TaskTemplate>('/admin/internship/task-templates', { method: 'POST', body });
  return res.myData!;
}

export async function updateTaskTemplate(
  id: string,
  body: TaskTemplateInput
): Promise<TaskTemplate> {
  const res = await api<TaskTemplate>(`/admin/internship/task-templates/${id}`, {
    method: 'PUT',
    body,
  });
  return res.myData!;
}

export async function deleteTaskTemplate(id: string): Promise<void> {
  await api(`/admin/internship/task-templates/${id}`, { method: 'DELETE' });
}

// ── assignments ──────────────────────────────────────────────────────────

/**
 * Assign one template to many interns. Omit `emails` to assign to every intern in
 * `programId`. Re-assigning an existing template+intern+period is skipped, not
 * duplicated (unique index on the backend).
 */
export async function createAssignments(body: {
  templateId: string;
  emails?: string[];
  programId?: string;
  dueDate?: string;
}): Promise<AssignmentBulkResult> {
  const res = await api<AssignmentBulkResult>('/admin/internship/assignments', {
    method: 'POST',
    body,
  });
  const d = res.myData;
  return {
    created: d?.created ?? [],
    skipped: d?.skipped ?? [],
    createdCount: d?.createdCount ?? d?.created?.length ?? 0,
    skippedCount: d?.skippedCount ?? d?.skipped?.length ?? 0,
    period: d?.period ?? null,
  };
}

// ── interns ──────────────────────────────────────────────────────────────

/** GET /interns also decorates each row with its pending-review count. */
export interface AdminInternRow extends InternProfile {
  pendingSubmissions?: number;
  /** Which internship + batch each person is on. Several at once is normal. */
  enrollments?: InternEnrollment[];
}

export async function listInterns(
  params: {
    q?: string;
    track?: Track;
    status?: InternStatus;
    programId?: string;
    limit?: number;
    skip?: number;
  } = {}
): Promise<Paged<AdminInternRow>> {
  const res = await api<Paged<AdminInternRow>>(`/admin/internship/interns${buildQuery(params)}`);
  return paged(res.myData);
}

export async function createIntern(body: {
  email: string;
  track?: Track;
  fullName?: string;
  programIds?: string[];
}): Promise<InternProfile> {
  const res = await api<InternProfile>('/admin/internship/interns', { method: 'POST', body });
  return res.myData!;
}

/** Profile + assigned tasks + points ledger + eligibility, for the intern drawer. */
export async function getIntern(id: string): Promise<AdminInternDetail> {
  const res = await api<AdminInternDetail>(`/admin/internship/interns/${id}`);
  return res.myData!;
}

export async function updateIntern(
  id: string,
  body: Partial<
    Pick<
      InternProfile,
      'track' | 'status' | 'fullName' | 'adminNotes' | 'socialHandles' | 'appLinkInBio'
    >
  > & { programIds?: string[] }
): Promise<InternProfile> {
  const res = await api<InternProfile>(`/admin/internship/interns/${id}`, { method: 'PATCH', body });
  return res.myData!;
}

// ── verification queue ───────────────────────────────────────────────────

export async function getSubmissionQueue(
  params: { track?: Track; programId?: string; status?: string; limit?: number } = {}
): Promise<Paged<SubmissionQueueItem>> {
  const res = await api<Paged<SubmissionQueueItem>>(
    `/admin/internship/submissions/queue${buildQuery(params)}`
  );
  return paged(res.myData);
}

/** Approving awards the template's points unless `pointsOverride` is given. */
export async function approveSubmission(
  id: string,
  body: { pointsOverride?: number; note?: string } = {}
): Promise<Submission> {
  const res = await api<Submission>(`/admin/internship/submissions/${id}/approve`, {
    method: 'POST',
    body,
  });
  return res.myData!;
}

export async function rejectSubmission(id: string, reason: string): Promise<Submission> {
  const res = await api<Submission>(`/admin/internship/submissions/${id}/reject`, {
    method: 'POST',
    body: { reason },
  });
  return res.myData!;
}

/** Per-id outcomes: `approved` holds the ids that went through. */
export async function bulkApproveSubmissions(ids: string[]): Promise<BulkApproveResult> {
  const res = await api<BulkApproveResult>('/admin/internship/submissions/bulk-approve', {
    method: 'POST',
    body: { ids },
  });
  return { approved: res.myData?.approved ?? [], failed: res.myData?.failed ?? [] };
}

// ── reward catalog ───────────────────────────────────────────────────────

export async function listRewards(
  params: { track?: Track; programId?: string; unlockType?: string } = {}
): Promise<Reward[]> {
  const res = await api<Reward[]>(`/admin/internship/rewards${buildQuery(params)}`);
  return res.myData ?? [];
}

export async function createReward(body: RewardInput): Promise<Reward> {
  const res = await api<Reward>('/admin/internship/rewards', { method: 'POST', body });
  return res.myData!;
}

export async function updateReward(id: string, body: RewardInput): Promise<Reward> {
  const res = await api<Reward>(`/admin/internship/rewards/${id}`, { method: 'PUT', body });
  return res.myData!;
}

export async function deleteReward(id: string): Promise<void> {
  await api(`/admin/internship/rewards/${id}`, { method: 'DELETE' });
}

// ── redemptions (payout / fulfilment desk) ───────────────────────────────

export async function listRedemptions(
  params: {
    status?: RedemptionStatus | string;
    source?: string;
    internProfileId?: string;
    limit?: number;
  } = {}
): Promise<Paged<Redemption>> {
  const res = await api<Paged<Redemption>>(`/admin/internship/redemptions${buildQuery(params)}`);
  return paged(res.myData);
}

export async function approveRedemption(id: string): Promise<Redemption> {
  const res = await api<Redemption>(`/admin/internship/redemptions/${id}/approve`, {
    method: 'POST',
  });
  return res.myData!;
}

/** Rejecting a self-redeem refunds the points, which is what `refund` reports. */
export async function rejectRedemption(
  id: string,
  reason: string
): Promise<{ redemption: Redemption; refund: { balance: number; ledgerEntry: LedgerEntry } | null }> {
  const res = await api<{
    redemption: Redemption;
    refund: { balance: number; ledgerEntry: LedgerEntry } | null;
  }>(`/admin/internship/redemptions/${id}/reject`, { method: 'POST', body: { reason } });
  return { redemption: res.myData!.redemption, refund: res.myData?.refund ?? null };
}

/** `fulfillmentNote` is the audit trail — bank/UPI reference or courier tracking id. */
export async function fulfillRedemption(
  id: string,
  fulfillmentNote: string
): Promise<Redemption> {
  const res = await api<Redemption>(`/admin/internship/redemptions/${id}/fulfill`, {
    method: 'POST',
    body: { fulfillmentNote },
  });
  return res.myData!;
}

/** Hand a reward out directly (source: admin_grant) — costs the intern no points. */
export async function grantRedemption(body: {
  internProfileId: string;
  rewardId: string;
  note?: string;
}): Promise<Redemption> {
  const res = await api<Redemption>('/admin/internship/redemptions/grant', {
    method: 'POST',
    body,
  });
  return res.myData!;
}

// ── points ───────────────────────────────────────────────────────────────

/** Manual correction. `delta` may be negative; every call writes a ledger row. */
export async function adjustPoints(body: {
  internProfileId: string;
  delta: number;
  note?: string;
}): Promise<{ balance: number; ledgerEntry: LedgerEntry }> {
  const res = await api<{ balance: number; ledgerEntry: LedgerEntry }>(
    '/admin/internship/points/adjust',
    { method: 'POST', body }
  );
  return res.myData!;
}

export async function getPointsLedger(params: {
  internProfileId: string;
  limit?: number;
  skip?: number;
}): Promise<PointsSummary> {
  const res = await api<PointsSummary>(`/admin/internship/points/ledger${buildQuery(params)}`);
  return res.myData!;
}

// ── eligibility rules + engine ───────────────────────────────────────────

export async function listRules(
  params: { programId?: string; track?: Track; isActive?: boolean } = {}
): Promise<EligibilityRule[]> {
  const res = await api<EligibilityRule[]>(`/admin/internship/rules${buildQuery(params)}`);
  return res.myData ?? [];
}

export async function createRule(body: EligibilityRuleInput): Promise<EligibilityRule> {
  const res = await api<EligibilityRule>('/admin/internship/rules', { method: 'POST', body });
  return res.myData!;
}

export async function updateRule(
  id: string,
  body: EligibilityRuleInput
): Promise<EligibilityRule> {
  const res = await api<EligibilityRule>(`/admin/internship/rules/${id}`, { method: 'PUT', body });
  return res.myData!;
}

export async function deleteRule(id: string): Promise<void> {
  await api(`/admin/internship/rules/${id}`, { method: 'DELETE' });
}

/**
 * Engine output — who is eligible, at risk, or forfeited. Omit `programId` for an
 * all-interns board (the backend caps how many it will walk un-scoped).
 */
export async function getProgramEligibility(
  params: { programId?: string; period?: string } = {}
): Promise<ProgramEligibilityResponse> {
  const res = await api<ProgramEligibilityResponse>(
    `/admin/internship/eligibility${buildQuery(params)}`
  );
  return {
    program: res.myData?.program ?? null,
    period: res.myData?.period ?? params.period ?? '',
    rows: res.myData?.rows ?? [],
  };
}

/** `statusId` comes from EligibilityEvaluation.statusId (an EligibilityStatus._id). */
export async function overrideEligibilityStatus(
  statusId: string,
  body: { status: EligibilityState; note?: string }
): Promise<EligibilityStatus> {
  const res = await api<EligibilityStatus>(
    `/admin/internship/eligibility/${statusId}/override`,
    { method: 'POST', body }
  );
  return res.myData!;
}

export async function recomputeEligibility(
  body: { programId?: string; period?: string } = {}
): Promise<RecomputeResult> {
  const res = await api<RecomputeResult>('/admin/internship/eligibility/recompute', {
    method: 'POST',
    body,
  });
  return {
    period: res.myData?.period ?? body.period ?? '',
    internsProcessed: res.myData?.internsProcessed ?? 0,
    programId: res.myData?.programId ?? null,
    failed: res.myData?.failed ?? [],
  };
}

// ── video evaluation ─────────────────────────────────────────────────────

/** Defaults to due_for_evaluation (past the 30-day window), then pending. */
export async function getVideoQueue(
  params: { status?: VideoSubmissionStatus; programId?: string; limit?: number } = {}
): Promise<Paged<VideoSubmission>> {
  const res = await api<Paged<VideoSubmission>>(
    `/admin/internship/videos/queue${buildQuery(params)}`
  );
  return paged(res.myData);
}

/** What recordMetrics locked, alongside the refreshed submission. */
export interface VideoEvaluationResult {
  video: VideoSubmission;
  lockedTierKey: string | null;
  lockedRewardId: string | null;
  lockedCashAmount: number;
  countsForBaseline: boolean;
  needsStricterReview: boolean;
  baselineMinLikes: number;
  tierLabel: string | null;
}

/** Locks the single highest qualifying program tier — tiers do not stack. */
export async function evaluateVideo(
  id: string,
  body: { views30d: number; likes30d: number }
): Promise<VideoEvaluationResult> {
  const res = await api<VideoEvaluationResult>(`/admin/internship/videos/${id}/evaluate`, {
    method: 'POST',
    body,
  });
  return res.myData!;
}

export async function rejectVideo(id: string, reason: string): Promise<VideoSubmission> {
  const res = await api<VideoSubmission>(`/admin/internship/videos/${id}/reject`, {
    method: 'POST',
    body: { reason },
  });
  return res.myData!;
}

// ── dashboard ────────────────────────────────────────────────────────────

export async function getDashboardSummary(
  params: { programId?: string; period?: string } = {}
): Promise<DashboardSummary> {
  const res = await api<DashboardSummary>(
    `/admin/internship/dashboard/summary${buildQuery(params)}`
  );
  return res.myData!;
}

// ── public openings (the hiring listings) ────────────────────────────────

/**
 * The admin view of an InternshipOpening. Same document the public pages read,
 * plus the fields only the team sees:
 *   - `status` / `sortOrder`   — draft/published/closed and board order
 *   - `applicationCount`       — denormalised counter, all time
 *   - `pendingApplications`    — added by GET /openings (submitted +
 *                                shortlisted + interviewing), i.e. the queue
 *   - `programIds`             — programs an accepted applicant is enrolled into
 *
 * `isOpen` is a Mongoose *method*, so the admin list (`.lean()`) does not carry
 * it — read `status` + `applyBy` instead. It stays optional here only because a
 * row handed over from the public API does have it.
 */
export type OpeningStatus = 'draft' | 'published' | 'closed';
export type EmploymentType = 'internship' | 'part-time' | 'full-time';

export const OPENING_STATUSES: OpeningStatus[] = ['draft', 'published', 'closed'];
export const EMPLOYMENT_TYPES: EmploymentType[] = ['internship', 'part-time', 'full-time'];

export interface AdminOpening extends Omit<Opening, '_id' | 'isOpen'> {
  _id: string;
  status: OpeningStatus;
  sortOrder?: number;
  applicationCount?: number;
  pendingApplications?: number;
  /**
   * People who registered interest AFTER the deadline passed — added by GET
   * /openings. On an expired listing this, not `pendingApplications`, is the
   * number that matters: it is the reason to run the role again.
   */
  waitlistCount?: number;
  programIds?: string[];
  isOpen?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Everything the editor may send. The controller patches only the keys present,
 * so a one-key body (`{ status }`) is a safe partial update — that is what the
 * list screen's publish toggle sends.
 */
export type OpeningInput = Partial<
  Omit<
    AdminOpening,
    | '_id'
    | 'isOpen'
    | 'applicationCount'
    | 'pendingApplications'
    | 'waitlistCount'
    | 'createdAt'
    | 'updatedAt'
  >
>;

/** Every listing, any status. Omit `status` for the whole board (max 200 rows). */
export async function listAdminOpenings(status?: OpeningStatus): Promise<AdminOpening[]> {
  const res = await api<{ openings: AdminOpening[]; total: number }>(
    `/admin/internship/openings${buildQuery({ status })}`
  );
  return res.myData?.openings ?? [];
}

/** One opening, unwrapped — this endpoint returns the document as myData itself. */
export async function getAdminOpening(id: string): Promise<AdminOpening> {
  const res = await api<AdminOpening>(`/admin/internship/openings/${id}`);
  return res.myData!;
}

export async function createOpening(body: OpeningInput): Promise<AdminOpening> {
  const res = await api<AdminOpening>('/admin/internship/openings', { method: 'POST', body });
  return res.myData!;
}

export async function updateOpening(id: string, body: OpeningInput): Promise<AdminOpening> {
  const res = await api<AdminOpening>(`/admin/internship/openings/${id}`, { method: 'PUT', body });
  return res.myData!;
}

/**
 * Hard delete. The server refuses (400) once an opening has applications and
 * says so in the message — surface that text rather than a generic failure.
 */
export async function deleteOpening(id: string): Promise<void> {
  await api(`/admin/internship/openings/${id}`, { method: 'DELETE' });
}

// ── applications (the hiring review queue) ───────────────────────────────
//
// Everything below belongs to /admin/applications. Types are spelled with
// inline `import('./openings')` so this block carries its own dependencies.

/** Status the applicant sees. `withdrawn` is set by them, never by the team. */
type ApplicationStatusWire = import('./openings').ApplicationStatus;

/**
 * The opening an application points at. GET /applications populates four fields
 * (slug, title, category, track); GET /applications/:id populates the whole
 * document, which is where the custom `questions` come from — the review pane
 * needs them to label the answers.
 */
export interface AdminApplicationOpening {
  _id: string;
  slug: string;
  title: string;
  category?: string;
  track?: Track | null;
  locationType?: import('./openings').LocationType;
  city?: string;
  duration?: string;
  stipend?: import('./openings').Stipend;
  questions?: import('./openings').OpeningQuestion[];
  status?: OpeningStatus;
  programIds?: string[];
}

/**
 * One application, exactly as the admin endpoints return it — the applicant
 * snapshot taken at submit time (never re-joined from their profile, so a later
 * edit cannot rewrite what the team reviewed) plus the team's own decision trail.
 *
 * `adminNotes` is internal and appears on admin routes ONLY; the applicant-facing
 * endpoints strip it.
 */
export interface AdminApplication {
  _id: string;
  /** Populated on both admin reads; a bare id only if population ever fails. */
  openingId: AdminApplicationOpening | string | null;
  userId?: string;

  /**
   * `interest` means they arrived after the deadline and left their details
   * instead of applying — the server decides this, never the client. Promoting
   * them to a live status flips it back to `application`.
   */
  kind?: import('./openings').SubmissionKind;
  /** When the team last told this waitlisted person the role was running again. */
  contactedAt?: string | null;

  fullName: string;
  email: string;
  phone?: string;
  city?: string;
  college?: string;
  graduationYear?: number;

  pitch?: string;
  /** Keyed by the opening question's `key`. Absent when the opening asks nothing. */
  answers?: Record<string, string> | null;

  resumeUrl?: string;
  portfolioUrl?: string;
  socialHandles?: {
    instagram?: string;
    youtube?: string;
    linkedin?: string;
    other?: string;
  };

  availableFrom?: string | null;
  confirmsDuration?: boolean;

  status: ApplicationStatusWire;
  /** Set the moment someone is accepted — this is the hire receipt. */
  internProfileId?:
    | string
    | { _id: string; status?: InternStatus; track?: Track | null; pointsBalance?: number }
    | null;

  decidedAt?: string | null;
  decidedBy?: string | null;
  /** Shown to the applicant. */
  decisionNote?: string | null;
  /** Internal only — the applicant never sees this. */
  adminNotes?: string | null;

  source?: string;
  createdAt: string;
  updatedAt?: string;
}

/** GET /applications — page-numbered (1-based), not skip-based like the rest. */
export interface AdminApplicationPage {
  applications: AdminApplication[];
  total: number;
  page: number;
  limit: number;
}

/** What the team may set. `withdrawn` is the applicant's to give, so it is absent. */
export type ApplicationDecision =
  | 'submitted'
  | 'shortlisted'
  | 'interviewing'
  | 'accepted'
  | 'rejected';

export const APPLICATION_DECISIONS: ApplicationDecision[] = [
  'submitted',
  'shortlisted',
  'interviewing',
  'accepted',
  'rejected',
];

export interface DecideApplicationBody {
  status: ApplicationDecision;
  /** Shown to the applicant — write it as if they are reading it, because they are. */
  decisionNote?: string;
  adminNotes?: string;
  /** Accept only. Omit to inherit the opening's track; `null` to decide later. */
  track?: Track | null;
  /** Accept only. Omit to inherit the opening's programs. */
  programIds?: string[];
}

/** `internProfile` is non-null only on an accept — that is the profile just created. */
export interface DecideApplicationResult {
  application: AdminApplication;
  internProfile: InternProfile | null;
}

export async function listApplications(
  params: {
    status?: ApplicationStatusWire;
    openingId?: string;
    q?: string;
    page?: number;
    limit?: number;
  } = {}
): Promise<AdminApplicationPage> {
  const res = await api<AdminApplicationPage>(
    `/admin/internship/applications${buildQuery(params)}`
  );
  return {
    applications: res.myData?.applications ?? [],
    total: res.myData?.total ?? 0,
    page: res.myData?.page ?? params.page ?? 1,
    limit: res.myData?.limit ?? params.limit ?? 50,
  };
}

/** Full record: the whole opening (with its questions) and the linked profile. */
export async function getApplication(id: string): Promise<AdminApplication> {
  const res = await api<AdminApplication>(`/admin/internship/applications/${id}`);
  return res.myData!;
}

/**
 * The one write on this screen. `status: 'accepted'` is the HIRE action: the
 * server creates (or tops up, idempotent by email) the InternProfile, links the
 * TalkDrill account we already know, and returns it as `internProfile`.
 */
export async function decideApplication(
  id: string,
  body: DecideApplicationBody
): Promise<DecideApplicationResult> {
  const res = await api<DecideApplicationResult>(
    `/admin/internship/applications/${id}/decide`,
    { method: 'POST', body }
  );
  return { application: res.myData!.application, internProfile: res.myData?.internProfile ?? null };
}

/** Narrows a possibly-unpopulated `openingId` to the document, or null. */
export function applicationOpening(app: AdminApplication): AdminApplicationOpening | null {
  const ref = app.openingId;
  if (!ref || typeof ref === 'string') return null;
  return ref;
}

/** The created/linked profile id, whether the ref came back populated or not. */
export function applicationProfileId(app: AdminApplication): string | null {
  const ref = app.internProfileId;
  if (!ref) return null;
  return typeof ref === 'string' ? ref : ref._id;
}

// ── waitlist (interest captured after a deadline passed) ─────────────────
//
// A listing whose applyBy has gone by no longer turns people away: they leave
// their details and land here as `kind: 'interest'` / `status: 'waitlisted'`.
// These three endpoints are the team's side of that promise — see who is
// waiting, record that you mailed them, and give the role a new deadline.

/** One person waiting on a reopen. A trimmed application: no answers, no links. */
export interface WaitlistEntry {
  _id: string;
  fullName: string;
  email: string;
  phone?: string;
  city?: string;
  college?: string;
  graduationYear?: number;
  /** Optional here — an interest submission never had to write one. */
  pitch?: string;
  createdAt: string;
  /** Null until someone marks them contacted. Nothing is emailed automatically. */
  contactedAt?: string | null;
  /** Their TalkDrill account, if the submission came from a signed-in user. */
  userId?: string | null;
}

/**
 * `emails` is the whole list, server-built and de-duplicated, so the "copy all"
 * action never has to reconstruct it from the rows on screen (which may be
 * paginated later).
 */
export interface WaitlistResponse {
  waitlist: WaitlistEntry[];
  total: number;
  /** How many still have no contactedAt — the number the team acts on. */
  uncontacted: number;
  emails: string[];
}

export async function getWaitlist(openingId: string): Promise<WaitlistResponse> {
  const res = await api<WaitlistResponse>(`/admin/internship/openings/${openingId}/waitlist`);
  const d = res.myData;
  return {
    waitlist: d?.waitlist ?? [],
    total: d?.total ?? d?.waitlist?.length ?? 0,
    uncontacted: d?.uncontacted ?? 0,
    emails: d?.emails ?? [],
  };
}

/**
 * Stamps `contactedAt`. This is bookkeeping ONLY — the backend sends no mail, so
 * call it after you have actually written to these people. Omit `ids` to mark
 * everyone who is not marked yet. Returns how many rows changed.
 */
export async function markWaitlistContacted(
  openingId: string,
  ids?: string[]
): Promise<number> {
  const res = await api<{ updated: number }>(
    `/admin/internship/openings/${openingId}/waitlist/contacted`,
    { method: 'POST', body: ids?.length ? { ids } : {} }
  );
  return res.myData?.updated ?? 0;
}

/** `applyBy` must be in the future — the server rejects a past date by message. */
export interface ReopenOpeningBody {
  applyBy: string;
  startWindow?: { from?: string; to?: string };
  postedAt?: string;
}

/** `waitlistCount` is who was waiting when it reopened — the reason to reopen. */
export interface ReopenOpeningResult {
  opening: AdminOpening;
  waitlistCount: number;
}

export async function reopenOpening(
  openingId: string,
  body: ReopenOpeningBody
): Promise<ReopenOpeningResult> {
  const res = await api<ReopenOpeningResult>(
    `/admin/internship/openings/${openingId}/reopen`,
    { method: 'POST', body }
  );
  return {
    opening: res.myData!.opening,
    waitlistCount: res.myData?.waitlistCount ?? 0,
  };
}

/* ------------------------------------------------------------------ BATCHES */

/**
 * Start a NEW cohort for a role.
 *
 * Distinct from `reopenOpening`, which only moves the CURRENT batch's deadline.
 * This creates the next `InternshipProgram`, points the opening at it, and
 * clears `contactedAt` on the waitlist so "who still needs mailing" is
 * meaningful again.
 *
 * The reason it matters: application uniqueness is (opening, user, batch), so
 * once a new batch exists everyone who applied to a previous one — including
 * the rejected pool a second round recruits from — can apply again, with batch
 * 1's decisions left intact.
 */
export interface StartNextBatchBody {
  /** Must be in the future — the server rejects a past date by message. */
  applyBy: string;
  /** Defaults to "Batch N" server-side. */
  batchLabel?: string;
  seats?: number;
  startWindow?: { from?: string; to?: string };
  postedAt?: string;
}

export interface StartNextBatchResult {
  opening: AdminOpening;
  program: { _id: string; name: string; slug: string; batchNumber: number };
  /** Waitlisted people reset to un-contacted — i.e. who to mail about this round. */
  waitlistCount: number;
}

export async function startNextBatch(
  openingId: string,
  body: StartNextBatchBody
): Promise<StartNextBatchResult> {
  const res = await api<StartNextBatchResult>(
    `/admin/internship/openings/${openingId}/next-batch`,
    { method: 'POST', body }
  );
  return {
    opening: res.myData!.opening,
    program: res.myData!.program,
    waitlistCount: res.myData?.waitlistCount ?? 0,
  };
}

/* ------------------------------------------------------------------ VIEW AS */

/**
 * "View as intern" — the picker. The impersonation itself is NOT an endpoint:
 * the admin keeps their own token and adds the `X-View-As-Intern` header
 * (attached in client.ts), which the backend honours only for team members and
 * only for GETs unless the target is a sandbox persona.
 */
export interface ViewAsTargets {
  /** false when the feature flag is off — hide the entry points entirely. */
  enabled: boolean;
  sandbox: AdminInternRow[];
  interns: AdminInternRow[];
}

export async function listViewAsTargets(q?: string): Promise<ViewAsTargets> {
  const res = await api<ViewAsTargets>(
    `/admin/internship/view-as/targets${buildQuery({ q })}`
  );
  return {
    enabled: res.myData?.enabled === true,
    sandbox: res.myData?.sandbox ?? [],
    interns: res.myData?.interns ?? [],
  };
}

/** Wipes a sandbox persona's activity and re-seeds it. Destructive by design. */
export async function resetSandbox(track?: string): Promise<AdminInternRow[]> {
  const res = await api<AdminInternRow[]>('/admin/internship/view-as/sandbox/reset', {
    method: 'POST',
    body: { track },
  });
  return res.myData ?? [];
}
