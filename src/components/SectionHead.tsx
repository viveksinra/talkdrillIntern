'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

/**
 * THE section header. One implementation for the whole app (replaces seven
 * hand-rolled copies): violet overline + optional count, an optional caption
 * under it, and an optional action pinned right.
 */
export default function SectionHead({
  label,
  count,
  caption,
  action,
  sx,
}: {
  label: string;
  count?: number;
  caption?: string;
  action?: React.ReactNode;
  sx?: object;
}) {
  return (
    <Stack
      direction="row"
      alignItems="flex-end"
      justifyContent="space-between"
      spacing={1}
      sx={{ mb: 1.5, ...sx }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="overline" sx={{ color: 'primary.main', display: 'block' }}>
          {label}
          {typeof count === 'number' && (
            <Box component="span" sx={{ color: 'text.disabled', ml: 0.75, letterSpacing: 0 }}>
              {count}
            </Box>
          )}
        </Typography>
        {caption && (
          <Typography variant="caption" color="text.secondary">
            {caption}
          </Typography>
        )}
      </Box>
      {action}
    </Stack>
  );
}
