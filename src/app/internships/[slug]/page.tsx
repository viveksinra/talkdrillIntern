import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PublicShell from '@/components/PublicShell';
import OpeningDetail from '@/components/public/OpeningDetail';
import { fetchOpening, type Opening } from '@/lib/api/openings';

/**
 * Public role detail page — the page every share link, job board and search
 * result lands on, so it is a SERVER component: the whole listing is in the
 * HTML, and Google gets a real JobPosting to index.
 *
 * Revalidates every 5 minutes: a role edited in the admin goes live on its own,
 * but crawlers and repeat visitors still get a cached page.
 */

export const revalidate = 300;

interface PageProps {
  // Next 15: route params are async.
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const opening = await fetchOpening(slug);

  if (!opening) {
    return { title: 'Internship not found — TalkDrill', robots: { index: false, follow: true } };
  }

  const title = opening.seo?.metaTitle || `${opening.title} internship at TalkDrill`;
  const description =
    opening.seo?.metaDescription ||
    (opening.about ? truncate(opening.about, 155) : `Apply for the ${opening.title} internship at TalkDrill.`);

  return {
    title,
    description,
    alternates: { canonical: `/internships/${opening.slug}` },
    openGraph: {
      type: 'article',
      title,
      description,
      url: `/internships/${opening.slug}`,
      images: [{ url: '/og.png', width: 1200, height: 630 }],
    },
  };
}

export default async function OpeningDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const opening = await fetchOpening(slug);
  if (!opening) notFound();

  return (
    <PublicShell>
      <OpeningDetail opening={opening} />
      <script
        type="application/ld+json"
        // JSON.stringify already escapes quotes; `<` is escaped too so no value
        // in the listing can close this tag.
        dangerouslySetInnerHTML={{ __html: jsonLd(opening) }}
      />
    </PublicShell>
  );
}

/* ------------------------------------------------------------------ helpers */

function truncate(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).trimEnd()}…`;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Google wants the full listing text; it accepts (and prefers) HTML here. */
function descriptionHtml(opening: Opening): string {
  const parts: string[] = [];

  if (opening.about) {
    for (const para of opening.about.split(/\n\s*\n/)) {
      const clean = para.trim();
      if (clean) parts.push(`<p>${escapeHtml(clean)}</p>`);
    }
  }

  if (opening.responsibilities?.length) {
    parts.push('<p>Selected candidate&#39;s day-to-day responsibilities include:</p>');
    parts.push(
      `<ol>${opening.responsibilities.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ol>`
    );
  }

  return parts.join('') || escapeHtml(opening.title);
}

/** 'month' | 'week' -> schema.org unitText. 'total' has no unit, so we skip pay. */
const UNIT_TEXT: Record<string, string> = { month: 'MONTH', week: 'WEEK' };

function jsonLd(opening: Opening): string {
  const stipend = opening.stipend;

  // Never invent a number: only a range/fixed stipend with a real amount and a
  // periodic unit becomes baseSalary. Performance-based and unpaid roles carry
  // no baseSalary at all rather than a fabricated one.
  const unitText = UNIT_TEXT[stipend?.period ?? 'month'];
  const payable = Boolean(
    (stipend?.kind === 'range' || stipend?.kind === 'fixed') &&
      unitText &&
      (stipend.min !== undefined || stipend.max !== undefined)
  );

  const baseSalary = payable
    ? {
        '@type': 'MonetaryAmount',
        currency: stipend.currency || 'INR',
        value: {
          '@type': 'QuantitativeValue',
          ...(stipend.min !== undefined ? { minValue: stipend.min } : {}),
          ...(stipend.max !== undefined ? { maxValue: stipend.max } : {}),
          unitText,
        },
      }
    : undefined;

  const types = opening.employmentTypes ?? [];
  const employmentType = ['INTERN'];
  if (types.some((t) => /part/i.test(t))) employmentType.push('PART_TIME');
  if (types.some((t) => /full/i.test(t))) employmentType.push('FULL_TIME');

  const remote = opening.locationType === 'wfh';

  const data = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: opening.title,
    description: descriptionHtml(opening),
    ...(opening.postedAt ? { datePosted: opening.postedAt } : {}),
    ...(opening.applyBy ? { validThrough: opening.applyBy } : {}),
    employmentType,
    hiringOrganization: {
      '@type': 'Organization',
      name: 'TalkDrill',
      sameAs: 'https://www.talkdrill.com',
    },
    ...(remote
      ? {
          jobLocationType: 'TELECOMMUTE',
          applicantLocationRequirements: { '@type': 'Country', name: 'India' },
        }
      : {
          jobLocation: {
            '@type': 'Place',
            address: {
              '@type': 'PostalAddress',
              ...(opening.city ? { addressLocality: opening.city } : {}),
              addressCountry: 'IN',
            },
          },
        }),
    ...(baseSalary ? { baseSalary } : {}),
    ...(opening.openings ? { totalJobOpenings: opening.openings } : {}),
    ...(opening.skills?.length ? { skills: opening.skills.join(', ') } : {}),
    ...(opening.startDate ? { jobStartDate: opening.startDate } : {}),
  };

  return JSON.stringify(data).replace(/</g, '\\u003c');
}
