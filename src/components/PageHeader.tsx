'use client';

import { useRouter } from 'next/navigation';
import React from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

export interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  /** Right-hand slot: a primary Button, a filter Select, a chip row… */
  action?: React.ReactNode;
  /** true = router.back(); a string = router.push(href). */
  back?: boolean | string;
  /** Status chips / counters rendered under the title. */
  meta?: React.ReactNode;
}

/** Page title row. Stacks on xs so a long title never squeezes the action button. */
export default function PageHeader({ title, subtitle, action, back, meta }: PageHeaderProps) {
  const router = useRouter();

  const goBack = () => {
    if (typeof back === 'string') router.push(back);
    else router.back();
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={{ xs: 1.25, sm: 2 }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          {back && (
            <IconButton
              onClick={goBack}
              aria-label="Go back"
              sx={{ ml: -1, width: 44, height: 44 }}
            >
              <ArrowBackIcon />
            </IconButton>
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" sx={{ lineHeight: 1.25, wordBreak: 'break-word' }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
        </Stack>
        {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
      </Stack>
      {meta && (
        <Stack direction="row" spacing={1} sx={{ mt: 1.25, flexWrap: 'wrap', gap: 1 }}>
          {meta}
        </Stack>
      )}
    </Box>
  );
}

export { PageHeader };
