'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

/**
 * The `a · b · c` metadata line — one implementation (replaces four copies).
 * Filters out falsy parts so callers can pass conditionals inline.
 */
export default function MetaLine({
  parts,
  sx,
}: {
  parts: Array<React.ReactNode | false | null | undefined>;
  sx?: object;
}) {
  const visible = parts.filter(Boolean);
  if (!visible.length) return null;
  return (
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 0.75, ...sx }}
    >
      {visible.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <Box component="span" aria-hidden sx={{ color: 'text.disabled' }}>
              ·
            </Box>
          )}
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            {part}
          </Box>
        </React.Fragment>
      ))}
    </Typography>
  );
}
