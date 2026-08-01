'use client';

import Link from 'next/link';
import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
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
import type { Theme } from '@mui/material/styles';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import GroupIcon from '@mui/icons-material/Group';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import LocalAtmIcon from '@mui/icons-material/LocalAtm';
import PaymentsIcon from '@mui/icons-material/Payments';
import RefreshIcon from '@mui/icons-material/Refresh';
import StarsIcon from '@mui/icons-material/Stars';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import { DataState, ErrorState, Loading } from '@/components/DataStates';
import { getDashboardSummary, listPrograms } from '@/lib/api/adminInternship';
import type { DashboardSummary, DashboardTrackRow } from '@/lib/api/types';
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
 * The founder's landing screen: what needs doing, and one tap to the screen that
 * does it. Every tile is a link — a number with nowhere to go is a dead end.
 */

/** Ramp keys — every tinted block on this page picks one, never a raw hex. */
type Tone = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';

/** Shared lift: cards react to the pointer instead of shouting with a border. */
const hoverLift = {
  transition: (t: Theme) =>
    t.transitions.create(['box-shadow', 'transform', 'border-color'], { duration: 200 }),
  '&:hover': {
    transform: { md: 'translateY(-2px)' },
    borderColor: 'primary.light',
    boxShadow: (t: Theme) => t.customShadows.cardHover,
  },
};

/** Typographic section head — a filled slab here reads as a card and competes. */
function SectionHeading({
  title,
  count,
  description,
  tone = 'primary',
}: {
  title: string;
  count?: string;
  description: string;
  tone?: 'primary' | 'muted';
}) {
  return (
    <Box sx={{ mb: 1.5, px: 0.5 }}>
      <Stack direction="row" alignItems="baseline" spacing={1}>
        <Typography
          variant="overline"
          sx={{ color: tone === 'primary' ? 'primary.main' : 'text.secondary' }}
        >
          {title}
        </Typography>
        {count && (
          <Typography variant="caption" className="tnum" sx={{ color: 'text.disabled', fontWeight: 600 }}>
            {count}
          </Typography>
        )}
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {description}
      </Typography>
    </Box>
  );
}

interface Tile {
  label: string;
  value: number;
  href: string;
  hint: string;
  icon: React.ReactElement;
  tone: Tone;
  /** A queue: colour it while there is work in it, green once it is clear. */
  urgent?: boolean;
}

function StatTile({ tile }: { tile: Tile }) {
  const needsAttention = !!tile.urgent && tile.value > 0;
  const cleared = !!tile.urgent && tile.value === 0;
  const tone: Tone = cleared ? 'success' : tile.tone;

  return (
    <Card sx={{ height: '100%', ...hoverLift }}>
      <CardActionArea component={Link} href={tile.href} sx={{ height: '100%' }}>
        <CardContent
          sx={{
            p: { xs: 1.75, sm: 2 },
            '&:last-child': { pb: { xs: 1.75, sm: 2 } },
            height: '100%',
          }}
        >
          <Stack direction="row" alignItems="center" sx={{ mb: 1.25 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                bgcolor: `${tone}.lighter`,
                color: `${tone}.dark`,
                '& svg': { fontSize: 22 },
              }}
            >
              {tile.icon}
            </Box>
            <Box sx={{ flexGrow: 1 }} />
            <ChevronRightRoundedIcon sx={{ fontSize: 20, color: 'text.disabled' }} />
          </Stack>

          <Typography
            className="tnum"
            sx={{
              fontWeight: 800,
              fontSize: { xs: 28, sm: 32 },
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              color: needsAttention ? `${tone}.darker` : 'text.primary',
            }}
          >
            {fmtNumber(tile.value)}
          </Typography>
          <Typography variant="subtitle2" sx={{ mt: 0.25 }}>
            {tile.label}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
            {tile.hint}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function DashboardBody() {
  const [programId, setProgramId] = useState('');
  const [period, setPeriod] = useState(currentPeriod());

  const programs = useAsync(async () => asList<ProgramRow>(await listPrograms()), []);
  const summary = useAsync<DashboardSummary>(
    () => getDashboardSummary({ programId: programId || undefined, period }),
    [programId, period]
  );

  const s = summary.data;
  const tiles: Tile[] = s
    ? [
        {
          label: 'Interns',
          value: s.interns,
          href: '/admin/interns',
          hint: 'Enrolled, not removed',
          icon: <GroupIcon />,
          tone: 'primary',
        },
        {
          label: 'Active',
          value: s.activeInterns,
          href: '/admin/interns',
          hint: 'Status is active',
          icon: <HowToRegIcon />,
          tone: 'info',
        },
        {
          label: 'Pending verifications',
          value: s.pendingSubmissions,
          href: '/admin/verify',
          hint: 'Proofs waiting for review',
          icon: <FactCheckIcon />,
          tone: 'warning',
          urgent: true,
        },
        {
          label: 'Pending redemptions',
          value: s.pendingRedemptions,
          href: '/admin/redemptions',
          hint: 'Requested, not yet decided',
          icon: <LocalAtmIcon />,
          tone: 'warning',
          urgent: true,
        },
        {
          // autoGrant stipends and admin grants land straight on 'approved', so
          // this — not the tile above — is where money owed shows up.
          label: 'Awaiting payout',
          value: s.awaitingFulfilment,
          href: '/admin/redemptions',
          hint: 'Approved, transfer not recorded',
          icon: <PaymentsIcon />,
          tone: 'error',
          urgent: true,
        },
        {
          label: 'Videos due',
          value: s.videosDue,
          href: '/admin/videos',
          hint: 'Past the 30-day window',
          icon: <VideoLibraryIcon />,
          tone: 'warning',
          urgent: true,
        },
        {
          label: 'Points awarded',
          value: s.pointsAwardedThisPeriod,
          href: '/admin/points',
          hint: `Credited in ${period}`,
          icon: <StarsIcon />,
          tone: 'primary',
        },
        {
          label: 'Stipend eligible',
          value: s.stipendEligibleCount,
          href: '/admin/rules',
          hint: `Eligible or earned, covering ${period}`,
          icon: <WorkspacePremiumIcon />,
          tone: 'success',
        },
      ]
    : [];

  const trackRows: DashboardTrackRow[] = s?.byTrack ?? [];
  const openWork = s
    ? s.pendingSubmissions + s.pendingRedemptions + s.awaitingFulfilment + s.videosDue
    : 0;

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ flexWrap: 'wrap', gap: 1.5 }}>
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
          sx={{ flex: '0 1 140px' }}
        >
          {recentPeriods(12).map((p) => (
            <MenuItem key={p} value={p}>
              {p}
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

          <Box>
            <SectionHeading
              title="Needs you"
              count={openWork > 0 ? `${fmtNumber(openWork)} open` : 'all clear'}
              description="Tap any number to go straight to the screen that clears it."
            />
            {/* Two-up on a phone: these are compared against each other, not read
                as a sequence. */}
            <Grid container spacing={2}>
              {tiles.map((t) => (
                <Grid key={t.label} size={{ xs: 6, md: 3 }}>
                  <StatTile tile={t} />
                </Grid>
              ))}
            </Grid>
          </Box>

          <Box>
            <SectionHeading
              title="By track"
              count={trackRows.length ? `${trackRows.length} tracks` : undefined}
              description={`Enrolment and points for ${period}.`}
              tone="muted"
            />
            <DataState
              loading={false}
              isEmpty={!trackRows.length}
              emptyTitle="No interns on any track yet"
              emptyDescription="Enrol interns from the Programs screen and the split by track appears here."
            >
              <Card>
                <ScrollArea>
                  <Table size="small" sx={{ minWidth: 520 }}>
                    <TableHead>
                      <TableRow>
                        {['Track', 'Interns', 'Active', 'Points earned', 'Balance'].map((head, i) => (
                          <TableCell
                            key={head}
                            align={i === 0 ? 'left' : 'right'}
                            sx={{
                              bgcolor: 'grey.100',
                              fontWeight: 700,
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
                      {trackRows.map((row) => (
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
              </Card>
            </DataState>
          </Box>
        </>
      )}

      <Box>
        <SectionHeading
          title="Manage"
          description="Everything else the programme is run from."
          tone="muted"
        />
        <Grid container spacing={2}>
          {ADMIN_SECTIONS.filter((sec) => sec.href !== '/admin').map((sec) => (
            <Grid key={sec.href} size={{ xs: 12, sm: 6 }}>
              <Card sx={{ height: '100%', ...hoverLift }}>
                <CardActionArea component={Link} href={sec.href} sx={{ height: '100%' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Box
                        sx={{
                          flexShrink: 0,
                          width: 40,
                          height: 40,
                          borderRadius: 2,
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor: 'primary.lighter',
                          color: 'primary.dark',
                          '& svg': { fontSize: 21 },
                        }}
                      >
                        {sec.icon}
                      </Box>
                      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                        <Typography sx={{ fontWeight: 700 }}>{sec.label}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {sec.desc}
                        </Typography>
                      </Box>
                      <ChevronRightRoundedIcon sx={{ color: 'text.disabled', flexShrink: 0 }} />
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
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
