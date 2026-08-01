'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import type { EligibilityProgress, EligibilityState } from '@/lib/api/types';
import Label, { type LabelColor } from './Label';
import MetaLine from './MetaLine';
import ProgressRing from './ProgressRing';
import { statusMeta } from './StatusChip';

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

/**
 * One condition per row: a 44px completion ring on the left carrying the two
 * numbers that matter, the label on the right. Non-numeric conditions keep the
 * alignment with a tick glyph and say plainly whether they are met.
 */
function ChecklistRow({ row }: { row: EligibilityProgress }) {
  const theme = useTheme();
  const pct = ratio(row);
  const numeric = pct !== null;
  const ringColor = row.met ? theme.palette.success.main : theme.palette.primary.main;

  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 0.75 }}>
      {numeric ? (
        <ProgressRing
          value={pct as number}
          size={44}
          thickness={5}
          color={ringColor}
          ariaLabel={row.label}
        >
          <Box sx={{ lineHeight: 1 }}>
            <Box
              className="tnum"
              sx={{
                fontSize: 12,
                fontWeight: 800,
                color: row.met ? 'success.main' : 'text.primary',
              }}
            >
              {display(row.current)}
            </Box>
            <Box className="tnum" sx={{ fontSize: 9, fontWeight: 700, color: 'text.disabled' }}>
              /{display(row.required)}
            </Box>
          </Box>
        </ProgressRing>
      ) : (
        <Box
          sx={{
            width: 44,
            height: 44,
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            color: row.met ? 'success.main' : 'text.disabled',
            '& svg': { fontSize: 26 },
          }}
        >
          {row.met ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />}
        </Box>
      )}

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: row.met ? 500 : 600,
            color: row.met ? 'text.secondary' : 'text.primary',
          }}
        >
          {row.label}
        </Typography>
        {!numeric && (
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5 }}>
            {/* A boolean condition used to render nothing under the label. */}
            <Label color={row.met ? 'success' : 'default'} variant="soft">
              {row.met ? '✓ Met' : '✗ Not yet'}
            </Label>
            {typeof row.current !== 'boolean' && row.current !== null && row.current !== undefined && (
              <Typography className="tnum" variant="caption" color="text.secondary">
                {display(row.current)}
                {row.required !== null && row.required !== undefined && typeof row.required !== 'boolean'
                  ? ` / ${display(row.required)}`
                  : ''}
              </Typography>
            )}
          </Stack>
        )}
      </Box>
    </Stack>
  );
}

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
  const meta = statusMeta(status);

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
          <MetaLine
            parts={[
              ruleName && rewardName ? ruleName : null,
              periodLabel,
              progress.length ? (
                <Box component="span" className="tnum" key="done">
                  {metCount} of {progress.length} done
                </Box>
              ) : null,
            ]}
          />
        </Box>
        {/* One quiet status pill — never a stack of coloured alerts. */}
        <Label
          color={(meta.color ?? 'default') as LabelColor}
          variant="soft"
          sx={{ flexShrink: 0 }}
        >
          {meta.label}
        </Label>
      </Stack>

      {reason && (
        <Typography variant="body2" color="text.secondary">
          {reason}
        </Typography>
      )}

      {progress.length > 0 && <Stack spacing={0.5}>{progress.map((row, i) => (
        <ChecklistRow key={`${row.label}-${i}`} row={row} />
      ))}</Stack>}

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
