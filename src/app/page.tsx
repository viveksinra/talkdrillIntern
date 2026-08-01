import type { Metadata } from 'next';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import PublicShell from '@/components/PublicShell';
import LandingHero from '@/components/public/LandingHero';
import OpeningCard from '@/components/public/OpeningCard';
import { ART } from '@/lib/art';
import { fetchOpenings } from '@/lib/api/openings';

/**
 * Public landing page for TalkDrill internships.
 *
 * A SERVER component: the roles are fetched and rendered into the HTML, so the
 * page is indexable and shareable. Signed-in visitors are not redirected away —
 * the header simply offers "My portal" instead of "Sign in".
 */

export const metadata: Metadata = {
  title: 'Internships at TalkDrill — work from home, part time',
  description:
    'Apply for work-from-home, part-time internships at TalkDrill: campus ambassador, content creation, digital marketing and more. Stipend, certificate and rewards for real work.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Internships at TalkDrill',
    description: 'Real work. Real rewards. Work-from-home, part-time internships at TalkDrill.',
    images: [{ url: '/og.png', width: 1200, height: 630 }],
  },
};

// Openings change rarely; revalidate so a newly published role appears within
// the hour without a redeploy.
export const revalidate = 300;

const STEPS = [
  {
    art: ART.proof.username,
    title: 'Pick a role and apply',
    body: 'Browse the open roles, read exactly what the work involves, and apply with a short pitch. You need a free TalkDrill account — the same one you use to practise.',
  },
  {
    art: ART.eligibility.handshake,
    title: 'We review and get back to you',
    body: 'Our team reads every application. Shortlisted candidates hear from us with next steps, usually a short call or a group case round.',
  },
  {
    art: ART.empty.allDone,
    title: 'Get your task board',
    body: 'Once you are in, your portal fills with weekly tasks. Submit proof, we verify it, and points land in your account.',
  },
  {
    art: ART.reward.stipend,
    title: 'Earn stipend and rewards',
    body: 'Points unlock real rewards, and hitting your monthly targets releases the stipend and your completion certificate.',
  },
];

const BENEFITS = [
  {
    art: ART.reward.certificate,
    title: 'Certificate and LOR',
    body: 'Finish your targets and get a signed completion certificate — plus a letter of recommendation for standout work.',
  },
  {
    art: ART.reward.stipend,
    title: 'Stipend that scales',
    body: 'Most roles pay a fixed base plus performance incentives, so doing more genuinely pays more.',
  },
  {
    art: ART.reward.goodies,
    title: 'Rewards you can use',
    body: 'Points from approved work convert into merch, TalkDrill Pro, mics, ring lights and cash bounties.',
  },
  {
    art: ART.mascot.laptop,
    title: 'Fully remote, part time',
    body: 'Built around a student timetable: work from home, flexible hours, two-month commitments.',
  },
];

const FAQS = [
  {
    q: 'Do I need a TalkDrill account to apply?',
    a: 'Yes. Applying takes a free TalkDrill account — it is how we track your application, and it becomes your intern portal if you are selected. Signing up takes an email and a one-time code.',
  },
  {
    q: 'Is this a paid internship?',
    a: 'Every role lists its own stipend on the role page. Most combine a fixed monthly amount with performance incentives; the campus ambassador role is performance-based with cash bounties per partnership.',
  },
  {
    q: 'Can I do this alongside college?',
    a: 'That is the point. All roles are work-from-home and part time, with flexible hours over a two-month commitment.',
  },
  {
    q: 'Will I get a certificate?',
    a: 'Yes — a signed completion certificate once you meet your targets, and a letter of recommendation on most roles for strong performers.',
  },
  {
    q: 'How long does the process take?',
    a: 'We review applications as they arrive. Roles marked "actively hiring" move fastest — usually a screening, then a short call or group round, then an offer.',
  },
];

export default async function LandingPage() {
  const openings = await fetchOpenings();
  const open = openings.filter((o) => o.isOpen);
  // Open roles lead, but closed ones still fill the grid: a lone card under
  // "1 role open" reads as a dead programme, when in fact five more listings
  // exist and are worth reading before the next batch opens.
  const featured = [...open, ...openings.filter((o) => !o.isOpen)].slice(0, 6);

  return (
    <PublicShell>
      <LandingHero openCount={open.length} totalCount={openings.length} />

      {/* ---------------------------------------------------------- ROLES */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }} id="roles">
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
          spacing={1}
          sx={{ mb: 3 }}
        >
          <Box>
            <Typography variant="overline" color="primary.main" sx={{ display: 'block' }}>
              Open roles
            </Typography>
            <Typography variant="h3" component="h2">
              {open.length > 0
                ? `${open.length} internship${open.length === 1 ? '' : 's'} accepting applications`
                : 'Internships at TalkDrill'}
            </Typography>
          </Box>
          <Button component={Link} href="/internships" variant="outlined">
            See all {openings.length}
          </Button>
        </Stack>

        {featured.length > 0 ? (
          <Grid container spacing={2.5}>
            {featured.map((opening) => (
              <Grid key={opening.slug} size={{ xs: 12, sm: 6, md: 4 }}>
                <OpeningCard opening={opening} />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Stack alignItems="center" spacing={1.5} sx={{ py: 6, textAlign: 'center' }}>
            <Box
              component="img"
              src={ART.mascot.sleeping}
              alt=""
              width={140}
              height={140}
              style={{ objectFit: 'contain' }}
            />
            <Typography variant="h6">No roles open right now</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
              We open new internships every few weeks. Check back soon.
            </Typography>
          </Stack>
        )}
      </Container>

      {/* ------------------------------------------------------- BENEFITS */}
      <Box sx={{ bgcolor: 'grey.100', py: { xs: 6, md: 8 } }}>
        <Container maxWidth="lg">
          <Typography variant="overline" color="primary.main" sx={{ display: 'block' }}>
            Why intern with us
          </Typography>
          <Typography variant="h3" component="h2" sx={{ mb: 4 }}>
            You do real work, and we pay for it properly
          </Typography>

          <Grid container spacing={2.5}>
            {BENEFITS.map((b) => (
              <Grid key={b.title} size={{ xs: 12, sm: 6, md: 3 }}>
                <Box
                  sx={{
                    height: '100%',
                    p: 3,
                    borderRadius: 3,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Box
                    component="img"
                    src={b.art}
                    alt=""
                    width={64}
                    height={64}
                    style={{ objectFit: 'contain', marginBottom: 12 }}
                  />
                  <Typography variant="h6" sx={{ mb: 0.75 }}>
                    {b.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {b.body}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ---------------------------------------------------- HOW IT WORKS */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }} id="how-it-works">
        <Typography variant="overline" color="primary.main" sx={{ display: 'block' }}>
          How it works
        </Typography>
        <Typography variant="h3" component="h2" sx={{ mb: 4 }}>
          From application to stipend
        </Typography>

        <Grid container spacing={3}>
          {STEPS.map((step, i) => (
            <Grid key={step.title} size={{ xs: 12, sm: 6, md: 3 }}>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      bgcolor: 'primary.lighter',
                      color: 'primary.dark',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 800,
                      fontSize: 14,
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </Box>
                  <Box
                    component="img"
                    src={step.art}
                    alt=""
                    width={44}
                    height={44}
                    style={{ objectFit: 'contain' }}
                  />
                </Stack>
                <Typography variant="h6">{step.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {step.body}
                </Typography>
              </Stack>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* ---------------------------------------------------------- FAQ */}
      <Box sx={{ bgcolor: 'grey.100', py: { xs: 6, md: 8 } }}>
        <Container maxWidth="md">
          <Typography variant="overline" color="primary.main" sx={{ display: 'block' }}>
            Questions
          </Typography>
          <Typography variant="h3" component="h2" sx={{ mb: 4 }}>
            Before you apply
          </Typography>

          <Stack spacing={2}>
            {FAQS.map((faq) => (
              <Box
                key={faq.q}
                component="details"
                sx={{
                  p: 2.5,
                  borderRadius: 3,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  '& summary': { cursor: 'pointer', listStyle: 'none', fontWeight: 700 },
                  '& summary::-webkit-details-marker': { display: 'none' },
                }}
              >
                <Box component="summary">
                  <Typography component="span" variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {faq.q}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                  {faq.a}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* ---------------------------------------------------------- CTA */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        <Box
          sx={{
            borderRadius: 4,
            p: { xs: 4, md: 6 },
            textAlign: 'center',
            background: 'linear-gradient(145deg, #6950E8 0%, #4834D4 50%, #3828A7 100%)',
            color: '#fff',
          }}
        >
          <Typography variant="h3" component="h2" sx={{ mb: 1.5 }}>
            Ready to start?
          </Typography>
          <Typography sx={{ opacity: 0.85, mb: 3, maxWidth: 520, mx: 'auto' }}>
            Create your free TalkDrill account, pick the role that fits you, and send us a pitch
            worth reading.
          </Typography>
          <Button
            component={Link}
            href="/internships"
            size="large"
            sx={{
              px: 4,
              borderRadius: 99,
              bgcolor: '#F5A623',
              color: '#231703',
              fontWeight: 800,
              '&:hover': { bgcolor: '#FFB84D' },
            }}
          >
            Browse open roles
          </Button>
        </Box>
      </Container>

      {/* FAQ structured data — these are real questions with real answers. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQS.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          }),
        }}
      />
    </PublicShell>
  );
}
