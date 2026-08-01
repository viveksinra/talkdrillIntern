'use client';

import Box, { BoxProps } from '@mui/material/Box';
import { animationTokens } from '@/theme';

/**
 * CSS-only entrance (fade + rise) with per-item stagger — the website's
 * FeatureCard reveal. No JS on the critical path, honors reduced motion, and
 * `both` fill keeps content invisible until its delay hits so lists cascade.
 */
export default function Reveal({
  index = 0,
  distance = 18,
  sx,
  children,
  ...rest
}: BoxProps & { index?: number; distance?: number }) {
  return (
    <Box
      {...rest}
      sx={{
        '@keyframes tdRevealIn': {
          from: { opacity: 0, transform: `translateY(${distance}px)` },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        animation: `tdRevealIn 0.5s ${animationTokens.easings.reveal} both`,
        animationDelay: `${Math.min(index, 10) * 0.06}s`,
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
