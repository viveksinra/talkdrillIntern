'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import StarsIcon from '@mui/icons-material/Stars';
import AppShell from '@/components/AppShell';
import CountUp from '@/components/CountUp';
import { ErrorState, Loading } from '@/components/DataStates';
import EmptyState from '@/components/EmptyState';
import HeroBand from '@/components/HeroBand';
import Label from '@/components/Label';
import PageHeader from '@/components/PageHeader';
import Reveal from '@/components/Reveal';
import SectionHead from '@/components/SectionHead';
import { INK } from '@/components/night';
import { RequireAuth } from '@/lib/auth/guards';
import { getLeaderboard } from '@/lib/api/internship';
import { ART } from '@/lib/art';
import { celebrateOnce } from '@/lib/juice';
import type { LeaderboardResponse, LeaderboardRow } from '@/lib/api/types';
import { FONT_DISPLAY, brand } from '@/theme';

const NUM = new Intl.NumberFormat('en-IN');

/** Medal metal, gold → silver → bronze. Physical colours, not palette ramps. */
const MEDAL = ['#F4B400', '#9AA4B2', '#CD7F32'] as const;

/** "Priya S." → "PS"; the board is anonymised, so initials are all we have. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

// ── podium ───────────────────────────────────────────────────────────────

function PodiumCard({ row, place }: { row: LeaderboardRow; place: 0 | 1 | 2 }) {
  const metal = MEDAL[place];
  const first = place === 0;
  const name = row.name || 'Intern';

  return (
    <Card
      sx={{
        position: 'relative',
        overflow: 'visible',
        textAlign: 'center',
        px: { xs: 0.75, sm: 1.5 },
        pt: first ? 3.5 : 2.75,
        pb: first ? 2.25 : 1.75,
        border: '1px solid',
        borderColor: row.isMe ? 'primary.main' : alpha(metal, 0.32),
        bgcolor: row.isMe ? 'primary.lighter' : 'background.paper',
        boxShadow: (t) => (first ? t.customShadows.z16 : t.customShadows.card),
      }}
    >
      {first && (
        <Box
          component="img"
          src={ART.crown}
          alt=""
          aria-hidden
          sx={{
            position: 'absolute',
            top: { xs: -20, sm: -24 },
            left: '50%',
            transform: 'translateX(-50%)',
            width: { xs: 40, sm: 48 },
            height: { xs: 40, sm: 48 },
            objectFit: 'contain',
            pointerEvents: 'none',
          }}
        />
      )}
      <Avatar
        sx={{
          width: 44,
          height: 44,
          mx: 'auto',
          fontSize: 15,
          fontWeight: 800,
          color: metal,
          bgcolor: alpha(metal, 0.14),
          border: '2px solid',
          borderColor: metal,
        }}
      >
        {initials(name)}
      </Avatar>
      <Typography
        variant="caption"
        noWrap
        sx={{ display: 'block', mt: 1, fontWeight: 700, px: 0.5 }}
        title={name}
      >
        {name}
      </Typography>
      <Typography
        className="tnum"
        sx={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: first ? 24 : 20, lineHeight: 1.2 }}
      >
        {NUM.format(row.points)}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
        pts
      </Typography>
      <Box
        sx={{
          mt: 1,
          mx: 'auto',
          width: 22,
          height: 22,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          fontSize: 12,
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
          color: '#fff',
          bgcolor: metal,
        }}
      >
        {row.rank}
      </Box>
    </Card>
  );
}

/** 2 · 1 · 3 with the leader raised — the shape everyone already reads as a podium. */
function Podium({ rows }: { rows: LeaderboardRow[] }) {
  const order: Array<{ row: LeaderboardRow; place: 0 | 1 | 2 }> = [
    { row: rows[1], place: 1 },
    { row: rows[0], place: 0 },
    { row: rows[2], place: 2 },
  ];

  return (
    <Stack direction="row" spacing={{ xs: 1, sm: 2 }} alignItems="flex-end" sx={{ pt: 3.5 }}>
      {order.map(({ row, place }, i) => (
        <Reveal
          key={`${row.rank}-${row.name}`}
          index={i}
          sx={{ flex: 1, minWidth: 0, mb: place === 0 ? 0 : { xs: 1, sm: 1.5 } }}
        >
          <PodiumCard row={row} place={place} />
        </Reveal>
      ))}
    </Stack>
  );
}

// ── standings rows ───────────────────────────────────────────────────────

function BoardRow({
  row,
  top,
  last,
  rowRef,
}: {
  row: LeaderboardRow;
  /** The leader's points — every bar is relative to this. */
  top: number;
  last: boolean;
  rowRef?: React.Ref<HTMLDivElement>;
}) {
  // Anonymised to "First L." by the backend — a cohort board carries no emails.
  const name = row.name || 'Intern';
  const pct = top > 0 ? Math.max(2, Math.min(100, Math.round((row.points / top) * 100))) : 0;

  return (
    <Box
      ref={rowRef}
      sx={{
        position: 'relative',
        px: { xs: 1.5, sm: 2 },
        py: 1.25,
        bgcolor: row.isMe ? 'primary.lighter' : 'transparent',
        borderBottom: last ? 0 : '1px solid',
        borderColor: 'divider',
      }}
    >
      {/* A rail on your own row so it is findable from a scroll, not just a tint. */}
      {row.isMe && (
        <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, bgcolor: 'primary.main' }} />
      )}
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box
          className="tnum"
          sx={{
            width: 26,
            flexShrink: 0,
            textAlign: 'right',
            fontSize: 13,
            fontWeight: 800,
            color: row.isMe ? 'primary.dark' : 'text.disabled',
          }}
        >
          {row.rank}
        </Box>
        <Typography
          variant="body2"
          noWrap
          sx={{
            flexGrow: 1,
            minWidth: 0,
            fontWeight: row.isMe ? 800 : 600,
            color: row.isMe ? 'primary.darker' : undefined,
          }}
        >
          {name}
        </Typography>
        {row.isMe && <Label color="primary" variant="filled">You</Label>}
        <Typography
          className="tnum"
          variant="subtitle2"
          sx={{
            flexShrink: 0,
            fontWeight: 800,
            minWidth: 56,
            textAlign: 'right',
            color: row.isMe ? 'primary.darker' : 'text.primary',
          }}
        >
          {NUM.format(row.points)}
        </Typography>
      </Stack>
      {/* Distance is the story a ranked list hides — the bar puts it back. */}
      <LinearProgress
        variant="determinate"
        value={pct}
        aria-hidden
        sx={{
          mt: 0.75,
          ml: { xs: 4.75, sm: 4.75 },
          height: 4,
          bgcolor: 'primary.lighter',
          '& .MuiLinearProgress-bar': {
            bgcolor: row.isMe ? 'primary.main' : alpha(brand.primary.main, 0.45),
          },
        }}
      />
    </Box>
  );
}

// ── page body ────────────────────────────────────────────────────────────

function LeaderboardBody() {
  const [board, setBoard] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const meRef = useRef<HTMLDivElement | null>(null);
  const scrolled = useRef(false);
  const celebrated = useRef(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getLeaderboard()
      .then(setBoard)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  // Your row is the one row you came for — bring it into view once, not on
  // every re-render, and never fight a scroll the intern already started.
  const myRank = board?.rows.find((r) => r.isMe)?.rank;
  useEffect(() => {
    if (scrolled.current || !meRef.current) return;
    scrolled.current = true;
    meRef.current.scrollIntoView({ block: 'center' });
  }, [myRank]);

  // Topping your batch is a win you discover by opening the page.
  useEffect(() => {
    if (celebrated.current || myRank !== 1) return;
    celebrated.current = true;
    celebrateOnce('leaderboard:rank-1');
  }, [myRank]);

  if (loading) return <Loading label="Loading the board…" />;
  if (error || !board) return <ErrorState error={error ?? 'No leaderboard data'} onRetry={load} />;

  // Opt-in per batch — an off board is a deliberate choice, not an error.
  if (!board.enabled) {
    return (
      <EmptyState
        art={ART.mascot.sleeping}
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
        art={ART.mascot.rocket}
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
  const myIndex = me ? rows.indexOf(me) : -1;
  const above = myIndex > 0 ? rows[myIndex - 1] : null;
  const toPass = above && me ? above.points - me.points : 0;
  const hasPodium = rows.length >= 3;
  const listed = hasPodium ? rows.slice(3) : rows;
  const top = rows[0]?.points ?? 0;

  return (
    <Stack spacing={2.5}>
      {me && (
        <HeroBand
          compact
          eyebrow="Your position"
          title={
            <Typography
              sx={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 600,
                fontSize: { xs: 40, sm: 52 },
                lineHeight: 1.05,
              }}
            >
              #<CountUp value={me.rank} />
              <Box component="span" sx={{ fontSize: '0.34em', fontWeight: 700, ml: 1, opacity: 0.7 }}>
                of {rows.length}
              </Box>
            </Typography>
          }
          pills={[
            <React.Fragment key="points">
              <StarsIcon sx={{ fontSize: 15, color: INK.amber }} />
              <Box component="span" className="tnum">
                {NUM.format(me.points)} points
              </Box>
            </React.Fragment>,
            above ? (
              <React.Fragment key="gap">
                <ArrowUpwardRoundedIcon sx={{ fontSize: 15, color: INK.amber }} />
                <Box component="span">
                  {toPass > 0 ? (
                    <>
                      <Box component="span" className="tnum">
                        +{NUM.format(toPass)}
                      </Box>{' '}
                      to pass {above.name || 'the intern above you'}
                    </>
                  ) : (
                    `Level with ${above.name || 'the intern above you'}`
                  )}
                </Box>
              </React.Fragment>
            ) : (
              <React.Fragment key="lead">
                <StarsIcon sx={{ fontSize: 15, color: INK.amber }} />
                Top of your batch. Hold it.
              </React.Fragment>
            ),
          ]}
          art={me.rank === 1 ? ART.medal.gold : ART.points.target}
          artWidth={112}
        />
      )}

      {hasPodium && <Podium rows={rows} />}

      <Box>
        <SectionHead
          label={hasPodium ? 'The rest of the board' : 'Standings'}
          count={rows.length}
          // Batch names are metadata, not status — a chip each turned them into noise.
          caption={
            board.programs && board.programs.length > 0
              ? board.programs.map((p) => p.name).join(' · ')
              : 'Everyone in your batch, by points earned.'
          }
        />

        {listed.length > 0 ? (
          <Card sx={{ overflow: 'hidden' }}>
            {listed.map((row, i) => (
              <BoardRow
                key={`${row.rank}-${row.name}`}
                row={row}
                top={top}
                last={i === listed.length - 1}
                rowRef={row.isMe ? meRef : undefined}
              />
            ))}
          </Card>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
            The whole board fits on the podium — for now.
          </Typography>
        )}
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
