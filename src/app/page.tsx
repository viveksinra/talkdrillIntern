'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loading } from '@/components/DataStates';
import { useAuth } from '@/lib/auth/AuthContext';

/** Root — route by auth state: guest → /login, admin → /admin, intern → /tasks. */
export default function Home() {
  const { ready, auth } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!auth) router.replace('/login');
    else if (auth.principal === 'admin') router.replace('/admin');
    else router.replace('/tasks');
  }, [ready, auth, router]);

  return <Loading label="Taking you to the right place…" minHeight="100vh" />;
}
