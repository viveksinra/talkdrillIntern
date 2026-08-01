import type { MetadataRoute } from 'next';
import { fetchOpeningSlugs } from '@/lib/api/openings';

/**
 * Only the public surface belongs here — the portal itself (tasks, points,
 * admin) is behind auth and is disallowed in robots.ts.
 *
 * fetchOpeningSlugs() already swallows its own failures and returns [], so a
 * backend outage degrades to the two static entries instead of a 500 that
 * would make Search Console drop the whole sitemap.
 */
const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://intern.talkdrill.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await fetchOpeningSlugs();
  const now = new Date();

  return [
    {
      url: BASE,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${BASE}/internships`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    ...slugs.map(({ slug, updatedAt }) => ({
      url: `${BASE}/internships/${slug}`,
      // A malformed updatedAt would serialise as "Invalid Date" and poison the
      // whole file, so fall back to now.
      lastModified: Number.isNaN(new Date(updatedAt).getTime()) ? now : new Date(updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
