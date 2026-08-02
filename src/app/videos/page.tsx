'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import MuiLink from '@mui/material/Link';
import useMediaQuery from '@mui/material/useMediaQuery';
import { alpha, useTheme } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import FavoriteIcon from '@mui/icons-material/Favorite';
import MovieCreationIcon from '@mui/icons-material/MovieCreation';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AppShell from '@/components/AppShell';
import Art from '@/components/Art';
import CountUp from '@/components/CountUp';
import { ErrorState, Loading, errorMessage } from '@/components/DataStates';
import EmptyState from '@/components/EmptyState';
import Label from '@/components/Label';
import MetaLine from '@/components/MetaLine';
import PageHeader from '@/components/PageHeader';
import ProgressRing from '@/components/ProgressRing';
import Reveal from '@/components/Reveal';
import SectionHead from '@/components/SectionHead';
import StatCard from '@/components/StatCard';
import { statusLabel } from '@/components/StatusChip';
import { isValidUrl, normalizeUrl } from '@/components/ProofUploader';
import { RequireAuth } from '@/lib/auth/guards';
import { useReadOnly } from '@/lib/auth/AuthContext';
import ReadOnlyNotice from '@/components/ReadOnlyNotice';
import { ART, videoPlaceholderArt, youtubeThumbnail } from '@/lib/art';
import { celebrate, celebrateOnce } from '@/lib/juice';
import { customShadows, FONT_DISPLAY, gradientTokens } from '@/theme';
import { getMe, getMyVideos, submitVideo, type MeResponse } from '@/lib/api/internship';
import {
  isPopulated,
  type InternProfile,
  type Program,
  type VideoPlatform,
  type VideoSubmission,
  type VideoTier,
} from '@/lib/api/types';

/**
 * The list endpoint adds the countdown, the tier's label and the program name.
 * `program` may also carry the batch's tier table when the backend populates it,
 * so the ladder is read defensively from either shape.
 */
type MyVideo = VideoSubmission & {
  daysToEvaluation?: number | null;
  lockedTierLabel?: string | null;
  program?: ({ _id: string; name: string } & { videoTiers?: VideoTier[] }) | null;
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

function platformLabelOf(platform: string): string {
  return PLATFORMS.find((p) => p.value === platform)?.label ?? platform;
}

// ── tier ladder helpers ──────────────────────────────────────────────────

/**
 * Tiers live on the intern's programme. Depending on which endpoint populated
 * it they can arrive on the profile's programIds, on the video's programId, or
 * on the list endpoint's `program` decoration — so try all three and give up
 * quietly (the whole block is skipped) when none of them carry a table.
 */
function sortTiers(tiers: VideoTier[]): VideoTier[] {
  return tiers
    .filter((t) => t && Number.isFinite(Number(t.minViews)))
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.minViews ?? 0) - (b.minViews ?? 0));
}

/** The ladder a SPECIFIC video is paid against — always its own batch's. */
function tiersForVideo(video: MyVideo): VideoTier[] {
  if (video.program?.videoTiers?.length) return sortTiers(video.program.videoTiers);
  const ref = video.programId ?? null;
  if (isPopulated<Program>(ref) && ref.videoTiers?.length) return sortTiers(ref.videoTiers);
  return [];
}

/**
 * A ladder to show when there is no particular video in hand (the explainer at
 * the top of the screen).
 *
 * Only returns one when every batch the intern is in agrees, because tiers are
 * editable per batch: picking whichever came first — which is what this used to
 * do — could display a ladder that disagrees with what the person is actually
 * paid, since the tier that counts is snapshotted onto each video from its OWN
 * batch. Showing nothing is better than showing a number we might not honour.
 */
function collectTiers(profile: InternProfile | null, videos: MyVideo[]): VideoTier[] {
  const candidates: VideoTier[][] = [];

  for (const ref of profile?.programIds ?? []) {
    if (isPopulated<Program>(ref) && ref.videoTiers?.length) candidates.push(sortTiers(ref.videoTiers));
  }
  for (const video of videos) {
    const tiers = tiersForVideo(video);
    if (tiers.length) candidates.push(tiers);
  }

  if (!candidates.length) return [];

  const first = JSON.stringify(candidates[0].map((t) => [t.minViews, t.cashAmount ?? 0]));
  const allAgree = candidates.every(
    (c) => JSON.stringify(c.map((t) => [t.minViews, t.cashAmount ?? 0])) === first
  );

  return allAgree ? candidates[0] : [];
}

/** Index of a locked tier key in the sorted ladder — drives the medallion art. */
function tierIndexOf(tiers: VideoTier[], key: string | null | undefined): number {
  if (!key) return -1;
  return tiers.findIndex((t) => t.key === key);
}

function tierArtFor(index: number): string | null {
  if (index < 0) return null;
  return ART.tier[Math.min(index, ART.tier.length - 1)];
}

/**
 * Where the intern's best video sits on the rail, as a percentage. Nodes are
 * laid out in equal columns, so tier `i` is centred at (i + 0.5)/n and the
 * marker interpolates linearly between the two tiers it falls between.
 */
function railPercent(views: number, tiers: VideoTier[]): number {
  const n = tiers.length;
  if (!n || views <= 0) return 0;
  const center = (i: number) => ((i + 0.5) / n) * 100;

  const first = tiers[0].minViews || 0;
  if (views < first) return first > 0 ? center(0) * (views / first) : 0;

  for (let i = n - 1; i >= 0; i -= 1) {
    if (views >= (tiers[i].minViews || 0)) {
      if (i === n - 1) return 100;
      const span = (tiers[i + 1].minViews || 0) - (tiers[i].minViews || 0);
      const t = span > 0 ? (views - (tiers[i].minViews || 0)) / span : 0;
      return center(i) + (center(i + 1) - center(i)) * Math.min(1, Math.max(0, t));
    }
  }
  return 0;
}

const NODE_MIN_WIDTH = 92;

/**
 * The headline visualisation: one milestone track for the whole programme, with
 * the intern's best 30-day video plotted on it. Tiers do not stack, so the only
 * number that matters is the gap to the next unreached rung — that is the one
 * display-face moment on the screen.
 */
function TierTrack({
  tiers,
  bestViews,
  unlockedCash,
}: {
  tiers: VideoTier[];
  bestViews: number;
  unlockedCash: number;
}) {
  const theme = useTheme();
  const next = tiers.find((t) => (t.minViews || 0) > bestViews) ?? null;
  const top = tiers[tiers.length - 1];
  const fill = railPercent(bestViews, tiers);
  const railTop = 22; // vertical centre of the 44px node badge

  return (
    <Card sx={{ overflow: 'hidden' }}>
      <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Typography variant="overline" sx={{ color: 'primary.main', display: 'block' }}>
          {next ? 'Next views tier' : 'Top tier reached'}
        </Typography>

        <Typography
          sx={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: { xs: 28, sm: 36 },
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            mt: 0.25,
          }}
        >
          {next ? (
            <>
              <Box component="span" className="tnum">
                <CountUp value={Math.max(0, (next.minViews || 0) - bestViews)} />
              </Box>{' '}
              views to{' '}
              <Box component="span" className="tnum" sx={{ color: 'primary.main' }}>
                {INR.format(next.cashAmount || 0)}
              </Box>
            </>
          ) : (
            <>
              You are at{' '}
              <Box component="span" sx={{ color: 'primary.main' }}>
                {top?.label || top?.key || 'the top tier'}
              </Box>
            </>
          )}
        </Typography>

        <MetaLine
          sx={{ mt: 0.75 }}
          parts={[
            bestViews > 0 ? (
              <Box component="span" className="tnum">
                Best video · {NUM.format(bestViews)} views
              </Box>
            ) : (
              'No 30-day numbers recorded yet'
            ),
            unlockedCash > 0 && (
              <Box component="span" className="tnum" sx={{ color: 'success.dark', fontWeight: 700 }}>
                {INR.format(unlockedCash)} unlocked
              </Box>
            ),
            'Tiers do not stack',
          ]}
        />
      </Box>

      {/* xs cannot fit five rungs — the track scrolls rather than squashing. */}
      <Box
        sx={{
          overflowX: 'auto',
          overflowY: 'hidden',
          px: { xs: 2, sm: 2.5 },
          pb: 2.5,
          WebkitOverflowScrolling: 'touch',
          '&::-webkit-scrollbar': { height: 6 },
          '&::-webkit-scrollbar-thumb': {
            borderRadius: 99,
            backgroundColor: alpha(theme.palette.text.disabled, 0.35),
          },
        }}
      >
        <Box sx={{ position: 'relative', minWidth: tiers.length * NODE_MIN_WIDTH, pt: 0.5 }}>
          {/* rail */}
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: railTop,
              height: 4,
              borderRadius: 99,
              bgcolor: alpha(theme.palette.text.disabled, 0.24),
            }}
          />
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              left: 0,
              top: railTop,
              width: `${fill}%`,
              height: 4,
              borderRadius: 99,
              background: gradientTokens.violet,
              transition: 'width .8s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
          {bestViews > 0 && (
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                left: `${fill}%`,
                top: railTop - 4,
                width: 12,
                height: 12,
                ml: '-6px',
                borderRadius: '50%',
                bgcolor: 'primary.main',
                border: '2px solid',
                borderColor: 'background.paper',
                boxShadow: (t) => t.customShadows.primary,
                zIndex: 2,
                transition: 'left .8s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          )}

          <Stack direction="row" sx={{ position: 'relative' }}>
            {tiers.map((tier, i) => {
              const reached = bestViews >= (tier.minViews || 0);
              const art = tierArtFor(i);
              return (
                <Stack
                  key={tier.key || i}
                  alignItems="center"
                  spacing={0.5}
                  sx={{
                    flex: '1 0 0',
                    minWidth: NODE_MIN_WIDTH,
                    px: 0.5,
                    textAlign: 'center',
                  }}
                >
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: 'background.paper',
                      border: '2px solid',
                      borderColor: reached ? 'primary.main' : 'divider',
                      zIndex: 1,
                    }}
                  >
                    {art ? (
                      <Art
                        src={art}
                        size={32}
                        sx={{
                          filter: reached ? 'none' : 'grayscale(1)',
                          opacity: reached ? 1 : 0.45,
                          transition: 'filter .4s ease, opacity .4s ease',
                        }}
                      />
                    ) : (
                      <Typography className="tnum" variant="caption" sx={{ fontWeight: 800 }}>
                        {i + 1}
                      </Typography>
                    )}
                  </Box>
                  <Typography
                    className="tnum"
                    variant="caption"
                    sx={{
                      fontWeight: 700,
                      lineHeight: 1.3,
                      color: reached ? 'text.primary' : 'text.disabled',
                    }}
                  >
                    {NUM.format(tier.minViews || 0)}
                  </Typography>
                  <Typography
                    className="tnum"
                    variant="caption"
                    sx={{
                      fontWeight: 800,
                      lineHeight: 1.2,
                      color: reached ? 'primary.main' : 'text.disabled',
                    }}
                  >
                    {INR.format(tier.cashAmount || 0)}
                  </Typography>
                  {(tier.label || tier.key) && (
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: 11,
                        lineHeight: 1.2,
                        color: 'text.secondary',
                        opacity: reached ? 1 : 0.7,
                      }}
                    >
                      {tier.label || tier.key}
                    </Typography>
                  )}
                </Stack>
              );
            })}
          </Stack>
        </Box>
      </Box>
    </Card>
  );
}

// ── video card ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<
  string,
  { text: string; color: 'warning' | 'info' | 'error' | 'success' }
> = {
  pending_evaluation: { text: 'Window open', color: 'warning' },
  due_for_evaluation: { text: 'Being counted', color: 'info' },
  rejected: { text: 'Not counted', color: 'error' },
  evaluated: { text: 'Evaluated', color: 'success' },
};

/** 16:9 media band — the real YouTube frame when we can derive one, clay art otherwise. */
function VideoThumb({ video }: { video: MyVideo }) {
  const thumb = youtubeThumbnail(video.videoUrl);
  const meta = STATUS_LABEL[video.status];

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 9',
        flexShrink: 0,
        bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
      }}
    >
      {thumb ? (
        <Box
          component="img"
          src={thumb}
          alt=""
          aria-hidden
          loading="lazy"
          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <Art src={videoPlaceholderArt(video.platform)} size={72} />
      )}
      {meta && (
        <Label
          color={meta.color}
          variant="filled"
          sx={{ position: 'absolute', top: 8, right: 8, boxShadow: customShadows.z1 }}
        >
          {meta.text}
        </Label>
      )}
    </Box>
  );
}

/** The 30-day clock as a ring: the day number stays, the sentence gets quieter. */
function Countdown({ days, dueAt }: { days: number | null; dueAt?: string }) {
  const elapsedPct =
    days === null
      ? 0
      : Math.max(0, Math.min(100, ((EVALUATION_WINDOW_DAYS - days) / EVALUATION_WINDOW_DAYS) * 100));

  const caption =
    days === null
      ? 'Counting down to the 30-day check.'
      : days === 0
        ? 'The window closes today — the team records your numbers next.'
        : `Views and likes are read${dueAt ? ` on ${formatDate(dueAt)}` : ' 30 days after you posted'}.`;

  return (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <ProgressRing
        value={elapsedPct}
        size={56}
        thickness={5}
        ariaLabel={days === null ? 'Evaluation pending' : `${days} days to evaluation`}
      >
        {days === null ? (
          <Typography variant="caption" sx={{ fontWeight: 800 }}>
            —
          </Typography>
        ) : (
          <Box>
            <Typography className="tnum" sx={{ fontSize: 17, fontWeight: 800, lineHeight: 1 }}>
              {days}
            </Typography>
            <Typography sx={{ fontSize: 9, lineHeight: 1.2, color: 'text.secondary' }}>
              {days === 1 ? 'day' : 'days'}
            </Typography>
          </Box>
        )}
      </ProgressRing>
      <Typography variant="caption" color="text.secondary">
        {caption}
      </Typography>
    </Stack>
  );
}

function VideoCard({ video, tiers }: { video: MyVideo; tiers: VideoTier[] }) {
  const tierArt = tierArtFor(tierIndexOf(tiers, video.lockedTierKey));

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
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
      <VideoThumb video={video} />

      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <Box sx={{ minWidth: 0 }}>
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
          <MetaLine
            sx={{ mt: 0.25 }}
            parts={[
              platformLabelOf(video.platform),
              video.postedAt && `posted ${formatDate(video.postedAt)}`,
              video.program?.name,
            ]}
          />
        </Box>

        {video.status === 'pending_evaluation' && (
          <Countdown days={video.daysToEvaluation ?? null} dueAt={video.evaluationDueAt} />
        )}

        {video.status === 'due_for_evaluation' && (
          <Typography variant="caption" color="text.secondary">
            30 days are up — the team is recording your numbers. Nothing needed from you.
          </Typography>
        )}

        {video.status === 'rejected' && (
          <Typography variant="caption" sx={{ color: 'error.dark' }}>
            {video.rejectionReason || 'This one was not counted towards rewards.'}
          </Typography>
        )}

        {video.status === 'evaluated' && (
          <>
            {video.lockedTierKey ? (
              <Stack
                direction="row"
                spacing={1.25}
                alignItems="center"
                sx={{ p: 1.25, borderRadius: 2.5, bgcolor: 'success.lighter' }}
              >
                {tierArt && <Art src={tierArt} size={32} />}
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 800, color: 'success.darker' }}
                    noWrap
                  >
                    {video.lockedTierLabel ?? video.lockedTierKey}
                  </Typography>
                  <Typography className="tnum" variant="caption" sx={{ color: 'success.dark' }}>
                    {video.lockedCashAmount > 0
                      ? `${INR.format(video.lockedCashAmount)} queued for payout by the team.`
                      : 'Your reward for this tier is queued with the team.'}
                  </Typography>
                </Box>
              </Stack>
            ) : (
              <Typography variant="caption" color="text.secondary">
                Did not reach the first views tier — it still counts towards your monthly video
                target.
              </Typography>
            )}

            <MetaLine
              sx={{ mt: 'auto', pt: 0.25 }}
              parts={[
                <Box key="v" component="span" className="tnum">
                  <VisibilityIcon sx={{ fontSize: 15, mr: 0.5, color: 'text.disabled' }} />
                  {NUM.format(video.views30d ?? 0)} views
                </Box>,
                <Box key="l" component="span" className="tnum">
                  <FavoriteIcon sx={{ fontSize: 15, mr: 0.5, color: 'text.disabled' }} />
                  {NUM.format(video.likes30d ?? 0)} likes
                </Box>,
                video.countsForBaseline && (
                  <Box key="b" component="span" sx={{ color: 'success.dark', fontWeight: 600 }}>
                    <CheckCircleRoundedIcon
                      sx={{ fontSize: 14, mr: 0.5, color: 'success.main', verticalAlign: '-2px' }}
                    />
                    Counts to target
                  </Box>
                ),
              ]}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── submit dialog ────────────────────────────────────────────────────────

function SubmitVideoDialog({
  open,
  disabled,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  disabled: boolean;
  onClose: () => void;
  onSubmitted: (message: string) => void;
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const today = useMemo(todayInputValue, []);
  const [videoUrl, setVideoUrl] = useState('');
  const [platform, setPlatform] = useState<VideoPlatform>('instagram');
  const [postedAt, setPostedAt] = useState(today);
  const [dashboardProofUrl, setDashboardProofUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const urlOk = isValidUrl(videoUrl);
  const proofOk = !dashboardProofUrl.trim() || isValidUrl(dashboardProofUrl);
  const canSubmit = urlOk && proofOk && !!postedAt && !saving && !disabled;

  const submit = async () => {
    setSaving(true);
    setError(null);
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
      celebrate();
      onSubmitted(
        created.evaluationDueAt
          ? `Logged. We check the numbers on ${formatDate(created.evaluationDueAt)}.`
          : 'Logged. We check the numbers 30 days after you posted.'
      );
      onClose();
    } catch (e) {
      setError(errorMessage(e, 'Could not log this video.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      fullScreen={fullScreen}
    >
      <DialogTitle sx={{ pb: 0.5 }}>
        Log a video
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          Log it the day you post. Views and likes are read 30 days later, and the highest views
          tier you reached is what pays — tiers do not stack.
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
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
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 1 }}>
        <Button color="inherit" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" disabled={!canSubmit} onClick={submit}>
          {saving ? 'Logging…' : 'Log this video'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── screen ───────────────────────────────────────────────────────────────

function VideoTotals({ videos }: { videos: MyVideo[] }) {
  const views = videos.reduce((sum, v) => sum + (v.views30d ?? 0), 0);
  const likes = videos.reduce((sum, v) => sum + (v.likes30d ?? 0), 0);
  const waiting = videos.filter(
    (v) => v.status === 'pending_evaluation' || v.status === 'due_for_evaluation'
  ).length;

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 4 }}>
        <StatCard
          title="Views counted"
          value={views}
          hint="At the 30-day read"
          icon={<VisibilityIcon />}
          tone="primary"
        />
      </Grid>
      <Grid size={{ xs: 6, sm: 4 }}>
        <StatCard
          title="Likes counted"
          value={likes}
          hint="At the 30-day read"
          icon={<FavoriteIcon />}
          tone="error"
        />
      </Grid>
      <Grid size={{ xs: 6, sm: 4 }}>
        <StatCard
          title="Videos logged"
          value={videos.length}
          hint={waiting ? `${waiting} on the clock` : 'All evaluated'}
          icon={<MovieCreationIcon />}
          tone="info"
        />
      </Grid>
    </Grid>
  );
}

function VideosScreen() {
  const readOnly = useReadOnly();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [videos, setVideos] = useState<MyVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const celebrated = useRef(false);

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

  const profile = me?.internProfile ?? null;
  const tiers = useMemo(() => collectTiers(profile, videos), [profile, videos]);
  const bestViews = videos.reduce((max, v) => Math.max(max, v.views30d ?? 0), 0);
  const unlockedCash = videos
    .filter((v) => v.status === 'evaluated')
    .reduce((sum, v) => sum + (v.lockedCashAmount || 0), 0);

  // A tier unlocked while the intern was away is a win they discover passively.
  useEffect(() => {
    if (celebrated.current) return;
    const won = videos.find((v) => v.status === 'evaluated' && v.lockedTierKey);
    if (!won) return;
    celebrated.current = true;
    celebrateOnce(`video-tier-${won._id}`);
  }, [videos]);

  // readOnly folds into the one gate the whole video flow already keys off, so
  // the "Log a video" trigger and the dialog's fields both go inert together.
  // Posting a video on someone's behalf would burn that URL for them permanently
  // (the duplicate check refuses a later genuine submission) and start a 30-day
  // cash-tier clock they never asked for.
  const canLog =
    !!profile && profile.track === 'content' && profile.status === 'active' && !readOnly;

  const header = (
    <PageHeader
      title="My videos"
      subtitle="Log what you post — rewards are decided on the 30-day numbers."
      action={
        canLog ? (
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => setFormOpen(true)}
          >
            Add video
          </Button>
        ) : undefined
      }
    />
  );

  const body = () => {
    if (loading) return <Loading label="Loading your videos…" />;
    if (error) return <ErrorState error={error} onRetry={() => load(true)} />;

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
          art={ART.track.content}
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
        {tiers.length > 0 && (
          <TierTrack tiers={tiers} bestViews={bestViews} unlockedCash={unlockedCash} />
        )}

        {videos.length > 0 && <VideoTotals videos={videos} />}

        {profile.status !== 'active' && (
          <Stack
            direction="row"
            spacing={1.25}
            alignItems="center"
            sx={{
              px: 1.75,
              py: 1.25,
              borderRadius: 2.5,
              bgcolor: 'warning.lighter',
              flexWrap: 'wrap',
              rowGap: 0.5,
            }}
          >
            <Label color="warning" variant="filled">
              {statusLabel(profile.status)}
            </Label>
            <Typography variant="caption" sx={{ color: 'warning.darker' }}>
              New videos cannot be logged right now. Everything already submitted still gets
              evaluated.
            </Typography>
          </Stack>
        )}

        {notice && (
          <Alert severity="success" onClose={() => setNotice(null)}>
            {notice}
          </Alert>
        )}

        <ReadOnlyNotice action="Video submissions" />

        <Box>
          <SectionHead
            label="My videos"
            count={videos.length || undefined}
            caption="Each one is evaluated 30 days after you posted it."
          />

          {!videos.length ? (
            <EmptyState
              art={ART.empty.videos}
              title="No videos logged yet"
              description="Post your first video, then log it here so the 30-day clock starts."
              action={
                <Button
                  variant="contained"
                  startIcon={<AddRoundedIcon />}
                  disabled={!canLog}
                  onClick={() => setFormOpen(true)}
                >
                  Add video
                </Button>
              }
            />
          ) : (
            <Grid container spacing={2}>
              {videos.map((video, i) => (
                <Grid key={video._id} size={{ xs: 12, sm: 6 }}>
                  <Reveal index={i} sx={{ height: '100%' }}>
                    <VideoCard video={video} tiers={tiers} />
                  </Reveal>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </Stack>
    );
  };

  return (
    <>
      {header}
      {body()}
      <SubmitVideoDialog
        open={formOpen}
        disabled={!canLog}
        onClose={() => setFormOpen(false)}
        onSubmitted={(message) => {
          setNotice(message);
          load();
        }}
      />
    </>
  );
}

export default function VideosPage() {
  return (
    <RequireAuth>
      <AppShell>
        <VideosScreen />
      </AppShell>
    </RequireAuth>
  );
}
