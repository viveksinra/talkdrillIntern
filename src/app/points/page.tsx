'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import RedeemIcon from '@mui/icons-material/Redeem';
import AppShell from '@/components/AppShell';
import { DataState, ErrorState, Loading } from '@/components/DataStates';
import PageHeader from '@/components/PageHeader';
import PointsBadge from '@/components/PointsBadge';
import { RequireAuth } from '@/lib/auth/guards';
import { getMyPoints, getRewards } from '@/lib/api/internship';
import type { LedgerEntry, PointsReason, PointsSummary, RewardWithEligibility } from '@/lib/api/types';

/** How many upcoming rewards to show progress bars for — more than this is noise. */
const PROGRESS_TARGETS = 4;

const NUM = new Intl.NumberFormat('en-IN');

const REASON_LABELS: Record<PointsReason, string> = {
  task_approved: 'Task approved',
  admin_adjustment: 'Adjusted by the team',
  redemption: 'Reward redeemed',
  reward_grant: 'Reward granted',
  reversal: 'Reversal',
};

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

/** Typographic section head — a filled slab here would compete with the cards under it. */
function SectionHead({
  title,
  count,
  caption,
  tone = 'primary',
  action,
}: {
  title: string;
  count?: number;
  caption?: string;
  tone?: 'primary' | 'muted';
  action?: React.ReactNode;
}) {
  return (
    <>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5, px: 0.5, minHeight: 34 }}>
        <Typography
          variant="overline"
          sx={{ color: tone === 'primary' ? 'primary.main' : 'text.secondary' }}
        >
          {title}
        </Typography>
        {count !== undefined && (
          <Typography className="tnum" variant="caption" sx={{ color: 'text.disabled', fontWeight: 600 }}>
            {NUM.format(count)}
          </Typography>
        )}
        {action && (
          <>
            <Box sx={{ flexGrow: 1 }} />
            {action}
          </>
        )}
      </Stack>
      {caption && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, px: 0.5 }}>
          {caption}
        </Typography>
      )}
    </>
  );
}

function LedgerRow({ entry }: { entry: LedgerEntry }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ py: 1.25 }}>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {REASON_LABELS[entry.reason] ?? entry.reason}
        </Typography>
        {entry.note && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {entry.note}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary">
          {formatDate(entry.createdAt)}
        </Typography>
      </Box>
      <Stack alignItems="flex-end" sx={{ flexShrink: 0 }}>
        <PointsBadge points={entry.delta} size="sm" signed />
        <Typography className="tnum" variant="caption" color="text.secondary">
          balance {NUM.format(entry.balanceAfter)}
        </Typography>
      </Stack>
    </Stack>
  );
}

/** One "how close am I" card — the progress bar carries the message, not a dead button. */
function TargetCard({ reward, balance }: { reward: RewardWithEligibility; balance: number }) {
  const cost = reward.pointsCost || 0;
  const pct = cost > 0 ? Math.min(100, Math.round((balance / cost) * 100)) : 100;
  const remaining = Math.max(0, cost - balance);

  return (
    <Card
      sx={{
        height: '100%',
        transition: (t) =>
          t.transitions.create(['box-shadow', 'transform', 'border-color'], { duration: 200 }),
        '&:hover': {
          transform: { md: 'translateY(-2px)' },
          borderColor: 'primary.light',
          boxShadow: (t) => t.customShadows.cardHover,
        },
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 2.25 }, '&:last-child': { pb: { xs: 2, sm: 2.25 } } }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
          {reward.name}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={pct}
          sx={{ height: 6, mt: 1.25 }}
          aria-label={`${pct}% of the way to ${reward.name}`}
        />
        <Stack
          direction="row"
          alignItems="baseline"
          sx={{ mt: 0.75, gap: 1, flexWrap: 'wrap', typography: 'caption' }}
        >
          <Box component="span" className="tnum" sx={{ color: 'text.secondary' }}>
            {NUM.format(balance)} / {NUM.format(cost)} pts
          </Box>
          <Box component="span" sx={{ color: 'text.disabled' }}>
            ·
          </Box>
          <Box component="span" className="tnum" sx={{ color: 'primary.dark', fontWeight: 700 }}>
            {NUM.format(remaining)} to go
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function NextRewards({
  balance,
  rewards,
}: {
  balance: number;
  rewards: RewardWithEligibility[];
}) {
  const redeemable = rewards
    .filter((r) => r.unlockType === 'points_redeemable')
    .sort((a, b) => (a.pointsCost || 0) - (b.pointsCost || 0));

  if (!redeemable.length) return null;

  const affordable = redeemable.filter((r) => (r.pointsCost || 0) <= balance);
  const upcoming = redeemable
    .filter((r) => (r.pointsCost || 0) > balance)
    .slice(0, PROGRESS_TARGETS);

  return (
    <Box>
      <SectionHead
        title="What your points unlock"
        caption={
          affordable.length > 0
            ? // Reward names are metadata, not status — a chip each turned them into noise.
              `Ready to claim: ${affordable
                .slice(0, 4)
                .map((r) => r.name)
                .join(' · ')}${affordable.length > 4 ? ` · +${affordable.length - 4} more` : ''}`
            : 'Nothing is in reach yet — here is what you are closest to.'
        }
        action={
          <Button
            component={Link}
            href="/rewards"
            size="small"
            variant={affordable.length > 0 ? 'contained' : 'text'}
            startIcon={<RedeemIcon />}
            sx={{ flexShrink: 0 }}
          >
            {affordable.length > 0 ? 'Redeem' : 'Rewards'}
          </Button>
        }
      />

      {upcoming.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
          Everything in the catalog is within reach — head to Rewards to claim it.
        </Typography>
      ) : (
        // Comparable targets, so they go two-up rather than wasting half the width.
        <Grid container spacing={2}>
          {upcoming.map((reward) => (
            <Grid key={reward._id} size={{ xs: 12, sm: 6 }}>
              <TargetCard reward={reward} balance={balance} />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}

function PointsBody() {
  const [summary, setSummary] = useState<PointsSummary | null>(null);
  const [rewards, setRewards] = useState<RewardWithEligibility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      getMyPoints({ limit: 100 }),
      // The catalog is a nice-to-have here: a rewards failure must not hide the ledger.
      getRewards().catch(() => [] as RewardWithEligibility[]),
    ])
      .then(([points, catalog]) => {
        setSummary(points);
        setRewards(catalog);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  if (loading) return <Loading label="Loading your points…" />;
  if (error || !summary) return <ErrorState error={error ?? 'No points data'} onRetry={load} />;

  const spent = Math.max(0, summary.totalEarned - summary.balance);

  return (
    <Stack spacing={3}>
      <Card
        sx={{
          color: 'common.white',
          border: 'none',
          background: (t) =>
            `linear-gradient(120deg, ${t.palette.primary.darker} 0%, ${t.palette.primary.main} 100%)`,
        }}
      >
        <Box sx={{ p: { xs: 2.5, sm: 3 } }}>
          <Typography variant="overline" sx={{ opacity: 0.75 }}>
            Points balance
          </Typography>
          <Typography
            className="tnum"
            sx={{ fontSize: { xs: 44, sm: 54 }, fontWeight: 800, lineHeight: 1.1 }}
          >
            {NUM.format(summary.balance)}
          </Typography>
          {/* Earned/spent are metadata about the headline, so they stay quiet text. */}
          <Stack
            direction="row"
            alignItems="baseline"
            sx={{ mt: 0.5, gap: 1, flexWrap: 'wrap', typography: 'caption', opacity: 0.85 }}
          >
            <Box component="span" className="tnum">
              {NUM.format(summary.totalEarned)} earned
            </Box>
            <Box component="span" sx={{ opacity: 0.6 }}>
              ·
            </Box>
            <Box component="span" className="tnum">
              {NUM.format(spent)} spent
            </Box>
          </Stack>
        </Box>
      </Card>

      <NextRewards balance={summary.balance} rewards={rewards} />

      <Box>
        <SectionHead
          title="History"
          count={summary.total || undefined}
          caption={
            summary.entries.length
              ? 'Every approval, adjustment and redemption, newest first.'
              : undefined
          }
          tone="muted"
        />
        <DataState
          isEmpty={!summary.entries.length}
          emptyTitle="No points yet"
          emptyDescription="Approved tasks add points here. Submit your first proof to get started."
          emptyAction={
            <Button component={Link} href="/tasks" variant="contained">
              Go to my tasks
            </Button>
          }
        >
          <Card>
            <CardContent sx={{ py: 0.5 }}>
              <Stack divider={<Divider flexItem />}>
                {summary.entries.map((entry) => (
                  <LedgerRow key={entry._id} entry={entry} />
                ))}
              </Stack>
            </CardContent>
          </Card>
          {summary.total > summary.entries.length && (
            <Typography
              className="tnum"
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 1, px: 0.5 }}
            >
              Showing the latest {summary.entries.length} of {summary.total} entries.
            </Typography>
          )}
        </DataState>
      </Box>
    </Stack>
  );
}

export default function PointsPage() {
  return (
    <RequireAuth>
      <AppShell>
        <PageHeader
          title="My points"
          subtitle="Every point here came from a task the team approved."
          action={
            <Button
              component={Link}
              href="/leaderboard"
              size="small"
              startIcon={<LeaderboardIcon />}
            >
              Leaderboard
            </Button>
          }
        />
        <PointsBody />
      </AppShell>
    </RequireAuth>
  );
}
