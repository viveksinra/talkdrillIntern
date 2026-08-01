'use client';

import React from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import RefreshIcon from '@mui/icons-material/Refresh';
import { ApiError } from '@/lib/api/client';
import EmptyState from './EmptyState';

/**
 * The three states every data-driven page has. Importing these instead of
 * hand-rolling a <CircularProgress> keeps loading/error UX identical everywhere
 * and means one place to change when we add skeletons to a new surface.
 */

/** Turns anything a catch block can receive into a sentence worth showing a user. */
export function errorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (error instanceof ApiError || error instanceof Error) return error.message || fallback;
  return fallback;
}

export interface LoadingProps {
  label?: string;
  /** Vertical space reserved so the page does not jump when content lands. */
  minHeight?: number | string;
  /** Render N card-shaped skeletons instead of a spinner (list pages). */
  skeletonRows?: number;
}

export function Loading({ label, minHeight = 240, skeletonRows }: LoadingProps) {
  if (skeletonRows && skeletonRows > 0) {
    return (
      <Stack spacing={1.5} aria-busy="true" aria-live="polite">
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={96} />
        ))}
      </Stack>
    );
  }
  return (
    <Stack
      spacing={1.5}
      alignItems="center"
      justifyContent="center"
      sx={{ minHeight }}
      aria-busy="true"
      aria-live="polite"
    >
      <CircularProgress />
      {label && (
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      )}
    </Stack>
  );
}

/** Inline spinner for buttons/rows where a full block would be overkill. */
export function InlineLoading({ label }: { label?: string }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 1 }}>
      <CircularProgress size={18} />
      <Typography variant="body2" color="text.secondary">
        {label ?? 'Loading…'}
      </Typography>
    </Stack>
  );
}

export interface ErrorStateProps {
  error: unknown;
  title?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({ error, title, onRetry, retryLabel = 'Try again' }: ErrorStateProps) {
  const status = error instanceof ApiError ? error.status : undefined;
  // A 403 is a permissions answer, not a crash — say so instead of shouting.
  const severity = status === 403 || status === 404 ? 'warning' : 'error';
  return (
    <Alert
      severity={severity}
      action={
        onRetry ? (
          <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : undefined
      }
      sx={{ alignItems: 'center' }}
    >
      {title && <AlertTitle sx={{ mb: 0.25 }}>{title}</AlertTitle>}
      {errorMessage(error)}
    </Alert>
  );
}

export interface DataStateProps {
  loading?: boolean;
  error?: unknown;
  /** When true (and not loading/error) the empty state renders instead of children. */
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  onRetry?: () => void;
  skeletonRows?: number;
  children: React.ReactNode;
}

/**
 * Convenience wrapper: `<DataState loading={l} error={e} isEmpty={!rows.length}>`
 * so a page body reads as the happy path only.
 */
export function DataState({
  loading,
  error,
  isEmpty,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyAction,
  onRetry,
  skeletonRows,
  children,
}: DataStateProps) {
  if (loading) return <Loading skeletonRows={skeletonRows} />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (isEmpty)
    return (
      <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
    );
  return <Box>{children}</Box>;
}

export { EmptyState };
