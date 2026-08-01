'use client';

import Link from 'next/link';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { AMBER_HAIRLINE, EYEBROW, INK, NIGHT_PILL_SX, NIGHT_SKY, STARFIELD } from '@/components/night';
import { ART } from '@/lib/art';
import { animationTokens, FONT_DISPLAY, gradientTokens, textGradient } from '@/theme';

/**
 * Landing hero on the "TalkDrill Night" surface — the same treatment the
 * marketing site uses for its headline moments, so the hiring page reads as
 * part of the product and not a bolted-on job board.
 */
export default function LandingHero({
  openCount,
  totalCount,
}: {
  openCount: number;
  totalCount: number;
}) {
  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        color: '#fff',
        background: NIGHT_SKY,
        '&::before': STARFIELD,
        '&::after': AMBER_HAIRLINE,
      }}
    >
      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, py: { xs: 6, md: 9 } }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1.15fr 0.85fr' },
            gap: { xs: 4, md: 5 },
            alignItems: 'center',
          }}
        >
          <Box
            sx={{
              '@keyframes heroIn': {
                from: { opacity: 0, transform: 'translateY(20px)' },
                to: { opacity: 1, transform: 'translateY(0)' },
              },
              animation: `heroIn 0.6s ${animationTokens.easings.reveal} both`,
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            }}
          >
            <Typography sx={{ ...EYEBROW, color: INK.amber, mb: 1.5 }}>
              TalkDrill internships
            </Typography>

            <Typography
              component="h1"
              sx={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 600,
                fontSize: { xs: 38, sm: 52, md: 60 },
                lineHeight: 1.08,
                letterSpacing: '-0.02em',
                mb: 2,
              }}
            >
              Real work.
              <br />
              <Box component="span" sx={textGradient(gradientTokens.secondary)}>
                Real rewards.
              </Box>
            </Typography>

            <Typography sx={{ color: INK.muted, fontSize: { xs: 15, md: 17 }, maxWidth: 520, mb: 3 }}>
              Work from home, part time, alongside your degree. Ship real work every week, get it
              reviewed by our team, and earn a stipend, a certificate and rewards you can actually
              use.
            </Typography>

            <Stack direction="row" spacing={1.5} sx={{ mb: 3, flexWrap: 'wrap', rowGap: 1.5 }}>
              <Button
                component={Link}
                href="/internships"
                size="large"
                endIcon={<ArrowForwardRoundedIcon />}
                sx={{
                  px: 4,
                  borderRadius: 99,
                  bgcolor: INK.amber,
                  color: INK.amberText,
                  fontWeight: 800,
                  boxShadow: '0 12px 30px rgba(245,166,35,0.3)',
                  '&:hover': {
                    bgcolor: INK.amberHover,
                    transform: 'translateY(-2px)',
                    boxShadow: '0 16px 36px rgba(245,166,35,0.4)',
                  },
                }}
              >
                See open roles
              </Button>
              <Button
                component={Link}
                href="/#how-it-works"
                size="large"
                sx={{
                  px: 4,
                  borderRadius: 99,
                  color: '#fff',
                  fontWeight: 700,
                  border: '1px solid rgba(255,255,255,0.28)',
                  bgcolor: 'rgba(255,255,255,0.04)',
                  '&:hover': {
                    borderColor: 'rgba(255,255,255,0.5)',
                    bgcolor: 'rgba(255,255,255,0.08)',
                  },
                }}
              >
                How it works
              </Button>
            </Stack>

            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
              <Box sx={NIGHT_PILL_SX}>
                {openCount > 0 ? `${openCount} role${openCount === 1 ? '' : 's'} open now` : 'Roles open soon'}
              </Box>
              <Box sx={NIGHT_PILL_SX}>{totalCount} listings</Box>
              <Box sx={NIGHT_PILL_SX}>Work from home</Box>
            </Stack>
          </Box>

          <Box
            sx={{
              display: { xs: 'none', md: 'flex' },
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Box
              component="img"
              src={ART.mascot.rocket}
              alt=""
              aria-hidden
              sx={{
                width: '100%',
                maxWidth: 300,
                filter: 'drop-shadow(0 24px 48px rgba(0,0,0,0.45))',
                '@keyframes floaty': {
                  '0%,100%': { transform: 'translateY(0)' },
                  '50%': { transform: 'translateY(-12px)' },
                },
                animation: 'floaty 5s ease-in-out infinite',
                '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
              }}
            />
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
