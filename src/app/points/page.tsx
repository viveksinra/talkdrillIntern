'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import CardGiftcardRoundedIcon from '@mui/icons-material/CardGiftcardRounded';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import RedeemIcon from '@mui/icons-material/Redeem';
import StarsIcon from '@mui/icons-material/Stars';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import AppShell from '@/components/AppShell';
import CountUp from '@/components/CountUp';
import { ErrorState, Loading } from '@/components/DataStates';
import EmptyState from '@/components/EmptyState';
import HeroBand from '@/components/HeroBand';
import MetaLine from '@/components/MetaLine';
import PageHeader from '@/components/PageHeader';
import PointsBadge from '@/components/PointsBadge';
import Reveal from '@/components/Reveal';
import SectionHead from '@/components/SectionHead';
import { INK } from '@/components/night';
import { RequireAuth } from '@/lib/auth/guards';
import { getMyPoints, getRewards } from '@/lib/api/internship';
import { ART, rewardFallbackArt } from '@/lib/art';
import { celebrateOnce } from '@/lib/juice';
import type { LedgerEntry, PointsReason, PointsSummary, RewardWithEligibility } from '@/lib/api/types';
import { FONT_DISPLAY, brand, hoverLift } from '@/theme';

/** How many upcoming rewards to show progress bars for — more than this is noise. */
const PROGRESS_TARGETS = 4;

/** Below this the "shape" of a balance line is noise, not a trend — so no chart. */
const MIN_CHART_POINTS = 3;

const NUM = new Intl.NumberFormat('en-IN');

const REASON_LABELS: Record<PointsReason, string> = {
  task_approved: 'Task approved',
  admin_adjustment: 'Adjusted by the team',
  redemption: 'Reward redeemed',
  reward_grant: 'Reward granted',
  reversal: 'Reversal',
};

/** Tinted icon tile per reason, so a ledger scan reads by shape before text. */
const REASON_ICONS: Record<
  PointsReason,
  { tone: 'success' | 'primary' | 'error' | 'info'; icon: React.ReactElement }
> = {
  task_approved: { tone: 'success', icon: <ArrowUpwardRoundedIcon /> },
  reward_grant: { tone: 'success', icon: <CardGiftcardRoundedIcon /> },
  redemption: { tone: 'primary', icon: <CardGiftcardRoundedIcon /> },
  reversal: { tone: 'error', icon: <UndoRoundedIcon /> },
  admin_adjustment: { tone: 'info', icon: <TuneRoundedIcon /> },
};

const DATE_FMT = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const DAY_FMT = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });

function formatDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : DATE_FMT.format(d);
}

/** Local calendar-day key, so "Today" means the intern's today. */
function dayKey(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'unknown';
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Earlier';
  const today = new Date();
  const key = dayKey(value);
  if (key === dayKey(today.toISOString())) return 'Today';
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (key === dayKey(yesterday.toISOString())) return 'Yesterday';
  return formatDate(value);
}

interface LedgerDay {
  key: string;
  label: string;
  entries: LedgerEntry[];
}

/** Group the (newest-first) ledger into calendar days, preserving order. */
function groupByDay(entries: LedgerEntry[]): LedgerDay[] {
  const days: LedgerDay[] = [];
  for (const entry of entries) {
    const key = dayKey(entry.createdAt);
    const last = days[days.length - 1];
    if (last && last.key === key) last.entries.push(entry);
    else days.push({ key, label: dayLabel(entry.createdAt), entries: [entry] });
  }
  return days;
}

// ── balance trend ────────────────────────────────────────────────────────

interface TrendPoint {
  label: string;
  full: string;
  balance: number;
}

/**
 * The ledger's `balanceAfter` over time — the only honest way to draw this,
 * since the API hands us the running balance rather than a daily series.
 * Recharts renders into SVG, so every colour here is a resolved hex: CSS
 * variables are dead inside SVG presentation attributes.
 */
function BalanceTrend({ entries }: { entries: LedgerEntry[] }) {
  const data = useMemo<TrendPoint[]>(
    () =>
      [...entries]
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map((entry) => ({
          label: DAY_FMT.format(new Date(entry.createdAt)),
          full: formatDate(entry.createdAt),
          balance: entry.balanceAfter,
        })),
    [entries]
  );

  if (data.length < MIN_CHART_POINTS) return null;

  return (
    <Box>
      <SectionHead label="Balance over time" caption="Your running balance after every entry." />
      <Card>
        <CardContent sx={{ px: { xs: 0.5, sm: 1 }, py: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 12 }}>
                <defs>
                  <linearGradient id="tdBalanceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={brand.primary.main} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={brand.primary.main} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={28}
                  tick={{ fill: brand.grey[600], fontSize: 11 }}
                />
                <YAxis hide domain={['dataMin', 'dataMax']} />
                <Tooltip
                  cursor={{ stroke: brand.primary.light, strokeWidth: 1 }}
                  contentStyle={{
                    borderRadius: 12,
                    border: `1px solid ${brand.grey[300]}`,
                    boxShadow: '0 12px 24px -8px rgba(145,158,171,0.28)',
                    fontSize: 12,
                    padding: '6px 10px',
                  }}
                  labelStyle={{ color: brand.grey[600], fontWeight: 600, marginBottom: 2 }}
                  itemStyle={{ color: brand.primary.dark, fontWeight: 700 }}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.full ?? label}
                  formatter={(value) => [`${NUM.format(Number(value))} pts`, 'Balance'] as [string, string]}
                />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke={brand.primary.main}
                  strokeWidth={2.5}
                  fill="url(#tdBalanceFill)"
                  dot={false}
                  activeDot={{ r: 4, fill: brand.primary.main, stroke: '#fff', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

// ── ledger ───────────────────────────────────────────────────────────────

function LedgerRow({ entry }: { entry: LedgerEntry }) {
  const { tone, icon } = REASON_ICONS[entry.reason] ?? REASON_ICONS.admin_adjustment;

  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 1.25 }}>
      <Box
        sx={{
          width: 32,
          height: 32,
          flexShrink: 0,
          borderRadius: 1.25,
          display: 'grid',
          placeItems: 'center',
          bgcolor: `${tone}.lighter`,
          color: `${tone}.main`,
          '& svg': { fontSize: 18 },
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {REASON_LABELS[entry.reason] ?? entry.reason}
        </Typography>
        <MetaLine
          parts={[
            entry.note,
            <Box key="bal" component="span" className="tnum">
              balance {NUM.format(entry.balanceAfter)}
            </Box>,
          ]}
        />
      </Box>
      <Box sx={{ flexShrink: 0 }}>
        <PointsBadge points={entry.delta} size="sm" signed />
      </Box>
    </Stack>
  );
}

// ── what points unlock ───────────────────────────────────────────────────

/** One "how close am I" card — the progress bar carries the message, not a dead button. */
function TargetCard({ reward, balance }: { reward: RewardWithEligibility; balance: number }) {
  const cost = reward.pointsCost || 0;
  const pct = cost > 0 ? Math.min(100, Math.round((balance / cost) * 100)) : 100;
  const remaining = Math.max(0, cost - balance);
  const art = reward.imageUrl || rewardFallbackArt(reward.name, reward.type);

  return (
    <Card sx={{ height: '100%', ...hoverLift(brand.primary.main) }}>
      <CardContent sx={{ p: { xs: 2, sm: 2.25 }, '&:last-child': { pb: { xs: 2, sm: 2.25 } } }}>
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
          <Box
            component="img"
            src={art}
            alt=""
            aria-hidden
            sx={{
              width: 40,
              height: 40,
              flexShrink: 0,
              objectFit: 'contain',
              borderRadius: 1.25,
              bgcolor: 'primary.lighter',
              p: 0.5,
            }}
          />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, minWidth: 0 }} noWrap>
            {reward.name}
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={pct}
          sx={{ height: 6, mt: 1.5 }}
          aria-label={`${pct}% of the way to ${reward.name}`}
        />
        <MetaLine
          sx={{ mt: 0.75 }}
          parts={[
            <Box key="of" component="span" className="tnum">
              {NUM.format(balance)} / {NUM.format(cost)} pts
            </Box>,
            <Box
              key="left"
              component="span"
              className="tnum"
              sx={{ color: 'primary.dark', fontWeight: 700 }}
            >
              {NUM.format(remaining)} to go
            </Box>,
          ]}
        />
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
        label="What your points unlock"
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
        // Two-up from sm; on a phone these become a snapped carousel rather than
        // a stack that pushes the ledger below the fold.
        <Box
          sx={{
            display: { xs: 'flex', sm: 'grid' },
            gridTemplateColumns: { sm: 'repeat(2, minmax(0, 1fr))' },
            gap: 2,
            overflowX: { xs: 'auto', sm: 'visible' },
            scrollSnapType: { xs: 'x mandatory', sm: 'none' },
            mx: { xs: -2, sm: 0 },
            px: { xs: 2, sm: 0 },
            pb: { xs: 0.5, sm: 0 },
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {upcoming.map((reward, i) => (
            <Reveal
              key={reward._id}
              index={i}
              sx={{
                minWidth: { xs: '78%', sm: 0 },
                flexShrink: { xs: 0, sm: 1 },
                scrollSnapAlign: 'start',
              }}
            >
              <TargetCard reward={reward} balance={balance} />
            </Reveal>
          ))}
        </Box>
      )}
    </Box>
  );
}

// ── page body ────────────────────────────────────────────────────────────

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

  // Points landing while you were away is a win you discover passively — pop it
  // once per entry, never again on a revisit.
  const latest = summary?.entries[0];
  const celebrated = useRef(false);
  useEffect(() => {
    if (celebrated.current || !latest || latest.delta <= 0) return;
    celebrated.current = true;
    celebrateOnce(`points:${latest._id}`);
  }, [latest]);

  if (loading) return <Loading label="Loading your points…" />;
  if (error || !summary) return <ErrorState error={error ?? 'No points data'} onRetry={load} />;

  const spent = Math.max(0, summary.totalEarned - summary.balance);
  const days = groupByDay(summary.entries);

  return (
    <Stack spacing={3}>
      <HeroBand
        eyebrow="Points balance"
        title={
          <Typography
            sx={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 600,
              fontSize: { xs: 40, sm: 56, md: 64 },
              lineHeight: 1.05,
            }}
          >
            <CountUp value={summary.balance} />
            <Box component="span" sx={{ fontSize: '0.32em', fontWeight: 700, ml: 1, opacity: 0.7 }}>
              pts
            </Box>
          </Typography>
        }
        pills={[
          <React.Fragment key="earned">
            <StarsIcon sx={{ fontSize: 15, color: INK.amber }} />
            <Box component="span" className="tnum">
              {NUM.format(summary.totalEarned)} earned
            </Box>
          </React.Fragment>,
          <React.Fragment key="spent">
            <RedeemIcon sx={{ fontSize: 15, color: INK.amber }} />
            <Box component="span" className="tnum">
              {NUM.format(spent)} spent
            </Box>
          </React.Fragment>,
          // The Board tab drops out of the bottom bar on a full nav, so the
          // leaderboard needs a door from here.
          <Box
            key="board"
            component={Link}
            href="/leaderboard"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            <LeaderboardIcon sx={{ fontSize: 15, color: INK.amber }} />
            View leaderboard
          </Box>,
        ]}
        art={ART.mascot.coins}
      />

      <NextRewards balance={summary.balance} rewards={rewards} />

      <BalanceTrend entries={summary.entries} />

      <Box>
        <SectionHead
          label="History"
          count={summary.total || undefined}
          caption={
            summary.entries.length
              ? 'Every approval, adjustment and redemption, newest first.'
              : undefined
          }
        />
        {!summary.entries.length ? (
          <EmptyState
            art={ART.empty.ledger}
            title="No points yet"
            description="Approved tasks add points here. Submit your first proof to get started."
            action={
              <Button component={Link} href="/tasks" variant="contained">
                Go to my tasks
              </Button>
            }
          />
        ) : (
          <>
            <Stack spacing={1.5}>
              {days.map((day, dayIndex) => (
                <Box key={day.key}>
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      px: 0.5,
                      mb: 0.75,
                      fontWeight: 700,
                      color: 'text.secondary',
                    }}
                  >
                    {day.label}
                  </Typography>
                  <Card>
                    <CardContent sx={{ py: 0.5, '&:last-child': { pb: 0.5 } }}>
                      <Stack divider={<Divider flexItem />}>
                        {day.entries.map((entry, i) => (
                          <Reveal key={entry._id} index={Math.min(dayIndex + i, 8)}>
                            <LedgerRow entry={entry} />
                          </Reveal>
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                </Box>
              ))}
            </Stack>
            {summary.total > summary.entries.length && (
              <Typography
                className="tnum"
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 1.5, px: 0.5 }}
              >
                Showing the latest {summary.entries.length} of {summary.total} entries.
              </Typography>
            )}
          </>
        )}
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
        />
        <PointsBody />
      </AppShell>
    </RequireAuth>
  );
}
