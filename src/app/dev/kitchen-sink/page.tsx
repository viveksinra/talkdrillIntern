'use client';

import React from 'react';
import { notFound } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import StarsIcon from '@mui/icons-material/Stars';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import Art from '@/components/Art';
import CountUp from '@/components/CountUp';
import HeroBand from '@/components/HeroBand';
import Label from '@/components/Label';
import MetaLine from '@/components/MetaLine';
import ProgressRing from '@/components/ProgressRing';
import Reveal from '@/components/Reveal';
import SectionHead from '@/components/SectionHead';
import StatCard from '@/components/StatCard';
import { ART } from '@/lib/art';
import { celebrate, playSfx } from '@/lib/juice';
import { FONT_DISPLAY, textGradient, gradientTokens } from '@/theme';

/** Dev-only visual QA of every P1 primitive + the full art registry. */
export default function KitchenSink() {
  if (process.env.NODE_ENV === 'production') notFound();

  const flatArt: Array<[string, string]> = [];
  const walk = (obj: Record<string, unknown>, prefix: string) => {
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string') flatArt.push([`${prefix}${k}`, v]);
      else if (Array.isArray(v)) v.forEach((p, i) => flatArt.push([`${prefix}${k}[${i}]`, p as string]));
      else walk(v as Record<string, unknown>, `${prefix}${k}.`);
    }
  };
  walk(ART as unknown as Record<string, unknown>, '');

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={4}>
        <HeroBand
          eyebrow="Kitchen sink"
          title={
            <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: { xs: 36, md: 56 }, lineHeight: 1.1 }}>
              <CountUp value={1240} /> pts
            </Typography>
          }
          pills={[
            <>
              <StarsIcon sx={{ fontSize: 15, color: '#F5A623' }} /> 2,180 earned
            </>,
            <>
              <LocalFireDepartmentIcon sx={{ fontSize: 15, color: '#F5A623' }} /> 6-day streak
            </>,
          ]}
          art={ART.mascot.coins}
        />

        <Box>
          <SectionHead label="Stat cards" count={3} caption="Admin structure + website hover language" />
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <StatCard title="Pending reviews" value={12} icon={<StarsIcon />} tone="warning" hint="Oldest 2 days" />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <StatCard title="Points awarded" value={5430} icon={<EmojiEventsIcon />} tone="primary" />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <StatCard title="Payouts owed" value={4} icon={<LocalFireDepartmentIcon />} tone="error" hint="₹9,500 total" />
            </Grid>
          </Grid>
        </Box>

        <Box>
          <SectionHead label="Labels" />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Label color="success">Approved</Label>
            <Label color="warning">Pending</Label>
            <Label color="error">Rejected</Label>
            <Label color="info" variant="outlined">Content</Label>
            <Label color="primary" variant="filled">120 pts</Label>
            <Label>Default</Label>
          </Stack>
        </Box>

        <Box>
          <SectionHead label="Rings + meta" />
          <Stack direction="row" spacing={3} alignItems="center">
            <ProgressRing value={72} size={84}>
              <Typography variant="h6" className="tnum">72%</Typography>
            </ProgressRing>
            <ProgressRing value={35} size={64} color="#F5A623">
              <Typography variant="subtitle2" className="tnum">3/9</Typography>
            </ProgressRing>
            <Box>
              <Typography sx={{ ...textGradient(gradientTokens.secondary), fontWeight: 800, fontSize: 28 }}>
                Gradient text
              </Typography>
              <MetaLine parts={['Campus track', 'Due Aug 12', '30 pts', false && 'hidden']} />
            </Box>
          </Stack>
        </Box>

        <Box>
          <SectionHead label="Juice" caption="Click — confetti honors reduced-motion" />
          <Stack direction="row" spacing={2}>
            <Button variant="contained" onClick={() => celebrate()}>Celebrate</Button>
            <Button variant="outlined" onClick={() => playSfx('correct')}>Correct sfx</Button>
            <Button variant="outlined" onClick={() => playSfx('tick')}>Tick</Button>
          </Stack>
        </Box>

        <Box>
          <SectionHead label="Art registry" count={flatArt.length} caption="Every asset, straight from ART" />
          <Grid container spacing={1.5}>
            {flatArt.map(([name, src], i) => (
              <Grid key={name} size={{ xs: 4, sm: 3, md: 2 }}>
                <Reveal index={i % 12}>
                  <Card sx={{ p: 1, textAlign: 'center' }}>
                    <Art src={src} size={72} sx={{ mx: 'auto' }} />
                    <Typography variant="caption" noWrap display="block" color="text.secondary">
                      {name}
                    </Typography>
                  </Card>
                </Reveal>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Stack>
    </Container>
  );
}
