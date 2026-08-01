'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { AMBER_HAIRLINE, EYEBROW, INK, NIGHT_PILL_SX, NIGHT_SKY, STARFIELD } from '@/components/night';
import { animationTokens } from '@/theme';

/**
 * "TalkDrill Night" band — the portal's signature surface for emotional peaks
 * (points balance, leaderboard rank, stipend earned). Starfield + mesh sky +
 * amber hairline, CSS-keyframe entrance (JS-free above the fold), and slots
 * for an eyebrow, a display-size headline, stat pills, and optional art.
 */
export default function HeroBand({
  eyebrow,
  title,
  pills,
  art,
  artWidth = 150,
  children,
  compact = false,
  sx,
}: {
  eyebrow?: string;
  /** Rendered as-is; pass Typography for full control of the display type. */
  title?: React.ReactNode;
  /** Stat pills row; each item is wrapped in the frosted pill. */
  pills?: React.ReactNode[];
  /** Transparent clay art, absolutely positioned bottom-right. */
  art?: string;
  artWidth?: number;
  children?: React.ReactNode;
  compact?: boolean;
  sx?: object;
}) {
  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: { xs: 3, md: 4 },
        px: { xs: 2.5, sm: 3.5 },
        py: compact ? { xs: 2.5, sm: 3 } : { xs: 3, sm: 4 },
        color: '#fff',
        background: NIGHT_SKY,
        '&::before': STARFIELD,
        '&::after': AMBER_HAIRLINE,
        '@keyframes tdHeroIn': {
          from: { opacity: 0, transform: 'translateY(16px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        animation: `tdHeroIn 0.6s ${animationTokens.easings.reveal} both`,
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        ...sx,
      }}
    >
      {art && (
        <Box
          component="img"
          src={art}
          alt=""
          aria-hidden
          sx={{
            position: 'absolute',
            right: { xs: -12, sm: 8 },
            bottom: -8,
            width: { xs: artWidth * 0.72, sm: artWidth },
            opacity: 0.95,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        />
      )}
      <Box sx={{ position: 'relative', zIndex: 1, pr: art ? { xs: `${artWidth * 0.6}px`, sm: `${artWidth + 16}px` } : 0 }}>
        {eyebrow && (
          <Typography sx={{ ...EYEBROW, color: INK.amber, mb: 0.75 }}>{eyebrow}</Typography>
        )}
        {title}
        {pills && pills.length > 0 && (
          <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', rowGap: 1 }}>
            {pills.map((pill, i) => (
              <Box key={i} sx={NIGHT_PILL_SX}>
                {pill}
              </Box>
            ))}
          </Stack>
        )}
        {children}
      </Box>
    </Box>
  );
}
