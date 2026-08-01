'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import AppShell from '@/components/AppShell';
import Art from '@/components/Art';
import ConfirmDialog from '@/components/ConfirmDialog';
import { ErrorState, Loading } from '@/components/DataStates';
import EmptyState from '@/components/EmptyState';
import Label, { type LabelColor } from '@/components/Label';
import MetaLine from '@/components/MetaLine';
import PageHeader from '@/components/PageHeader';
import PointsBadge from '@/components/PointsBadge';
import Reveal from '@/components/Reveal';
import SectionHead from '@/components/SectionHead';
import { statusMeta } from '@/components/StatusChip';
import { EYEBROW } from '@/components/night';
import { ART, rewardFallbackArt } from '@/lib/art';
import { celebrate } from '@/lib/juice';
import { FONT_DISPLAY, hoverLift } from '@/theme';
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

/** Timeline dots need something shorter than the full date. */
const SHORT_DATE_FMT = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });

function formatDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : DATE_FMT.format(d);
}

function formatShortDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : SHORT_DATE_FMT.format(d);
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
  const theme = useTheme();
  const redeemable = reward.unlockType === 'points_redeemable';
  const remaining = reward.stockRemaining;
  const progressPct =
    redeemable && reward.pointsCost > 0
      ? Math.min(100, Math.round((balance / reward.pointsCost) * 100))
      : 0;

  /* Every card carries art — the admin's upload when there is one, otherwise the
     clay stand-in the registry picks from the reward's name/type. */
  const art = reward.imageUrl || rewardFallbackArt(reward.name, reward.type);
  const locked = !redeemable;
  const accent = locked ? theme.palette.grey[500] : theme.palette.primary.main;
  const tint = locked ? theme.palette.grey[300] : theme.palette.primary.lighter;
  const lowStock = typeof remaining === 'number' && remaining > 0 && remaining <= 3;
  const outOfStock = typeof remaining === 'number' && remaining <= 0;

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        ...hoverLift(accent),
      }}
    >
      {/* Fixed-height art block so a row of cards lines up whatever the copy length.
          A soft radial tint, not a cropped cover banner — clay art needs air. */}
      <Box
        sx={{
          position: 'relative',
          height: 156,
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          background: `radial-gradient(circle at 50% 46%, ${tint} 0%, ${alpha(tint, 0)} 72%)`,
        }}
      >
        <Art
          src={art}
          size={120}
          sx={locked ? { filter: 'grayscale(0.9)', opacity: 0.8 } : undefined}
        />
        {locked && (
          <Box
            component="img"
            src={ART.lock.locked}
            alt=""
            aria-hidden
            sx={{
              position: 'absolute',
              top: 18,
              left: 'calc(50% + 30px)',
              width: 28,
              height: 28,
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.18))',
            }}
          />
        )}
      </Box>

      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 0.75 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, flexGrow: 1, minWidth: 0 }}>
            {reward.name}
          </Typography>
          <Label color="default" variant="soft" sx={{ flexShrink: 0 }}>
            {TYPE_LABELS[reward.type] ?? reward.type}
          </Label>
        </Stack>

        {reward.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {reward.description}
          </Typography>
        )}

        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          sx={{ flexWrap: 'wrap', gap: 1, mb: 1.5 }}
        >
          {redeemable && <PointsBadge points={reward.pointsCost} size="sm" />}
          {reward.cashValue > 0 && (
            <Typography className="tnum" variant="body2" sx={{ fontWeight: 600 }}>
              {INR.format(reward.cashValue)}
            </Typography>
          )}
          {outOfStock ? (
            <Label color="error" variant="soft">
              Out of stock
            </Label>
          ) : lowStock ? (
            <Label color="warning" variant="soft">
              Only {remaining} left
            </Label>
          ) : typeof remaining === 'number' ? (
            <Typography className="tnum" variant="caption" color="text.secondary">
              {remaining} left
            </Typography>
          ) : null}
        </Stack>

        {/* Pushes the action to the bottom so uneven descriptions still align. */}
        <Box sx={{ flexGrow: 1 }} />

        {redeemable ? (
          reward.canRedeem ? (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Typography
                sx={{ ...EYEBROW, fontSize: 11, color: 'warning.dark', flexGrow: 1, minWidth: 0 }}
              >
                In reach
              </Typography>
              <Button
                variant="contained"
                size="small"
                onClick={() => onRedeem?.(reward)}
                sx={{ flexShrink: 0 }}
              >
                Redeem
              </Button>
            </Stack>
          ) : (
            /* An unaffordable reward shows how close you are, not a dead grey
               slab saying "Not enough points" over a line repeating it. */
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <LinearProgress
                  variant="determinate"
                  value={progressPct}
                  color="primary"
                  sx={{ height: 6, borderRadius: 3 }}
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 0.5 }}
                >
                  {reward.lockedReason ?? 'Keep earning points'}
                </Typography>
              </Box>
              <Button
                variant="contained"
                size="small"
                disabled
                onClick={() => onRedeem?.(reward)}
                sx={{ flexShrink: 0 }}
              >
                Redeem
              </Button>
            </Stack>
          )
        ) : (
          <Typography variant="caption" color="text.secondary">
            {reward.lockedReason ??
              (reward.unlockType === 'eligibility_gated'
                ? 'Earned by completing tasks'
                : 'Awarded by the team')}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

/** requested → decided → fulfilled, filled only where the backend has a timestamp. */
function RedemptionTimeline({
  redemption,
  rejected,
}: {
  redemption: Redemption;
  rejected: boolean;
}) {
  const steps: { label: string; at?: string | null; tone: 'success' | 'error' }[] = [
    {
      label: 'Requested',
      at: redemption.requestedAt || redemption.createdAt,
      tone: 'success',
    },
    {
      label: rejected ? 'Rejected' : 'Decided',
      at: redemption.decidedAt,
      tone: rejected ? 'error' : 'success',
    },
    { label: 'Fulfilled', at: redemption.fulfilledAt, tone: 'success' },
  ];

  return (
    <Stack direction="row" sx={{ mt: 1 }}>
      {steps.map((step, i) => {
        const done = !!step.at;
        return (
          <Box key={step.label} sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" sx={{ pr: i === steps.length - 1 ? 0 : 0 }}>
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  flexShrink: 0,
                  bgcolor: done ? `${step.tone}.main` : 'transparent',
                  border: done ? 'none' : '2px solid',
                  borderColor: 'divider',
                }}
              />
              {i < steps.length - 1 && (
                <Box
                  sx={{
                    flexGrow: 1,
                    height: 2,
                    bgcolor: steps[i + 1].at ? `${steps[i + 1].tone}.light` : 'divider',
                  }}
                />
              )}
            </Stack>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                mt: 0.5,
                fontWeight: done ? 600 : 400,
                color: done ? 'text.primary' : 'text.disabled',
              }}
            >
              {step.label}
            </Typography>
            {done && (
              <Typography className="tnum" variant="caption" color="text.secondary">
                {formatShortDate(step.at)}
              </Typography>
            )}
          </Box>
        );
      })}
    </Stack>
  );
}

function RedemptionRow({ redemption }: { redemption: Redemption }) {
  const reward = isPopulated(redemption.rewardId) ? redemption.rewardId : null;
  const meta = statusMeta(redemption.status);
  const rejected = redemption.status === 'rejected';

  return (
    <Box sx={{ py: 1.5 }}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {reward?.name ?? 'Reward'}
          </Typography>
          <MetaLine
            parts={[
              formatDate(redemption.requestedAt || redemption.createdAt),
              redemption.pointsSpent > 0 && (
                <Box component="span" className="tnum" key="pts">
                  {redemption.pointsSpent} pts
                </Box>
              ),
              redemption.source === 'admin_grant'
                ? 'granted by the team'
                : redemption.source === 'eligibility'
                  ? 'earned'
                  : null,
            ]}
          />
        </Box>
        <Label color={(meta.color ?? 'default') as LabelColor} variant="soft" sx={{ flexShrink: 0 }}>
          {meta.label}
        </Label>
      </Stack>

      <RedemptionTimeline redemption={redemption} rejected={rejected} />

      {rejected && redemption.rejectionReason && (
        <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.75 }}>
          {redemption.rejectionReason}
        </Typography>
      )}
      {redemption.fulfillmentNote && (
        <Box sx={{ mt: 0.75 }}>
          <Label color="success" variant="soft">
            Ref: {redemption.fulfillmentNote}
          </Label>
        </Box>
      )}
    </Box>
  );
}

function RewardsBody() {
  const [rewards, setRewards] = useState<CatalogReward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState<CatalogReward | null>(null);
  /** Set once a redemption goes through — drives the celebratory receipt. */
  const [redeemed, setRedeemed] = useState<CatalogReward | null>(null);

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
        <Card>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ p: 2 }}>
            <Art src={ART.points.stack} size={48} />
            <PointsBadge points={balance} size="md" label="points to spend" />
            <Box sx={{ flexGrow: 1 }} />
            <Button component={Link} href="/points" size="small">
              History
            </Button>
          </Stack>
        </Card>
      )}

      {!rewards.length ? (
        <EmptyState
          art={ART.empty.rewards}
          title="The reward catalog is being set up"
          description="Your points are safe — keep completing tasks and the catalog for your track will appear here."
        />
      ) : (
        <>
          {spendable.length > 0 && (
            <Box>
              <SectionHead
                label="Spend your points"
                count={spendable.length}
                caption="Redeeming spends the points straight away."
              />
              {/* Two-up from sm: a catalog is browsed by comparison, and a
                  single column wasted half the width on desktop. */}
              <Grid container spacing={2}>
                {spendable.map((reward, i) => (
                  <Grid key={reward._id} size={{ xs: 12, sm: 6 }}>
                    <Reveal index={i} sx={{ height: '100%' }}>
                      <RewardCard reward={reward} onRedeem={setPending} balance={balance ?? 0} />
                    </Reveal>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {earned.length > 0 && (
            <Box>
              <SectionHead
                label="Awarded by the team"
                count={earned.length}
                caption="Not bought with points — these land when you meet your conditions."
                action={
                  <Button component={Link} href="/eligibility" size="small">
                    Status page
                  </Button>
                }
              />
              <Grid container spacing={2}>
                {earned.map((reward, i) => (
                  <Grid key={reward._id} size={{ xs: 12, sm: 6 }}>
                    <Reveal index={i} sx={{ height: '100%' }}>
                      <RewardCard reward={reward} balance={balance ?? 0} />
                    </Reveal>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </>
      )}

      <Box>
        <SectionHead
          label="My redemptions"
          count={redemptions.length || undefined}
          caption={redemptions.length ? 'Where each claim has got to.' : undefined}
        />
        {!redemptions.length ? (
          <EmptyState
            dense
            art={ART.empty.inbox}
            title="Nothing redeemed yet"
            description="Anything you claim shows up here with its payout status."
          />
        ) : (
          <Card>
            <CardContent sx={{ py: 0.5 }}>
              <Stack divider={<Divider flexItem />}>
                {redemptions.map((r, i) => (
                  <Reveal key={r._id} index={i}>
                    <RedemptionRow redemption={r} />
                  </Reveal>
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
            <Stack spacing={1.5} alignItems="center" sx={{ textAlign: 'center' }}>
              <Art
                src={pending.imageUrl || rewardFallbackArt(pending.name, pending.type)}
                size={96}
              />
              <Typography variant="body2">
                This spends <strong>{pending.pointsCost} points</strong> right away and sends a
                request to the team. Points are only returned if the request is rejected.
              </Typography>
              {balance !== null && (
                <Label color="info" variant="soft">
                  Balance after: {Math.max(0, balance - pending.pointsCost)} points
                </Label>
              )}
            </Stack>
          ) : undefined
        }
        onClose={() => setPending(null)}
        onConfirm={async () => {
          if (!pending) return;
          await redeemReward(pending._id);
          celebrate();
          setRedeemed(pending);
          await load();
        }}
      />

      {/* The payoff moment: the confirm dialog hands straight over to a receipt. */}
      <Dialog
        open={!!redeemed}
        onClose={() => setRedeemed(null)}
        fullWidth
        maxWidth="xs"
        aria-labelledby="redeemed-title"
      >
        <DialogContent>
          <Stack spacing={1.5} alignItems="center" sx={{ textAlign: 'center', py: 2 }}>
            <Art src={ART.character.present} size={96} />
            <Typography
              id="redeemed-title"
              sx={{ fontFamily: FONT_DISPLAY, fontSize: 30, fontWeight: 700, lineHeight: 1.1 }}
            >
              Redeemed!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              The team will process this soon.
            </Typography>
            {redeemed && (
              <Typography variant="caption" color="text.secondary">
                {redeemed.name}
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="contained" fullWidth onClick={() => setRedeemed(null)}>
            Done
          </Button>
        </DialogActions>
      </Dialog>
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
