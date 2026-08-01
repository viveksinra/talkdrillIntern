import type { Metadata } from 'next';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import PublicShell from '@/components/PublicShell';
import OpeningCard from '@/components/public/OpeningCard';
import EmptyState from '@/components/EmptyState';
import { ART } from '@/lib/art';
import { FONT_DISPLAY } from '@/theme';
import { fetchOpenings, LOCATION_LABEL, type LocationType } from '@/lib/api/openings';

/**
 * Every internship, in one indexable page.
 *
 * A SERVER component, and the filters are server-side too: each chip is a plain
 * <Link> to `?track=…&location=…`, so the page filters correctly with
 * JavaScript disabled, every filtered view is a shareable URL, and a crawler
 * sees real listings instead of an empty shell waiting on a fetch.
 */

export const metadata: Metadata = {
  title: 'Internship openings at TalkDrill',
  description:
    'Every internship TalkDrill is hiring for right now — campus ambassador, content and digital marketing roles. Work from home, part time, with stipend, certificate and rewards for real work.',
  alternates: { canonical: '/internships' },
  openGraph: {
    title: 'Internship openings at TalkDrill',
    description:
      'Work-from-home, part-time internships at TalkDrill. Browse every open role, see the stipend up front, and apply in minutes.',
    url: '/internships',
    images: [{ url: '/og.png', width: 1200, height: 630 }],
  },
};

// A newly published role should show up without a redeploy, but repeat visitors
// and crawlers still get a cached page.
export const revalidate = 300;

type Track = 'campus' | 'content' | 'marketing';

const TRACKS: Track[] = ['campus', 'content', 'marketing'];
const TRACK_LABEL: Record<Track, string> = {
  campus: 'Campus',
  content: 'Content',
  marketing: 'Marketing',
};
const LOCATIONS: LocationType[] = ['wfh', 'onsite', 'hybrid'];

/** Filter links keep the *other* dimension, so the two rows compose. */
function filterHref(track?: Track, location?: LocationType): string {
  const qs = new URLSearchParams();
  if (track) qs.set('track', track);
  if (location) qs.set('location', location);
  const query = qs.toString();
  return query ? `/internships?${query}` : '/internships';
}

function FilterPill({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Box
      component={Link}
      href={href}
      prefetch={false}
      aria-current={active ? 'page' : undefined}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 34,
        px: 1.75,
        borderRadius: 99,
        border: '1px solid',
        fontSize: 14,
        fontWeight: 700,
        lineHeight: 1,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        transition: 'background-color .2s ease, border-color .2s ease, color .2s ease',
        ...(active
          ? { bgcolor: 'primary.main', borderColor: 'primary.main', color: 'common.white' }
          : {
              bgcolor: 'background.paper',
              borderColor: 'divider',
              color: 'text.secondary',
              '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
            }),
      }}
    >
      {label}
    </Box>
  );
}

export default async function InternshipsPage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string; location?: string }>;
}) {
  const [{ track: rawTrack, location: rawLocation }, openings] = await Promise.all([
    searchParams,
    fetchOpenings(),
  ]);

  // Never offer a filter for a value nothing in the data has — an empty result
  // you could have predicted is a bug, not a filter.
  const availableTracks = TRACKS.filter((t) => openings.some((o) => o.track === t));
  const availableLocations = LOCATIONS.filter((l) => openings.some((o) => o.locationType === l));
  const showLocationFilter = availableLocations.length > 1;

  const track = availableTracks.find((t) => t === rawTrack);
  const location = showLocationFilter
    ? availableLocations.find((l) => l === rawLocation)
    : undefined;
  const filtering = Boolean(track || location);

  const matched = openings.filter(
    (o) => (!track || o.track === track) && (!location || o.locationType === location)
  );
  // Open roles first; the API's own ordering survives inside each group.
  const visible = [...matched.filter((o) => o.isOpen), ...matched.filter((o) => !o.isOpen)];

  const openCount = openings.filter((o) => o.isOpen).length;

  return (
    <PublicShell>
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        {/* ------------------------------------------------------- HEADER */}
        <Box sx={{ maxWidth: 720 }}>
          <Typography variant="overline" color="primary.main" sx={{ display: 'block' }}>
            Internships
          </Typography>
          <Typography
            variant="h2"
            component="h1"
            sx={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 600,
              fontSize: { xs: 34, sm: 44, md: 52 },
              lineHeight: 1.1,
              mb: 1.5,
            }}
          >
            Every role we are hiring for
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Work from home, part time, built around a student timetable — each role lists its own
            stipend, duration and what the work actually involves.
          </Typography>
          <Typography variant="subtitle2" color="text.disabled" sx={{ mt: 1.5 }}>
            {openCount} open · {openings.length} total
          </Typography>
        </Box>

        {/* ------------------------------------------------------- FILTERS */}
        {(availableTracks.length > 0 || showLocationFilter) && (
          <Stack spacing={1.25} sx={{ mt: { xs: 3, md: 4 } }}>
            {availableTracks.length > 0 && (
              <Stack
                direction="row"
                spacing={1}
                sx={{ flexWrap: 'wrap', gap: 1 }}
                component="nav"
                aria-label="Filter by track"
              >
                <FilterPill
                  href={filterHref(undefined, location)}
                  label="All"
                  active={!track}
                />
                {availableTracks.map((t) => (
                  <FilterPill
                    key={t}
                    href={filterHref(t, location)}
                    label={TRACK_LABEL[t]}
                    active={track === t}
                  />
                ))}
              </Stack>
            )}

            {showLocationFilter && (
              <Stack
                direction="row"
                spacing={1}
                sx={{ flexWrap: 'wrap', gap: 1 }}
                component="nav"
                aria-label="Filter by location"
              >
                <FilterPill
                  href={filterHref(track, undefined)}
                  label="Anywhere"
                  active={!location}
                />
                {availableLocations.map((l) => (
                  <FilterPill
                    key={l}
                    href={filterHref(track, l)}
                    label={LOCATION_LABEL[l]}
                    active={location === l}
                  />
                ))}
              </Stack>
            )}
          </Stack>
        )}

        {/* --------------------------------------------------------- ROLES */}
        <Box sx={{ mt: { xs: 3, md: 4 } }}>
          {visible.length > 0 ? (
            <>
              {filtering && (
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1.5 }}>
                  Showing {visible.length} of {openings.length} roles
                </Typography>
              )}
              <Grid container spacing={2.5}>
                {visible.map((opening) => (
                  <Grid key={opening.slug} size={{ xs: 12, sm: 6, md: 4 }}>
                    <OpeningCard opening={opening} />
                  </Grid>
                ))}
              </Grid>
            </>
          ) : filtering ? (
            <EmptyState
              art={ART.empty.search}
              title="No roles match this filter"
              description="Nothing is open in that combination right now. Widen the search — the other tracks may still be hiring."
              action={
                <Button component={Link} href="/internships" variant="outlined">
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              art={ART.mascot.sleeping}
              title="No roles open right now"
              description="We open new internships every few weeks. Check back soon — or follow TalkDrill to hear when the next batch goes live."
            />
          )}
        </Box>
      </Container>
    </PublicShell>
  );
}
