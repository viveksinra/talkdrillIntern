'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import StarsIcon from '@mui/icons-material/Stars';

/** Points are dimensionless — always render them with the token glyph, never as a bare number. */

export interface PointsBadgeProps {
  points: number;
  /** 'sm' inline in a list row, 'md' on a card, 'lg' as the balance hero. */
  size?: 'sm' | 'md' | 'lg';
  /** Caption under (lg) or beside (sm/md) the number. */
  label?: string;
  /** Render as a chip instead of plain text — for task cards. */
  chip?: boolean;
  /** Signed rendering for ledger rows: +50 green / -200 red. */
  signed?: boolean;
}

function formatPoints(points: number, signed: boolean): string {
  const n = Math.abs(points).toLocaleString('en-IN');
  if (!signed) return n;
  return `${points < 0 ? '−' : '+'}${n}`;
}

export default function PointsBadge({
  points,
  size = 'md',
  label,
  chip = false,
  signed = false,
}: PointsBadgeProps) {
  const text = formatPoints(points, signed);
  const color = signed ? (points < 0 ? 'error.main' : 'success.main') : 'primary.main';

  if (chip) {
    return (
      <Chip
        className="tnum"
        size={size === 'sm' ? 'small' : 'medium'}
        icon={<StarsIcon />}
        label={`${text} ${label ?? 'pts'}`}
        sx={{
          fontWeight: 700,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          '& .MuiChip-icon': { color: 'inherit' },
        }}
      />
    );
  }

  if (size === 'lg') {
    return (
      <Box>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <StarsIcon sx={{ color, fontSize: 30 }} />
          <Typography
            className="tnum"
            sx={{ fontSize: 34, fontWeight: 800, lineHeight: 1.05, color }}
          >
            {text}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {label ?? 'points'}
        </Typography>
      </Box>
    );
  }

  const fontSize = size === 'sm' ? 14 : 18;
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <StarsIcon sx={{ color, fontSize: fontSize + 4 }} />
      <Typography className="tnum" sx={{ fontSize, fontWeight: 700, color }}>
        {text}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {label ?? 'pts'}
      </Typography>
    </Stack>
  );
}

export { PointsBadge };
