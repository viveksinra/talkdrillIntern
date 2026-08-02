'use client';

import Alert from '@mui/material/Alert';
import { useReadOnly } from '@/lib/auth/AuthContext';

/**
 * Shown on the intern screens while a team member is viewing as a REAL intern.
 *
 * The backend already rejects every non-GET in this mode (see
 * internController.attachInternProfile), so this is purely so the admin knows
 * why the buttons are dead instead of discovering it by hitting a 403. Renders
 * nothing in a normal intern session or in a sandbox persona, where writes are
 * genuinely allowed.
 */
export default function ReadOnlyNotice({ action = 'Actions' }: { action?: string }) {
  const readOnly = useReadOnly();
  if (!readOnly) return null;

  return (
    <Alert severity="info" variant="outlined" sx={{ mb: 2.5 }}>
      {action} are disabled while you view as another intern — this is their
      account, so nothing here can be changed on their behalf. Use a sandbox
      persona to try the flow for real.
    </Alert>
  );
}
