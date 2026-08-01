'use client';

import Link from 'next/link';
import React, { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MuiLink from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import ConfirmDialog from '@/components/ConfirmDialog';
import { DataState, errorMessage } from '@/components/DataStates';
import ProofPreview from '@/components/ProofPreview';
import StatusChip from '@/components/StatusChip';
import { evaluateVideo, getVideoQueue, rejectVideo } from '@/lib/api/adminInternship';
import {
  isPopulated,
  type VideoSubmission,
  type VideoSubmissionStatus,
  type VideoTier,
} from '@/lib/api/types';
import AdminScreen, { useSnack } from '../_shared/AdminScreen';
import {
  fmtDate,
  fmtMoney,
  fmtNumber,
  internLabel,
  tierForViews,
  titleCase,
} from '../_shared/adminUtils';
import { useAsync } from '../_shared/useAsync';

/**
 * Content-track evaluation. Metrics are only counted 30 days after posting, and a
 * video locks exactly one tier — the highest its views qualify for. The ladder
 * below the inputs resolves live as the numbers are typed, because the lock is
 * irreversible: a mistyped view count pays out the wrong reward.
 */

const STATUS_OPTIONS: { value: VideoSubmissionStatus | ''; label: string }[] = [
  { value: 'due_for_evaluation', label: 'Ready to evaluate' },
  { value: 'pending_evaluation', label: 'Window still open' },
  { value: '', label: 'All waiting' },
  { value: 'evaluated', label: 'Evaluated' },
  { value: 'rejected', label: 'Rejected' },
];

const DEFAULT_BASELINE_MIN_LIKES = 10;

interface Draft {
  views: string;
  likes: string;
}

function programOf(video: VideoSubmission) {
  const program = video.programId;
  if (!program || typeof program === 'string') return null;
  return program as typeof program & { baselineMinLikes?: number; videoTiers?: VideoTier[] };
}

/** Quiet caption line, middot separated. */
function MetaLine({ items }: { items: React.ReactNode[] }) {
  const parts = items.filter(Boolean);
  if (!parts.length) return null;
  return (
    <Stack
      direction="row"
      alignItems="center"
      sx={{ gap: 0.75, flexWrap: 'wrap', typography: 'caption', color: 'text.secondary' }}
    >
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <Box component="span" sx={{ color: 'text.disabled' }}>
              ·
            </Box>
          )}
          {part}
        </React.Fragment>
      ))}
    </Stack>
  );
}

/**
 * The ladder, with exactly one rung lit. Tiers do not stack, so showing all of
 * them with a single highlight is the clearest way to say which one is about to
 * be written.
 */
function TierLadder({ tiers, resolved }: { tiers: VideoTier[]; resolved: VideoTier | null }) {
  if (!tiers.length) return null;
  const ordered = [...tiers].sort((a, b) => (a.minViews ?? 0) - (b.minViews ?? 0));

  return (
    <Stack spacing={0.5} sx={{ mt: 1.25 }}>
      {ordered.map((t) => {
        const active = resolved?.key === t.key;
        return (
          <Stack
            key={t.key}
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{
              px: 1.25,
              py: 0.75,
              borderRadius: 1.5,
              bgcolor: active ? 'success.lighter' : 'transparent',
              color: active ? 'success.darker' : 'text.secondary',
            }}
          >
            <CheckCircleRoundedIcon
              sx={{ fontSize: 16, color: active ? 'success.main' : 'text.disabled' }}
            />
            <Typography
              className="tnum"
              variant="caption"
              sx={{ fontWeight: active ? 700 : 500, flexGrow: 1 }}
            >
              {fmtNumber(t.minViews)}+ views — {t.label || t.key}
            </Typography>
            <Typography className="tnum" variant="caption" sx={{ fontWeight: active ? 800 : 600 }}>
              {fmtMoney(t.cashAmount)}
            </Typography>
          </Stack>
        );
      })}
    </Stack>
  );
}

function VideoCard({
  video,
  draft,
  onDraft,
  onEvaluate,
  onReject,
  busy,
}: {
  video: VideoSubmission;
  draft: Draft;
  onDraft: (next: Draft) => void;
  onEvaluate: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  const profile = isPopulated(video.internProfileId) ? video.internProfileId : null;
  const program = programOf(video);
  const tiers = (program?.videoTiers ?? []) as VideoTier[];
  const views = Number(draft.views);
  const likes = Number(draft.likes);
  const hasViews = draft.views.trim() !== '' && Number.isFinite(views) && views >= 0;
  const hasLikes = draft.likes.trim() !== '' && Number.isFinite(likes) && likes >= 0;
  const tier = hasViews ? tierForViews(tiers, views) : null;
  const baseline = program?.baselineMinLikes ?? DEFAULT_BASELINE_MIN_LIKES;
  const decided = video.status === 'evaluated' || video.status === 'rejected';
  const ready = video.status === 'due_for_evaluation';

  // Panel tone: green once a tier resolves, amber when the numbers say nothing
  // will be paid, neutral while the reviewer is still typing.
  const tone = !hasViews ? 'idle' : tier ? 'locked' : 'none';

  return (
    <Card
      sx={{
        transition: (t) =>
          t.transitions.create(['box-shadow', 'border-color'], { duration: 200 }),
        '&:hover': { boxShadow: (t) => t.customShadows.cardHover },
        ...(video.needsStricterReview && { borderColor: 'warning.light' }),
      }}
    >
      <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack direction="row" spacing={1.5} justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {profile ? (
                <Box
                  component={Link}
                  href={`/admin/interns/${profile._id}`}
                  sx={{ color: 'text.primary', textDecoration: 'none' }}
                >
                  {internLabel(profile)}
                </Box>
              ) : (
                'Unknown intern'
              )}
            </Typography>
            <MuiLink
              href={video.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="caption"
              sx={{
                mt: 0.25,
                fontWeight: 600,
                wordBreak: 'break-all',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
              }}
            >
              {video.videoUrl}
              <OpenInNewIcon sx={{ fontSize: 14, flexShrink: 0 }} />
            </MuiLink>
          </Box>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexShrink: 0 }}>
            <Chip size="small" variant="outlined" label={titleCase(video.platform)} />
            <StatusChip status={video.status} />
          </Stack>
        </Stack>

        <Box sx={{ mt: 1.25 }}>
          <MetaLine
            items={[
              `Posted ${fmtDate(video.postedAt)}`,
              ready ? (
                <Box component="span" sx={{ color: 'warning.dark', fontWeight: 700 }}>
                  Due {fmtDate(video.evaluationDueAt)}
                </Box>
              ) : (
                `Due ${fmtDate(video.evaluationDueAt)}`
              ),
              video.period,
              program?.name,
            ]}
          />
        </Box>

        {video.dashboardProofUrl && (
          <Box sx={{ mt: 1.5 }}>
            <ProofPreview dashboardProofUrl={video.dashboardProofUrl} compact />
          </Box>
        )}

        {video.needsStricterReview && (
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            Flagged for a stricter check — verify the analytics screenshot before locking a tier.
          </Alert>
        )}

        {decided ? (
          <Box
            sx={{
              mt: 1.75,
              px: 1.75,
              py: 1.25,
              borderRadius: 2,
              bgcolor: video.status === 'evaluated' ? 'success.lighter' : 'error.lighter',
              color: video.status === 'evaluated' ? 'success.darker' : 'error.darker',
            }}
          >
            {video.status === 'evaluated' ? (
              <>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Locked {video.lockedTierKey ?? 'no tier'} ·{' '}
                  <Box component="span" className="tnum">
                    {fmtMoney(video.lockedCashAmount)}
                  </Box>
                </Typography>
                <Typography className="tnum" variant="caption" sx={{ display: 'block' }}>
                  {fmtNumber(video.views30d)} views · {fmtNumber(video.likes30d)} likes ·{' '}
                  {video.countsForBaseline
                    ? 'counts toward the monthly baseline'
                    : 'does not count toward the monthly baseline'}
                </Typography>
              </>
            ) : (
              <>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Rejected
                </Typography>
                <Typography variant="caption">{video.rejectionReason ?? 'No reason recorded'}</Typography>
              </>
            )}
          </Box>
        ) : (
          <>
            <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
              <TextField
                size="small"
                label="30-day views"
                type="number"
                value={draft.views}
                onChange={(e) => onDraft({ ...draft, views: e.target.value })}
                inputProps={{ min: 0, className: 'tnum' }}
                sx={{ flex: 1, maxWidth: 180 }}
              />
              <TextField
                size="small"
                label="30-day likes"
                type="number"
                value={draft.likes}
                onChange={(e) => onDraft({ ...draft, likes: e.target.value })}
                inputProps={{ min: 0, className: 'tnum' }}
                sx={{ flex: 1, maxWidth: 180 }}
              />
            </Stack>

            {/* Live resolution — always on screen while the row is undecided, so
                the reviewer never saves blind. */}
            <Box
              sx={{
                mt: 1.75,
                px: 1.75,
                py: 1.5,
                borderRadius: 2,
                bgcolor:
                  tone === 'locked'
                    ? 'success.lighter'
                    : tone === 'none'
                      ? 'warning.lighter'
                      : 'grey.100',
              }}
            >
              <Typography
                variant="overline"
                sx={{
                  display: 'block',
                  color:
                    tone === 'locked'
                      ? 'success.darker'
                      : tone === 'none'
                        ? 'warning.darker'
                        : 'text.disabled',
                }}
              >
                {tone === 'locked' ? 'Will lock' : tone === 'none' ? 'Nothing will lock' : 'Tier preview'}
              </Typography>

              {tone === 'locked' && tier && (
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 800, color: 'success.darker' }}
                  className="tnum"
                >
                  {tier.label || tier.key} — {fmtMoney(tier.cashAmount)}
                </Typography>
              )}
              {tone === 'none' && (
                <Typography variant="body2" sx={{ color: 'warning.darker', fontWeight: 600 }}>
                  {tiers.length ? (
                    <Box component="span" className="tnum">
                      {fmtNumber(views)} views is below the lowest tier (
                      {fmtNumber(Math.min(...tiers.map((t) => t.minViews ?? 0)))}+).
                    </Box>
                  ) : (
                    'This program has no video tiers configured, so nothing can be paid.'
                  )}
                </Typography>
              )}
              {tone === 'idle' && (
                <Typography variant="caption" color="text.secondary">
                  Type the 30-day views to see which single tier locks. Tiers never stack.
                </Typography>
              )}

              <TierLadder tiers={tiers} resolved={tier} />

              {hasLikes && (
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    mt: 1,
                    color: likes >= baseline ? 'success.dark' : 'text.secondary',
                    fontWeight: likes >= baseline ? 700 : 400,
                  }}
                  className="tnum"
                >
                  {likes >= baseline
                    ? `Counts toward the monthly baseline (${baseline}+ likes).`
                    : `Below the ${baseline}-like baseline, so it will not count toward monthly rules.`}
                </Typography>
              )}
            </Box>
          </>
        )}
      </Box>

      {!decided && (
        <>
          <Divider />
          <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1.5 }}>
            <Button
              size="small"
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={onEvaluate}
              disabled={busy || !hasViews || !hasLikes}
            >
              Save &amp; lock tier
            </Button>
            {(!hasViews || !hasLikes) && (
              <Typography variant="caption" color="text.secondary">
                Both numbers are needed
              </Typography>
            )}
            <Box sx={{ flexGrow: 1 }} />
            <Button size="small" color="error" startIcon={<CloseIcon />} onClick={onReject} disabled={busy}>
              Reject
            </Button>
          </Stack>
        </>
      )}
    </Card>
  );
}

function VideosBody() {
  const { show, snackbar } = useSnack();
  const [status, setStatus] = useState<VideoSubmissionStatus | ''>('due_for_evaluation');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<VideoSubmission | null>(null);
  const [confirming, setConfirming] = useState<VideoSubmission | null>(null);

  const queue = useAsync(
    async () => (await getVideoQueue({ status: status || undefined })).items,
    [status]
  );

  const rows = queue.data ?? [];
  const draftFor = (id: string) => drafts[id] ?? { views: '', likes: '' };

  const drop = (id: string) => queue.setData((cur) => (cur ?? []).filter((v) => v._id !== id));
  const restore = (video: VideoSubmission, index: number) =>
    queue.setData((cur) => {
      const next = [...(cur ?? [])];
      next.splice(Math.min(Math.max(index, 0), next.length), 0, video);
      return next;
    });

  const runEvaluate = async (video: VideoSubmission) => {
    const draft = draftFor(video._id);
    const views30d = Math.round(Number(draft.views));
    const likes30d = Math.round(Number(draft.likes));
    const index = rows.findIndex((v) => v._id === video._id);
    setBusyId(video._id);
    drop(video._id);
    try {
      const result = await evaluateVideo(video._id, { views30d, likes30d });
      const label = result.tierLabel || result.lockedTierKey;
      show(label ? `Evaluated — tier ${label} locked` : 'Evaluated — no tier qualified');
    } catch (err) {
      restore(video, index);
      show(errorMessage(err, 'Evaluation failed — the row has been restored.'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const runReject = async (video: VideoSubmission, reason: string) => {
    const index = rows.findIndex((v) => v._id === video._id);
    drop(video._id);
    try {
      await rejectVideo(video._id, reason);
      show('Video rejected');
    } catch (err) {
      restore(video, index);
      show(errorMessage(err, 'Reject failed — the row has been restored.'), 'error');
    }
  };

  // The confirm step repeats the resolved tier: this is the last screen before an
  // irreversible payout decision.
  const confirmTier = confirming
    ? tierForViews(
        (programOf(confirming)?.videoTiers ?? []) as VideoTier[],
        Number(draftFor(confirming._id).views)
      )
    : null;

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <TextField
          select
          size="small"
          label="Queue"
          value={status}
          onChange={(e) => setStatus(e.target.value as VideoSubmissionStatus | '')}
          sx={{ minWidth: 200, maxWidth: 240 }}
        >
          {STATUS_OPTIONS.map((o) => (
            <MenuItem key={o.label} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="Refresh the queue">
          <IconButton onClick={queue.reload} aria-label="Refresh video queue" sx={{ width: 44, height: 44 }}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      <Box>
        <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 0.5, px: 0.5 }}>
          <Typography variant="overline" sx={{ color: 'primary.main' }}>
            {STATUS_OPTIONS.find((o) => o.value === status)?.label ?? 'Queue'}
          </Typography>
          <Typography
            className="tnum"
            variant="caption"
            sx={{ color: 'text.disabled', fontWeight: 600 }}
          >
            {fmtNumber(rows.length)}
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, px: 0.5 }}>
          Work top to bottom. A video locks exactly one tier and can never be re-evaluated.
        </Typography>

        <DataState
          loading={queue.loading && !queue.data}
          error={queue.error && !queue.data ? queue.error : undefined}
          onRetry={queue.reload}
          isEmpty={!rows.length}
          emptyTitle="Nothing to evaluate"
          emptyDescription="Videos appear here once their 30-day window closes."
          skeletonRows={2}
        >
          {/* A queue is sequential work, so it stays one full-width column. */}
          <Stack spacing={2}>
            {rows.map((video) => (
              <VideoCard
                key={video._id}
                video={video}
                draft={draftFor(video._id)}
                onDraft={(next) => setDrafts((cur) => ({ ...cur, [video._id]: next }))}
                onEvaluate={() => setConfirming(video)}
                onReject={() => setRejecting(video)}
                busy={busyId === video._id}
              />
            ))}
          </Stack>
        </DataState>
      </Box>

      <ConfirmDialog
        open={!!confirming}
        title="Lock this tier?"
        message={
          confirming
            ? `${fmtNumber(Math.round(Number(draftFor(confirming._id).views)))} views and ${fmtNumber(
                Math.round(Number(draftFor(confirming._id).likes))
              )} likes will lock ${
                confirmTier
                  ? `“${confirmTier.label || confirmTier.key}” — ${fmtMoney(confirmTier.cashAmount)}`
                  : 'no tier, so this video pays nothing'
              }. It cannot be re-evaluated.`
            : ''
        }
        confirmLabel="Save & lock"
        onClose={() => setConfirming(null)}
        onConfirm={async () => {
          if (confirming) await runEvaluate(confirming);
        }}
      />

      <ConfirmDialog
        open={!!rejecting}
        title="Reject this video?"
        message="The intern sees this reason. A rejected video can never be evaluated."
        confirmLabel="Reject"
        destructive
        requireReason
        reasonLabel="Reason"
        reasonPlaceholder="e.g. Video does not mention TalkDrill"
        onClose={() => setRejecting(null)}
        onConfirm={async (reason) => {
          if (rejecting) await runReject(rejecting, reason ?? '');
        }}
      />

      {snackbar}
    </Stack>
  );
}

export default function AdminVideosPage() {
  return (
    <AdminScreen
      title="Video evaluation"
      subtitle="Enter 30-day views and likes; the highest qualifying tier locks"
      back="/admin"
    >
      <VideosBody />
    </AdminScreen>
  );
}
