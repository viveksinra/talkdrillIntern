'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import PriorityHighRoundedIcon from '@mui/icons-material/PriorityHighRounded';
import AppShell from '@/components/AppShell';
import Art from '@/components/Art';
import CountUp from '@/components/CountUp';
import { ErrorState, Loading } from '@/components/DataStates';
import EmptyState from '@/components/EmptyState';
import Label, { type LabelColor } from '@/components/Label';
import MetaLine from '@/components/MetaLine';
import PageHeader from '@/components/PageHeader';
import ProgressRing from '@/components/ProgressRing';
import Reveal from '@/components/Reveal';
import SectionHead from '@/components/SectionHead';
import { statusLabel } from '@/components/StatusChip';
import { EYEBROW, GLASS_PILL_SX } from '@/components/night';
import { RequireAuth } from '@/lib/auth/guards';
import { ART } from '@/lib/art';
import { celebrateOnce } from '@/lib/juice';
import { getMe, getMyTasks, type MeResponse } from '@/lib/api/internship';
import { FONT_DISPLAY } from '@/theme';
import type {
  AssignedTaskStatus,
  InternProfile,
  InternshipTask,
  MyTasksResponse,
  ProofType,
  Track,
} from '@/lib/api/types';

const TRACK_LABELS: Record<Track, string> = {
  campus: 'Campus Ambassador',
  content: 'Content Creator',
  marketing: 'Digital Marketing',
};

const DATE_FMT = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });

/** Statuses where the intern still owes us something. */
const NEEDS_ACTION: AssignedTaskStatus[] = ['assigned', 'rejected'];

/** The proof you have to produce is the fastest way to recognise a task in a list. */
const PROOF_ART: Record<ProofType, string> = {
  screenshot: ART.proof.screenshot,
  link: ART.proof.link,
  text: ART.proof.text,
  username: ART.proof.username,
  'video-metric': ART.proof.video,
  file: ART.proof.poster,
};

type Tone = 'primary' | 'success' | 'warning' | 'error';

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

function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// ── welcome banner ───────────────────────────────────────────────────────

/** One cell of the banner's stat strip; `href` turns the whole cell into a link. */
function BannerStat({
  label,
  children,
  href,
}: {
  label: string;
  children: React.ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <Typography
        sx={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.6)',
        }}
      >
        {label}
      </Typography>
      <Typography
        className="tnum"
        noWrap
        sx={{ fontWeight: 800, fontSize: { xs: 16, sm: 18 }, lineHeight: 1.3, mt: 0.25 }}
      >
        {children}
      </Typography>
    </>
  );

  if (!href) return <Box sx={{ flex: 1, minWidth: 0 }}>{body}</Box>;
  return (
    <Box
      component={Link}
      href={href}
      sx={{
        flex: 1,
        minWidth: 0,
        color: 'inherit',
        textDecoration: 'none',
        borderRadius: 1.5,
        transition: 'opacity .2s ease',
        '&:hover': { opacity: 0.82 },
      }}
    >
      {body}
    </Box>
  );
}

/**
 * The violet welcome band — greeting, the one big display name, and the
 * mandatory-completion ring. Everything on it is either the intern's own name
 * or a number straight off /internship/me and /internship/tasks.
 */
function WelcomeBanner({
  profile,
  approvedMandatory,
  totalMandatory,
  toDo,
  hasDailyTask,
}: {
  profile: InternProfile;
  approvedMandatory: number;
  totalMandatory: number;
  toDo: number;
  hasDailyTask: boolean;
}) {
  const firstName = profile.fullName ? profile.fullName.trim().split(' ')[0] : null;
  const greeting = greetingFor(new Date().getHours());
  const pct = totalMandatory ? (approvedMandatory / totalMandatory) * 100 : 0;

  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 3,
        p: { xs: 2.5, sm: 3 },
        color: 'common.white',
        background: (t) =>
          `linear-gradient(135deg, ${t.palette.primary.main} 0%, ${t.palette.primary.dark} 52%, ${t.palette.primary.darker} 100%)`,
        boxShadow: (t) => t.customShadows.primary,
      }}
    >
      {/* Decorative bokeh — the website's dashboard welcome-banner treatment. */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          width: 240,
          height: 240,
          borderRadius: '50%',
          bgcolor: 'rgba(255,255,255,0.07)',
          top: -110,
          right: -70,
        }}
      />
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          width: 150,
          height: 150,
          borderRadius: '50%',
          bgcolor: 'rgba(255,255,255,0.05)',
          bottom: -84,
          right: 90,
        }}
      />
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          width: 110,
          height: 110,
          borderRadius: '50%',
          bgcolor: 'rgba(245,166,35,0.12)',
          top: 30,
          left: -52,
        }}
      />

      <Box sx={{ position: 'relative' }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ ...EYEBROW, color: 'rgba(255,255,255,0.62)' }}>{greeting}</Typography>
            <Typography
              sx={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 600,
                fontSize: { xs: 30, sm: 40 },
                lineHeight: 1.1,
                mt: 0.5,
                wordBreak: 'break-word',
              }}
            >
              {firstName ?? 'Welcome back'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.74)', mt: 0.75 }}>
              {toDo > 0
                ? `${toDo} task${toDo === 1 ? '' : 's'} waiting on you`
                : totalMandatory > 0
                  ? 'Nothing is waiting on you right now'
                  : 'No tasks assigned yet'}
            </Typography>
            {hasDailyTask && (
              <Box sx={{ ...GLASS_PILL_SX, mt: 1.5 }}>
                <Art src={ART.streak.flame} size={18} />
                Daily task
              </Box>
            )}
          </Box>

          {totalMandatory > 0 ? (
            <ProgressRing
              value={pct}
              size={92}
              thickness={7}
              color="#F5A623"
              trackColor="rgba(255,255,255,0.2)"
              ariaLabel={`${approvedMandatory} of ${totalMandatory} required tasks approved`}
            >
              <Box sx={{ color: 'text.primary' }}>
                <Typography className="tnum" sx={{ fontWeight: 800, fontSize: 19, lineHeight: 1 }}>
                  {approvedMandatory}/{totalMandatory}
                </Typography>
                <Typography
                  sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', opacity: 0.6 }}
                >
                  DONE
                </Typography>
              </Box>
            </ProgressRing>
          ) : (
            <Art src={ART.mascot.wave} size={{ xs: 72, sm: 88 }} />
          )}
        </Stack>

        <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.16)' }} />

        <Stack
          direction="row"
          spacing={2}
          divider={
            <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.16)' }} />
          }
        >
          <BannerStat label="Points" href="/points">
            <CountUp value={profile.pointsBalance} />
          </BannerStat>
          <BannerStat label="To do">{toDo}</BannerStat>
          <BannerStat label="Track">
            {profile.track ? TRACK_LABELS[profile.track] : 'Pending'}
          </BannerStat>
        </Stack>
      </Box>
    </Box>
  );
}

// ── task rows ────────────────────────────────────────────────────────────

/**
 * One task as a single tap target. A compact row rather than a slab: the proof
 * art says what kind of work it is, the meta line says when and how much, and
 * the state lives in a 3px rail instead of a shouting block, so a list of eight
 * stays scannable on a 390px screen.
 */
function TaskRow({ task }: { task: InternshipTask }) {
  const due = dueMeta(task.dueDate, task.status);
  const done = task.status === 'approved';
  const rejected = task.status === 'rejected';
  const overdue = due?.color === 'error';

  const rail: 'warning' | 'error' | null = rejected ? 'error' : overdue ? 'warning' : null;
  const tone: Tone = done ? 'success' : rejected ? 'error' : overdue ? 'warning' : 'primary';
  const attempts = task.submissionCount;

  return (
    <Card
      sx={{
        position: 'relative',
        overflow: 'hidden',
        ...(done && { bgcolor: (t) => alpha(t.palette.success.main, 0.06) }),
        transition: 'transform .25s ease, box-shadow .25s ease, border-color .25s ease',
        '&:hover': {
          transform: { md: 'translateY(-3px)' },
          borderColor: (t) => t.palette[tone].main,
          boxShadow: (t) => `0 18px 36px -24px ${alpha(t.palette[tone].main, 0.75)}`,
        },
        ...(rail && {
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            bgcolor: `${rail}.main`,
            zIndex: 1,
          },
        }),
      }}
    >
      <CardActionArea component={Link} href={`/tasks/${task._id}`} sx={{ p: { xs: 1.75, sm: 2 } }}>
        <Stack direction="row" spacing={1.75} alignItems="center">
          <Box
            sx={{
              flexShrink: 0,
              width: 48,
              height: 48,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              bgcolor: `${tone}.lighter`,
            }}
          >
            <Art src={PROOF_ART[task.proofType] ?? ART.proof.text} size={32} />
          </Box>

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                lineHeight: 1.35,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {task.title}
            </Typography>

            {rejected && task.rejectionReason && (
              <Typography
                variant="caption"
                noWrap
                title={task.rejectionReason}
                sx={{ display: 'block', color: 'error.main', fontWeight: 600, mt: 0.25 }}
              >
                {task.rejectionReason}
              </Typography>
            )}

            <MetaLine
              sx={{ mt: 0.5 }}
              parts={[
                due && (
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.25,
                      color: due.color === 'default' ? 'inherit' : `${due.color}.dark`,
                      fontWeight: due.color === 'default' ? 400 : 700,
                    }}
                  >
                    {due.color === 'default' ? (
                      <EventRoundedIcon sx={{ fontSize: 14 }} />
                    ) : (
                      <PriorityHighRoundedIcon sx={{ fontSize: 14 }} />
                    )}
                    {due.label}
                  </Box>
                ),
                task.cadence === 'daily-streak' && 'Daily task',
                task.status === 'submitted' && statusLabel('submitted'),
                done && (task.pointsAwarded ?? 0) > 0 && (
                  <Box component="span" sx={{ color: 'success.dark', fontWeight: 700 }}>
                    +{task.pointsAwarded} pts added
                  </Box>
                ),
                attempts > 0 && `${attempts} attempt${attempts === 1 ? '' : 's'}`,
              ]}
            />
          </Box>

          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
            <Label color={done ? 'success' : 'primary'} variant="soft">
              {task.points} pts
            </Label>
            {done && <CheckCircleRoundedIcon sx={{ fontSize: 20, color: 'success.main' }} />}
            <ChevronRightRoundedIcon sx={{ fontSize: 20, color: 'text.disabled' }} />
          </Stack>
        </Stack>
      </CardActionArea>
    </Card>
  );
}

function TaskSection({
  label,
  caption,
  tasks,
}: {
  label: string;
  caption: string;
  tasks: InternshipTask[];
}) {
  // An empty section is not worth a dashed box — it just adds a dead slab.
  if (!tasks.length) return null;
  const outstanding = tasks.filter((t) => NEEDS_ACTION.includes(t.status)).length;

  return (
    <Box>
      <SectionHead
        label={label}
        count={tasks.length}
        caption={caption}
        action={
          outstanding > 0 ? (
            <Label color="warning" variant="soft">
              {outstanding} to do
            </Label>
          ) : undefined
        }
      />
      <Stack spacing={1.25}>
        {tasks.map((task, i) => (
          <Reveal key={task._id} index={i}>
            <TaskRow task={task} />
          </Reveal>
        ))}
      </Stack>
    </Box>
  );
}

/** One line, one label — a paused/completed internship is context, not an alarm. */
function StatusStrip({ status }: { status: InternProfile['status'] }) {
  const color: LabelColor = status === 'paused' ? 'warning' : 'info';
  const line =
    status === 'paused'
      ? 'Submissions are closed. Message the team to resume.'
      : status === 'completed'
        ? 'Your internship has ended — this is now read-only.'
        : 'Your internship is not active yet.';

  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      sx={{
        px: 1.75,
        py: 1.25,
        borderRadius: 2,
        bgcolor: (t) => alpha(t.palette[color].main, 0.08),
      }}
    >
      <Label color={color} variant="soft">
        {statusLabel(status)}
      </Label>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 0 }}>
        {line}
      </Typography>
    </Stack>
  );
}

// ── screen ───────────────────────────────────────────────────────────────

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

  const mandatory = useMemo(() => tasks?.mandatory ?? [], [tasks]);
  const optional = useMemo(() => tasks?.optional ?? [], [tasks]);

  const stats = useMemo(() => {
    const all = [...mandatory, ...optional];
    const approvedMandatory = mandatory.filter((t) => t.status === 'approved').length;
    return {
      approvedMandatory,
      totalMandatory: mandatory.length,
      toDo: all.filter((t) => NEEDS_ACTION.includes(t.status)).length,
      hasDailyTask: all.some((t) => t.cadence === 'daily-streak'),
      // "All done" means the mandatory set is complete AND nothing anywhere is
      // still open or in review.
      allDone: mandatory.length > 0 && all.every((t) => t.status === 'approved'),
    };
  }, [mandatory, optional]);

  const profileId = profile?._id;
  useEffect(() => {
    if (stats.allDone && profileId) celebrateOnce(`tasks-all-done-${profileId}`);
  }, [stats.allDone, profileId]);

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

    return (
      <Stack spacing={3}>
        <WelcomeBanner
          profile={profile}
          approvedMandatory={stats.approvedMandatory}
          totalMandatory={stats.totalMandatory}
          toDo={stats.toDo}
          hasDailyTask={stats.hasDailyTask}
        />

        {profile.status !== 'active' && <StatusStrip status={profile.status} />}

        {!mandatory.length && !optional.length ? (
          <EmptyState
            art={ART.mascot.sleeping}
            title="Nothing here yet"
            description="Your first tasks land here as soon as the team assigns them. Meanwhile, make sure your handles are up to date so your proof can be verified."
            action={
              <Button component={Link} href="/onboarding" variant="contained">
                Check my profile
              </Button>
            }
          />
        ) : (
          <>
            {stats.allDone && (
              <Card sx={{ bgcolor: (t) => alpha(t.palette.success.main, 0.08) }}>
                <EmptyState
                  bare
                  art={ART.empty.allDone}
                  title="Every task approved"
                  description="Nothing is pending. New tasks land here the moment the team assigns them."
                />
              </Card>
            )}

            <TaskSection
              label="Required tasks"
              caption="These decide your stipend and certificate. Do these first."
              tasks={mandatory}
            />

            <TaskSection
              label="Bonus tasks"
              caption="Optional — extra points on top of your required work."
              tasks={optional}
            />
          </>
        )}

        <Button
          component={Link}
          href="/onboarding"
          variant="text"
          size="small"
          sx={{ alignSelf: 'flex-start' }}
        >
          Update my track details and handles
        </Button>
      </Stack>
    );
  };

  // The violet band is the page title for an enrolled intern; everyone else
  // (loading, admin, not-enrolled) still needs a plain heading.
  const showPlainHeader = !profile || needsOnboarding;

  return (
    <>
      {showPlainHeader && <PageHeader title="My tasks" />}
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
