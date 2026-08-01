'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import AppShell from '@/components/AppShell';
import { ErrorState, Loading } from '@/components/DataStates';
import EligibilityChecklist from '@/components/EligibilityChecklist';
import EmptyState from '@/components/EmptyState';
import PageHeader from '@/components/PageHeader';
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

/**
 * Accent per state. Only the state that needs chasing — a forfeited reward — gets a
 * coloured card border; the rest are distinguished by a left accent bar so a page of
 * four rules does not read as four selected cards.
 */
const ACCENT: Record<EligibilityState, string> = {
  forfeited: 'error.main',
  not_yet_eligible: 'grey.300',
  eligible: 'success.light',
  earned: 'success.main',
};

interface Group {
  key: EligibilityState[];
  title: string;
  caption: string;
  tone: 'primary' | 'muted';
  /** Sweeps up any status the backend adds later so a rule can never go missing. */
  catchAll?: boolean;
}

/** Closed doors first (nothing else can be done about them), then live work, then wins. */
const GROUPS: Group[] = [
  {
    key: ['forfeited'],
    title: 'Missed',
    caption: 'The period closed before every condition was met. Nothing to do here.',
    tone: 'muted',
  },
  {
    key: ['not_yet_eligible'],
    title: 'Still in play',
    caption: 'Exactly what is left before this one is yours.',
    tone: 'primary',
    catchAll: true,
  },
  {
    key: ['eligible', 'earned'],
    title: 'Unlocked',
    caption: 'Conditions met — the team pays these out after review.',
    tone: 'muted',
  },
];

const GROUPED = new Set<string>(GROUPS.flatMap((g) => g.key));

function RuleCard({ row }: { row: EligibilityRow }) {
  const forfeited = row.status === 'forfeited';
  return (
    <Card
      sx={{
        height: '100%',
        overflow: 'hidden',
        // The accent bar carries status without repainting the whole card.
        borderLeft: '4px solid',
        borderLeftColor: ACCENT[row.status] ?? 'grey.300',
        ...(forfeited && { borderColor: 'error.light', borderLeftColor: 'error.main' }),
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

function GroupSection({ group, rows }: { group: Group; rows: EligibilityRow[] }) {
  if (!rows.length) return null;
  // A lone detailed checklist reads better full width than orphaned in half a row.
  const span = rows.length > 1 ? { xs: 12, md: 6 } : { xs: 12 };

  return (
    <Box>
      <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 0.5, px: 0.5 }}>
        <Typography
          variant="overline"
          sx={{ color: group.tone === 'primary' ? 'primary.main' : 'text.secondary' }}
        >
          {group.title}
        </Typography>
        <Typography className="tnum" variant="caption" sx={{ color: 'text.disabled', fontWeight: 600 }}>
          {rows.length}
        </Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, px: 0.5 }}>
        {group.caption}
      </Typography>

      <Grid container spacing={2}>
        {rows.map((row, i) => (
          <Grid key={row.statusId ?? row.ruleId ?? `${row.rewardName}-${i}`} size={span}>
            <RuleCard row={row} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

/** One line of arithmetic the intern would otherwise do in their head. */
function EligibilitySummary({ rows }: { rows: EligibilityRow[] }) {
  const unlocked = rows.filter((r) => r.status === 'earned' || r.status === 'eligible');
  const secured = unlocked.reduce((sum, r) => sum + (r.rewardValue ?? 0), 0);

  return (
    <Card>
      <Stack
        direction="row"
        alignItems="center"
        sx={{ p: { xs: 2, sm: 2.5 }, gap: { xs: 2, sm: 4 }, flexWrap: 'wrap' }}
      >
        <Box>
          <Typography
            className="tnum"
            sx={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1, color: 'primary.main' }}
          >
            {unlocked.length}
            <Box component="span" sx={{ color: 'text.disabled', fontWeight: 700 }}>
              /{rows.length}
            </Box>
          </Typography>
          <Typography variant="caption" color="text.secondary">
            rewards unlocked
          </Typography>
        </Box>

        {secured > 0 && (
          <Box>
            <Typography
              className="tnum"
              sx={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1, color: 'success.dark' }}
            >
              {INR.format(secured)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              secured so far
            </Typography>
          </Box>
        )}
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

  if (loading) return <Loading label="Checking what you have unlocked…" skeletonRows={2} />;
  if (error || !rows) return <ErrorState error={error ?? 'No eligibility data'} onRetry={load} />;

  if (!rows.length) {
    return (
      <EmptyState
        icon={<WorkspacePremiumIcon />}
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

  return (
    <Stack spacing={3}>
      <EligibilitySummary rows={rows} />

      {GROUPS.map((group) => (
        <GroupSection
          key={group.title}
          group={group}
          rows={rows.filter(
            (r) => group.key.includes(r.status) || (group.catchAll && !GROUPED.has(r.status))
          )}
        />
      ))}

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
