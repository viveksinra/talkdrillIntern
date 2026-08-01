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
