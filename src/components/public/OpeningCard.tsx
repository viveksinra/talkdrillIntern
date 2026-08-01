'use client';

import Link from 'next/link';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import CurrencyRupeeRoundedIcon from '@mui/icons-material/CurrencyRupeeRounded';
import LaptopMacRoundedIcon from '@mui/icons-material/LaptopMacRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import Label from '@/components/Label';
import {
  formatListingDate,
  formatStipend,
  LOCATION_LABEL,
  relativeFromNow,
  type OpeningCard as OpeningCardData,
} from '@/lib/api/openings';

/**
 * One internship listing as a card. The three facts a candidate scans for —
 * where, how long, how much — are a fixed row so cards stay comparable down a
 * column; everything else is secondary.
 */

function Fact({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
      <Box sx={{ color: 'text.disabled', display: 'flex', '& svg': { fontSize: 17 } }}>{icon}</Box>
      <Typography variant="body2" color="text.secondary" noWrap>
        {children}
      </Typography>
    </Stack>
  );
}

export default function OpeningCard({ opening }: { opening: OpeningCardData }) {
  const closed = !opening.isOpen;

  return (
    <Card
      sx={{
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform .3s ease, box-shadow .3s ease, border-color .3s ease',
        opacity: closed ? 0.72 : 1,
        '&:hover': {
          transform: { md: 'translateY(-6px)' },
          borderColor: 'primary.main',
          boxShadow: '0 24px 48px -26px rgba(76,63,226,0.6)',
        },
        '&:hover .oc-arrow': { transform: 'translateX(2px)', opacity: 1 },
      }}
    >
      <CardActionArea
        component={Link}
        href={`/internships/${opening.slug}`}
        sx={{ height: '100%', p: { xs: 2.25, sm: 2.75 }, display: 'block' }}
      >
        <Stack spacing={1.5} sx={{ height: '100%' }}>
          <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between">
            <Box sx={{ minWidth: 0 }}>
              {opening.category && (
                <Typography variant="overline" color="primary.main" sx={{ display: 'block' }}>
                  {opening.category}
                </Typography>
              )}
              <Typography variant="h6" sx={{ lineHeight: 1.3 }}>
                {opening.title}
              </Typography>
            </Box>
            {opening.activelyHiring && !closed && (
              <Label color="success" sx={{ flexShrink: 0 }}>
                Actively hiring
              </Label>
            )}
            {closed && (
              <Label color="default" sx={{ flexShrink: 0 }}>
                Closed
              </Label>
            )}
          </Stack>

          <Stack spacing={0.75}>
            <Fact icon={<LaptopMacRoundedIcon />}>
              {LOCATION_LABEL[opening.locationType]}
              {opening.city && opening.locationType !== 'wfh' ? ` · ${opening.city}` : ''}
            </Fact>
            <Fact icon={<AccessTimeRoundedIcon />}>
              {opening.duration}
              {opening.startsImmediately ? ' · Starts immediately' : ''}
            </Fact>
            <Fact icon={<CurrencyRupeeRoundedIcon />}>{formatStipend(opening.stipend)}</Fact>
          </Stack>

          {!!opening.skills?.length && (
            <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
              {opening.skills.slice(0, 3).map((skill) => (
                <Label key={skill} color="default" variant="soft">
                  {skill}
                </Label>
              ))}
              {opening.skills.length > 3 && (
                <Typography variant="caption" color="text.disabled" sx={{ alignSelf: 'center' }}>
                  +{opening.skills.length - 3} more
                </Typography>
              )}
            </Stack>
          )}

          <Box sx={{ flexGrow: 1 }} />

          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ pt: 1.25, borderTop: '1px solid', borderColor: 'divider' }}
          >
            <Typography variant="caption" color="text.disabled">
              {closed
                ? opening.applyBy
                  ? `Closed ${formatListingDate(opening.applyBy)}`
                  : 'Closed'
                : opening.applyBy
                  ? `Apply by ${formatListingDate(opening.applyBy)}`
                  : `Posted ${relativeFromNow(opening.postedAt)}`}
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'primary.main' }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {closed ? 'View' : 'View & apply'}
              </Typography>
              <ArrowForwardRoundedIcon
                className="oc-arrow"
                sx={{ fontSize: 16, opacity: 0.7, transition: 'transform .2s ease, opacity .2s ease' }}
              />
            </Stack>
          </Stack>
        </Stack>
      </CardActionArea>
    </Card>
  );
}
