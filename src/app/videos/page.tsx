'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import MuiLink from '@mui/material/Link';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import FavoriteIcon from '@mui/icons-material/Favorite';
import MovieCreationIcon from '@mui/icons-material/MovieCreation';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AppShell from '@/components/AppShell';
import { ErrorState, Loading, errorMessage } from '@/components/DataStates';
import EmptyState from '@/components/EmptyState';
import PageHeader from '@/components/PageHeader';
import StatusChip, { statusLabel } from '@/components/StatusChip';
import { isValidUrl, normalizeUrl } from '@/components/ProofUploader';
import { RequireAuth } from '@/lib/auth/guards';
import { getMe, getMyVideos, submitVideo, type MeResponse } from '@/lib/api/internship';
import type { VideoPlatform, VideoSubmission } from '@/lib/api/types';

/** The list endpoint adds the countdown, the tier's label and the program name. */
type MyVideo = VideoSubmission & {
  daysToEvaluation?: number | null;
  lockedTierLabel?: string | null;
  program?: { _id: string; name: string } | null;
};

const EVALUATION_WINDOW_DAYS = 30;

const PLATFORMS: { value: VideoPlatform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'other', label: 'Somewhere else' },
];

const DATE_FMT = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : DATE_FMT.format(d);
}

const NUM = new Intl.NumberFormat('en-IN');
const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** Local YYYY-MM-DD — the date input needs it and a UTC slice can be a day off. */
function todayInputValue(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

/** A full reel URL wrapped over three lines was the loudest thing on the card. */
function shortUrl(raw: string): string {
  return raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
}

/** A middot separator between two pieces of quiet metadata. */
function Dot() {
  return (
    <Box component="span" sx={{ color: 'text.disabled' }}>
      ·
    </Box>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon?: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <Box>
      <Stack direction="row" spacing={0.75} alignItems="center">
        {icon && (
          <Box sx={{ color: 'text.disabled', display: 'flex', '& svg': { fontSize: 18 } }}>
            {icon}
          </Box>
        )}
        <Typography className="tnum" sx={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>
          {value}
        </Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

/**
 * The 30-day countdown is the whole emotional content of a pending video, so it
 * gets a figure rather than a sentence.
 */
function Countdown({ days, dueAt }: { days: number | null; dueAt?: string }) {
  const elapsedPct =
    days === null
      ? 0
      : Math.max(0, Math.min(100, ((EVALUATION_WINDOW_DAYS - days) / EVALUATION_WINDOW_DAYS) * 100));

  return (
    <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: 'primary.lighter', color: 'primary.darker' }}>
      <Stack direction="row" alignItems="baseline" spacing={0.75}>
        {days === null ? (
          <Typography sx={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>Counting</Typography>
        ) : days === 0 ? (
          <Typography sx={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>Today</Typography>
        ) : (
          <>
            <Typography className="tnum" sx={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>
              {days}
            </Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {days === 1 ? 'day to go' : 'days to go'}
            </Typography>
          </>
        )}
      </Stack>
      <LinearProgress
        variant="determinate"
        value={elapsedPct}
        sx={{ height: 6, my: 1, bgcolor: (t) => t.palette.common.white }}
      />
      <Typography variant="caption" sx={{ opacity: 0.85 }}>
        {days === 0
          ? 'The window closes today — the team records your numbers next.'
          : `Views and likes are read${dueAt ? ` on ${formatDate(dueAt)}` : ' 30 days after you posted'}.`}
      </Typography>
    </Box>
  );
}

function VideoCard({ video }: { video: MyVideo }) {
  const platformLabel =
    PLATFORMS.find((p) => p.value === video.platform)?.label ?? video.platform;

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: (t) =>
          t.transitions.create(['box-shadow', 'transform', 'border-color'], { duration: 200 }),
        '&:hover': {
          transform: { md: 'translateY(-2px)' },
          borderColor: 'primary.light',
          boxShadow: (t) => t.customShadows.cardHover,
        },
        ...(video.status === 'rejected' && { borderColor: 'error.light' }),
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1.25 }}>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <MuiLink
              href={video.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={video.videoUrl}
              variant="body2"
              noWrap
              sx={{ fontWeight: 700, display: 'block' }}
            >
              {shortUrl(video.videoUrl)}
              <OpenInNewIcon sx={{ fontSize: 13, ml: 0.5, verticalAlign: 'baseline' }} />
            </MuiLink>
            <Stack
              direction="row"
              alignItems="center"
              sx={{ mt: 0.25, gap: 0.75, flexWrap: 'wrap', typography: 'caption' }}
            >
              <Box component="span" sx={{ color: 'text.secondary' }}>
                {platformLabel}
              </Box>
              {video.postedAt && (
                <>
                  <Dot />
                  <Box component="span" sx={{ color: 'text.secondary' }}>
                    posted {formatDate(video.postedAt)}
                  </Box>
                </>
              )}
              {video.program?.name && (
                <>
                  <Dot />
                  <Box component="span" sx={{ color: 'text.secondary' }}>
                    {video.program.name}
                  </Box>
                </>
              )}
            </Stack>
          </Box>
          <StatusChip status={video.status} />
        </Stack>

        {video.status === 'pending_evaluation' && (
          <Countdown days={video.daysToEvaluation ?? null} dueAt={video.evaluationDueAt} />
        )}

        {video.status === 'due_for_evaluation' && (
          <Box
            sx={{ p: 1.5, borderRadius: 2.5, bgcolor: 'warning.lighter', color: 'warning.darker' }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              30 days are up
            </Typography>
            <Typography variant="caption">
              The team is recording your numbers — nothing needed from you.
            </Typography>
          </Box>
        )}

        {video.status === 'rejected' && video.rejectionReason && (
          <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: 'error.lighter', color: 'error.darker' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Not counted
            </Typography>
            <Typography variant="caption">{video.rejectionReason}</Typography>
          </Box>
        )}

        {video.status === 'evaluated' && (
          <Stack spacing={1.5}>
            {/* The tier is the outcome, so it is the headline; the raw numbers explain it. */}
            {video.lockedTierKey ? (
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2.5,
                  bgcolor: 'success.lighter',
                  color: 'success.darker',
                }}
              >
                <Typography variant="overline" sx={{ display: 'block', opacity: 0.8 }}>
                  Tier unlocked
                </Typography>
                <Typography variant="h6" sx={{ color: 'inherit' }}>
                  {video.lockedTierLabel ?? video.lockedTierKey}
                </Typography>
                <Typography className="tnum" variant="caption">
                  {video.lockedCashAmount > 0
                    ? `${INR.format(video.lockedCashAmount)} queued for payout by the team.`
                    : 'Your reward for this tier is queued with the team.'}
                </Typography>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                This one did not reach the first views tier — it still counts towards your monthly
                video target.
              </Typography>
            )}

            <Stack direction="row" spacing={3}>
              <Stat
                icon={<VisibilityIcon />}
                value={NUM.format(video.views30d ?? 0)}
                label="views at 30 days"
              />
              <Stat
                icon={<FavoriteIcon />}
                value={NUM.format(video.likes30d ?? 0)}
                label="likes at 30 days"
              />
            </Stack>

            {video.countsForBaseline && (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <CheckCircleRoundedIcon sx={{ fontSize: 15, color: 'success.main' }} />
                <Typography variant="caption" sx={{ color: 'success.dark', fontWeight: 600 }}>
                  Counts towards your monthly target
                </Typography>
              </Stack>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

function SubmitVideoForm({ disabled, onSubmitted }: { disabled: boolean; onSubmitted: () => void }) {
  const today = useMemo(todayInputValue, []);
  const [videoUrl, setVideoUrl] = useState('');
  const [platform, setPlatform] = useState<VideoPlatform>('instagram');
  const [postedAt, setPostedAt] = useState(today);
  const [dashboardProofUrl, setDashboardProofUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const urlOk = isValidUrl(videoUrl);
  const proofOk = !dashboardProofUrl.trim() || isValidUrl(dashboardProofUrl);
  const canSubmit = urlOk && proofOk && !!postedAt && !saving && !disabled;

  const submit = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await submitVideo({
        videoUrl: normalizeUrl(videoUrl),
        platform,
        // Date inputs give a bare day; the backend derives the payout month from it.
        postedAt: new Date(postedAt).toISOString(),
        dashboardProofUrl: dashboardProofUrl.trim() ? normalizeUrl(dashboardProofUrl) : undefined,
      });
      setVideoUrl('');
      setDashboardProofUrl('');
      setPostedAt(today);
      setSuccess(
        created.evaluationDueAt
          ? `Logged. We check the numbers on ${formatDate(created.evaluationDueAt)}.`
          : 'Logged. We check the numbers 30 days after you posted.'
      );
      onSubmitted();
    } catch (e) {
      setError(errorMessage(e, 'Could not log this video.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="overline" sx={{ color: 'primary.main', display: 'block' }}>
          Log a video
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          Log it the day you post. Views and likes are read 30 days later, and the highest views
          tier you reached is what pays — tiers do not stack.
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="Video link"
            placeholder="https://instagram.com/reel/…"
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={disabled || saving}
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            onBlur={() => videoUrl.trim() && setVideoUrl(normalizeUrl(videoUrl))}
            error={!!videoUrl && !urlOk}
            helperText={!!videoUrl && !urlOk ? 'Paste the full public link to the video.' : ' '}
          />

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                label="Platform"
                value={platform}
                disabled={disabled || saving}
                onChange={(e) => setPlatform(e.target.value as VideoPlatform)}
              >
                {PLATFORMS.map((p) => (
                  <MenuItem key={p.value} value={p.value}>
                    {p.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Posted on"
                type="date"
                value={postedAt}
                disabled={disabled || saving}
                onChange={(e) => setPostedAt(e.target.value)}
                inputProps={{ max: today }}
                helperText="Decides which month's target it counts for."
              />
            </Grid>
          </Grid>

          <TextField
            label="Analytics screenshot link (optional)"
            placeholder="Drive or Imgur link to your dashboard"
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={disabled || saving}
            value={dashboardProofUrl}
            onChange={(e) => setDashboardProofUrl(e.target.value)}
            error={!!dashboardProofUrl && !proofOk}
            helperText={
              !!dashboardProofUrl && !proofOk
                ? 'That does not look like a full link.'
                : 'Speeds up review for high-view videos.'
            }
          />

          {error && <Alert severity="error">{error}</Alert>}
          {success && (
            <Alert severity="success" onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}

          {/* The form's single primary action — the one place a full-width button belongs. */}
          <Button variant="contained" size="large" disabled={!canSubmit} onClick={submit}>
            {saving ? 'Logging…' : 'Log this video'}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

function VideoTotals({ videos }: { videos: MyVideo[] }) {
  const evaluated = videos.filter((v) => v.status === 'evaluated');
  const totalCash = evaluated.reduce((sum, v) => sum + (v.lockedCashAmount || 0), 0);
  const waiting = videos.filter(
    (v) => v.status === 'pending_evaluation' || v.status === 'due_for_evaluation'
  ).length;

  return (
    <Card>
      <Stack
        direction="row"
        sx={{ p: { xs: 2, sm: 2.5 }, gap: { xs: 2.5, sm: 5 }, flexWrap: 'wrap' }}
      >
        <Stat value={NUM.format(videos.length)} label="videos logged" />
        <Stat value={NUM.format(waiting)} label="waiting on the clock" />
        <Stat value={INR.format(totalCash)} label="unlocked so far" />
      </Stack>
    </Card>
  );
}

function VideosScreen() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [videos, setVideos] = useState<MyVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback((initial = false) => {
    if (initial) setLoading(true);
    setError(null);
    return getMe()
      .then(async (identity) => {
        setMe(identity);
        if (identity.principal === 'admin' || !identity.internProfile) return [] as MyVideo[];
        const list = await getMyVideos();
        return list as MyVideo[];
      })
      .then(setVideos)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  if (loading) return <Loading label="Loading your videos…" />;
  if (error) return <ErrorState error={error} onRetry={() => load(true)} />;

  const profile = me?.internProfile ?? null;

  if (!profile) {
    return (
      <Alert severity="info">
        Video submissions are for enrolled content-track interns. Sign in with the email you gave
        the TalkDrill team if this looks wrong.
      </Alert>
    );
  }

  // The backend rejects video posts from other tracks, so say so instead of showing a dead form.
  if (profile.track !== 'content') {
    return (
      <EmptyState
        icon={<MovieCreationIcon />}
        title="Videos are not part of your track"
        description="This page is for Content Creator interns, who earn per-video rewards based on 30-day views. Your tasks and rewards work the same way without it."
        action={
          <Button component={Link} href="/tasks" variant="contained">
            Go to my tasks
          </Button>
        }
      />
    );
  }

  return (
    <Stack spacing={3}>
      {videos.length > 0 && <VideoTotals videos={videos} />}

      {profile.status !== 'active' && (
        <Alert severity="warning">
          Your internship is {statusLabel(profile.status).toLowerCase()}, so new videos cannot be
          logged right now. Everything
          already submitted still gets evaluated.
        </Alert>
      )}

      <SubmitVideoForm disabled={profile.status !== 'active'} onSubmitted={() => load()} />

      <Box>
        <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 0.5, px: 0.5 }}>
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>
            My videos
          </Typography>
          {videos.length > 0 && (
            <Typography
              className="tnum"
              variant="caption"
              sx={{ color: 'text.disabled', fontWeight: 600 }}
            >
              {videos.length}
            </Typography>
          )}
        </Stack>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mb: 1.5, px: 0.5 }}
        >
          Each one is evaluated 30 days after you posted it.
        </Typography>

        {!videos.length ? (
          <EmptyState
            dense
            icon={<MovieCreationIcon />}
            title="No videos logged yet"
            description="Post your first video, then log it here so the 30-day clock starts."
          />
        ) : (
          <Grid container spacing={2}>
            {videos.map((video) => (
              <Grid key={video._id} size={{ xs: 12, sm: 6 }}>
                <VideoCard video={video} />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </Stack>
  );
}

export default function VideosPage() {
  return (
    <RequireAuth>
      <AppShell>
        <PageHeader
          title="My videos"
          subtitle="Log what you post — rewards are decided on the 30-day numbers."
        />
        <VideosScreen />
      </AppShell>
    </RequireAuth>
  );
}
