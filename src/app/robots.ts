import type { MetadataRoute } from 'next';

/**
 * The landing page and the openings are the only things worth crawling. Every
 * signed-in surface is disallowed — not as a security control (auth does that)
 * but so half-rendered shells and login redirects never land in the index.
 */
const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://intern.talkdrill.com';

const PRIVATE_PATHS = [
  '/admin',
  '/tasks',
  '/points',
  '/rewards',
  '/eligibility',
  '/videos',
  '/leaderboard',
  '/onboarding',
  '/applications',
  '/apply',
  '/dev',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Bare prefixes on purpose: `Disallow: /tasks` covers both /tasks and
      // /tasks/*, whereas a trailing slash would leave the index page crawlable.
      disallow: PRIVATE_PATHS,
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
