'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import MuiLink from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import LockIcon from '@mui/icons-material/Lock';
import AppShell from '@/components/AppShell';
import ConfirmDialog from '@/components/ConfirmDialog';
import { ErrorState, Loading } from '@/components/DataStates';
import EmptyState from '@/components/EmptyState';
import PageHeader from '@/components/PageHeader';
import PointsBadge from '@/components/PointsBadge';
import StatusChip from '@/components/StatusChip';
import { RequireAuth } from '@/lib/auth/guards';
import { getMyPoints, getMyRedemptions, getRewards, redeemReward } from '@/lib/api/internship';
import { isPopulated } from '@/lib/api/types';
import type { Redemption, RewardType, RewardWithEligibility } from '@/lib/api/types';

/** The catalog endpoint adds remaining stock (null = unlimited) to each reward. */
type CatalogReward = RewardWithEligibility & { stockRemaining?: number | null };

const TYPE_LABELS: Record<RewardType, string> = {
  cash: 'Cash',
  goodie: 'Goodie',
  gift: 'Gift',
  certificate: 'Certificate',
  perk: 'Perk',
  coins: 'App coins',
};

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

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

function RewardCard({
  reward,
  onRedeem,
  balance = 0,
}: {
  reward: CatalogReward;
  onRedeem?: (reward: CatalogReward) => void;
  /** Drives the "how close am I" bar on a points-redeemable reward. */
  balance?: number;
}) {
  const redeemable = reward.unlockType === 'points_redeemable';
  const remaining = reward.stockRemaining;
  const progressPct =
    redeemable && reward.pointsCost > 0
      ? Math.min(100, Math.round((balance / reward.pointsCost) * 100))
      : 0;

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {reward.imageUrl && (
        // Reward art is uploaded to S3, outside next/image's configured domains.
        <Box
          component="img"
          src={reward.imageUrl}
          alt={reward.name}
          loading="lazy"
          sx={{ width: '100%', height: 132, objectFit: 'cover', display: 'block' }}
        />
      )}
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 0.75 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, flexGrow: 1, minWidth: 0 }}>
            {reward.name}
          </Typography>
          <Chip size="small" variant="outlined" label={TYPE_LABELS[reward.type] ?? reward.type} />
        </Stack>

        {reward.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {reward.description}
          </Typography>
        )}

        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
          {redeemable && <PointsBadge points={reward.pointsCost} size="sm" />}
          {reward.cashValue > 0 && (
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {INR.format(reward.cashValue)}
            </Typography>
          )}
          {typeof remaining === 'number' && (
            <Typography variant="caption" color={remaining > 0 ? 'text.secondary' : 'error.main'}>
              {remaining > 0 ? `${remaining} left` : 'Out of stock'}
            </Typography>
          )}
        </Stack>

        <Box sx={{ mt: 1.5 }}>
          {redeemable ? (
            /* An unaffordable reward shows how close you are, not a dead grey
               slab saying "Not enough points" over a line repeating it. */
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <LinearProgress
                  variant="determinate"
                  value={progressPct}
                  color={reward.canRedeem ? 'success' : 'primary'}
                  sx={{ height: 6 }}
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 0.5 }}
                >
                  {reward.canRedeem
                    ? 'You can claim this now'
                    : (reward.lockedReason ?? 'Keep earning points')}
                </Typography>
              </Box>
              <Button
                variant="contained"
                size="small"
                disabled={!reward.canRedeem}
                onClick={() => onRedeem?.(reward)}
                sx={{ flexShrink: 0 }}
              >
                Redeem
              </Button>
            </Stack>
          ) : (
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: 'text.secondary' }}>
              <LockIcon sx={{ fontSize: 16 }} />
              <Typography variant="caption">
                {reward.lockedReason ??
                  (reward.unlockType === 'eligibility_gated'
                    ? 'Earned by completing tasks'
                    : 'Awarded by the team')}
              </Typography>
            </Stack>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

function RedemptionRow({ redemption }: { redemption: Redemption }) {
  const reward = isPopulated(redemption.rewardId) ? redemption.rewardId : null;
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ py: 1.25 }}>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {reward?.name ?? 'Reward'}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {[
            formatDate(redemption.requestedAt || redemption.createdAt),
            redemption.pointsSpent > 0 ? `${redemption.pointsSpent} pts` : null,
            redemption.source === 'admin_grant'
              ? 'granted by the team'
              : redemption.source === 'eligibility'
                ? 'earned'
                : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Typography>
        {redemption.status === 'rejected' && redemption.rejectionReason && (
          <Typography variant="caption" color="error.main" sx={{ display: 'block' }}>
            {redemption.rejectionReason}
          </Typography>
        )}
        {redemption.fulfillmentNote && (
          <Typography variant="caption" color="success.main" sx={{ display: 'block' }}>
            Reference: {redemption.fulfillmentNote}
          </Typography>
        )}
      </Box>
      <StatusChip status={redemption.status} />
    </Stack>
  );
}

function RewardsBody() {
  const [rewards, setRewards] = useState<CatalogReward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState<CatalogReward | null>(null);

  const load = useCallback((initial = false) => {
    if (initial) setLoading(true);
    setError(null);
    return Promise.all([
      getRewards(),
      getMyRedemptions().catch(() => [] as Redemption[]),
      // Only the headline balance comes from here — the per-card verdict is the server's.
      getMyPoints({ limit: 1 })
        .then((p) => p.balance)
        .catch(() => null),
    ])
      .then(([catalog, history, bal]) => {
        setRewards(catalog as CatalogReward[]);
        setRedemptions(history);
        setBalance(bal);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  if (loading) return <Loading label="Loading the reward catalog…" />;
  if (error) return <ErrorState error={error} onRetry={() => load(true)} />;

  const spendable = rewards.filter((r) => r.unlockType === 'points_redeemable');
  const earned = rewards.filter((r) => r.unlockType !== 'points_redeemable');

  return (
    <Stack spacing={3}>
      {balance !== null && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <PointsBadge points={balance} size="md" label="points to spend" />
            <Box sx={{ flexGrow: 1 }} />
            <Button component={Link} href="/points" size="small">
              History
            </Button>
          </Stack>
        </Paper>
      )}

      {!rewards.length ? (
        <EmptyState
          icon={<CardGiftcardIcon />}
          title="The reward catalog is being set up"
          description="Your points are safe — keep completing tasks and the catalog for your track will appear here."
        />
      ) : (
        <>
          {spendable.length > 0 && (
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                Spend your points
              </Typography>
              {/* Two-up from sm: a catalog is browsed by comparison, and a
                  single column wasted half the width on desktop. */}
              <Grid container spacing={2}>
                {spendable.map((reward) => (
                  <Grid key={reward._id} size={{ xs: 12, sm: 6 }}>
                    <RewardCard reward={reward} onRedeem={setPending} balance={balance ?? 0} />
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {earned.length > 0 && (
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                Awarded by the team
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                These are not bought with points — they land when you meet the conditions on your{' '}
                <MuiLink component={Link} href="/eligibility" sx={{ fontWeight: 600 }}>
                  status page
                </MuiLink>
                .
              </Typography>
              <Grid container spacing={2}>
                {earned.map((reward) => (
                  <Grid key={reward._id} size={{ xs: 12, sm: 6 }}>
                    <RewardCard reward={reward} balance={balance ?? 0} />
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </>
      )}

      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          My redemptions
        </Typography>
        {!redemptions.length ? (
          <EmptyState
            dense
            title="Nothing redeemed yet"
            description="Anything you claim shows up here with its payout status."
          />
        ) : (
          <Card variant="outlined">
            <CardContent sx={{ py: 0.5 }}>
              <Stack divider={<Divider flexItem />}>
                {redemptions.map((r) => (
                  <RedemptionRow key={r._id} redemption={r} />
                ))}
              </Stack>
            </CardContent>
          </Card>
        )}
      </Box>

      <ConfirmDialog
        open={!!pending}
        title={`Redeem ${pending?.name ?? 'this reward'}?`}
        confirmLabel="Yes, redeem"
        message={
          pending ? (
            <Stack spacing={1}>
              <Typography variant="body2">
                This spends <strong>{pending.pointsCost} points</strong> right away and sends a
                request to the team. Points are only returned if the request is rejected.
              </Typography>
              {balance !== null && (
                <Alert severity="info" sx={{ py: 0 }}>
                  Balance after redeeming: {Math.max(0, balance - pending.pointsCost)} points
                </Alert>
              )}
            </Stack>
          ) : undefined
        }
        onClose={() => setPending(null)}
        onConfirm={async () => {
          if (!pending) return;
          await redeemReward(pending._id);
          await load();
        }}
      />
    </Stack>
  );
}

export default function RewardsPage() {
  return (
    <RequireAuth>
      <AppShell>
        <PageHeader
          title="Rewards"
          subtitle="Spend points, or see what the team hands out for hitting your targets."
        />
        <RewardsBody />
      </AppShell>
    </RequireAuth>
  );
}
