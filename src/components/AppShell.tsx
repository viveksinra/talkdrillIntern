'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import CampaignIcon from '@mui/icons-material/Campaign';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import GroupIcon from '@mui/icons-material/Group';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import RuleIcon from '@mui/icons-material/Rule';
import SchoolIcon from '@mui/icons-material/School';
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboard';
import StarsIcon from '@mui/icons-material/Stars';
import VideocamIcon from '@mui/icons-material/Videocam';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import { useAuth } from '@/lib/auth/AuthContext';
import { getLeaderboard, getMe } from '@/lib/api/internship';
import type { Track } from '@/lib/api/types';

/**
 * Shared page shell: top bar with identity + sign out, role-aware navigation and a
 * mobile-first content container.
 *
 * Interns are on phones, so their nav is a fixed bottom bar on xs and a tab row from
 * sm up. Admin sections outnumber a tab row on a phone, so they get scrollable tabs
 * plus a drawer. Navigation is derived from auth.principal — an intern can never see
 * an admin link.
 */

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: React.ReactElement;
  /** Only shown to interns on this track. */
  track?: Track;
  /** Only shown when the intern's batch has leaderboards switched on. */
  needsLeaderboard?: boolean;
}

export const INTERN_NAV: NavItem[] = [
  { key: 'tasks', label: 'Tasks', href: '/tasks', icon: <AssignmentTurnedInIcon /> },
  { key: 'points', label: 'Points', href: '/points', icon: <StarsIcon /> },
  { key: 'rewards', label: 'Rewards', href: '/rewards', icon: <CardGiftcardIcon /> },
  { key: 'eligibility', label: 'Stipend', href: '/eligibility', icon: <WorkspacePremiumIcon /> },
  { key: 'videos', label: 'Videos', href: '/videos', icon: <VideocamIcon />, track: 'content' },
  // Six entries is the xs bottom-bar ceiling, so this one only appears for a batch
  // that actually runs a board (and Videos only for the content track).
  {
    key: 'leaderboard',
    label: 'Board',
    href: '/leaderboard',
    icon: <LeaderboardIcon />,
    needsLeaderboard: true,
  },
];

export const ADMIN_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/admin', icon: <SpaceDashboardIcon /> },
  { key: 'verify', label: 'Verify', href: '/admin/verify', icon: <FactCheckIcon /> },
  { key: 'openings', label: 'Openings', href: '/admin/openings', icon: <CampaignIcon /> },
  { key: 'applications', label: 'Applicants', href: '/admin/applications', icon: <HowToRegIcon /> },
  { key: 'interns', label: 'Interns', href: '/admin/interns', icon: <GroupIcon /> },
  { key: 'tasks', label: 'Tasks', href: '/admin/tasks', icon: <AssignmentTurnedInIcon /> },
  { key: 'programs', label: 'Programs', href: '/admin/programs', icon: <SchoolIcon /> },
  { key: 'videos', label: 'Videos', href: '/admin/videos', icon: <VideocamIcon /> },
  { key: 'rewards', label: 'Rewards', href: '/admin/rewards', icon: <CardGiftcardIcon /> },
  { key: 'redemptions', label: 'Payouts', href: '/admin/redemptions', icon: <LocalShippingIcon /> },
  { key: 'eligibility', label: 'Eligibility', href: '/admin/eligibility', icon: <RuleIcon /> },
];

/**
 * The intern's track decides whether Videos exists in the nav. Cached per tab so
 * every navigation does not re-hit /internship/me; cleared on sign-out so a second
 * intern on the same device never inherits the first one's nav.
 */
let trackPromise: Promise<Track | null> | null = null;
let leaderboardPromise: Promise<boolean> | null = null;

/**
 * Last-known nav gating, persisted so the returning intern's nav renders in
 * its final shape on first paint instead of popping tabs in after the fetch
 * resolves under their thumb. Corrected silently if the fetch disagrees.
 */
const NAV_SNAPSHOT_KEY = 'td_internship_nav';

function readNavSnapshot(): { track: Track | null; board: boolean } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(NAV_SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeNavSnapshot(snapshot: { track: Track | null; board: boolean }): void {
  try {
    localStorage.setItem(NAV_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    /* non-critical */
  }
}

function loadTrack(): Promise<Track | null> {
  if (!trackPromise) {
    trackPromise = getMe()
      .then((me) => me.internProfile?.track ?? null)
      .catch(() => null);
  }
  return trackPromise;
}

/** Cached alongside the track — a failure hides the tab rather than guessing. */
function loadLeaderboardEnabled(): Promise<boolean> {
  if (!leaderboardPromise) {
    leaderboardPromise = getLeaderboard()
      .then((board) => board.enabled)
      .catch(() => false);
  }
  return leaderboardPromise;
}

/** Longest-prefix match, so /tasks/abc still highlights Tasks. */
function activeKeyFor(items: NavItem[], pathname: string | null): string | false {
  if (!pathname) return false;
  let best: NavItem | null = null;
  for (const item of items) {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (matches && (!best || item.href.length > best.href.length)) best = item;
  }
  return best ? best.key : false;
}

export interface AppShellProps {
  children: React.ReactNode;
  /** Let a page declare its own active nav key when the route cannot be inferred. */
  navKey?: string;
  /** Pass the intern's track if the page already fetched it — saves the shell a call. */
  track?: Track | null;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | false;
  /** Hide navigation entirely (onboarding / single-purpose screens). */
  hideNav?: boolean;
}

export default function AppShell({
  children,
  navKey,
  track,
  maxWidth,
  hideNav = false,
}: AppShellProps) {
  const { auth, logout, viewAs, exitViewAs } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Seed from the persisted snapshot so returning users never see tabs pop in.
  const [fetchedTrack, setFetchedTrack] = useState<Track | null>(
    () => readNavSnapshot()?.track ?? null
  );
  const [boardEnabled, setBoardEnabled] = useState(() => readNavSnapshot()?.board ?? false);

  // While viewing as an intern, a team member must get the INTERN shell — nav,
  // bottom bar, track filtering and all. Deriving it here means every downstream
  // `isAdmin` check flips at once instead of each screen special-casing it.
  const isAdmin = auth?.principal === 'admin' && !viewAs;
  const isIntern = !!auth && !isAdmin;

  useEffect(() => {
    if (!isIntern || hideNav) return;
    let alive = true;
    Promise.all([track === undefined ? loadTrack() : Promise.resolve(track), loadLeaderboardEnabled()]).then(
      ([t, enabled]) => {
        if (!alive) return;
        setFetchedTrack(t);
        setBoardEnabled(enabled);
        writeNavSnapshot({ track: t, board: enabled });
      }
    );
    return () => {
      alive = false;
    };
  }, [isIntern, hideNav, track]);

  const handleExitViewAs = () => {
    // Reset the memoised track/leaderboard fetches too — they were resolved for
    // the intern being viewed and would otherwise carry into the next session.
    trackPromise = null;
    leaderboardPromise = null;
    exitViewAs();
    router.replace('/admin/interns');
  };

  const handleLogout = () => {
    trackPromise = null;
    leaderboardPromise = null;
    try {
      localStorage.removeItem(NAV_SNAPSHOT_KEY);
    } catch {
      /* non-critical */
    }
    logout();
    router.replace('/login');
  };

  const effectiveTrack = track !== undefined ? track : fetchedTrack;
  const items = !auth || hideNav
    ? []
    : isAdmin
      ? ADMIN_NAV
      : INTERN_NAV.filter(
          (item) =>
            (!item.track || item.track === effectiveTrack) &&
            (!item.needsLeaderboard || boardEnabled)
        );

  const activeKey = items.length
    ? navKey && items.some((i) => i.key === navKey)
      ? navKey
      : activeKeyFor(items, pathname)
    : false;

  const showBottomNav = isIntern && items.length > 0;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" elevation={0}>
        {/* Mode strip. Deliberately a flat one-line chrome bar INSIDE the AppBar
            (so it stays put while scrolling) — not a gradient hero with blur
            circles, which is the look this project has ruled out for logged-in
            surfaces. It has to be impossible to forget you are in this mode. */}
        {viewAs && (
          <Box
            role="status"
            sx={{
              bgcolor: viewAs.isSandbox ? 'info.dark' : 'warning.dark',
              px: { xs: 1.5, sm: 3 },
              py: 0.5,
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" noWrap sx={{ fontWeight: 700, flexGrow: 1, minWidth: 0 }}>
                {viewAs.isSandbox
                  ? `Sandbox — ${viewAs.label}. Changes here affect nobody.`
                  : `Viewing as ${viewAs.label} — read-only`}
              </Typography>
              <Button
                size="small"
                onClick={handleExitViewAs}
                sx={{ color: 'inherit', fontWeight: 700, minHeight: 28, py: 0, flexShrink: 0 }}
              >
                Exit
              </Button>
            </Stack>
          </Box>
        )}
        <Toolbar>
          {isAdmin && items.length > 0 && (
            <IconButton
              color="inherit"
              edge="start"
              aria-label="Open sections"
              onClick={() => setDrawerOpen(true)}
              sx={{ mr: 1, display: { xs: 'inline-flex', md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Stack
            direction="row"
            spacing={1.25}
            alignItems="center"
            component={Link}
            href={isAdmin ? '/admin' : '/tasks'}
            sx={{ flexGrow: 1, color: 'inherit', textDecoration: 'none', minWidth: 0 }}
          >
            <Box
              component="img"
              src="/logo/Talk Drill-White-PNG.png"
              alt="TalkDrill"
              width={118}
              height={26}
              sx={{ height: 26, width: 118, aspectRatio: '1000 / 220', flexShrink: 0 }}
            />
            <Typography
              variant="subtitle2"
              noWrap
              sx={{
                color: alpha('#FFFFFF', 0.72),
                borderLeft: '1px solid',
                borderColor: alpha('#FFFFFF', 0.24),
                pl: 1.25,
                display: { xs: 'none', sm: 'block' },
              }}
            >
              {isAdmin ? 'Internship admin' : 'Internships'}
            </Typography>
          </Stack>
          {auth && (
            <>
              <Tooltip title={auth.user.email || auth.user.name || ''}>
                <Avatar
                  src={auth.user.profileImage}
                  sx={{
                    width: 32,
                    height: 32,
                    mr: 1,
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'common.white',
                    bgcolor: alpha('#FFFFFF', 0.2),
                    border: '1px solid',
                    borderColor: alpha('#FFFFFF', 0.3),
                  }}
                >
                  {(auth.user.name || auth.user.email || '?').charAt(0).toUpperCase()}
                </Avatar>
              </Tooltip>
              <Button
                color="inherit"
                size="small"
                endIcon={<LogoutIcon />}
                onClick={handleLogout}
                sx={{ minWidth: 0 }}
              >
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  Sign out
                </Box>
              </Button>
            </>
          )}
        </Toolbar>

        {items.length > 0 && (
          <Box
            sx={{
              bgcolor: 'background.paper',
              borderBottom: 1,
              borderColor: 'divider',
              // Interns get the bottom bar on xs; the tab row is sm-and-up only.
              display: isAdmin ? 'block' : { xs: 'none', sm: 'block' },
            }}
          >
            <Container maxWidth={maxWidth ?? (isAdmin ? 'lg' : 'md')} disableGutters>
              <Tabs
                value={activeKey}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                textColor="primary"
                indicatorColor="primary"
              >
                {items.map((item) => (
                  <Tab
                    key={item.key}
                    value={item.key}
                    label={item.label}
                    icon={item.icon}
                    iconPosition="start"
                    component={Link}
                    href={item.href}
                    sx={{ minHeight: 48, px: 2 }}
                  />
                ))}
              </Tabs>
            </Container>
          </Box>
        )}
      </AppBar>

      <Container
        maxWidth={maxWidth ?? (isAdmin ? 'lg' : 'md')}
        sx={{
          py: { xs: 2, sm: 3 },
          // Clear the fixed bottom bar (and the iOS home indicator) on phones.
          pb: showBottomNav
            ? { xs: 'calc(80px + env(safe-area-inset-bottom))', sm: 3 }
            : { xs: 2, sm: 3 },
        }}
      >
        {children}
      </Container>

      {showBottomNav && (
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: (theme) => theme.zIndex.appBar,
            display: { xs: 'block', sm: 'none' },
            borderRadius: 0,
            pb: 'env(safe-area-inset-bottom)',
          }}
        >
          {/* Five thumb targets max on a phone: when both Videos and Board are on,
              Board is reachable from the Points screen instead. */}
          <BottomNavigation value={activeKey} showLabels sx={{ height: 60 }}>
            {(items.length > 5 ? items.filter((i) => i.key !== 'leaderboard') : items).map((item) => (
              <BottomNavigationAction
                key={item.key}
                value={item.key}
                label={item.label}
                icon={item.icon}
                component={Link}
                href={item.href}
                sx={{ minWidth: 0, px: 0.5 }}
              />
            ))}
          </BottomNavigation>
        </Paper>
      )}

      {isAdmin && (
        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
          <Box sx={{ width: 260 }} role="presentation" onClick={() => setDrawerOpen(false)}>
            <Box sx={{ px: 2, py: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Internship Admin
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {auth?.user.email}
              </Typography>
            </Box>
            <Divider />
            {ADMIN_NAV.map((item) => (
              <ListItemButton
                key={item.key}
                component={Link}
                href={item.href}
                selected={activeKey === item.key}
                sx={{ minHeight: 48 }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </Box>
        </Drawer>
      )}
    </Box>
  );
}
