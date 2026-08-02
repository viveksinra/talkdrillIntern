'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useAuth } from '@/lib/auth/AuthContext';
import type { AdminInternRow } from '@/lib/api/adminInternship';

/**
 * "View as this intern" — drops the admin into the intern portal looking through
 * someone else's profile.
 *
 * No credential changes hands: enterViewAs only records WHO to look at, and
 * client.ts turns that into an `X-View-As-Intern` header on the admin's own
 * token. The backend is what decides whether to honour it (team members only,
 * feature-flagged, GET-only unless the target is a sandbox persona).
 */
export default function ViewAsButton({
  intern,
  size = 'small',
  variant = 'outlined',
  fullWidth = false,
}: {
  intern: Pick<AdminInternRow, '_id' | 'email' | 'fullName' | 'status'> & { isSandbox?: boolean };
  size?: 'small' | 'medium' | 'large';
  variant?: 'text' | 'outlined' | 'contained';
  fullWidth?: boolean;
}) {
  const { enterViewAs } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // An intern who never logged in has nothing to look at yet, and a removed one
  // only shows the removal wall — still useful, so only 'invited' is blocked.
  const notYetJoined = intern.status === 'invited';

  const go = () => {
    setBusy(true);
    enterViewAs({
      internProfileId: intern._id,
      label: intern.fullName || intern.email,
      isSandbox: intern.isSandbox === true,
    });
    // Straight to the first screen an intern lands on.
    router.push('/tasks');
  };

  const button = (
    <span style={fullWidth ? { display: 'block' } : undefined}>
      <Button
        size={size}
        variant={variant}
        fullWidth={fullWidth}
        disabled={busy || notYetJoined}
        startIcon={<VisibilityIcon />}
        onClick={go}
      >
        {intern.isSandbox ? 'Enter sandbox' : 'View as'}
      </Button>
    </span>
  );

  if (notYetJoined) {
    return (
      <Tooltip title="This intern has not accepted their invite yet, so there is nothing to see.">
        {button}
      </Tooltip>
    );
  }

  return (
    <Tooltip
      title={
        intern.isSandbox
          ? 'Walk the full intern flow on a throwaway account — safe to submit and redeem.'
          : 'See the portal exactly as they see it. Read-only: nothing can be changed on their behalf.'
      }
    >
      {button}
    </Tooltip>
  );
}
