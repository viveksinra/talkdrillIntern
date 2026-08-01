'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import React, { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import EventIcon from '@mui/icons-material/Event';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import AppShell from '@/components/AppShell';
import { ErrorState, Loading, errorMessage } from '@/components/DataStates';
import PageHeader from '@/components/PageHeader';
import ProofPreview from '@/components/ProofPreview';
import ProofUploader, { isProofComplete, type ProofValue } from '@/components/ProofUploader';
import StatusChip from '@/components/StatusChip';
import { RequireAuth } from '@/lib/auth/guards';
import { getMe, getMyTask, submitProof, type MeResponse } from '@/lib/api/internship';
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

const CTA_LABEL: Record<AssignedTaskStatus, string> = {
  assigned: 'Submit proof',
  rejected: 'Resubmit proof',
  submitted: 'Submit again',
  approved: 'Submit proof',
};

/** A middot separator between two pieces of quiet metadata. */
function Dot() {
  return (
    <Box component="span" sx={{ color: 'text.disabled' }}>
      ·
    </Box>
  );
}

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

/**
 * The at-a-glance answer to "what is this worth, and when is it due". The points
 * tile matches the one on the task list so the two screens read as one object.
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
          <Typography className="tnum" sx={{ fontWeight: 800, fontSize: 22, lineHeight: 1 }}>
            {task.points}
          </Typography>
          <Typography sx={{ fontSize: 10, fontWeight: 600, opacity: 0.8, mt: 0.25 }}>
            points
          </Typography>
        </Stack>

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <StatusChip status={task.status} withIcon />

          <Stack
            direction="row"
            alignItems="center"
            sx={{ mt: 1, gap: 1, flexWrap: 'wrap', typography: 'caption' }}
          >
            {due && (
              <Stack direction="row" spacing={0.5} alignItems="center">
                {due.tone === 'default' ? (
                  <EventIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
                ) : (
                  <PriorityHighIcon sx={{ fontSize: 15, color: `${due.tone}.main` }} />
                )}
                <Box
                  component="span"
                  sx={{
                    color: due.tone === 'default' ? 'text.secondary' : `${due.tone}.dark`,
                    fontWeight: due.tone === 'default' ? 500 : 700,
                  }}
                >
                  {due.label}
                </Box>
              </Stack>
            )}
            {due && <Dot />}
            <Box component="span" sx={{ color: 'text.secondary' }}>
              {task.isMandatory ? 'Required' : 'Bonus'}
            </Box>
            {task.cadence === 'daily-streak' && (
              <>
                <Dot />
                <Box component="span" sx={{ color: 'text.secondary' }}>
                  Daily streak
                </Box>
              </>
            )}
            {task.category && (
              <>
                <Dot />
                <Box component="span" sx={{ color: 'text.secondary' }}>
                  {task.category}
                </Box>
              </>
            )}
          </Stack>
        </Box>
      </Stack>
    </Card>
  );
}

/** Newest first, on a rail — history is reference material, not the main event. */
function SubmissionHistory({
  submissions,
  /** Already shown in the banner above the uploader — never print it twice. */
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
      <Stack direction="row" alignItems="baseline" spacing={1} sx={{ px: 0.5 }}>
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
          Submission history
        </Typography>
        <Typography className="tnum" variant="caption" sx={{ color: 'text.disabled', fontWeight: 600 }}>
          {submissions.length}
        </Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, px: 0.5 }}>
        Everything you sent, newest first — exactly what the reviewer saw.
      </Typography>

      <Stack>
        {submissions.map((submission, i) => {
          const last = i === submissions.length - 1;
          const echoesBanner = i === 0 && submission.rejectionReason === reasonShownAbove;
          return (
            <Box key={submission._id} sx={{ position: 'relative', pl: 3, pb: last ? 0 : 1.5 }}>
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
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ mb: 1 }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {i === 0 ? 'Latest attempt' : `Attempt ${submissions.length - i}`}
                    </Typography>
                    {submission.submittedAt && (
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(submission.submittedAt, true)}
                      </Typography>
                    )}
                  </Box>
                  <StatusChip status={submission.status} />
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
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}

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

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitProof(task._id, value);
      setValue({});
      setJustSubmitted(true);
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
        <TaskSummary task={task} />

        {task.status === 'approved' && (
          <Alert severity="success">
            <AlertTitle sx={{ mb: 0.25 }}>Approved</AlertTitle>
            {(task.pointsAwarded ?? 0) > 0
              ? `${task.pointsAwarded} points are in your balance.`
              : 'Nothing left to do here.'}
          </Alert>
        )}

        {justSubmitted && task.status === 'submitted' && (
          <Alert severity="success" onClose={() => setJustSubmitted(false)}>
            Proof sent. The team reviews submissions through the week — you will see the points land
            here.
          </Alert>
        )}

        {(task.description || task.instructions) && (
          <Card>
            <CardContent>
              <Typography variant="overline" sx={{ color: 'primary.main', display: 'block', mb: 0.75 }}>
                What to do
              </Typography>
              {task.description && (
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {task.description}
                </Typography>
              )}
              {task.instructions && (
                <>
                  {task.description && <Divider sx={{ my: 2 }} />}
                  <Typography
                    variant="overline"
                    sx={{ color: 'text.secondary', display: 'block', mb: 0.75 }}
                  >
                    Step by step
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}
                  >
                    {task.instructions}
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {!isActive && (
          <Alert severity="warning">
            {me?.internProfile?.status === 'paused'
              ? 'Your internship is paused, so submissions are closed. Message the team to resume.'
              : 'Your internship has ended — this task is read-only now.'}
          </Alert>
        )}

        {/* The rejection reason belongs immediately above the box the intern has to
            fix it in, not buried at the top of the page. */}
        {task.status === 'rejected' && task.rejectionReason && (
          <Alert severity="error">
            <AlertTitle sx={{ mb: 0.25 }}>Needs another try</AlertTitle>
            {task.rejectionReason}
          </Alert>
        )}

        {canSubmit && (
          <Card sx={{ borderColor: task.status === 'rejected' ? 'error.light' : undefined }}>
            <CardContent>
              <Typography variant="overline" sx={{ color: 'primary.main', display: 'block' }}>
                {task.status === 'rejected' ? 'Fix it and resubmit' : 'Submit your proof'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                {task.status === 'submitted'
                  ? 'Your last attempt is still in review — send another only if something changed.'
                  : 'Approved proof puts the points straight into your balance.'}
              </Typography>

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

              {/* The one legitimate full-width button on this screen: the form's
                  single primary action. */}
              <Button
                fullWidth
                size="large"
                variant="contained"
                sx={{ mt: 2 }}
                disabled={!complete || submitting}
                onClick={submit}
              >
                {submitting ? 'Sending…' : CTA_LABEL[task.status]}
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
            </CardContent>
          </Card>
        )}

        {task.submissions && task.submissions.length > 0 ? (
          <SubmissionHistory
            submissions={task.submissions}
            reasonShownAbove={task.status === 'rejected' ? task.rejectionReason : null}
          />
        ) : (
          task.status !== 'approved' && (
            <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
              No submissions yet. Everything you send stays here so you can see what the reviewer
              saw.
            </Typography>
          )
        )}

        <Box>
          <Button
            component={Link}
            href="/tasks"
            variant="text"
            size="small"
            startIcon={<ArrowBackRoundedIcon />}
          >
            All tasks
          </Button>
        </Box>
      </Stack>
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
