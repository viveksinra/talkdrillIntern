'use client';

import React from 'react';
import Box from '@mui/material/Box';
import { alpha, useTheme } from '@mui/material/styles';

/**
 * Status label, ported from the admin's Minimal-UI `Label` — the soft tinted
 * pill that reads as data, not as a button. Use for statuses everywhere a
 * Chip would over-decorate.
 */

export type LabelColor = 'default' | 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'error';
export type LabelVariant = 'soft' | 'filled' | 'outlined';

export default function Label({
  children,
  color = 'default',
  variant = 'soft',
  startIcon,
  sx,
}: {
  children: React.ReactNode;
  color?: LabelColor;
  variant?: LabelVariant;
  startIcon?: React.ReactNode;
  sx?: object;
}) {
  const theme = useTheme();
  const pal =
    color === 'default'
      ? { main: theme.palette.grey[600], dark: theme.palette.grey[700], contrastText: '#fff' }
      : theme.palette[color];

  const styles =
    variant === 'filled'
      ? { color: pal.contrastText, bgcolor: pal.main }
      : variant === 'outlined'
        ? { color: pal.main, border: `1px solid ${alpha(pal.main, 0.48)}`, bgcolor: 'transparent' }
        : { color: pal.dark, bgcolor: alpha(pal.main, 0.16) };

  return (
    <Box
      component="span"
      sx={{
        height: 24,
        minWidth: 24,
        px: 0.75,
        borderRadius: 0.75,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        ...styles,
        ...sx,
      }}
    >
      {startIcon}
      {children}
    </Box>
  );
}
