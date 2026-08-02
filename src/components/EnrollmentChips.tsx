'use client';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Label from '@/components/Label';
import type { InternEnrollment, InternStatus } from '@/lib/api/types';

const STATUS_COLOR: Record<InternStatus, 'success' | 'warning' | 'info' | 'default' | 'error'> = {
  invited: 'info',
  active: 'success',
  paused: 'warning',
  completed: 'default',
  removed: 'error',
};

/** "Campus Ambassador · Batch 2" — role first, because that is how people say it. */
function labelFor(e: InternEnrollment): string {
  const role = e.openingTitle?.trim();
  const batch = e.batchNumber ? `Batch ${e.batchNumber}` : null;
  if (role && batch) return `${role} · ${batch}`;
  if (role) return role;
  // Programme names already read "Role — Batch N" when they came from a batch.
  return e.programName?.trim() || 'Internship';
}

/**
 * Which internships a student is on, and which batch of each.
 *
 * One chip per enrollment rather than a single field, because holding several at
 * once is normal — someone can have finished a Campus batch and be active in a
 * Content one, and collapsing that to a single track/status (which is what the
 * profile alone can express) loses the half that is still running.
 */
export default function EnrollmentChips({
  enrollments,
  emptyText = 'Not on a batch yet',
}: {
  enrollments?: InternEnrollment[] | null;
  emptyText?: string;
}) {
  if (!enrollments?.length) {
    return (
      <Typography variant="caption" color="text.secondary">
        {emptyText}
      </Typography>
    );
  }

  return (
    <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
      {enrollments.map((e) => (
        <Label key={e._id} color={STATUS_COLOR[e.status] ?? 'default'} variant="soft">
          {labelFor(e)}
        </Label>
      ))}
    </Stack>
  );
}
