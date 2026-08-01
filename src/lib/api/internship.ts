import { api } from './client';
import type {
  AssignedTaskStatus,
  InternEligibilityView,
  InternProfile,
  LeaderboardResponse,
  MyTasksResponse,
  InternshipTask,
  PointsSummary,
  Redemption,
  RewardWithEligibility,
  Submission,
  SubmitProofBody,
  SubmitVideoBody,
  UpdateMyProfileBody,
  VideoSubmission,
} from './types';

/**
 * Intern-facing internship API (backend: routes/api/v1/internship.js).
 * Every call requires an intern JWT. Admin calls live in ./adminInternship.
 */

// Convenience re-export so UI files can pull calls and types from one module.
export * from './types';

export interface MeResponse {
  principal: 'intern' | 'admin';
  user?: { id: string; name?: string; email?: string; profileImage?: string };
  admin?: { id: string; name?: string; email?: string };
  internProfile: InternProfile | null;
}

export async function getMe(): Promise<MeResponse> {
  const res = await api<MeResponse>('/internship/me');
  return res.myData!;
}

export async function updateMyProfile(body: UpdateMyProfileBody): Promise<InternProfile> {
  const res = await api<InternProfile>('/internship/me', { method: 'PATCH', body });
  return res.myData!;
}

// ── tasks ────────────────────────────────────────────────────────────────

export async function getMyTasks(): Promise<MyTasksResponse> {
  const res = await api<MyTasksResponse>('/internship/tasks');
  return { mandatory: res.myData?.mandatory ?? [], optional: res.myData?.optional ?? [] };
}

export async function getMyTask(assignedTaskId: string): Promise<InternshipTask> {
  const res = await api<InternshipTask>(`/internship/tasks/${assignedTaskId}`);
  return res.myData!;
}

/** The submitted proof plus the assignment's new state (status flips to submitted). */
export interface SubmitProofResult {
  submission: Submission;
  task: { _id: string; status: AssignedTaskStatus; submissionCount: number };
}

/** `assignedTaskId` is InternshipTask._id from getMyTasks (NOT the template id). */
export async function submitProof(
  assignedTaskId: string,
  body: SubmitProofBody
): Promise<SubmitProofResult> {
  const res = await api<SubmitProofResult>(`/internship/tasks/${assignedTaskId}/submit`, {
    method: 'POST',
    body,
  });
  return res.myData!;
}

// ── points ───────────────────────────────────────────────────────────────

export async function getMyPoints(
  params: { limit?: number; skip?: number } = {}
): Promise<PointsSummary> {
  const res = await api<PointsSummary>(`/internship/points${buildQuery(params)}`);
  return res.myData!;
}

// ── eligibility ──────────────────────────────────────────────────────────

export async function getMyEligibility(): Promise<InternEligibilityView[]> {
  const res = await api<InternEligibilityView[]>('/internship/eligibility');
  return res.myData ?? [];
}

// ── rewards + redemptions ────────────────────────────────────────────────

export async function getRewards(): Promise<RewardWithEligibility[]> {
  const res = await api<RewardWithEligibility[]>('/internship/rewards');
  return res.myData ?? [];
}

/** Points-redeemable rewards only — spends points immediately, hence the balance. */
export async function redeemReward(
  rewardId: string
): Promise<{ redemption: Redemption; balance: number }> {
  const res = await api<{ redemption: Redemption; balance: number }>(
    `/internship/rewards/${rewardId}/redeem`,
    { method: 'POST' }
  );
  return { redemption: res.myData!.redemption, balance: res.myData?.balance ?? 0 };
}

export async function getMyRedemptions(): Promise<Redemption[]> {
  const res = await api<Redemption[]>('/internship/redemptions');
  return res.myData ?? [];
}

// ── leaderboard ──────────────────────────────────────────────────────────

/** Returns `{ enabled: false, rows: [] }` when the intern's program opted out. */
export async function getLeaderboard(): Promise<LeaderboardResponse> {
  const res = await api<LeaderboardResponse>('/internship/leaderboard');
  const d = res.myData;
  return { ...d, enabled: d?.enabled ?? false, rows: d?.rows ?? [] };
}

// ── videos (content track) ───────────────────────────────────────────────

export async function getMyVideos(): Promise<VideoSubmission[]> {
  const res = await api<VideoSubmission[]>('/internship/videos');
  return res.myData ?? [];
}

export async function submitVideo(body: SubmitVideoBody): Promise<VideoSubmission> {
  const res = await api<VideoSubmission>('/internship/videos', { method: 'POST', body });
  return res.myData!;
}

// ── query-string helper (shared with adminInternship) ────────────────────

/** Serialises defined, non-empty params. Exported so the admin client reuses it. */
export function buildQuery(params: Record<string, string | number | boolean | undefined | null>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    qs.append(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}
