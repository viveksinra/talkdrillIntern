'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import InboxIcon from '@mui/icons-material/Inbox';

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** Defaults to an inbox glyph. Pass any MUI icon element. */
  icon?: React.ReactNode;
  /** Clay illustration path (from the ART registry). Wins over `icon`. */
  art?: string;
  /** Primary call to action (a Button, usually). */
  action?: React.ReactNode;
  /** Drops the card border — for use inside an existing Card. */
  bare?: boolean;
  dense?: boolean;
}

/** Friendly "nothing here yet" block. Never leave a list rendering as blank space. */
export default function EmptyState({
  title,
  description,
  icon,
  art,
  action,
  bare = false,
  dense = false,
}: EmptyStateProps) {
  const body = (
    <Stack spacing={1.25} alignItems="center" sx={{ textAlign: 'center', py: dense ? 2 : 4, px: 2 }}>
      {art ? (
        <Box
          component="img"
          src={art}
          alt=""
          aria-hidden
          sx={{ width: dense ? 88 : 120, height: dense ? 88 : 120, objectFit: 'contain' }}
        />
      ) : (
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'action.hover',
          color: 'text.secondary',
          '& svg': { fontSize: 28 },
        }}
      >
        {icon ?? <InboxIcon />}
      </Box>
      )}
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380 }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ pt: 0.5 }}>{action}</Box>}
    </Stack>
  );

  if (bare) return body;
  return (
    <Paper variant="outlined" sx={{ borderStyle: 'dashed' }}>
      {body}
    </Paper>
  );
}

export { EmptyState };
