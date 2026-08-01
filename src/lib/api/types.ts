/**
 * Shared domain types for the internship module — mirrors Models/internship/* on
 * the backend. Import types from here; import CALLS from ./internship (intern)
 * or ./adminInternship (admin).
 *
 * Two conventions apply throughout:
 *  - Dates arrive as JSON, so every Date field is typed `string` (ISO 8601).
 *  - A Mongoose ref may come back as an id or as a populated document depending
 *    on the endpoint, so refs are `Ref<T>` = `string | T`. Use refId()/isPopulated()
 *    instead of casting.
 */

// ── ref helpers ──────────────────────────────────────────────────────────

export type Ref<T> = string | T;

/** Narrow a Ref to its populated document. */
export function isPopulated<T extends { _id: string }>(ref: Ref<T> | null | undefined): ref is T {
  return !!ref && typeof ref === 'object';
}

/** Id of a Ref whether it is populated or not ('' when absent). */
export function refId<T extends { _id: string }>(ref: Ref<T> | null | undefined): string {
  if (!ref) return '';
  return typeof ref === 'string' ? ref : ref._id;
}

interface Timestamped {
  createdAt?: string;
  updatedAt?: string;
}

/** Envelope of every paginated admin list endpoint. */
export interface Paged<T> {
  items: T[];
  total: number;
  limit?: number;
  skip?: number;
}

// ── enums (string-literal unions, matching the mongoose enums exactly) ───

export type Track = 'campus' | 'content' | 'marketing';
export type InternStatus = 'invited' | 'active' | 'paused' | 'completed' | 'removed';

export type ProofType = 'screenshot' | 'link' | 'text' | 'username' | 'video-metric' | 'file';
export type TaskCadence = 'one-time' | 'daily-streak' | 'recurring';
export type AssignedTaskStatus = 'assigned' | 'submitted' | 'approved' | 'rejected';

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';
export type FlagSeverity = 'info' | 'warn' | 'high';

export type VideoPlatform = 'youtube' | 'instagram' | 'tiktok' | 'facebook' | 'linkedin' | 'other';
export type VideoSubmissionStatus =
  | 'pending_evaluation'
  | 'due_for_evaluation'
  | 'evaluated'
  | 'rejected';

export type RewardType = 'cash' | 'goodie' | 'gift' | 'certificate' | 'perk' | 'coins';
export type RewardUnlockType = 'points_redeemable' | 'eligibility_gated' | 'admin_granted';

export type RedemptionSource = 'self_redeem' | 'eligibility' | 'admin_grant';
export type RedemptionStatus = 'requested' | 'approved' | 'fulfilled' | 'rejected';

export type PointsReason =
  | 'task_approved'
  | 'admin_adjustment'
  | 'redemption'
  | 'reward_grant'
  | 'reversal';
export type ActorType = 'admin' | 'system';

export type EligibilityState = 'not_yet_eligible' | 'eligible' | 'earned' | 'forfeited';
export type RulePeriod = 'one-time' | 'monthly' | 'multi-month';

/** Condition types the eligibility engine understands. Conditions are AND-combined. */
export type ConditionType =
  | 'all_mandatory_tasks_approved'
  | 'min_approved_tasks'
  | 'min_points'
  | 'min_videos'
  | 'min_videos_with_min_likes';

// ── intern profile ───────────────────────────────────────────────────────

export interface SocialHandles {
  instagram?: string;
  youtube?: string;
  linkedin?: string;
  other?: string;
}

export interface InternProfile extends Timestamped {
  _id: string;
  email: string;
  /** Absent until the intern's first login links their TalkDrill account. */
  userId?: string;
  track: Track | null;
  status: InternStatus;
  fullName?: string;
  onboardingAccepted: boolean;
  appLinkInBio: boolean;
  pointsBalance: number;
  totalPointsEarned: number;
  programIds: Ref<Program>[];
  socialHandles?: SocialHandles;
  /** Admin-only field — not returned on intern-facing endpoints. */
  adminNotes?: string;
  activatedAt?: string;
}

/** Body of PATCH /internship/me — interns may only edit these fields. */
export interface UpdateMyProfileBody {
  track?: Track;
  onboardingAccepted?: boolean;
  appLinkInBio?: boolean;
  socialHandles?: SocialHandles;
  fullName?: string;
}

// ── programs ─────────────────────────────────────────────────────────────

/**
 * One row of the content-creator reward table (10K/50K/100K/500K/1M views), stored
 * per batch so thresholds are editable without a deploy. Tiers do NOT stack — the
 * evaluator locks the single highest qualifying tier.
 */
export interface VideoTier {
  key: string;
  label?: string;
  minViews: number;
  rewardId?: Ref<Reward> | null;
  cashAmount: number;
  sortOrder: number;
}

export interface Program extends Timestamped {
  _id: string;
  name: string;
  slug: string;
  track: Track | null;
  description?: string;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  leaderboardEnabled: boolean;
  createdBy?: Ref<TeamMemberRef>;
  videoTiers: VideoTier[];
  /**
   * Likes a video must clear to count toward the monthly stipend baseline.
   * null = fall back to the batch's min_videos_with_min_likes rule, then to the
   * service default.
   */
  baselineMinLikes?: number | null;
}

/** Minimal shape of a populated myTeam admin ref (reviewer / creator bylines). */
export interface TeamMemberRef {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export type ProgramInput = Partial<
  Pick<
    Program,
    | 'name'
    | 'slug'
    | 'track'
    | 'description'
    | 'startDate'
    | 'endDate'
    | 'isActive'
    | 'leaderboardEnabled'
    | 'videoTiers'
    | 'baselineMinLikes'
  >
>;

// ── task templates + assignments ─────────────────────────────────────────

export interface TaskTemplate extends Timestamped {
  _id: string;
  title: string;
  description?: string;
  instructions?: string;
  track: Track | null;
  /** A template can belong to MANY programs. */
  programIds: Ref<Program>[];
  points: number;
  proofType: ProofType;
  cadence: TaskCadence;
  isMandatory: boolean;
  category?: string;
  tags: string[];
  deadline?: string;
  requiresDashboardProof: boolean;
  isActive: boolean;
  createdBy?: Ref<TeamMemberRef>;
}

export type TaskTemplateInput = Partial<
  Pick<
    TaskTemplate,
    | 'title'
    | 'description'
    | 'instructions'
    | 'track'
    | 'programIds'
    | 'points'
    | 'proofType'
    | 'cadence'
    | 'isMandatory'
    | 'category'
    | 'tags'
    | 'deadline'
    | 'requiresDashboardProof'
    | 'isActive'
  >
> & { programIds?: string[] };

export interface AssignedTask extends Timestamped {
  _id: string;
  templateId: Ref<TaskTemplate>;
  internProfileId: Ref<InternProfile>;
  programId?: Ref<Program> | null;
  status: AssignedTaskStatus;
  dueDate?: string;
  /** "YYYY-MM" for recurring/monthly cadence; null for one-time. */
  period: string | null;
  latestSubmissionId?: Ref<Submission> | null;
  submissionCount: number;
  pointsAwarded: number;
  approvedAt?: string;
  rejectionReason?: string;
  assignedBy?: Ref<TeamMemberRef>;
  assignedAt?: string;
}

/**
 * Intern-facing task card (GET /internship/tasks). This is a FLATTENED view:
 * `_id` is the AssignedTask id — it is what POST /internship/tasks/:id/submit takes.
 * Title/points/proof rules are copied down from the template.
 */
export interface InternshipTask {
  _id: string;
  title: string;
  description?: string;
  instructions?: string;
  points: number;
  proofType: ProofType;
  cadence: TaskCadence;
  isMandatory: boolean;
  dueDate?: string | null;
  status: AssignedTaskStatus;
  rejectionReason?: string | null;
  submissionCount: number;
  latestSubmission?: Submission | null;
  templateId?: string;
  category?: string;
  tags?: string[];
  requiresDashboardProof?: boolean;
  period?: string | null;
  pointsAwarded?: number;
}

export interface MyTasksResponse {
  mandatory: InternshipTask[];
  optional: InternshipTask[];
}

// ── submissions ──────────────────────────────────────────────────────────

export interface SubmissionFile {
  url: string;
  key?: string;
  mime?: string;
  size?: number;
  /** Content hash — the fraud checker uses it to spot the same proof across interns. */
  sha256?: string;
}

export interface SubmissionFlag {
  type: string;
  message?: string;
  severity: FlagSeverity;
}

export interface Submission extends Timestamped {
  _id: string;
  assignedTaskId: Ref<AssignedTask>;
  internProfileId: Ref<InternProfile>;
  proofType: ProofType;
  textValue?: string;
  linkUrl?: string;
  usernameValue?: string;
  files: SubmissionFile[];
  note?: string;
  status: SubmissionStatus;
  reviewedBy?: Ref<TeamMemberRef> | null;
  reviewedAt?: string;
  rejectionReason?: string;
  pointsAwarded: number;
  flags: SubmissionFlag[];
  needsStricterReview: boolean;
  submittedAt: string;
}

/** Body of POST /internship/tasks/:id/submit — send only the fields the proofType needs. */
export interface SubmitProofBody {
  textValue?: string;
  linkUrl?: string;
  usernameValue?: string;
  note?: string;
  files?: SubmissionFile[];
}

/**
 * Verification-queue row: same document as Submission, but assignedTaskId and
 * internProfileId come back populated (and assignedTaskId.templateId with them).
 */
export type SubmissionQueueItem = Submission;

// ── video submissions ────────────────────────────────────────────────────

export interface VideoSubmission extends Timestamped {
  _id: string;
  internProfileId: Ref<InternProfile>;
  programId?: Ref<Program> | null;
  videoUrl: string;
  platform: VideoPlatform;
  postedAt: string;
  /** postedAt + 30 days — metrics are only counted after this. */
  evaluationDueAt?: string;
  status: VideoSubmissionStatus;
  views30d: number | null;
  likes30d: number | null;
  evaluatedAt?: string;
  evaluatedBy?: Ref<TeamMemberRef> | null;
  lockedTierKey: string | null;
  lockedRewardId?: Ref<Reward> | null;
  lockedCashAmount: number;
  /** True when likes cleared the program's baseline — feeds monthly stipend rules. */
  countsForBaseline: boolean;
  period: string | null;
  needsStricterReview: boolean;
  dashboardProofUrl?: string;
  rejectionReason?: string;
  notes?: string;
}

export interface SubmitVideoBody {
  videoUrl: string;
  platform: VideoPlatform;
  postedAt: string;
  dashboardProofUrl?: string;
}

// ── rewards + redemptions ────────────────────────────────────────────────

export interface Reward extends Timestamped {
  _id: string;
  name: string;
  description?: string;
  type: RewardType;
  unlockType: RewardUnlockType;
  pointsCost: number;
  cashValue: number;
  /** null = unlimited. */
  stock: number | null;
  stockUsed: number;
  imageUrl?: string;
  track: Track | null;
  programIds: Ref<Program>[];
  isActive: boolean;
  sortOrder: number;
}

export type RewardInput = Partial<
  Pick<
    Reward,
    | 'name'
    | 'description'
    | 'type'
    | 'unlockType'
    | 'pointsCost'
    | 'cashValue'
    | 'stock'
    | 'imageUrl'
    | 'track'
    | 'isActive'
    | 'sortOrder'
  >
> & { programIds?: string[] };

/** GET /internship/rewards — catalog entry decorated with this intern's access. */
export interface RewardWithEligibility extends Reward {
  canRedeem: boolean;
  /** Human sentence when canRedeem is false, e.g. "Needs 300 more points". */
  lockedReason?: string | null;
}

export interface Redemption extends Timestamped {
  _id: string;
  internProfileId: Ref<InternProfile>;
  rewardId: Ref<Reward>;
  source: RedemptionSource;
  status: RedemptionStatus;
  pointsSpent: number;
  period: string | null;
  eligibilityRuleId?: Ref<EligibilityRule> | null;
  requestedAt: string;
  decidedBy?: Ref<TeamMemberRef> | null;
  decidedAt?: string;
  fulfilledAt?: string;
  /** Manual payout reference — bank/UPI txn id or courier tracking number. */
  fulfillmentNote?: string;
  rejectionReason?: string;
}

// ── points ledger ────────────────────────────────────────────────────────

export interface LedgerEntry {
  _id: string;
  internProfileId: Ref<InternProfile>;
  delta: number;
  balanceAfter: number;
  reason: PointsReason;
  refType?: string;
  refId?: string | null;
  note?: string;
  actorType: ActorType;
  actorId?: string | null;
  createdAt: string;
}

/** GET /internship/points and GET /admin/internship/points/ledger. */
export interface PointsSummary {
  balance: number;
  totalEarned: number;
  entries: LedgerEntry[];
  total: number;
}

// ── eligibility ──────────────────────────────────────────────────────────

export interface EligibilityProgress {
  label: string;
  required: number | string | boolean | null;
  current: number | string | boolean | null;
  met: boolean;
}

export interface EligibilityCondition {
  type: ConditionType;
  /** Shape depends on `type`: {count} | {points} | {count,minLikes} | {}. */
  params: Record<string, unknown>;
  label?: string;
}

export interface EligibilityRule extends Timestamped {
  _id: string;
  name: string;
  programId?: Ref<Program> | null;
  track: Track | null;
  rewardId: Ref<Reward>;
  period: RulePeriod;
  /** Only meaningful for period 'multi-month' (e.g. 2 = any 2 months in window). */
  windowMonths: number | null;
  isActive: boolean;
  priority: number;
  /** When true, meeting the rule auto-creates an eligibility redemption. */
  autoGrant: boolean;
  conditions: EligibilityCondition[];
}

export type EligibilityRuleInput = Partial<
  Pick<
    EligibilityRule,
    | 'name'
    | 'track'
    | 'period'
    | 'windowMonths'
    | 'isActive'
    | 'priority'
    | 'autoGrant'
    | 'conditions'
  >
> & { programId?: string | null; rewardId?: string };

/** Persisted cache row (InternshipEligibilityStatus) — recomputable at any time. */
export interface EligibilityStatus extends Timestamped {
  _id: string;
  internProfileId: Ref<InternProfile>;
  ruleId: Ref<EligibilityRule>;
  rewardId?: Ref<Reward> | null;
  period: string | null;
  status: EligibilityState;
  /** Human sentence, e.g. "Missing 2 mandatory tasks". */
  reason?: string;
  progress: EligibilityProgress[];
  computedAt?: string;
  overriddenBy?: Ref<TeamMemberRef> | null;
  overrideNote?: string;
  overriddenStatus?: EligibilityState | null;
}

/** One evaluated rule as returned by the engine (evaluateIntern / evaluateProgram). */
export interface EligibilityEvaluation {
  /** InternshipEligibilityStatus._id — pass this to overrideEligibilityStatus(). */
  statusId?: string;
  ruleId: string;
  ruleName?: string;
  rewardId: string | null;
  rewardName: string;
  status: EligibilityState;
  reason: string;
  progress: EligibilityProgress[];
  period?: string | null;
}

/** GET /internship/eligibility — the intern's own view. */
export interface InternEligibilityView {
  rewardName: string;
  rewardType?: RewardType;
  status: EligibilityState;
  reason: string;
  progress: EligibilityProgress[];
  period: string | null;
  statusId?: string;
  ruleId?: string;
  ruleName?: string;
}

/** GET /admin/internship/eligibility — one row per intern in scope. */
export interface ProgramEligibilityRow {
  internProfileId: string;
  email: string;
  fullName?: string | null;
  track?: Track | null;
  statuses: EligibilityEvaluation[];
}

/** `program` is null when the board was requested without a programId. */
export interface ProgramEligibilityResponse {
  program: { _id: string; name: string; slug: string } | null;
  period: string;
  rows: ProgramEligibilityRow[];
}

// ── leaderboard ──────────────────────────────────────────────────────────

/**
 * `name` is deliberately anonymised to "First L." by the backend — a cohort board
 * is semi-public inside the batch, so it never carries emails or full surnames.
 */
export interface LeaderboardRow {
  rank: number;
  name: string;
  /** Points the ranking is sorted by (lifetime earned, not spendable balance). */
  points: number;
  isMe?: boolean;
}

/** `enabled: false` when the intern's program has leaderboards switched off. */
export interface LeaderboardResponse {
  enabled: boolean;
  rows: LeaderboardRow[];
  /** The batches the board covers — absent when the board is off. */
  programs?: { _id: string; name: string }[];
}

// ── admin dashboard ──────────────────────────────────────────────────────

export interface DashboardTrackRow {
  track: Track | 'unassigned';
  interns: number;
  activeInterns?: number;
  pointsBalance?: number;
  totalPointsEarned?: number;
}

export interface DashboardSummary {
  interns: number;
  activeInterns: number;
  pendingSubmissions: number;
  pendingRedemptions: number;
  /** Approved redemptions with no payout reference yet — money owed. */
  awaitingFulfilment: number;
  videosDue: number;
  pointsAwardedThisPeriod: number;
  stipendEligibleCount: number;
  byTrack: DashboardTrackRow[];
  period?: string;
}

// ── admin bulk-operation results ─────────────────────────────────────────

/** POST /programs/:id/enroll — created/updated are email lists, not counts. */
export interface EnrollResult {
  created: string[];
  updated: string[];
  invalid: { email: string; reason: string }[];
  createdCount: number;
  updatedCount: number;
}

export interface AssignmentBulkResult {
  created: { _id: string; internProfileId: string; email: string }[];
  /** Why each target was skipped (already assigned, no profile, removed…). */
  skipped: { email: string; internProfileId?: string; reason: string }[];
  createdCount: number;
  skippedCount: number;
  period: string | null;
}

export interface BulkApproveResult {
  /** Submission ids that were approved. */
  approved: string[];
  failed: { id: string; reason: string }[];
}

/** GET /admin/internship/interns/:id — profile plus everything hanging off it. */
export interface AdminInternDetail {
  profile: InternProfile;
  tasks: AssignedTask[];
  points: PointsSummary;
  eligibility: EligibilityStatus[];
}

export interface RecomputeResult {
  period: string;
  internsProcessed: number;
  programId?: string | null;
  failed?: { internProfileId: string; reason: string }[];
}
