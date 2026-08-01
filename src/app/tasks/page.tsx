'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import EventIcon from '@mui/icons-material/Event';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import AppShell from '@/components/AppShell';
import { ErrorState, Loading } from '@/components/DataStates';
import EmptyState from '@/components/EmptyState';
import PageHeader from '@/components/PageHeader';
import PointsBadge from '@/components/PointsBadge';
import StatusChip from '@/components/StatusChip';
import { RequireAuth } from '@/lib/auth/guards';
import { getMe, getMyTasks, type MeResponse } from '@/lib/api/internship';
import type { AssignedTaskStatus, InternshipTask, MyTasksResponse, Track } from '@/lib/api/types';

const TRACK_LABELS: Record<Track, string> = {
  campus: 'Campus Ambassador',
  content: 'Content Creator',
  marketing: 'Digital Marketing',
};

const DATE_FMT = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });

/** Statuses where the intern still owes us something. */
const NEEDS_ACTION: AssignedTaskStatus[] = ['assigned', 'rejected'];

const CTA_LABEL: Record<AssignedTaskStatus, string> = {
  assigned: 'Submit proof',
  rejected: 'Resubmit',
  submitted: 'View submission',
  approved: 'View task',
};

interface DueMeta {
  label: string;
  color: 'error' | 'warning' | 'default';
}

/**
 * Deadlines only carry urgency while the task is still open — an approved task
 * whose deadline has passed must not shout in red.
 */
function dueMeta(dueDate: string | null | undefined, status: AssignedTaskStatus): DueMeta | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return null;

  const label = `Due ${DATE_FMT.format(due)}`;
  if (!NEEDS_ACTION.includes(status)) return { label, color: 'default' };

  const days = Math.ceil((due.getTime() - Date.now()) / 86400000);
  if (days < 0) {
    const overdue = Math.abs(days);
    return { label: `Overdue by ${overdue} day${overdue === 1 ? '' : 's'}`, color: 'error' };
  }
  if (days === 0) return { label: 'Due today', color: 'error' };
  if (days <= 2) return { label: `Due in ${days} day${days === 1 ? '' : 's'}`, color: 'warning' };
  return { label, color: 'default' };
}

/**
 * One task as a single tap target. The whole card is the link — a per-card
 * button block turned the list into a column of identical purple slabs, which
 * made scanning eight tasks harder than it needed to be. Urgency is carried by
 * the points block and the due line, not by shouting at every row.
 */
function TaskCard({ task }: { task: InternshipTask }) {
  const due = dueMeta(task.dueDate, task.status);
  const needsAction = NEEDS_ACTION.includes(task.status);
  const urgent = due?.color === 'error';
  const done = task.status === 'approved';

  return (
    <Card
      sx={{
        overflow: 'hidden',
        transition: (t) =>
          t.transitions.create(['box-shadow', 'transform', 'border-color'], { duration: 200 }),
        '&:hover': {
          transform: { md: 'translateY(-2px)' },
          borderColor: 'primary.light',
          boxShadow: (t) => t.customShadows.cardHover,
        },
        // A rejected task is the one thing the intern must come back to.
        ...(task.status === 'rejected' && { borderColor: 'error.light' }),
      }}
    >
      <CardActionArea component={Link} href={`/tasks/${task._id}`} sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          {/* Points block — the reward is the reason to tap, so it leads. */}
          <Stack
            alignItems="center"
            justifyContent="center"
            sx={{
              flexShrink: 0,
              width: 56,
              height: 56,
              borderRadius: 2.5,
              bgcolor: done ? 'success.lighter' : urgent ? 'error.lighter' : 'primary.lighter',
              color: done ? 'success.darker' : urgent ? 'error.darker' : 'primary.dark',
            }}
          >
            <Typography className="tnum" sx={{ fontWeight: 800, fontSize: 18, lineHeight: 1 }}>
              {task.points}
            </Typography>
            <Typography sx={{ fontSize: 10, fontWeight: 600, opacity: 0.8, mt: 0.25 }}>
              pts
            </Typography>
          </Stack>

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 700, flexGrow: 1, minWidth: 0, pr: 0.5 }}
              >
                {task.title}
              </Typography>
              <StatusChip status={task.status} />
            </Stack>

            {task.description && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mt: 0.5,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {task.description}
              </Typography>
            )}

            {/* Meta as quiet text with dot separators — chips here competed
                with the status chip for attention. */}
            <Stack
              direction="row"
              alignItems="center"
              sx={{ mt: 1.25, gap: 1, flexWrap: 'wrap', typography: 'caption' }}
            >
              {due && (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  {due.color === 'default' ? (
                    <EventIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
                  ) : (
                    <PriorityHighIcon sx={{ fontSize: 15, color: `${due.color}.main` }} />
                  )}
                  <Box
                    component="span"
                    sx={{
                      color: due.color === 'default' ? 'text.secondary' : `${due.color}.dark`,
                      fontWeight: due.color === 'default' ? 500 : 700,
                    }}
                  >
                    {due.label}
                  </Box>
                </Stack>
              )}
              {task.cadence === 'daily-streak' && (
                <>
                  {due && <Box component="span" sx={{ color: 'text.disabled' }}>·</Box>}
                  <Box component="span" sx={{ color: 'text.secondary' }}>Daily streak</Box>
                </>
              )}
              {done && (task.pointsAwarded ?? 0) > 0 && (
                <>
                  {(due || task.cadence === 'daily-streak') && (
                    <Box component="span" sx={{ color: 'text.disabled' }}>·</Box>
                  )}
                  <Box component="span" sx={{ color: 'success.dark', fontWeight: 700 }}>
                    {task.pointsAwarded} pts added
                  </Box>
                </>
              )}
            </Stack>

            {task.status === 'rejected' && task.rejectionReason && (
              <Box
                sx={{
                  mt: 1.5,
                  px: 1.5,
                  py: 1,
                  borderRadius: 1.5,
                  bgcolor: 'error.lighter',
                  color: 'error.darker',
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                  Needs another try
                </Typography>
                <Typography variant="caption">{task.rejectionReason}</Typography>
              </Box>
            )}
          </Box>

          <ChevronRightRoundedIcon
            sx={{
              display: { xs: 'none', sm: 'block' },
              alignSelf: 'center',
              color: needsAction ? 'primary.main' : 'text.disabled',
            }}
          />
        </Stack>
      </CardActionArea>
    </Card>
  );
}

function TaskSection({
  title,
  caption,
  tasks,
  tone,
}: {
  title: string;
  caption: string;
  tasks: InternshipTask[];
  tone: 'primary' | 'muted';
}) {
  const outstanding = tasks.filter((t) => NEEDS_ACTION.includes(t.status)).length;

  return (
    <Box>
      {/* Typographic section head — the old filled slab read as a card and
          competed with the actual task cards below it. */}
      <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 0.5, px: 0.5 }}>
        <Typography
          variant="overline"
          sx={{ color: tone === 'primary' ? 'primary.main' : 'text.secondary' }}
        >
          {title}
        </Typography>
        {outstanding > 0 && (
          <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600 }}>
            {outstanding} to do
          </Typography>
        )}
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, px: 0.5 }}>
        {caption}
      </Typography>

      {tasks.length === 0 ? (
        <EmptyState
          dense
          title={tone === 'primary' ? 'No required tasks right now' : 'No bonus tasks yet'}
          description={
            tone === 'primary'
              ? 'Nothing mandatory is pending. Check back after the team assigns the next batch.'
              : 'Optional tasks appear here when the team adds them.'
          }
        />
      ) : (
        <Stack spacing={1.5}>
          {tasks.map((task) => (
            <TaskCard key={task._id} task={task} />
          ))}
        </Stack>
      )}
    </Box>
  );
}

function TasksHeader({ me }: { me: MeResponse | null }) {
  const profile = me?.internProfile;
  if (!profile) return <PageHeader title="My tasks" />;

  const firstName = profile.fullName ? profile.fullName.trim().split(' ')[0] : null;
  return (
    <PageHeader
      title="My tasks"
      subtitle={firstName ? `Hi ${firstName} — here is what is on your plate.` : undefined}
      meta={
        <>
          <Chip
            size="small"
            color="primary"
            label={profile.track ? TRACK_LABELS[profile.track] : 'Track pending'}
            sx={{ fontWeight: 600 }}
          />
          <StatusChip status={profile.status} />
          <Chip
            size="small"
            variant="outlined"
            component={Link}
            href="/points"
            clickable
            label={`${profile.pointsBalance} pts`}
            sx={{ fontWeight: 600 }}
          />
        </>
      }
    />
  );
}

function TasksScreen() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [tasks, setTasks] = useState<MyTasksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getMe()
      .then(async (identity) => {
        setMe(identity);
        // Admins and unenrolled users have no assignments — /tasks 403s for them.
        if (identity.principal === 'admin' || !identity.internProfile) return null;
        return getMyTasks();
      })
      .then(setTasks)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const profile = me?.internProfile ?? null;
  // Onboarding gates everything else: handles and track drive verification.
  const needsOnboarding = Boolean(profile && !profile.onboardingAccepted);

  useEffect(() => {
    if (needsOnboarding) router.replace('/onboarding');
  }, [needsOnboarding, router]);

  const renderBody = () => {
    if (loading) return <Loading label="Loading your tasks…" skeletonRows={3} />;
    if (error) return <ErrorState error={error} onRetry={load} />;

    if (me?.principal === 'admin') {
      return (
        <Alert
          severity="info"
          action={
            <Button component={Link} href="/admin" color="inherit" size="small">
              Admin
            </Button>
          }
        >
          You are signed in as a team member, so there are no assignments here. The admin console is
          where tasks get created and verified.
        </Alert>
      );
    }

    // Preserved wording: this is the screen a non-intern TalkDrill user lands on.
    if (!profile) {
      return (
        <Alert severity="info">
          Your account isn&apos;t enrolled in an internship yet. If you just joined, make sure you
          signed in with the same email you shared with the TalkDrill team.
        </Alert>
      );
    }

    if (needsOnboarding) return <Loading label="Taking you to onboarding…" />;

    const mandatory = tasks?.mandatory ?? [];
    const optional = tasks?.optional ?? [];

    if (!mandatory.length && !optional.length) {
      return (
        <EmptyState
          icon={<AssignmentTurnedInIcon />}
          title="No tasks assigned yet"
          description="Your first tasks land here as soon as the team assigns them. Meanwhile, make sure your handles are up to date so your proof can be verified."
          action={
            <Button component={Link} href="/onboarding" variant="contained">
              Check my profile
            </Button>
          }
        />
      );
    }

    return (
      <Stack spacing={3}>
        {profile.status !== 'active' && (
          <Alert severity={profile.status === 'paused' ? 'warning' : 'info'}>
            {profile.status === 'paused'
              ? 'Your internship is paused, so submissions are closed. Message the team to resume.'
              : profile.status === 'completed'
                ? 'Your internship has ended — this is now read-only.'
                : 'Your internship is not active yet.'}
          </Alert>
        )}

        <TaskSection
          title="Required tasks"
          caption="These decide your stipend and certificate. Do these first."
          tasks={mandatory}
          tone="primary"
        />

        <TaskSection
          title="Bonus tasks"
          caption="Optional — extra points on top of your required work."
          tasks={optional}
          tone="muted"
        />

        <Button component={Link} href="/onboarding" variant="text" size="small">
          Update my track details and handles
        </Button>
      </Stack>
    );
  };

  return (
    <>
      <TasksHeader me={me} />
      {renderBody()}
    </>
  );
}

export default function TasksPage() {
  return (
    <RequireAuth>
      <AppShell>
        <TasksScreen />
      </AppShell>
    </RequireAuth>
  );
}
