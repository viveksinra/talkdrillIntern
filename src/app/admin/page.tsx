'use client';

import Link from 'next/link';
import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import GroupIcon from '@mui/icons-material/Group';
import LocalAtmIcon from '@mui/icons-material/LocalAtm';
import PaymentsIcon from '@mui/icons-material/Payments';
import RefreshIcon from '@mui/icons-material/Refresh';
import StarsIcon from '@mui/icons-material/Stars';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ErrorState, Loading } from '@/components/DataStates';
import EmptyState from '@/components/EmptyState';
import CountUp from '@/components/CountUp';
import Label from '@/components/Label';
import Reveal from '@/components/Reveal';
import SectionHead from '@/components/SectionHead';
import StatCard from '@/components/StatCard';
import { ART } from '@/lib/art';
import { getDashboardSummary, listPrograms } from '@/lib/api/adminInternship';
import type { DashboardSummary, DashboardTrackRow } from '@/lib/api/types';
import { brand } from '@/theme';
import AdminScreen, { ADMIN_SECTIONS, ScrollArea } from './_shared/AdminScreen';
import {
  asList,
  currentPeriod,
  fmtNumber,
  recentPeriods,
  titleCase,
  type ProgramRow,
} from './_shared/adminUtils';
import { useAsync } from './_shared/useAsync';

/**
 * The founder's landing screen: what needs doing first, then the shape of the
 * programme. One "Needs you" strip carries every queue, so the answer to "what
 * do I open?" is above the fold instead of buried in a wall of equal tiles.
 */

type Tone = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "2026-08" → "August 2026". Parsed by hand: `new Date` would shift the month by TZ. */
function formatPeriod(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period;
  const name = MONTH_NAMES[Number(match[2]) - 1];
  return name ? `${name} ${match[1]}` : period;
}

// ── needs-you strip ──────────────────────────────────────────────────────

interface QueueStat {
  label: string;
  value: number;
  href: string;
  hint: string;
  icon: React.ReactElement;
  /** Colour worn while there is work in the queue; a clear queue always goes green. */
  tone: Tone;
}

/** One queue inside the "Needs you" card: a number that is also a door. */
function QueueBlock({ stat }: { stat: QueueStat }) {
  const open = stat.value > 0;
  const tone: Tone = open ? stat.tone : 'success';

  return (
    <Box
      component={Link}
      href={stat.href}
      sx={{
        display: 'block',
        height: '100%',
        px: { xs: 1.25, sm: 1.5 },
        py: 1.25,
        borderRadius: 2,
        textDecoration: 'none',
        color: 'inherit',
        transition: 'background-color .2s ease',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Box
        sx={{
          width: 30,
          height: 30,
          borderRadius: 1.25,
          display: 'grid',
          placeItems: 'center',
          bgcolor: `${tone}.lighter`,
          color: `${tone}.main`,
          '& svg': { fontSize: 18 },
        }}
      >
        {open ? stat.icon : <CheckCircleRoundedIcon />}
      </Box>
      <Typography
        className="tnum"
        sx={{
          mt: 1,
          fontWeight: 800,
          fontSize: { xs: 26, sm: 30 },
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          color: open ? `${tone}.dark` : 'success.main',
        }}
      >
        <CountUp value={stat.value} format={fmtNumber} />
      </Typography>
      <Typography variant="subtitle2" sx={{ mt: 0.25 }}>
        {stat.label}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {stat.hint}
      </Typography>
    </Box>
  );
}

// ── by-track chart ───────────────────────────────────────────────────────

interface TrackDatum {
  track: string;
  active: number;
  inactive: number;
}

function LegendDot({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
      <Typography variant="caption" color="text.secondary">
        {children}
      </Typography>
    </Stack>
  );
}

function TrackChart({ data }: { data: TrackDatum[] }) {
  // One row ≈ 46px, so three tracks land near the intended ~200px band.
  const height = Math.min(320, Math.max(160, data.length * 46 + 36));

  return (
    <Box sx={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          barSize={16}
          margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
        >
          {/* Resolved hex only — CSS vars are dead inside SVG presentation attrs. */}
          <XAxis
            type="number"
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: brand.grey[600], fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="track"
            width={92}
            tickLine={false}
            axisLine={false}
            tick={{ fill: brand.grey[700], fontSize: 12 }}
          />
          <RechartsTooltip
            cursor={{ fill: alpha(brand.primary.main, 0.06) }}
            contentStyle={{
              borderRadius: 12,
              border: `1px solid ${brand.grey[300]}`,
              boxShadow: '0 12px 24px -8px rgba(145,158,171,0.28)',
              fontSize: 12,
              padding: '6px 10px',
            }}
            labelStyle={{ color: brand.grey[600], fontWeight: 600, marginBottom: 2 }}
            formatter={(value, name) => [fmtNumber(Number(value)), String(name)] as [string, string]}
          />
          <Bar
            dataKey="active"
            name="Active"
            stackId="interns"
            fill={brand.primary.main}
            isAnimationActive={false}
          />
          <Bar
            dataKey="inactive"
            name="Inactive"
            stackId="interns"
            fill={brand.grey[300]}
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}

function TrackTable({ rows }: { rows: DashboardTrackRow[] }) {
  return (
    <ScrollArea>
      <Table size="small" sx={{ minWidth: 380 }}>
        <TableHead>
          <TableRow>
            {['Track', 'Interns', 'Active', 'Earned', 'Balance'].map((head, i) => (
              <TableCell
                key={head}
                align={i === 0 ? 'left' : 'right'}
                sx={{
                  bgcolor: 'grey.100',
                  fontWeight: 700,
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                  borderBottomColor: 'divider',
                }}
              >
                {head}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.track || 'unassigned'} hover>
              <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                {titleCase(row.track || 'unassigned')}
              </TableCell>
              <TableCell align="right" className="tnum">
                {fmtNumber(row.interns)}
              </TableCell>
              <TableCell align="right" className="tnum">
                {fmtNumber(row.activeInterns ?? 0)}
              </TableCell>
              <TableCell align="right" className="tnum">
                {fmtNumber(row.totalPointsEarned ?? 0)}
              </TableCell>
              <TableCell align="right" className="tnum">
                {fmtNumber(row.pointsBalance ?? 0)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

// ── page body ────────────────────────────────────────────────────────────

function DashboardBody() {
  const [programId, setProgramId] = useState('');
  const [period, setPeriod] = useState(currentPeriod());

  const programs = useAsync(async () => asList<ProgramRow>(await listPrograms()), []);
  const summary = useAsync<DashboardSummary>(
    () => getDashboardSummary({ programId: programId || undefined, period }),
    [programId, period]
  );

  const s = summary.data;
  const periodLabel = formatPeriod(period);

  const queues: QueueStat[] = s
    ? [
        {
          label: 'Verifications',
          value: s.pendingSubmissions,
          href: '/admin/verify',
          hint: 'Proofs waiting for review',
          icon: <FactCheckIcon />,
          tone: 'warning',
        },
        {
          label: 'Redemptions',
          value: s.pendingRedemptions,
          href: '/admin/redemptions',
          hint: 'Requested, not yet decided',
          icon: <LocalAtmIcon />,
          tone: 'warning',
        },
        {
          // autoGrant stipends and admin grants land straight on 'approved', so
          // this — not the queue above — is where money owed shows up.
          label: 'Awaiting payout',
          value: s.awaitingFulfilment,
          href: '/admin/redemptions',
          hint: 'Approved, transfer not recorded',
          icon: <PaymentsIcon />,
          tone: 'error',
        },
        {
          label: 'Videos due',
          value: s.videosDue,
          href: '/admin/videos',
          hint: 'Past the 30-day window',
          icon: <VideoLibraryIcon />,
          tone: 'warning',
        },
      ]
    : [];

  const trackRows: DashboardTrackRow[] = s?.byTrack ?? [];
  const chartData: TrackDatum[] = trackRows.map((row) => ({
    track: titleCase(row.track || 'unassigned'),
    active: row.activeInterns ?? 0,
    inactive: Math.max(0, row.interns - (row.activeInterns ?? 0)),
  }));
  const openWork = s
    ? s.pendingSubmissions + s.pendingRedemptions + s.awaitingFulfilment + s.videosDue
    : 0;

  const quickLinks = ADMIN_SECTIONS.filter((sec) => sec.href !== '/admin');

  return (
    <Stack spacing={3}>
      {/* Filters read as one instrument panel rather than three floating controls. */}
      <Card>
        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="flex-start"
            sx={{ flexWrap: 'wrap', gap: 1.5 }}
          >
            <TextField
              select
              size="small"
              label="Program"
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
              helperText={programs.error ? 'Could not load programs' : undefined}
              sx={{ flex: '1 1 190px', maxWidth: { sm: 260 } }}
            >
              <MenuItem value="">All programs</MenuItem>
              {asList<ProgramRow>(programs.data).map((p) => (
                <MenuItem key={p._id} value={p._id}>
                  {p.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              sx={{ flex: '0 1 180px' }}
            >
              {recentPeriods(12).map((p) => (
                <MenuItem key={p} value={p}>
                  {formatPeriod(p)}
                </MenuItem>
              ))}
            </TextField>
            <Box sx={{ flexGrow: 1 }} />
            <Tooltip title="Refresh">
              <IconButton
                onClick={summary.reload}
                aria-label="Refresh summary"
                sx={{ width: 44, height: 44 }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </CardContent>
      </Card>

      {summary.error && !s ? (
        <ErrorState error={summary.error} title="Could not load the summary" onRetry={summary.reload} />
      ) : !s ? (
        <Loading label="Loading summary…" />
      ) : (
        <>
          {summary.error && (
            <ErrorState
              error={summary.error}
              title="Showing the last loaded numbers"
              onRetry={summary.reload}
            />
          )}

          {/* Everything that is waiting on a human, in one amber-edged card. */}
          <Card
            sx={{
              borderLeft: '4px solid',
              borderLeftColor: 'secondary.main',
              backgroundImage: (t) =>
                `linear-gradient(100deg, ${alpha(t.palette.secondary.main, 0.07)} 0%, transparent 46%)`,
            }}
          >
            <CardContent sx={{ p: { xs: 1.5, sm: 2.5 }, '&:last-child': { pb: { xs: 1.5, sm: 2.5 } } }}>
              <SectionHead
                label="Needs you"
                caption="Tap a number to open the queue that clears it."
                sx={{ px: { xs: 1.25, sm: 1.5 } }}
                action={
                  openWork > 0 ? (
                    <Label color="warning" variant="soft">
                      {fmtNumber(openWork)} open
                    </Label>
                  ) : (
                    <Label color="success" variant="soft" startIcon={<CheckCircleRoundedIcon sx={{ fontSize: 15 }} />}>
                      All clear
                    </Label>
                  )
                }
              />
              {/* Two-up on a phone: these are compared with each other, not read in order. */}
              <Grid container>
                {queues.map((stat, i) => (
                  <Grid key={stat.label} size={{ xs: 6, md: 3 }}>
                    <Reveal index={i} sx={{ height: '100%' }}>
                      <QueueBlock stat={stat} />
                    </Reveal>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>

          <Box>
            <SectionHead label="Programme" caption={`Enrolment and points for ${periodLabel}.`} />
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Reveal index={0} sx={{ height: '100%' }}>
                  <StatCard
                    title="Interns"
                    value={s.interns}
                    hint={`${fmtNumber(s.activeInterns)} active`}
                    icon={<GroupIcon />}
                    tone="primary"
                    href="/admin/interns"
                    format={fmtNumber}
                  />
                </Reveal>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Reveal index={1} sx={{ height: '100%' }}>
                  <StatCard
                    title="Points awarded"
                    value={s.pointsAwardedThisPeriod}
                    hint={`Credited in ${periodLabel}`}
                    icon={<StarsIcon />}
                    tone="info"
                    href="/admin/points"
                    format={fmtNumber}
                  />
                </Reveal>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Reveal index={2} sx={{ height: '100%' }}>
                  <StatCard
                    title="Stipend eligible"
                    value={s.stipendEligibleCount}
                    hint={`Eligible or earned, covering ${periodLabel}`}
                    icon={<WorkspacePremiumIcon />}
                    tone="success"
                    href="/admin/rules"
                    format={fmtNumber}
                  />
                </Reveal>
              </Grid>
            </Grid>
          </Box>

          <Card>
            <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
              <SectionHead
                label="By track"
                count={trackRows.length || undefined}
                caption={`Who is enrolled where, for ${periodLabel}.`}
                action={
                  trackRows.length ? (
                    <Stack direction="row" spacing={1.5}>
                      <LegendDot color={brand.primary.main}>Active</LegendDot>
                      <LegendDot color={brand.grey[300]}>Inactive</LegendDot>
                    </Stack>
                  ) : undefined
                }
              />
              {trackRows.length ? (
                <Grid container spacing={2} alignItems="center">
                  <Grid size={{ xs: 12, md: 7 }}>
                    <TrackChart data={chartData} />
                  </Grid>
                  {/* Admins copy these numbers out, so the table stays next to the bars. */}
                  <Grid size={{ xs: 12, md: 5 }}>
                    <TrackTable rows={trackRows} />
                  </Grid>
                </Grid>
              ) : (
                <EmptyState
                  bare
                  dense
                  art={ART.empty.inbox}
                  title="No interns on any track yet"
                  description="Enrol interns from the Programs screen and the split by track appears here."
                />
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* The nav already carries these twice — this is a keyboard-friendly shortcut row. */}
      <Stack
        direction="row"
        alignItems="center"
        sx={{ flexWrap: 'wrap', columnGap: 0.5, rowGap: 0.5, px: 0.5 }}
      >
        <Typography variant="overline" color="text.disabled" sx={{ mr: 1 }}>
          Jump to
        </Typography>
        {quickLinks.map((sec) => (
          <Button
            key={sec.href}
            component={Link}
            href={sec.href}
            size="small"
            variant="text"
            color="inherit"
            sx={{
              minWidth: 0,
              px: 1,
              fontWeight: 600,
              color: 'text.secondary',
              '&:hover': { color: 'primary.main', bgcolor: 'action.hover' },
            }}
          >
            {sec.label}
          </Button>
        ))}
      </Stack>
    </Stack>
  );
}

export default function AdminDashboardPage() {
  return (
    <AdminScreen
      title="Internship admin"
      subtitle="Verification, rewards and eligibility for the intern programme"
    >
      <DashboardBody />
    </AdminScreen>
  );
}
