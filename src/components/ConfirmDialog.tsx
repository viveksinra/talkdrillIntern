'use client';

import React, { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { errorMessage } from './DataStates';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button + warning copy — for reject / delete. */
  destructive?: boolean;
  /**
   * Ask for a reason and pass it to onConfirm. Rejections must always carry one,
   * so the confirm button stays disabled until it is filled in.
   */
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  /** Extra fields (e.g. a points override) rendered above the reason box. */
  children?: React.ReactNode;
  onClose: () => void;
  /** Awaited — the dialog shows a busy state and surfaces a throw inline. */
  onConfirm: (reason?: string) => void | Promise<unknown>;
}

/**
 * One dialog for every destructive/irreversible action in the portal. It owns its
 * own busy + error state so callers never leave a half-finished spinner behind and
 * an API failure is visible where the click happened instead of vanishing.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  requireReason = false,
  reasonLabel = 'Reason',
  reasonPlaceholder,
  children,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (open) {
      setReason('');
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const reasonMissing = requireReason && reason.trim().length === 0;

  const handleConfirm = async () => {
    if (reasonMissing || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(requireReason ? reason.trim() : undefined);
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="xs"
      aria-labelledby="confirm-dialog-title"
    >
      <DialogTitle id="confirm-dialog-title">{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          {message &&
            (typeof message === 'string' ? (
              <DialogContentText>{message}</DialogContentText>
            ) : (
              message
            ))}
          {children}
          {requireReason && (
            <TextField
              label={reasonLabel}
              placeholder={reasonPlaceholder}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              multiline
              minRows={2}
              autoFocus
              disabled={busy}
              helperText={
                reasonMissing ? 'Required — the intern sees this.' : 'The intern sees this message.'
              }
            />
          )}
          {error != null && <Alert severity="error">{errorMessage(error)}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy} color="inherit">
          {cancelLabel}
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color={destructive ? 'error' : 'primary'}
          disabled={busy || reasonMissing}
          loading={busy}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export { ConfirmDialog };
