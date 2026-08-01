'use client';

import Link from 'next/link';
import React from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { useAuth } from '@/lib/auth/AuthContext';

/**
 * Chrome for the PUBLIC hiring pages (landing, listings, listing detail).
 *
 * Deliberately not AppShell: that is portal furniture (task tabs, bottom nav)
 * and means nothing to a visitor who has not applied yet. This is a client
 * component only so the header can react to auth — the pages it wraps stay
 * server components, which is the whole point of these routes being indexable.
 */

const NAV = [
  { label: 'Internships', href: '/internships' },
  { label: 'How it works', href: '/#how-it-works' },
];

export default function PublicShell({ children }: { children: React.ReactNode }) {
  const { ready, auth } = useAuth();

  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
      <AppBar
        position="sticky"
        elevation={0}
        color="transparent"
        sx={{
          bgcolor: 'rgba(255,255,255,0.86)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Container maxWidth="lg" disableGutters>
          <Toolbar sx={{ gap: 2 }}>
            <Box
              component={Link}
              href="/"
              sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, textDecoration: 'none' }}
            >
              <Box
                component="img"
                src="/logo/logo-full.svg"
                alt="TalkDrill"
                width={126}
                height={30}
                sx={{ height: 30, width: 126 }}
              />
            </Box>

            <Stack
              direction="row"
              spacing={0.5}
              sx={{ ml: 1, display: { xs: 'none', md: 'flex' }, flexGrow: 1 }}
            >
              {NAV.map((item) => (
                <Button
                  key={item.href}
                  component={Link}
                  href={item.href}
                  color="inherit"
                  sx={{ color: 'text.secondary', fontWeight: 600 }}
                >
                  {item.label}
                </Button>
              ))}
            </Stack>
            <Box sx={{ flexGrow: { xs: 1, md: 0 } }} />

            {/* Auth-aware: never flash the wrong CTA before the token is read. */}
            {ready && (
              auth ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button
                    component={Link}
                    href="/applications"
                    color="inherit"
                    sx={{ color: 'text.secondary', fontWeight: 600, display: { xs: 'none', sm: 'inline-flex' } }}
                  >
                    My applications
                  </Button>
                  <Button
                    component={Link}
                    href={auth.principal === 'admin' ? '/admin' : '/tasks'}
                    variant="contained"
                  >
                    {auth.principal === 'admin' ? 'Admin' : 'My portal'}
                  </Button>
                </Stack>
              ) : (
                <Stack direction="row" spacing={1}>
                  <Button component={Link} href="/login" color="inherit" sx={{ fontWeight: 600 }}>
                    Sign in
                  </Button>
                  <Button component={Link} href="/internships" variant="contained">
                    Browse roles
                  </Button>
                </Stack>
              )
            )}
          </Toolbar>
        </Container>
      </AppBar>

      <Box component="main" sx={{ flexGrow: 1 }}>
        {children}
      </Box>

      <Box component="footer" sx={{ bgcolor: 'grey.100', mt: 8 }}>
        <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            spacing={3}
          >
            <Box sx={{ maxWidth: 340 }}>
              <Box
                component="img"
                src="/logo/logo-full.svg"
                alt="TalkDrill"
                width={118}
                height={28}
                sx={{ height: 28, width: 118, mb: 1.5 }}
              />
              <Typography variant="body2" color="text.secondary">
                TalkDrill is your speaking practice partner, available 24/7 — for interviews,
                public speaking and everyday fluency.
              </Typography>
            </Box>

            <Stack direction="row" spacing={{ xs: 4, sm: 6 }}>
              <Stack spacing={1}>
                <Typography variant="overline" color="text.disabled">
                  Internships
                </Typography>
                <Link href="/internships" style={{ textDecoration: 'none' }}>
                  <Typography variant="body2" color="text.secondary">All roles</Typography>
                </Link>
                <Link href="/applications" style={{ textDecoration: 'none' }}>
                  <Typography variant="body2" color="text.secondary">My applications</Typography>
                </Link>
              </Stack>
              <Stack spacing={1}>
                <Typography variant="overline" color="text.disabled">
                  TalkDrill
                </Typography>
                <a href="https://www.talkdrill.com" style={{ textDecoration: 'none' }}>
                  <Typography variant="body2" color="text.secondary">Main site</Typography>
                </a>
                <a href="mailto:support@talkdrill.com" style={{ textDecoration: 'none' }}>
                  <Typography variant="body2" color="text.secondary">Contact us</Typography>
                </a>
              </Stack>
            </Stack>
          </Stack>

          <Divider sx={{ my: 3, borderColor: alpha('#919EAB', 0.2) }} />
          <Typography variant="caption" color="text.disabled">
            © {new Date().getFullYear()} TalkDrill. Kolkata, India.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
