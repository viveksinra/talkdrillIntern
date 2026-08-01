'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CurrencyRupeeRoundedIcon from '@mui/icons-material/CurrencyRupeeRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import EventBusyRoundedIcon from '@mui/icons-material/EventBusyRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import LaptopMacRoundedIcon from '@mui/icons-material/LaptopMacRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import Label from '@/components/Label';
import { AMBER_HAIRLINE, EYEBROW, INK, NIGHT_PILL_SX, NIGHT_SKY, STARFIELD } from '@/components/night';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  formatListingDate,
  formatStipend,
  getOpeningWithMine,
  LOCATION_LABEL,
  relativeFromNow,
  SUBMISSION_STATUS_LABEL,
  type MoneyRange,
  type MyApplicationSummary,
  type Opening,
} from '@/lib/api/openings';
import { FONT_DISPLAY } from '@/theme';

/**
 * The role detail page body — the page a candidate actually decides on.
 *
 * The opening itself arrives as a prop from the server component (so the whole
 * listing is in the HTML for crawlers and for a fast first paint). The only
 * thing this component fetches is *this viewer's* application state, which is
 * per-user and can never be part of a cached page.
 */

/* ------------------------------------------------------------------ format */

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const PERIOD_SUFFIX: Record<string, string> = { week: '/week', total: ' total', month: '/month' };

/** "₹6,000 - 8,000 /month" for the fixed/incentive split rows. */
function rangeText(r: MoneyRange | undefined, period?: string): string {
  if (!r || (r.min === undefined && r.max === undefined)) return '';
  const per = PERIOD_SUFFIX[period ?? 'month'] ?? '/month';
  const min = r.min ?? 0;
  if (r.max === undefined || r.max === r.min) return `${inr(min)} ${per}`;
  return `${inr(min)} - ${(r.max ?? 0).toLocaleString('en-IN')} ${per}`;
}

/* --------------------------------------------------------------- fragments */

/** Content heading: h5 with the short amber rule the marketing pages use. */
function BlockHead({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 1.75 }}>
      <Typography variant="h5" component="h2">
        {children}
      </Typography>
      <Box sx={{ width: 28, height: 3, borderRadius: 99, bgcolor: INK.amber, mt: 1 }} />
    </Box>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box component="section" sx={{ mb: { xs: 4, md: 5 } }}>
      <BlockHead>{title}</BlockHead>
      {children}
    </Box>
  );
}

/** Paragraphs from a free-text field, blank lines preserved as breaks. */
function Prose({ text }: { text: string }) {
  const paras = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  return (
    <Stack spacing={1.5}>
      {paras.map((p, i) => (
        <Typography key={i} variant="body1" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
          {p.trim()}
        </Typography>
      ))}
    </Stack>
  );
}

function NumberedList({ items }: { items: string[] }) {
  return (
    <Stack component="ol" spacing={1.25} sx={{ listStyle: 'none', p: 0, m: 0 }}>
      {items.map((item, i) => (
        <Stack key={i} component="li" direction="row" spacing={1.5} alignItems="flex-start">
          <Box
            aria-hidden
            sx={{
              flexShrink: 0,
              mt: '2px',
              width: 24,
              height: 24,
              borderRadius: '50%',
              bgcolor: 'primary.lighter',
              color: 'primary.dark',
              display: 'grid',
              placeItems: 'center',
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {i + 1}
          </Box>
          <Typography variant="body1" color="text.secondary">
            {item}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <Stack component="ul" spacing={1} sx={{ listStyle: 'none', p: 0, m: 0 }}>
      {items.map((item, i) => (
        <Stack key={i} component="li" direction="row" spacing={1.5} alignItems="flex-start">
          <Box
            aria-hidden
            sx={{
              flexShrink: 0,
              mt: '9px',
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: 'primary.main',
            }}
          />
          <Typography variant="body1" color="text.secondary">
            {item}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

function Pills({ items }: { items: string[] }) {
  return (
    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
      {items.map((item) => (
        <Label key={item} color="default" variant="soft" sx={{ height: 28, px: 1.25, fontSize: 13 }}>
          {item}
        </Label>
      ))}
    </Stack>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ minWidth: 0 }}>
      <Box
        aria-hidden
        sx={{
          flexShrink: 0,
          width: 32,
          height: 32,
          borderRadius: 1.5,
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'primary.lighter',
          color: 'primary.dark',
          '& svg': { fontSize: 18 },
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.35 }}>
          {value}
        </Typography>
      </Box>
    </Stack>
  );
}

/* --------------------------------------------------------------- apply CTA */

interface ApplyState {
  ready: boolean;
  signedIn: boolean;
  mine: MyApplicationSummary | null;
  /** false while we are still asking the API whether this viewer applied. */
  settled: boolean;
}

/**
 * One CTA, four truths: sign in, apply, register interest, or "we already have
 * you". A closed role is never a dead end — it becomes a waitlist. The CTA
 * never guesses: while auth or the submission lookup is in flight it shows a
 * placeholder rather than flashing the wrong call to action.
 */
function ApplyCta({
  slug,
  isOpen,
  state,
  tone,
}: {
  slug: string;
  isOpen: boolean;
  state: ApplyState;
  tone: 'light' | 'night';
}) {
  const night = tone === 'night';
  const helperColor = night ? INK.faint : 'text.secondary';

  const amberSx = {
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
  } as const;

  // Closed roles used to short-circuit to a disabled button. They no longer
  // can: whether this viewer is already on the waitlist changes the copy, so
  // we wait for the lookup exactly as an open role does.
  if (!state.ready || (state.signedIn && !state.settled)) {
    return <Skeleton variant="rounded" height={50} sx={{ borderRadius: 99 }} />;
  }

  const mine = state.signedIn ? state.mine : null;

  /* Already on the waitlist — a confirmation, not a call to action. */
  if (mine?.status === 'waitlisted') {
    return (
      <Stack spacing={1.25} alignItems={night ? 'center' : 'stretch'}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent={night ? 'center' : 'flex-start'}
          sx={{ flexWrap: 'wrap', rowGap: 1 }}
        >
          <Label color={SUBMISSION_STATUS_LABEL.waitlisted.color} variant={night ? 'filled' : 'soft'}>
            {SUBMISSION_STATUS_LABEL.waitlisted.label}
          </Label>
          <Typography variant="body2" sx={{ color: night ? INK.muted : 'text.secondary' }}>
            Registered {relativeFromNow(mine.appliedAt)}
          </Typography>
        </Stack>
        <Typography
          variant="body2"
          sx={{ color: helperColor, textAlign: night ? 'center' : 'left' }}
        >
          {isOpen
            ? "This role is open again — we'll be in touch about your interest."
            : "We'll email you when this role reopens."}
        </Typography>
      </Stack>
    );
  }

  /* A real application already on file. */
  if (mine) {
    const status = SUBMISSION_STATUS_LABEL[mine.status];
    return (
      <Stack spacing={1.25} alignItems={night ? 'center' : 'stretch'}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent={night ? 'center' : 'flex-start'}
          sx={{ flexWrap: 'wrap', rowGap: 1 }}
        >
          <Label color={status.color} variant={night ? 'filled' : 'soft'}>
            {status.label}
          </Label>
          <Typography variant="body2" sx={{ color: night ? INK.muted : 'text.secondary' }}>
            Applied {relativeFromNow(mine.appliedAt)}
          </Typography>
        </Stack>
        <Button
          component={Link}
          href="/applications"
          variant={night ? 'text' : 'outlined'}
          endIcon={<ArrowForwardRoundedIcon />}
          fullWidth={!night}
          sx={night ? { color: '#fff', fontWeight: 700 } : { borderRadius: 99 }}
        >
          Track your application
        </Button>
      </Stack>
    );
  }

  const href = state.signedIn ? `/apply/${slug}` : `/login?next=/apply/${slug}`;

  /* Deadline passed, nothing on file — capture interest for the next round. */
  if (!isOpen) {
    return (
      <Stack spacing={1}>
        <Button
          component={Link}
          href={href}
          size="large"
          variant={night ? 'text' : 'contained'}
          endIcon={<ArrowForwardRoundedIcon />}
          fullWidth={!night}
          sx={night ? amberSx : { borderRadius: 99, fontWeight: 800 }}
        >
          Get notified when this reopens
        </Button>
        <Typography variant="caption" sx={{ color: helperColor, textAlign: 'center' }}>
          We&apos;ll email you when the next round opens.
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={1}>
      <Button
        component={Link}
        href={href}
        size="large"
        variant={night ? 'text' : 'contained'}
        endIcon={<ArrowForwardRoundedIcon />}
        fullWidth={!night}
        sx={night ? amberSx : { borderRadius: 99, fontWeight: 800 }}
      >
        Apply now
      </Button>
      {!state.signedIn && (
        <Typography variant="caption" sx={{ color: helperColor, textAlign: 'center' }}>
          You&apos;ll need a free TalkDrill account
        </Typography>
      )}
    </Stack>
  );
}

/* -------------------------------------------------------------------- page */

export default function OpeningDetail({ opening }: { opening: Opening }) {
  const { ready, auth } = useAuth();
  const [mine, setMine] = useState<MyApplicationSummary | null>(null);
  const [settled, setSettled] = useState(false);

  // The server already gave us the opening; this call exists only to learn
  // whether *this* viewer applied. If it fails the page is still complete.
  useEffect(() => {
    if (!ready || !auth) return;
    let alive = true;
    getOpeningWithMine(opening.slug)
      .then((res) => {
        if (alive) setMine(res.myApplication);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setSettled(true);
      });
    return () => {
      alive = false;
    };
  }, [ready, auth, opening.slug]);

  const applyState: ApplyState = { ready, signedIn: !!auth, mine, settled };
  const closed = !opening.isOpen;
  /** Only trustworthy once the lookup has settled — never flash "you're in". */
  const onWaitlist = !!auth && settled && mine?.status === 'waitlisted';
  const applyByText = formatListingDate(opening.applyBy);

  const locationValue =
    LOCATION_LABEL[opening.locationType] +
    (opening.city && opening.locationType !== 'wfh' ? ` · ${opening.city}` : '');

  const startValue = opening.startsImmediately
    ? 'Immediately'
    : opening.startDate
      ? formatListingDate(opening.startDate)
      : opening.startWindow?.from
        ? [formatListingDate(opening.startWindow.from), formatListingDate(opening.startWindow.to)]
            .filter(Boolean)
            .join(' – ')
        : '';

  const facts = [
    { icon: <LaptopMacRoundedIcon />, label: 'Location', value: locationValue },
    { icon: <EventAvailableRoundedIcon />, label: 'Start date', value: startValue },
    { icon: <AccessTimeRoundedIcon />, label: 'Duration', value: opening.duration ?? '' },
    { icon: <CurrencyRupeeRoundedIcon />, label: 'Stipend', value: formatStipend(opening.stipend) },
    {
      icon: <EventBusyRoundedIcon />,
      label: 'Apply by',
      // Past the deadline the date is history, not an instruction.
      value: applyByText && closed ? `Closed ${applyByText}` : applyByText,
    },
    {
      icon: <GroupsRoundedIcon />,
      label: 'Openings',
      value: opening.openings ? `${opening.openings}` : '',
    },
  ].filter((f) => f.value);

  const stipend = opening.stipend;
  const fixedText = rangeText(stipend?.fixedPay, stipend?.period);
  const incentiveText = rangeText(stipend?.incentivePay, stipend?.period);
  const hasStipendSplit = !!(fixedText || incentiveText);

  const offer = opening.jobOffer;
  const offerText =
    offer?.available && (offer.min !== undefined || offer.max !== undefined)
      ? offer.max !== undefined && offer.max !== offer.min
        ? `${inr(offer.min ?? 0)} – ${(offer.max ?? 0).toLocaleString('en-IN')} /year`
        : `${inr(offer.min ?? offer.max ?? 0)} /year`
      : '';

  /* ------------------------------------------------------------- fact card */
  const factCard = (
    <Card sx={{ p: { xs: 2.5, md: 3 } }}>
      <Grid container spacing={2.25}>
        {facts.map((f) => (
          <Grid key={f.label} size={{ xs: 6 }}>
            <Fact icon={f.icon} label={f.label} value={f.value} />
          </Grid>
        ))}
      </Grid>

      <Divider sx={{ my: 2.5 }} />

      <ApplyCta slug={opening.slug} isOpen={opening.isOpen} state={applyState} tone="light" />

      {!!opening.postedAt && (
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ display: 'block', textAlign: 'center', mt: 1.5 }}
        >
          Posted {relativeFromNow(opening.postedAt)}
        </Typography>
      )}
    </Card>
  );

  return (
    <>
      {/* ------------------------------------------------------------ HEAD */}
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
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, py: { xs: 4.5, md: 7 } }}>
          <Button
            component={Link}
            href="/internships"
            startIcon={<ArrowBackRoundedIcon />}
            sx={{
              mb: 2,
              ml: -1.5,
              color: INK.muted,
              fontWeight: 600,
              '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' },
            }}
          >
            All internships
          </Button>

          {opening.category && (
            <Typography sx={{ ...EYEBROW, color: INK.amber, mb: 1.25 }}>
              {opening.category}
            </Typography>
          )}

          <Stack
            direction="row"
            spacing={1.5}
            alignItems="flex-start"
            sx={{ flexWrap: 'wrap', rowGap: 1.5, mb: 2 }}
          >
            <Typography
              component="h1"
              sx={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 600,
                fontSize: { xs: 32, sm: 42, md: 50 },
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
              }}
            >
              {opening.title}
            </Typography>
            {closed ? (
              <Label color="default" variant="filled" sx={{ mt: { xs: 0, md: 1.5 } }}>
                Closed
              </Label>
            ) : (
              opening.activelyHiring && (
                <Label color="success" variant="filled" sx={{ mt: { xs: 0, md: 1.5 } }}>
                  Actively hiring
                </Label>
              )
            )}
          </Stack>

          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            <Box sx={NIGHT_PILL_SX}>{LOCATION_LABEL[opening.locationType]}</Box>
            {opening.employmentTypes?.map((t) => (
              <Box key={t} sx={NIGHT_PILL_SX}>
                {t}
              </Box>
            ))}
            {!!opening.duration && <Box sx={NIGHT_PILL_SX}>{opening.duration}</Box>}
            <Box sx={NIGHT_PILL_SX}>{formatStipend(opening.stipend)}</Box>
          </Stack>
        </Container>
      </Box>

      {/* ------------------------------------------------------------ BODY */}
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        <Grid container spacing={{ xs: 3, md: 5 }}>
          {/* Facts + CTA read first on a phone, then sit in the rail on md+. */}
          <Grid size={{ xs: 12, md: 4 }} sx={{ order: { xs: 1, md: 2 } }}>
            <Box sx={{ position: { md: 'sticky' }, top: { md: 88 } }}>{factCard}</Box>
          </Grid>

          <Grid size={{ xs: 12, md: 8 }} sx={{ order: { xs: 2, md: 1 } }}>
            {!!opening.about && (
              <Block title="About the internship">
                <Prose text={opening.about} />
              </Block>
            )}

            {!!opening.responsibilities?.length && (
              <Block title="What you will be doing">
                <NumberedList items={opening.responsibilities} />
              </Block>
            )}

            {!!opening.skills?.length && (
              <Block title="Skills required">
                <Pills items={opening.skills} />
              </Block>
            )}

            {opening.sections?.map((section) => (
              <Block key={section.heading} title={section.heading}>
                <Stack spacing={2}>
                  {!!section.body && <Prose text={section.body} />}
                  {!!section.bullets?.length && <BulletList items={section.bullets} />}
                </Stack>
              </Block>
            ))}

            {!!opening.whoCanApply?.length && (
              <Block title="Who can apply">
                <Stack spacing={2}>
                  <NumberedList items={opening.whoCanApply} />
                  {opening.womenRestartWelcome && (
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      * Women wanting to start/restart their career can also apply.
                    </Typography>
                  )}
                </Stack>
              </Block>
            )}

            {!!opening.otherRequirements?.length && (
              <Block title="Other requirements">
                <BulletList items={opening.otherRequirements} />
              </Block>
            )}

            {!!opening.perks?.length && (
              <Block title="Perks">
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                  {opening.perks.map((perk) => (
                    <Label
                      key={perk}
                      color="success"
                      variant="soft"
                      startIcon={<CheckCircleRoundedIcon sx={{ fontSize: 15 }} />}
                      sx={{ height: 28, px: 1.25, fontSize: 13 }}
                    >
                      {perk}
                    </Label>
                  ))}
                </Stack>
              </Block>
            )}

            {hasStipendSplit && (
              <Block title="Stipend structure">
                <Card sx={{ p: { xs: 2, md: 2.5 } }}>
                  <Stack divider={<Divider flexItem />} spacing={1.5}>
                    {!!fixedText && (
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        spacing={2}
                      >
                        <Typography variant="body2" color="text.secondary">
                          Fixed pay
                        </Typography>
                        <Typography variant="subtitle2">{fixedText}</Typography>
                      </Stack>
                    )}
                    {!!incentiveText && (
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        spacing={2}
                      >
                        <Typography variant="body2" color="text.secondary">
                          Incentive pay
                        </Typography>
                        <Typography variant="subtitle2">{incentiveText}</Typography>
                      </Stack>
                    )}
                  </Stack>
                  {!!stipend?.note && (
                    <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1.5 }}>
                      {stipend.note}
                    </Typography>
                  )}
                </Card>
              </Block>
            )}

            {!!offerText && (
              <Block title="Job offer">
                <Stack
                  direction="row"
                  spacing={1.5}
                  alignItems="center"
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'grey.100',
                  }}
                >
                  <Box sx={{ color: 'secondary.dark', display: 'flex' }}>
                    <WorkspacePremiumRoundedIcon />
                  </Box>
                  <Typography variant="body1" color="text.secondary">
                    On conversion to a permanent role:{' '}
                    <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
                      {offerText}
                    </Box>
                  </Typography>
                </Stack>
              </Block>
            )}

            {/* ------------------------------------------------ ABOUT US */}
            <Box
              component="section"
              sx={{
                p: { xs: 2.5, md: 3 },
                borderRadius: 4,
                bgcolor: 'grey.100',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="overline" color="primary.main" sx={{ display: 'block' }}>
                About TalkDrill
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
                TalkDrill is your speaking practice partner, available 24/7 — for interviews,
                public speaking and everyday fluency. Learners practise with an AI coach and with
                real peers, and get feedback on what to fix next. We are building it from Kolkata,
                India, with a small team and a lot of interns who ship real work.
              </Typography>
              <Button
                component="a"
                href="https://www.talkdrill.com"
                target="_blank"
                rel="noopener"
                endIcon={<ArrowForwardRoundedIcon />}
                sx={{ mt: 1, ml: -1.5, fontWeight: 700 }}
              >
                Visit talkdrill.com
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Container>

      {/* --------------------------------------------------- CLOSING CTA */}
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          color: '#fff',
          background: NIGHT_SKY,
          '&::before': STARFIELD,
        }}
      >
        <Container
          maxWidth="sm"
          sx={{ position: 'relative', zIndex: 1, py: { xs: 5, md: 7 }, textAlign: 'center' }}
        >
          <Typography variant="h4" component="p" sx={{ mb: 1 }}>
            {!closed
              ? `Think you fit ${opening.title}?`
              : onWaitlist
                ? "You're on the list"
                : 'This round has closed'}
          </Typography>
          <Typography sx={{ color: INK.muted, mb: 3 }}>
            {!closed
              ? 'Tell us why in a short pitch. We read every application ourselves.'
              : onWaitlist
                ? "We'll email you the moment this role runs again. Meanwhile, other roles are still taking applications."
                : "Register your interest and we'll email you when it runs again."}
          </Typography>

          {/* The interest CTA leads; browsing other roles is the fallback, not
              the only door out. */}
          <Stack spacing={2} alignItems="center">
            <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
              <Box sx={{ minWidth: { xs: '100%', sm: 280 } }}>
                <ApplyCta
                  slug={opening.slug}
                  isOpen={opening.isOpen}
                  state={applyState}
                  tone="night"
                />
              </Box>
            </Box>
            {closed && (
              <Button
                component={Link}
                href="/internships"
                endIcon={<ArrowForwardRoundedIcon />}
                sx={{
                  px: 3,
                  borderRadius: 99,
                  color: '#fff',
                  fontWeight: 700,
                  border: '1px solid rgba(255,255,255,0.24)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.4)' },
                }}
              >
                See open roles
              </Button>
            )}
          </Stack>
        </Container>
      </Box>
    </>
  );
}
