'use client';

import React, { useCallback, useState } from 'react';
import Alert from '@mui/material/Alert';
import type { AlertColor } from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Snackbar from '@mui/material/Snackbar';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import GroupIcon from '@mui/icons-material/Group';
import InsightsIcon from '@mui/icons-material/Insights';
import LocalAtmIcon from '@mui/icons-material/LocalAtm';
import RuleIcon from '@mui/icons-material/Rule';
import SchoolIcon from '@mui/icons-material/School';
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboard';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import { RequireAdmin } from '@/lib/auth/guards';

/**
 * Frame every admin page shares: admin gate, app shell and page title. Pages
 * render only their own body.
 */

/**
 * Deep-link targets for the dashboard's "Manage" grid. AppShell's ADMIN_NAV is the
 * primary navigation; this list is broader (it includes Points) and is the one
 * place the real route of each admin screen is spelled out.
 */
export interface AdminSection {
  href: string;
  label: string;
  icon: React.ReactElement;
  desc: string;
}

export const ADMIN_SECTIONS: AdminSection[] = [
  {
    href: '/admin',
    label: 'Dashboard',
    icon: <SpaceDashboardIcon />,
    desc: 'Programme health at a glance',
  },
  {
    href: '/admin/verify',
    label: 'Verify',
    icon: <FactCheckIcon />,
    desc: 'Approve or reject proof submissions',
  },
  {
    href: '/admin/tasks',
    label: 'Tasks',
    icon: <AssignmentTurnedInIcon />,
    desc: 'Task templates and bulk assignment',
  },
  {
    href: '/admin/programs',
    label: 'Programs',
    icon: <SchoolIcon />,
    desc: 'Batches, enrolment and video tiers',
  },
  { href: '/admin/interns', label: 'Interns', icon: <GroupIcon />, desc: 'Search and manage interns' },
  {
    href: '/admin/rewards',
    label: 'Rewards',
    icon: <CardGiftcardIcon />,
    desc: 'Reward catalog and unlock rules',
  },
  {
    href: '/admin/redemptions',
    label: 'Redemptions',
    icon: <LocalAtmIcon />,
    desc: 'Approve, reject and fulfil payouts',
  },
  {
    href: '/admin/rules',
    label: 'Eligibility',
    icon: <RuleIcon />,
    desc: 'Stipend rules and the eligibility board',
  },
  {
    href: '/admin/videos',
    label: 'Videos',
    icon: <VideoLibraryIcon />,
    desc: '30-day views and likes evaluation',
  },
  {
    href: '/admin/points',
    label: 'Points',
    icon: <InsightsIcon />,
    desc: 'Manual adjustments and ledger feed',
  },
];

export interface AdminScreenProps {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  meta?: React.ReactNode;
  back?: boolean | string;
  /** Which AppShell nav tab to highlight when the route cannot be inferred. */
  navKey?: string;
  children: React.ReactNode;
}

export default function AdminScreen({
  title,
  subtitle,
  action,
  meta,
  back,
  navKey,
  children,
}: AdminScreenProps) {
  return (
    <RequireAdmin>
      {/* AppShell owns the admin section nav (tabs + drawer); pages add only their header. */}
      <AppShell navKey={navKey}>
        <PageHeader title={title} subtitle={subtitle} action={action} meta={meta} back={back} />
        {children}
      </AppShell>
    </RequireAdmin>
  );
}

// ── toast ────────────────────────────────────────────────────────────────

export interface Snack {
  show: (text: string, severity?: AlertColor) => void;
  snackbar: React.ReactElement;
}

/** One toast host per page. `show()` is stable, so it is safe in callbacks. */
export function useSnack(): Snack {
  const [msg, setMsg] = useState<{ text: string; severity: AlertColor } | null>(null);

  const show = useCallback((text: string, severity: AlertColor = 'success') => {
    setMsg({ text, severity });
  }, []);

  const snackbar = (
    <Snackbar
      open={!!msg}
      autoHideDuration={msg?.severity === 'error' ? 8000 : 4000}
      onClose={() => setMsg(null)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        severity={msg?.severity ?? 'success'}
        variant="filled"
        onClose={() => setMsg(null)}
        sx={{ width: '100%' }}
      >
        {msg?.text ?? ''}
      </Alert>
    </Snackbar>
  );

  return { show, snackbar };
}

// ── small layout atoms ───────────────────────────────────────────────────

/** Wraps a wide table so the page body never scrolls sideways. */
export function ScrollArea({ children }: { children: React.ReactNode }) {
  return <Box sx={{ overflowX: 'auto', width: '100%' }}>{children}</Box>;
}
