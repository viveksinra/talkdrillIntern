'use client';

import React from 'react';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { useTheme } from '@mui/material/styles';
import CountUp from '@/components/CountUp';
import { hoverLift } from '@/theme';

type Tone = 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'error';

/**
 * Stat tile: admin StatCard structure (48px `{tone}.lighter` icon square,
 * big value, small title) + the website FeatureCard hover (lift + tinted glow
 * + accent top bar wipe). Numbers count up.
 */
export default function StatCard({
  title,
  value,
  suffix,
  hint,
  icon,
  tone = 'primary',
  href,
  format,
}: {
  title: string;
  value: number;
  suffix?: string;
  hint?: string;
  icon: React.ReactNode;
  tone?: Tone;
  href?: string;
  format?: (n: number) => string;
}) {
  const theme = useTheme();
  const accent = theme.palette[tone].main;

  const body = (
    <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ p: 2.5 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" color="text.secondary" noWrap>
          {title}
        </Typography>
        <Typography variant="h4" className="tnum" sx={{ mt: 0.5 }}>
          <CountUp value={value} format={format} />
          {suffix && (
            <Box component="span" sx={{ fontSize: '0.6em', fontWeight: 600, ml: 0.25 }}>
              {suffix}
            </Box>
          )}
        </Typography>
        {hint && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
            {hint}
          </Typography>
        )}
      </Box>
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: 2,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: `${tone}.lighter`,
          color: `${tone}.main`,
        }}
      >
        {icon}
      </Box>
    </Stack>
  );

  return (
    <Card
      sx={{
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        ...hoverLift(accent),
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: 3,
          background: accent,
          transform: 'scaleX(0)',
          transformOrigin: 'left',
          transition: 'transform .35s ease',
          zIndex: 1,
        },
        '&:hover::before': { transform: 'scaleX(1)' },
      }}
    >
      {href ? <CardActionArea component={Link} href={href}>{body}</CardActionArea> : body}
    </Card>
  );
}
