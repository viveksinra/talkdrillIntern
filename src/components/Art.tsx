'use client';

import Box from '@mui/material/Box';

/**
 * Renders a clay illustration from the ART registry at a fixed square size
 * (explicit dimensions → zero CLS). Decorative by default (empty alt).
 */
export default function Art({
  src,
  size = 120,
  alt = '',
  sx,
}: {
  src: string;
  size?: number | { xs: number; sm?: number; md?: number };
  alt?: string;
  sx?: object;
}) {
  const dims =
    typeof size === 'number'
      ? { width: size, height: size }
      : {
          width: { xs: size.xs, sm: size.sm ?? size.xs, md: size.md ?? size.sm ?? size.xs },
          height: { xs: size.xs, sm: size.sm ?? size.xs, md: size.md ?? size.sm ?? size.xs },
        };
  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      loading="lazy"
      aria-hidden={alt === '' ? true : undefined}
      sx={{ ...dims, objectFit: 'contain', display: 'block', userSelect: 'none', ...sx }}
    />
  );
}
