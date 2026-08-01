'use client';

import { useRouter } from 'next/navigation';
import React, { useEffect } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuth } from './AuthContext';

function CenteredSpinner() {
  return (
    <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <CircularProgress />
    </Box>
  );
}

/** Route guard: any logged-in principal (intern or admin). */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { ready, auth } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !auth) router.replace('/login');
  }, [ready, auth, router]);

  if (!ready || !auth) return <CenteredSpinner />;
  return <>{children}</>;
}

/** Route guard: admin (team member) only. Interns get bounced to their portal. */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { ready, auth } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!auth) router.replace('/login');
    else if (auth.principal !== 'admin') router.replace('/tasks');
  }, [ready, auth, router]);

  if (!ready || !auth || auth.principal !== 'admin') return <CenteredSpinner />;
  return <>{children}</>;
}
