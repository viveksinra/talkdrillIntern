'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useState } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AppShell from '@/components/AppShell';
import Art from '@/components/Art';
import CountUp from '@/components/CountUp';
import { ErrorState, Loading } from '@/components/DataStates';
import EligibilityChecklist from '@/components/EligibilityChecklist';
import EmptyState from '@/components/EmptyState';
import Label from '@/components/Label';
import PageHeader from '@/components/PageHeader';
import ProgressRing from '@/components/ProgressRing';
import Reveal from '@/components/Reveal';
import SectionHead from '@/components/SectionHead';
import { INK, NIGHT_SKY, STARFIELD } from '@/components/night';
import { ART } from '@/lib/art';
import { celebrateOnce } from '@/lib/juice';
import { FONT_DISPLAY } from '@/theme';
import { RequireAuth } from '@/lib/auth/guards';
import { getMyEligibility } from '@/lib/api/internship';
import type { EligibilityState, InternEligibilityView } from '@/lib/api/types';

/** The backend attaches the reward's cash value so the card can state what it is worth. */
type EligibilityRow = InternEligibilityView & { rewardValue?: number };

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** Statuses that count as a win; everything else is either closed or still live. */
const UNLOCKED: EligibilityState[] = ['eligible', 'earned'];

/** "2026-08" -> "Aug 2026". Left as-is if it is not a period string. */
function formatPeriod(period?: string | null): string | null {
  if (!period) return null;
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return period;
  return new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  });
}

function rowKey(row: EligibilityRow, i: number): string {
  return row.statusId ?? row.ruleId ?? `${row.rewardName}-${i}`;
}

/**
 * An unlocked reward is the whole point of the programme, so it gets the
 * "TalkDrill Night" treatment instead of another grey checklist card.
 */
function UnlockedBand({ row }: { row: EligibilityRow }) {
  const periodLabel = formatPeriod(row.period);
  const meta = [row.ruleName, periodLabel].filter(Boolean).join(' · ');

  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 3,
        p: 2.5,
        color: '#fff',
        background: NIGHT_SKY,
        '&::before': STARFIELD,
      }}
    >
      <Stack
        direction="row"
        spacing={2}
        alignItems="center"
        sx={{ position: 'relative', zIndex: 1 }}
      >
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Box sx={{ mb: 1 }}>
            <Label
              variant="soft"
              color="warning"
              sx={{ color: INK.amber, bgcolor: 'rgba(245,166,35,0.16)' }}
            >
              Unlocked
            </Label>
          </Box>
          <Typography
            sx={{ fontSize: 18, fontWeight: 700, color: '#fff', wordBreak: 'break-word' }}
          >
            {row.rewardName}
          </Typography>
          {row.rewardValue !== undefined && row.rewardValue > 0 && (
            <Typography
              className="tnum"
              sx={{ fontSize: 26, fontWeight: 800, color: '#fff', lineHeight: 1.15, mt: 0.25 }}
            >
              {INR.format(row.rewardValue)}
            </Typography>
          )}
          {meta && (
            <Typography sx={{ fontSize: 12, color: INK.faint, mt: 0.5 }}>{meta}</Typography>
          )}
          {row.reason && (
            <Typography sx={{ fontSize: 13, color: INK.muted, mt: 0.75 }}>{row.reason}</Typography>
          )}
        </Box>
        <Art src={ART.reward.trophy} size={72} sx={{ flexShrink: 0 }} />
      </Stack>
    </Box>
  );
}

/** A rule that is still winnable keeps the detailed checklist. */
function RuleCard({ row }: { row: EligibilityRow }) {
  return (
    <Card
      sx={{
        height: '100%',
        overflow: 'hidden',
        // The accent bar carries status without repainting the whole card.
        borderLeft: '4px solid',
        borderLeftColor: 'primary.light',
        transition: (t) =>
          t.transitions.create(['box-shadow', 'transform', 'border-color'], { duration: 200 }),
        '&:hover': {
          transform: { md: 'translateY(-2px)' },
          boxShadow: (t) => t.customShadows.cardHover,
        },
      }}
    >
      {/* `bare` drops the component's own Paper so the theme Card owns the frame —
          which means the padding has to come from here. */}
      <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
        <EligibilityChecklist
          bare
          status={row.status}
          progress={row.progress ?? []}
          reason={row.reason}
          rewardName={row.rewardName}
          ruleName={row.ruleName}
          period={row.period}
          footer={
            row.rewardValue && row.rewardValue > 0 ? (
              <Typography variant="caption" color="text.secondary">
                Worth{' '}
                <Box
                  component="span"
                  className="tnum"
                  sx={{ fontWeight: 700, color: 'text.primary' }}
                >
                  {INR.format(row.rewardValue)}
                </Box>{' '}
                — paid by the team after review.
              </Typography>
            ) : undefined
          }
        />
      </Box>
    </Card>
  );
}

/** Closed doors get one collapsed drawer, not a page of red alerts. */
function MissedAccordion({ rows }: { rows: EligibilityRow[] }) {
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const allThisMonth = rows.every((r) => r.period === currentPeriod);

  return (
    <Accordion
      disableGutters
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'action.hover',
        '&:before': { display: 'none' },
        '&.Mui-expanded': { margin: 0 },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
          {allThisMonth ? 'Missed this month' : 'Missed'}{' '}
          <Box component="span" className="tnum" sx={{ color: 'text.disabled' }}>
            ({rows.length})
          </Box>
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        <Stack divider={<Divider flexItem />}>
          {rows.map((row, i) => {
            const periodLabel = formatPeriod(row.period);
            return (
              <Box key={rowKey(row, i)} sx={{ py: 1.25 }}>
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="baseline"
                  justifyContent="space-between"
                >
                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                    {row.rewardName}
                  </Typography>
                  {periodLabel && (
                    <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0 }}>
                      {periodLabel}
                    </Typography>
                  )}
                </Stack>
                {row.reason && (
                  <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                    {row.reason}
                  </Typography>
                )}
              </Box>
            );
          })}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

/** One line of arithmetic the intern would otherwise do in their head. */
function EligibilitySummary({ rows }: { rows: EligibilityRow[] }) {
  const theme = useTheme();
  const unlocked = rows.filter((r) => UNLOCKED.includes(r.status));
  const secured = unlocked.reduce((sum, r) => sum + (r.rewardValue ?? 0), 0);
  const pct = rows.length ? (unlocked.length / rows.length) * 100 : 0;
  const ringColor = unlocked.length ? theme.palette.success.main : theme.palette.primary.main;

  return (
    <Card>
      <Stack
        direction="row"
        alignItems="center"
        spacing={{ xs: 2, sm: 3 }}
        sx={{ p: { xs: 2, sm: 2.5 } }}
      >
        <ProgressRing
          value={pct}
          size={84}
          thickness={7}
          color={ringColor}
          ariaLabel={`${unlocked.length} of ${rows.length} rewards unlocked`}
        >
          <Typography className="tnum" sx={{ fontSize: 19, fontWeight: 800, lineHeight: 1 }}>
            {unlocked.length}
            <Box component="span" sx={{ color: 'text.disabled' }}>
              /{rows.length}
            </Box>
          </Typography>
        </ProgressRing>

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontFamily: FONT_DISPLAY,
              fontSize: { xs: 32, sm: 38 },
              fontWeight: 700,
              lineHeight: 1.05,
              color: secured > 0 ? 'success.dark' : 'text.primary',
            }}
          >
            <CountUp value={secured} format={(n) => INR.format(n)} />
            <Box
              component="span"
              sx={{ fontSize: '0.45em', fontWeight: 600, color: 'text.secondary', ml: 0.75 }}
            >
              secured
            </Box>
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {unlocked.length} of {rows.length} rewards unlocked — the team pays these out after
            review.
          </Typography>
        </Box>

        <Art
          src={ART.eligibility.shield}
          size={72}
          sx={{ flexShrink: 0, display: { xs: 'none', sm: 'block' } }}
        />
      </Stack>
    </Card>
  );
}

function EligibilityBody() {
  const [rows, setRows] = useState<EligibilityRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getMyEligibility()
      .then((data) => setRows(data as EligibilityRow[]))
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  /* A reward that quietly turned "earned" while the intern was elsewhere still
     deserves its moment — once, ever, per rule. */
  useEffect(() => {
    if (!rows) return;
    const first = rows.find((r) => r.status === 'earned');
    if (!first) return;
    celebrateOnce(`eligibility-earned-${first.statusId ?? first.ruleId ?? first.rewardName}`);
  }, [rows]);

  if (loading) return <Loading label="Checking what you have unlocked…" skeletonRows={2} />;
  if (error || !rows) return <ErrorState error={error ?? 'No eligibility data'} onRetry={load} />;

  if (!rows.length) {
    return (
      <EmptyState
        art={ART.eligibility.hourglass}
        title="No stipend or certificate rules yet"
        description="Once the team sets the conditions for your batch, this page shows exactly what you have done and what is still missing."
        action={
          <Button component={Link} href="/tasks" variant="contained">
            Go to my tasks
          </Button>
        }
      />
    );
  }

  const unlockedRows = rows.filter((r) => UNLOCKED.includes(r.status));
  const missedRows = rows.filter((r) => r.status === 'forfeited');
  /* Catch-all on purpose: any status the backend adds later still shows up as
     live work rather than silently disappearing from the page. */
  const inPlayRows = rows.filter(
    (r) => !UNLOCKED.includes(r.status) && r.status !== 'forfeited'
  );

  return (
    <Stack spacing={3}>
      <EligibilitySummary rows={rows} />

      {unlockedRows.length > 0 && (
        <Box>
          <SectionHead
            label="Unlocked"
            count={unlockedRows.length}
            caption="Conditions met — the team pays these out after review."
          />
          <Stack spacing={2}>
            {unlockedRows.map((row, i) => (
              <Reveal key={rowKey(row, i)} index={i}>
                <UnlockedBand row={row} />
              </Reveal>
            ))}
          </Stack>
        </Box>
      )}

      {inPlayRows.length > 0 && (
        <Box>
          <SectionHead
            label="Still in play"
            count={inPlayRows.length}
            caption="Exactly what is left before this one is yours."
          />
          <Grid container spacing={2}>
            {inPlayRows.map((row, i) => (
              // A lone detailed checklist reads better full width than orphaned in half a row.
              <Grid key={rowKey(row, i)} size={inPlayRows.length > 1 ? { xs: 12, md: 6 } : { xs: 12 }}>
                <Reveal index={i} sx={{ height: '100%' }}>
                  <RuleCard row={row} />
                </Reveal>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {missedRows.length > 0 && <MissedAccordion rows={missedRows} />}

      <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
        Counts update as your proof is approved, so a submission still in review does not show here
        yet.
      </Typography>
    </Stack>
  );
}

export default function EligibilityPage() {
  return (
    <RequireAuth>
      <AppShell>
        <PageHeader
          title="Stipend & rewards status"
          subtitle="What you have earned, and exactly what is left for the rest."
        />
        <EligibilityBody />
      </AppShell>
    </RequireAuth>
  );
}
