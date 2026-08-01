'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import AppShell from '@/components/AppShell';
import { ErrorState, Loading } from '@/components/DataStates';
import EmptyState from '@/components/EmptyState';
import PageHeader from '@/components/PageHeader';
import { RequireAuth } from '@/lib/auth/guards';
import { getLeaderboard } from '@/lib/api/internship';
import type { LeaderboardResponse, LeaderboardRow } from '@/lib/api/types';

const NUM = new Intl.NumberFormat('en-IN');

/**
 * Gold / silver / bronze taken from the theme ramps rather than invented hexes:
 * warning is the amber, grey is the silver, secondary's dark stop is the bronze.
 */
const PODIUM = [
  { bg: 'warning.lighter', fg: 'warning.darker' },
  { bg: 'grey.200', fg: 'grey.700' },
  { bg: 'secondary.lighter', fg: 'secondary.darker' },
] as const;

function RankBadge({ rank, isMe }: { rank: number; isMe?: boolean }) {
  const podium = rank <= 3 ? PODIUM[rank - 1] : null;
  return (
    <Box
      sx={{
        width: 36,
        height: 36,
        flexShrink: 0,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        fontWeight: 800,
        fontSize: 14,
        fontVariantNumeric: 'tabular-nums',
        color: podium ? podium.fg : isMe ? 'primary.dark' : 'text.secondary',
        bgcolor: podium ? podium.bg : isMe ? 'primary.lighter' : 'action.hover',
      }}
    >
      {rank}
    </Box>
  );
}

function BoardRow({ row, last }: { row: LeaderboardRow; last: boolean }) {
  // Anonymised to "First L." by the backend — a cohort board carries no emails.
  const name = row.name || 'Intern';
  const podium = row.rank <= 3;

  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="center"
      sx={{
        position: 'relative',
        px: { xs: 1.5, sm: 2 },
        py: 1.25,
        minHeight: 56,
        bgcolor: row.isMe ? 'primary.lighter' : 'transparent',
        borderBottom: last ? 0 : '1px solid',
        borderColor: 'divider',
      }}
    >
      {/* A rail on your own row so it is findable from a scroll, not just a tint. */}
      {row.isMe && (
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            bgcolor: 'primary.main',
          }}
        />
      )}
      <RankBadge rank={row.rank} isMe={row.isMe} />

      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          noWrap
          sx={{ fontWeight: row.isMe ? 800 : 600, color: row.isMe ? 'primary.darker' : undefined }}
        >
          {name}
        </Typography>
        {podium && (
          <EmojiEventsRoundedIcon sx={{ fontSize: 16, color: PODIUM[row.rank - 1].fg }} />
        )}
      </Stack>

      {row.isMe && (
        <Chip size="small" color="primary" label="You" sx={{ fontWeight: 700, flexShrink: 0 }} />
      )}
      <Typography
        className="tnum"
        variant="subtitle2"
        sx={{
          fontWeight: 800,
          flexShrink: 0,
          color: row.isMe ? 'primary.darker' : 'text.primary',
        }}
      >
        {NUM.format(row.points)}
        <Box component="span" sx={{ ml: 0.5, fontWeight: 600, color: 'text.disabled' }}>
          pts
        </Box>
      </Typography>
    </Stack>
  );
}

function LeaderboardBody() {
  const [board, setBoard] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getLeaderboard()
      .then(setBoard)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  if (loading) return <Loading label="Loading the board…" />;
  if (error || !board) return <ErrorState error={error ?? 'No leaderboard data'} onRetry={load} />;

  // Opt-in per batch — an off board is a deliberate choice, not an error.
  if (!board.enabled) {
    return (
      <EmptyState
        icon={<VisibilityOffIcon />}
        title="The leaderboard is off for your batch"
        description="Your programme runs without public rankings, so everyone is judged on their own tasks and rewards. Nothing to do here — your points and rewards are unaffected."
        action={
          <Button component={Link} href="/points" variant="contained">
            See my points
          </Button>
        }
      />
    );
  }

  if (!board.rows.length) {
    return (
      <EmptyState
        icon={<LeaderboardIcon />}
        title="No one is on the board yet"
        description="Rankings appear once the first tasks are approved. Get your proof in early and take the top spot."
        action={
          <Button component={Link} href="/tasks" variant="contained">
            Go to my tasks
          </Button>
        }
      />
    );
  }

  const rows = board.rows;
  const me = rows.find((r) => r.isMe);
  const gap = me ? Math.max(0, (rows[0]?.points ?? 0) - me.points) : 0;

  return (
    <Stack spacing={2.5}>
      {me && (
        <Card
          sx={{
            color: 'common.white',
            border: 'none',
            background: (t) =>
              `linear-gradient(120deg, ${t.palette.primary.darker} 0%, ${t.palette.primary.main} 100%)`,
          }}
        >
          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            sx={{ p: { xs: 2, sm: 2.5 }, gap: 2, flexWrap: 'wrap' }}
          >
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="overline" sx={{ opacity: 0.75 }}>
                Your position
              </Typography>
              <Typography className="tnum" sx={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1 }}>
                #{me.rank}
                <Box component="span" sx={{ fontSize: 16, fontWeight: 600, opacity: 0.7 }}>
                  {' '}
                  of {rows.length}
                </Box>
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.85 }}>
                {me.rank === 1
                  ? 'Top of your batch. Hold it.'
                  : `${NUM.format(gap)} points behind the leader.`}
              </Typography>
            </Box>
            <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
              <Typography className="tnum" sx={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1 }}>
                {NUM.format(me.points)}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.85 }}>
                points earned
              </Typography>
            </Box>
          </Stack>
        </Card>
      )}

      <Box>
        <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 0.5, px: 0.5 }}>
          <Typography variant="overline" sx={{ color: 'primary.main' }}>
            Standings
          </Typography>
          <Typography
            className="tnum"
            variant="caption"
            sx={{ color: 'text.disabled', fontWeight: 600 }}
          >
            {rows.length}
          </Typography>
        </Stack>
        {/* Batch names are metadata, not status — a chip each turned them into noise. */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mb: 1.5, px: 0.5 }}
        >
          {board.programs && board.programs.length > 0
            ? board.programs.map((p) => p.name).join(' · ')
            : 'Everyone in your batch, by points earned.'}
        </Typography>

        <Card sx={{ overflow: 'hidden' }}>
          <Stack>
            {rows.map((row, i) => (
              <BoardRow
                key={`${row.rank}-${row.name}`}
                row={row}
                last={i === rows.length - 1}
              />
            ))}
          </Stack>
        </Card>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
        Ranked on points earned over the whole internship — redeeming a reward never pushes you
        down the board.
      </Typography>
    </Stack>
  );
}

export default function LeaderboardPage() {
  return (
    <RequireAuth>
      <AppShell>
        <PageHeader title="Leaderboard" subtitle="How your batch is doing this internship." />
        <LeaderboardBody />
      </AppShell>
    </RequireAuth>
  );
}
