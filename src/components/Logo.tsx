'use client';

import Box from '@mui/material/Box';

/**
 * The TalkDrill mark. `full` is the lockup (mark + wordmark) for the login
 * screen; `single` is the mark alone for the app bar, where the product name is
 * already set in text.
 */
export default function Logo({
  variant = 'single',
  height = 32,
  sx,
}: {
  variant?: 'single' | 'full';
  height?: number;
  sx?: object;
}) {
  const src = variant === 'full' ? '/logo/logo-full.svg' : '/logo/logo-single.svg';
  // Intrinsic ratios (from the SVG viewBoxes) so the box is sized pre-load — no CLS.
  const ratio = variant === 'full' ? 942 / 224 : 1;
  return (
    <Box
      component="img"
      src={src}
      alt="TalkDrill"
      width={Math.round(height * ratio)}
      height={height}
      sx={{
        height,
        width: 'auto',
        aspectRatio: String(ratio),
        display: 'block',
        userSelect: 'none',
        // A column flex parent stretches an auto width and squashes the mark;
        // pin the cross-size and let the intrinsic ratio decide the width.
        alignSelf: 'flex-start',
        flexShrink: 0,
        ...sx,
      }}
    />
  );
}
