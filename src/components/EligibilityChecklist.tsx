'use client';

import React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import type { EligibilityProgress, EligibilityState } from '@/lib/api/types';
import StatusChip from './StatusChip';

/**
 * The "what do I still need for the stipend?" component. Interns judge the whole
 * programme by this screen, so every condition shows its own number — never a
 * single opaque "not eligible".
 */

type ProgressValue = EligibilityProgress['current'];

/** Booleans read as Yes/No; a missing value reads as an em dash, never "null". */
function display(value: ProgressValue): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

/** Ratio only when both sides are real numbers — string conditions get a tick instead. */
function ratio(row: EligibilityProgress): number | null {
  const req = typeof row.required === 'number' ? row.required : null;
  const cur = typeof row.current === 'number' ? row.current : null;
  if (req === null || cur === null || req <= 0) return null;
  return Math.max(0, Math.min(100, (cur / req) * 100));
}

function ChecklistRow({ row }: { row: EligibilityProgress }) {
  const pct = ratio(row);
  const numeric = pct !== null;
  return (
    <Box sx={{ py: 1.25 }}>
      <Stack direction="row" spacing={1.25} alignItems="flex-start">
        <Box
          sx={{
            mt: '1px',
            color: row.met ? 'success.main' : 'text.disabled',
            '& svg': { fontSize: 20 },
          }}
        >
          {row.met ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />}
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={1}
            alignItems="baseline"
            justifyContent="space-between"
            sx={{ gap: 1 }}
          >
            <Typography
              variant="body2"
              sx={{ fontWeight: row.met ? 500 : 600, color: row.met ? 'text.secondary' : 'text.primary' }}
            >
              {row.label}
            </Typography>
            <Typography
              className="tnum"
              variant="body2"
              sx={{ fontWeight: 700, whiteSpace: 'nowrap', color: row.met ? 'success.main' : 'text.primary' }}
            >
              {numeric
                ? `${display(row.current)} / ${display(row.required)}`
                : display(row.current)}
            </Typography>
          </Stack>
          {numeric && (
            <LinearProgress
              variant="determinate"
              value={pct as number}
              color={row.met ? 'success' : 'primary'}
              sx={{ mt: 0.75, height: 6, borderRadius: 3 }}
            />
          )}
        </Box>
      </Stack>
    </Box>
  );
}

const REASON_SEVERITY: Record<EligibilityState, 'success' | 'info' | 'warning' | 'error'> = {
  earned: 'success',
  eligible: 'success',
  not_yet_eligible: 'info',
  forfeited: 'error',
};

export interface EligibilityChecklistProps {
  status: EligibilityState;
  progress: EligibilityProgress[];
  /** Human sentence from the engine, e.g. "Missing 2 mandatory tasks". */
  reason?: string;
  /** What the intern gets — the headline of the card. */
  rewardName?: string;
  ruleName?: string;
  /** "YYYY-MM"; rendered as "Aug 2026". */
  period?: string | null;
  /** Drop the surrounding Paper when embedding in an existing card. */
  bare?: boolean;
  /** Footer slot — an override control on the admin side, for instance. */
  footer?: React.ReactNode;
}

/** "2026-08" -> "Aug 2026". Left as-is if it is not a period string. */
function formatPeriod(period?: string | null): string | null {
  if (!period) return null;
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return period;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

export default function EligibilityChecklist({
  status,
  progress,
  reason,
  rewardName,
  ruleName,
  period,
  bare = false,
  footer,
}: EligibilityChecklistProps) {
  const metCount = progress.filter((p) => p.met).length;
  const periodLabel = formatPeriod(period);

  const body = (
    <Stack spacing={1.5} sx={{ p: bare ? 0 : { xs: 2, sm: 2.5 } }}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="flex-start"
        justifyContent="space-between"
        sx={{ gap: 1 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, wordBreak: 'break-word' }}>
            {rewardName ?? ruleName ?? 'Reward'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {[ruleName && rewardName ? ruleName : null, periodLabel, progress.length ? `${metCount} of ${progress.length} done` : null]
              .filter(Boolean)
              .join(' · ')}
          </Typography>
        </Box>
        <StatusChip status={status} withIcon />
      </Stack>

      {reason && (
        <Alert
          severity={REASON_SEVERITY[status] ?? 'info'}
          variant={status === 'forfeited' ? 'filled' : 'standard'}
          sx={{ py: 0.5 }}
        >
          {reason}
        </Alert>
      )}

      {progress.length > 0 && (
        <Box>
          <Divider />
          {progress.map((row, i) => (
            <React.Fragment key={`${row.label}-${i}`}>
              <ChecklistRow row={row} />
              {i < progress.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </Box>
      )}

      {footer}
    </Stack>
  );

  if (bare) return body;
  return (
    <Paper
      variant="outlined"
      sx={{
        borderColor: status === 'forfeited' ? 'error.light' : undefined,
        overflow: 'hidden',
      }}
    >
      {body}
    </Paper>
  );
}

export { EligibilityChecklist };
