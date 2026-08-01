'use client';

import { useParams } from 'next/navigation';
import React, { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import EventIcon from '@mui/icons-material/Event';
import HourglassTopRoundedIcon from '@mui/icons-material/HourglassTopRounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import AppShell from '@/components/AppShell';
import Art from '@/components/Art';
import { ErrorState, Loading, errorMessage } from '@/components/DataStates';
import Label, { type LabelColor } from '@/components/Label';
import MetaLine from '@/components/MetaLine';
import PageHeader from '@/components/PageHeader';
import ProofPreview from '@/components/ProofPreview';
import ProofUploader, { isProofComplete, type ProofValue } from '@/components/ProofUploader';
import Reveal from '@/components/Reveal';
import SectionHead from '@/components/SectionHead';
import { ART } from '@/lib/art';
import { RequireAuth } from '@/lib/auth/guards';
import { celebrate } from '@/lib/juice';
import { getMe, getMyTask, submitProof, type MeResponse } from '@/lib/api/internship';
import { FONT_DISPLAY } from '@/theme';
import type {
  AssignedTaskStatus,
  InternshipTask,
  ProofType,
  SubmissionFile,
  SubmissionStatus,
} from '@/lib/api/types';

/**
 * GET /internship/tasks/:id returns the flattened task plus every submission ever
 * made against it (resubmission history), shaped down to these fields.
 */
interface TaskSubmission {
  _id: string;
  status: SubmissionStatus;
  proofType: ProofType;
  textValue?: string;
  linkUrl?: string;
  usernameValue?: string;
  files?: SubmissionFile[];
  note?: string;
  rejectionReason?: string | null;
  pointsAwarded?: number;
  submittedAt?: string;
  /** Set once a reviewer has acted — absent while the attempt is still pending. */
  reviewedAt?: string;
}

type TaskDetail = InternshipTask & { submissions?: TaskSubmission[] };

const DATE_FMT = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const DATE_TIME_FMT = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

function formatDate(value?: string | null, withTime = false): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return (withTime ? DATE_TIME_FMT : DATE_FMT).format(d);
}

/** "4h ago" — falls back to the absolute date once it stops being recent news. */
function relativeTime(value?: string | null): string {
  if (!value) return '';
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return '';
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days <= 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return `on ${formatDate(value)}`;
}

/** Approved tasks never render the form, so they have no CTA of their own. */
const CTA_LABEL: Partial<Record<AssignedTaskStatus, string>> = {
  assigned: 'Submit proof',
  rejected: 'Resubmit proof',
  submitted: 'Submit again',
};

interface DueMeta {
  label: string;
  tone: 'error' | 'warning' | 'default';
}

/** A deadline only carries urgency while the task is still open. */
function dueMeta(dueDate: string | null | undefined, status: AssignedTaskStatus): DueMeta | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return null;

  const open = status === 'assigned' || status === 'rejected';
  const label = `Due ${formatDate(dueDate)}`;
  if (!open) return { label, tone: 'default' };

  const days = Math.ceil((due.getTime() - Date.now()) / 86400000);
  if (days < 0) {
    const late = Math.abs(days);
    return { label: `Overdue by ${late} day${late === 1 ? '' : 's'}`, tone: 'error' };
  }
  if (days === 0) return { label: 'Due today', tone: 'error' };
  if (days <= 2) return { label: `Due in ${days} day${days === 1 ? '' : 's'}`, tone: 'warning' };
  return { label, tone: 'default' };
}

// ── status strip ──────────────────────────────────────────────────────────

type StripTone = 'primary' | 'info' | 'success' | 'warning' | 'error';

/**
 * The screen's single status line. Every state the intern can be in resolves to
 * exactly one of these — the old stacked-Alert sandwich (approved + just-sent +
 * paused + rejected, all at once) never renders more than one band again.
 */
function StatusStrip({
  tone,
  label,
  line,
  icon,
}: {
  tone: StripTone;
  label: string;
  line?: React.ReactNode;
  icon?: React.ReactElement;
}) {
  return (
    <Stack
      direction="row"
      spacing={1.25}
      alignItems="flex-start"
      sx={{
        px: 1.5,
        py: 1.25,
        borderRadius: 2,
        bgcolor: (t) => alpha(t.palette[tone].main, 0.08),
        border: '1px solid',
        borderColor: (t) => alpha(t.palette[tone].main, 0.16),
      }}
    >
      <Label color={tone as LabelColor} startIcon={icon}>
        {label}
      </Label>
      {line && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ flexGrow: 1, minWidth: 0, pt: 0.15 }}
        >
          {line}
        </Typography>
      )}
    </Stack>
  );
}

const ICON_SX = { fontSize: 14 };

interface StripSpec {
  tone: StripTone;
  label: string;
  line?: string;
  icon: React.ReactElement;
  /** True when the strip itself prints the rejection reason (history must not echo it). */
  showsReason?: boolean;
}

function stripFor(
  task: TaskDetail,
  isActive: boolean,
  internStatus?: string,
  lastSubmittedAt?: string
): StripSpec {
  if (task.status === 'approved') {
    return {
      tone: 'success',
      label: 'Approved',
      line:
        (task.pointsAwarded ?? 0) > 0
          ? `${task.pointsAwarded} points are in your balance.`
          : 'Nothing left to do here.',
      icon: <CheckCircleRoundedIcon sx={ICON_SX} />,
    };
  }
  if (!isActive) {
    return internStatus === 'paused'
      ? {
          tone: 'warning',
          label: 'Paused',
          line: 'Submissions are closed while your internship is paused. Message the team to resume.',
          icon: <PauseCircleOutlineIcon sx={ICON_SX} />,
        }
      : {
          tone: 'warning',
          label: 'Read only',
          line: 'Your internship has ended, so this task can no longer be submitted.',
          icon: <LockOutlinedIcon sx={ICON_SX} />,
        };
  }
  if (task.status === 'rejected') {
    return {
      tone: 'error',
      label: 'Needs another try',
      line: task.rejectionReason ?? 'The reviewer asked for a better proof — fix it and resubmit.',
      icon: <ErrorOutlineRoundedIcon sx={ICON_SX} />,
      showsReason: Boolean(task.rejectionReason),
    };
  }
  if (task.status === 'submitted') {
    const sent = relativeTime(lastSubmittedAt);
    return {
      tone: 'info',
      label: 'In review',
      line: sent
        ? `Sent ${sent}. The team reviews submissions through the week.`
        : 'The team reviews submissions through the week.',
      icon: <HourglassTopRoundedIcon sx={ICON_SX} />,
    };
  }
  return {
    tone: 'primary',
    label: 'To do',
    line: 'Not submitted yet — send your proof below.',
    icon: <RadioButtonUncheckedIcon sx={ICON_SX} />,
  };
}

// ── pieces ────────────────────────────────────────────────────────────────

/**
 * The at-a-glance answer to "what is this worth, and when is it due". The points
 * tile matches the one on the task list so the two screens read as one object.
 * Status lives in the strip above — never printed twice.
 */
function TaskSummary({ task }: { task: TaskDetail }) {
  const due = dueMeta(task.dueDate, task.status);
  const urgent = due?.tone === 'error';
  const done = task.status === 'approved';

  return (
    <Card>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack
          alignItems="center"
          justifyContent="center"
          sx={{
            flexShrink: 0,
            width: 64,
            height: 64,
            borderRadius: 2.5,
            bgcolor: done ? 'success.lighter' : urgent ? 'error.lighter' : 'primary.lighter',
            color: done ? 'success.darker' : urgent ? 'error.darker' : 'primary.dark',
          }}
        >
          <Typography
            className="tnum"
            sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 26, lineHeight: 1 }}
          >
            {task.points}
          </Typography>
          <Typography sx={{ fontSize: 10, fontWeight: 600, opacity: 0.8, mt: 0.25 }}>
            points
          </Typography>
        </Stack>

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {task.isMandatory ? 'Required task' : 'Bonus task'}
          </Typography>
          <MetaLine
            sx={{ mt: 0.5 }}
            parts={[
              due && (
                <Box
                  component="span"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    color: due.tone === 'default' ? 'text.secondary' : `${due.tone}.dark`,
                    fontWeight: due.tone === 'default' ? 500 : 700,
                  }}
                >
                  {due.tone === 'default' ? (
                    <EventIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
                  ) : (
                    <PriorityHighIcon sx={{ fontSize: 15, color: `${due.tone}.main` }} />
                  )}
                  {due.label}
                </Box>
              ),
              task.cadence === 'daily-streak' && 'Daily streak',
              task.category,
            ]}
          />
        </Box>
      </Stack>
    </Card>
  );
}

/**
 * Instructions arrive as one newline-separated blob. Interns read them on a
 * phone mid-task, so they render as discrete numbered steps rather than a
 * pre-wrapped wall — and any numbering the admin typed by hand is stripped so
 * the list never reads "1. 1. Post the reel".
 */
function toSteps(instructions: string): string[] {
  return instructions
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^(?:\d+\s*[.)\]:-]|[-*•·—])\s*/, '').trim())
    .filter(Boolean);
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <Stack
      spacing={1.25}
      sx={{
        p: { xs: 1.5, sm: 2 },
        borderRadius: 2,
        bgcolor: 'grey.100',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      {steps.map((step, i) => (
        <Stack key={i} direction="row" spacing={1.25} alignItems="flex-start">
          <Box
            className="tnum"
            sx={{
              flexShrink: 0,
              width: 24,
              height: 24,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'primary.lighter',
              color: 'primary.dark',
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {i + 1}
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, pt: 0.15 }}>
            {step}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

const SUBMISSION_LABEL: Record<string, { tone: LabelColor; text: string }> = {
  approved: { tone: 'success', text: 'Approved' },
  rejected: { tone: 'error', text: 'Rejected' },
  pending: { tone: 'warning', text: 'Pending review' },
};

/** Newest first, on a rail — history is reference material, not the main event. */
function SubmissionHistory({
  submissions,
  /** Already shown in the status strip — never print it twice. */
  reasonShownAbove,
}: {
  submissions: TaskSubmission[];
  reasonShownAbove?: string | null;
}) {
  const DOT_TONE: Record<string, string> = {
    approved: 'success.main',
    rejected: 'error.main',
    pending: 'warning.main',
  };

  return (
    <Box>
      <SectionHead
        label="Submission history"
        count={submissions.length}
        caption="Everything you sent, newest first — exactly what the reviewer saw."
      />

      <Stack>
        {submissions.map((submission, i) => {
          const last = i === submissions.length - 1;
          const echoesBanner = i === 0 && submission.rejectionReason === reasonShownAbove;
          const attempt = submissions.length - i;
          const chip = SUBMISSION_LABEL[submission.status];
          return (
            <Reveal key={submission._id} index={i} sx={{ position: 'relative', pl: 3, pb: last ? 0 : 1.5 }}>
              {/* Rail: a hairline down the left, one dot per attempt. */}
              {!last && (
                <Box
                  sx={{
                    position: 'absolute',
                    left: 5,
                    top: 20,
                    bottom: 0,
                    width: '2px',
                    bgcolor: 'divider',
                  }}
                />
              )}
              <Box
                sx={{
                  position: 'absolute',
                  left: 0,
                  top: 8,
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  bgcolor: DOT_TONE[submission.status] ?? 'text.disabled',
                }}
              />

              <Box
                sx={{
                  p: { xs: 1.5, sm: 2 },
                  borderRadius: 2.5,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="flex-start"
                  justifyContent="space-between"
                  sx={{ mb: 1 }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      Attempt {attempt}
                      {i === 0 && submissions.length > 1 && (
                        <Box component="span" sx={{ color: 'text.disabled', fontWeight: 500 }}>
                          {' '}
                          · latest
                        </Box>
                      )}
                    </Typography>
                    <MetaLine
                      sx={{ mt: 0.25 }}
                      parts={[
                        submission.submittedAt && formatDate(submission.submittedAt, true),
                        submission.reviewedAt && `Reviewed ${relativeTime(submission.reviewedAt)}`,
                      ]}
                    />
                  </Box>
                  <Label color={chip?.tone ?? 'default'}>{chip?.text ?? submission.status}</Label>
                </Stack>

                {submission.status === 'rejected' && submission.rejectionReason && !echoesBanner && (
                  <Box
                    sx={{
                      mb: 1.25,
                      px: 1.5,
                      py: 1,
                      borderRadius: 1.5,
                      bgcolor: 'error.lighter',
                      color: 'error.darker',
                    }}
                  >
                    <Typography variant="caption">{submission.rejectionReason}</Typography>
                  </Box>
                )}
                {submission.status === 'approved' && (submission.pointsAwarded ?? 0) > 0 && (
                  <Typography
                    className="tnum"
                    variant="caption"
                    sx={{ display: 'block', mb: 1.25, color: 'success.dark', fontWeight: 700 }}
                  >
                    {submission.pointsAwarded} points added to your balance
                  </Typography>
                )}

                <ProofPreview
                  compact
                  proofType={submission.proofType}
                  files={submission.files ?? []}
                  textValue={submission.textValue}
                  linkUrl={submission.linkUrl}
                  usernameValue={submission.usernameValue}
                  note={submission.note}
                />
              </Box>
            </Reveal>
          );
        })}
      </Stack>
    </Box>
  );
}

// ── screen ────────────────────────────────────────────────────────────────

function TaskScreen() {
  const params = useParams<{ id: string }>();
  const taskId = params?.id ?? '';

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const [value, setValue] = useState<ProofValue>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const load = useCallback(
    (initial = false) => {
      if (!taskId) return;
      if (initial) setLoading(true);
      setError(null);
      Promise.all([
        getMyTask(taskId).then((t) => t as TaskDetail),
        // Read-only for paused/completed interns — better to say so than to let the
        // submit call fail after they have filled the form.
        getMe().catch(() => null),
      ])
        .then(([detail, identity]) => {
          setTask(detail);
          if (identity) setMe(identity);
        })
        .catch(setError)
        .finally(() => setLoading(false));
    },
    [taskId]
  );

  useEffect(() => {
    load(true);
  }, [load]);

  if (loading) return <Loading label="Loading this task…" />;
  if (error || !task) return <ErrorState error={error ?? 'Task not found'} onRetry={() => load(true)} />;

  const isActive = me?.internProfile ? me.internProfile.status === 'active' : true;
  const canSubmit = task.status !== 'approved' && isActive;
  const complete = isProofComplete(task.proofType, value);
  const steps = task.instructions ? toSteps(task.instructions) : [];
  const strip = stripFor(task, isActive, me?.internProfile?.status, task.submissions?.[0]?.submittedAt);
  const celebrating = justSubmitted && task.status === 'submitted';

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitProof(task._id, value);
      setValue({});
      setJustSubmitted(true);
      // THE moment of the product: proof is in, points are on their way.
      celebrate();
      load();
    } catch (e) {
      setSubmitError(errorMessage(e, 'Could not submit your proof.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader title={task.title} back="/tasks" />

      <Stack spacing={2.5}>
        {celebrating ? (
          <Reveal index={0}>
            <Card
              sx={{
                position: 'relative',
                textAlign: 'center',
                bgcolor: (t) => alpha(t.palette.success.main, 0.08),
                border: '1px solid',
                borderColor: (t) => alpha(t.palette.success.main, 0.2),
              }}
            >
              <IconButton
                aria-label="Dismiss"
                size="small"
                onClick={() => setJustSubmitted(false)}
                sx={{ position: 'absolute', top: 8, right: 8, color: 'text.disabled' }}
              >
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
              <Stack alignItems="center" spacing={0.75} sx={{ py: { xs: 3, sm: 3.5 }, px: 2 }}>
                <Art src={ART.character.present} size={96} />
                <Stack direction="row" alignItems="baseline" spacing={0.75} sx={{ flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Box
                    component="span"
                    className="tnum"
                    sx={{
                      fontFamily: FONT_DISPLAY,
                      fontSize: { xs: 40, sm: 48 },
                      fontWeight: 700,
                      lineHeight: 1,
                      color: 'success.darker',
                    }}
                  >
                    +{task.points}
                  </Box>
                  <Box component="span" sx={{ fontSize: 15, fontWeight: 700, color: 'success.dark' }}>
                    pts pending review
                  </Box>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  We&apos;ll review it soon
                </Typography>
              </Stack>
            </Card>
          </Reveal>
        ) : (
          <Reveal index={0}>
            <StatusStrip tone={strip.tone} label={strip.label} line={strip.line} icon={strip.icon} />
          </Reveal>
        )}

        <Reveal index={1}>
          <TaskSummary task={task} />
        </Reveal>

        {(task.description || steps.length > 0) && (
          <Reveal index={2}>
            <Card>
              <CardContent>
                <SectionHead label="What to do" />
                {task.description && (
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                    {task.description}
                  </Typography>
                )}
                {steps.length > 0 && (
                  <>
                    <Typography
                      variant="overline"
                      sx={{ color: 'text.secondary', display: 'block', mt: task.description ? 2 : 0, mb: 0.75 }}
                    >
                      Step by step
                    </Typography>
                    <StepList steps={steps} />
                  </>
                )}
              </CardContent>
            </Card>
          </Reveal>
        )}

        {canSubmit && (
          <Reveal index={3}>
            <Card sx={{ borderColor: task.status === 'rejected' ? 'error.light' : undefined }}>
              <CardContent>
                <SectionHead
                  label={task.status === 'rejected' ? 'Fix it and resubmit' : 'Submit your proof'}
                  caption={
                    task.status === 'submitted'
                      ? 'Your last attempt is still in review — send another only if something changed.'
                      : 'Approved proof puts the points straight into your balance.'
                  }
                />

                <ProofUploader
                  proofType={task.proofType}
                  value={value}
                  onChange={setValue}
                  disabled={submitting}
                  hint={
                    task.requiresDashboardProof
                      ? 'This task needs a screenshot of your creator dashboard showing the numbers.'
                      : undefined
                  }
                />

                {submitError && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {submitError}
                  </Alert>
                )}

                {/* Desktop keeps the form's own primary action; on a phone it moves
                    to the thumb-reachable sticky bar below. */}
                <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                  <Button
                    fullWidth
                    size="large"
                    variant="contained"
                    sx={{ mt: 2 }}
                    disabled={!complete || submitting}
                    onClick={submit}
                  >
                    {submitting ? 'Sending…' : (CTA_LABEL[task.status] ?? 'Submit proof')}
                  </Button>
                  {!complete && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mt: 0.75, textAlign: 'center' }}
                    >
                      Add your proof above to enable this.
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Reveal>
        )}

        {task.submissions && task.submissions.length > 0 && (
          <SubmissionHistory
            submissions={task.submissions}
            reasonShownAbove={strip.showsReason ? task.rejectionReason : null}
          />
        )}

        {/* Runway so the sticky bar never covers the last row on a phone. */}
        {canSubmit && <Box sx={{ display: { xs: 'block', sm: 'none' }, height: 64 }} />}
      </Stack>

      {/* Kept OUTSIDE the animated Stack: a transformed ancestor would turn this
          fixed bar into an absolutely-positioned one. Sits above the 60px nav. */}
      {canSubmit && (
        <Paper
          elevation={8}
          sx={{
            display: { xs: 'flex', sm: 'none' },
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 'calc(60px + env(safe-area-inset-bottom))',
            zIndex: (t) => t.zIndex.appBar,
            alignItems: 'center',
            gap: 1.5,
            px: 2,
            py: 1.25,
            borderRadius: 0,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography className="tnum" sx={{ fontWeight: 800, fontSize: 17, lineHeight: 1.2 }}>
              {task.points} points
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {complete ? 'Ready to send' : 'Add your proof above'}
            </Typography>
          </Box>
          <Button
            size="large"
            variant="contained"
            disabled={!complete || submitting}
            onClick={submit}
            sx={{ flexShrink: 0 }}
          >
            {submitting ? 'Sending…' : (CTA_LABEL[task.status] ?? 'Submit proof')}
          </Button>
        </Paper>
      )}
    </>
  );
}

export default function TaskDetailPage() {
  return (
    <RequireAuth>
      <AppShell>
        <TaskScreen />
      </AppShell>
    </RequireAuth>
  );
}
