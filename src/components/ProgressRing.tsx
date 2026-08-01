'use client';

import React from 'react';
import Box from '@mui/material/Box';
import { alpha, useTheme } from '@mui/material/styles';

/**
 * Conic-gradient completion ring (website `ProfileHeader.jsx` pattern) with
 * arbitrary center content. Pure CSS — no SVG, no chart lib.
 */
export default function ProgressRing({
  value,
  size = 72,
  thickness = 6,
  color,
  trackColor,
  children,
  ariaLabel,
}: {
  /** 0–100. */
  value: number;
  size?: number;
  thickness?: number;
  /** Any CSS color; defaults to primary.main. */
  color?: string;
  trackColor?: string;
  children?: React.ReactNode;
  ariaLabel?: string;
}) {
  const theme = useTheme();
  const fill = color ?? theme.palette.primary.main;
  const track = trackColor ?? alpha('#919EAB', 0.16);
  const deg = Math.max(0, Math.min(100, value)) * 3.6;

  return (
    <Box
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        background: `conic-gradient(${fill} ${deg}deg, ${track} ${deg}deg)`,
        transition: 'background 0.6s ease',
      }}
    >
      <Box
        sx={{
          width: size - thickness * 2,
          height: size - thickness * 2,
          borderRadius: '50%',
          bgcolor: 'background.paper',
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
