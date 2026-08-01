import type { Metadata, Viewport } from 'next';
import { Fraunces, Roboto } from 'next/font/google';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from '@/theme';
import { AuthProvider } from '@/lib/auth/AuthContext';

// Roboto is TalkDrill's primary face (theme-config.js). Self-hosted through
// next/font so the portal renders its own type without a third-party request.
const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  display: 'swap',
  variable: '--font-body',
});

// Fraunces is the display face for hero numerals and headline moments — the
// website loads it the same way on /books and /about-us (--font-book-display).
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['600', '700'],
  style: ['normal'],
  display: 'swap',
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: 'TalkDrill Internships',
  description: 'TalkDrill internship portal — tasks, points, and rewards.',
  icons: { icon: '/favicon.ico', apple: '/apple-touch-icon.png' },
  openGraph: {
    title: 'TalkDrill Internships',
    description: 'Do the work. Earn the rewards.',
    images: [{ url: '/og.png', width: 1200, height: 630 }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#4C3FE2',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${roboto.variable} ${fraunces.variable}`}>
      <body>
        <AppRouterCacheProvider>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <AuthProvider>{children}</AuthProvider>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
