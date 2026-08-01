'use client';

import React from 'react';
import Chip, { type ChipProps } from '@mui/material/Chip';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import type {
  AssignedTaskStatus,
  EligibilityState,
  InternStatus,
  RedemptionStatus,
  SubmissionStatus,
  VideoSubmissionStatus,
} from '@/lib/api/types';

/**
 * Single source of truth for how a status renders. Every status string in the
 * system is spelled snake_case on the wire; nothing in the UI may print one raw,
 * so all of them get a human label + a colour here.
 */
export type AnyStatus =
  | AssignedTaskStatus
  | SubmissionStatus
  | RedemptionStatus
  | EligibilityState
  | VideoSubmissionStatus
  | InternStatus;

type Tone = ChipProps['color'];

interface StatusMeta {
  label: string;
  color: Tone;
  icon: React.ReactElement;
  /** Longer explanation for tooltips / helper text. */
  hint?: string;
}

const PENDING_ICON = <HourglassTopIcon />;
const DONE_ICON = <CheckCircleIcon />;
const FAIL_ICON = <CancelIcon />;
const TODO_ICON = <RadioButtonUncheckedIcon />;

/**
 * Values are unique across the unions except where the meaning is genuinely the
 * same word (approved / rejected on tasks, submissions and redemptions), so one
 * flat map is safe and keeps the vocabulary consistent for interns.
 */
const META: Record<AnyStatus, StatusMeta> = {
  // assigned task
  assigned: { label: 'To do', color: 'default', icon: TODO_ICON, hint: 'Not submitted yet' },
  submitted: {
    label: 'In review',
    color: 'info',
    icon: PENDING_ICON,
    hint: 'Waiting for the TalkDrill team to check your proof',
  },

  // submission
  pending: { label: 'Pending review', color: 'warning', icon: PENDING_ICON },
  approved: { label: 'Approved', color: 'success', icon: DONE_ICON },
  rejected: { label: 'Rejected', color: 'error', icon: FAIL_ICON },

  // redemption
  requested: { label: 'Requested', color: 'warning', icon: PENDING_ICON },
  fulfilled: {
    label: 'Fulfilled',
    color: 'success',
    icon: DONE_ICON,
    hint: 'Sent — check the fulfilment note for the reference',
  },

  // eligibility
  not_yet_eligible: {
    label: 'In progress',
    color: 'default',
    icon: TODO_ICON,
    hint: 'Keep going — the period is still open',
  },
  eligible: {
    label: 'Eligible',
    color: 'info',
    icon: DONE_ICON,
    hint: 'All conditions met — awaiting the team',
  },
  earned: { label: 'Earned', color: 'success', icon: <EmojiEventsIcon /> },
  forfeited: {
    label: 'Missed',
    color: 'error',
    icon: FAIL_ICON,
    hint: 'The period closed before the conditions were met',
  },

  // video submission
  pending_evaluation: {
    label: '30-day window open',
    color: 'default',
    icon: <ScheduleIcon />,
    hint: 'Views and likes are counted 30 days after posting',
  },
  due_for_evaluation: {
    label: 'Ready to evaluate',
    color: 'warning',
    icon: PENDING_ICON,
    hint: '30 days have passed — metrics can be recorded',
  },
  evaluated: { label: 'Evaluated', color: 'success', icon: DONE_ICON },

  // intern profile
  invited: { label: 'Invited', color: 'default', icon: TODO_ICON },
  active: { label: 'Active', color: 'success', icon: DONE_ICON },
  paused: { label: 'Paused', color: 'warning', icon: <PauseCircleOutlineIcon /> },
  completed: { label: 'Completed', color: 'info', icon: DONE_ICON },
  removed: { label: 'Removed', color: 'default', icon: FAIL_ICON },
};

/** Title-cases an unknown status so a backend addition never leaks snake_case. */
function fallbackLabel(status: string): string {
  return status.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function statusMeta(status: AnyStatus | string): StatusMeta {
  return (
    META[status as AnyStatus] ?? {
      label: fallbackLabel(status),
      color: 'default' as Tone,
      icon: TODO_ICON,
    }
  );
}

/** Human label for a status — use this anywhere a chip is too heavy. */
export function statusLabel(status: AnyStatus | string): string {
  return statusMeta(status).label;
}

export interface StatusChipProps extends Omit<ChipProps, 'color' | 'label' | 'icon'> {
  status: AnyStatus | string;
  /** Override the mapped label (rare — e.g. "Approved · 50 pts"). */
  label?: string;
  withIcon?: boolean;
}

export default function StatusChip({
  status,
  label,
  withIcon = false,
  size = 'small',
  variant,
  sx,
  ...rest
}: StatusChipProps) {
  const meta = statusMeta(status);
  return (
    <Chip
      size={size}
      color={meta.color}
      variant={variant ?? (meta.color === 'default' ? 'outlined' : 'filled')}
      label={label ?? meta.label}
      icon={withIcon ? meta.icon : undefined}
      sx={{ fontWeight: 600, ...sx }}
      {...rest}
    />
  );
}

export { StatusChip };
