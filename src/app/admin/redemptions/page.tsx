'use client';

import Link from 'next/link';
import React, { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import RefreshIcon from '@mui/icons-material/Refresh';
import ConfirmDialog from '@/components/ConfirmDialog';
import { DataState, errorMessage } from '@/components/DataStates';
import StatusChip from '@/components/StatusChip';
import {
  approveRedemption,
  fulfillRedemption,
  listRedemptions,
  rejectRedemption,
} from '@/lib/api/adminInternship';
import {
  isPopulated,
  type Redemption,
  type RedemptionSource,
  type RedemptionStatus,
} from '@/lib/api/types';
import AdminScreen, { useSnack } from '../_shared/AdminScreen';
import { asList, fmtDateTime, fmtMoney, fmtNumber, internLabel, nameOf } from '../_shared/adminUtils';
import { useAsync } from '../_shared/useAsync';

/**
 * The payout desk. Money and goodies move by hand, so `fulfillmentNote` (the UPI
 * reference or courier tracking id) is the only record that a reward physically
 * reached the intern — it is required, not optional.
 *
 * The filter defaults to "needs action" rather than to `requested`: an autoGrant
 * stipend and an admin grant are both created straight as `approved`, so a
 * requested-only view hides exactly the rows that are waiting for a transfer.
 *
 * Rows are then GROUPED by status with "awaiting payout" first, because a flat
 * list buried the transfers we still owe people among the ones we do not.
 */

const STATUSES: RedemptionStatus[] = ['requested', 'approved', 'fulfilled', 'rejected'];

/** Anything still owing a decision or a payout. */
const NEEDS_ACTION = 'requested,approved';

const STATUS_LABELS: Record<string, string> = {
  [NEEDS_ACTION]: 'Needs action',
  requested: 'Awaiting decision',
  approved: 'Awaiting payout',
  fulfilled: 'Fulfilled',
  rejected: 'Rejected',
};

/** Queue order: what we owe money on comes first, always. */
const GROUP_ORDER: RedemptionStatus[] = ['approved', 'requested', 'fulfilled', 'rejected'];

const GROUP_COPY: Record<RedemptionStatus, { title: string; description: string }> = {
  approved: {
    title: 'Awaiting payout',
    description: 'Approved and reserved. Transfer the money or ship the goodie, then record the reference.',
  },
  requested: {
    title: 'Awaiting decision',
    description: 'An intern has spent their points. Approve to reserve stock, or reject to refund them.',
  },
  fulfilled: {
    title: 'Fulfilled',
    description: 'Paid or shipped, with a reference on file.',
  },
  rejected: {
    title: 'Rejected',
    description: 'Closed. Any points spent were refunded automatically.',
  },
};

const SOURCE_LABELS: Record<RedemptionSource, string> = {
  self_redeem: 'Self-redeemed with points',
  eligibility: 'Earned by an eligibility rule',
  admin_grant: 'Granted by the team',
};

interface RewardRef {
  _id?: string;
  name?: string;
  type?: string;
  unlockType?: string;
  pointsCost?: number;
  cashValue?: number;
}

function rewardOf(r: Redemption): RewardRef | null {
  const reward = r.rewardId as unknown;
  if (!reward || typeof reward !== 'object') return null;
  return reward as RewardRef;
}

// ── small layout atoms ───────────────────────────────────────────────────

function Dot() {
  return (
    <Box component="span" sx={{ color: 'text.disabled' }}>
      ·
    </Box>
  );
}

/** Typographic section head — never a filled slab competing with the rows under it. */
function SectionHead({
  title,
  count,
  description,
  tone = 'primary',
}: {
  title: string;
  count: string;
  description: string;
  tone?: 'primary' | 'muted';
}) {
  return (
    <Box sx={{ px: 0.5, mb: 1.5 }}>
      <Stack direction="row" alignItems="baseline" spacing={1}>
        <Typography
          variant="overline"
          sx={{ color: tone === 'primary' ? 'primary.main' : 'text.secondary' }}
        >
          {title}
        </Typography>
        <Typography
          className="tnum"
          variant="caption"
          sx={{ color: 'text.disabled', fontWeight: 600 }}
        >
          {count}
        </Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {description}
      </Typography>
    </Box>
  );
}

/** The number the payout desk is judged on. */
function QueueTile({
  value,
  label,
  hint,
  tone,
}: {
  value: string;
  label: string;
  hint: string;
  tone: 'warning' | 'primary';
}) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        px: 2,
        py: 1.5,
        borderRadius: 3,
        bgcolor: `${tone}.lighter`,
        color: `${tone}.darker`,
      }}
    >
      <Typography className="tnum" sx={{ fontWeight: 800, fontSize: 26, lineHeight: 1.15 }}>
        {value}
      </Typography>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{ display: 'block', opacity: 0.85 }}>
        {hint}
      </Typography>
    </Box>
  );
}

// ── queue row ────────────────────────────────────────────────────────────

/**
 * One redemption as a full-width row — this is a worklist read top to bottom, so
 * it never goes multi-column. The value being moved leads; everything the desk
 * does not act on (source, period, timestamps) is quiet text.
 */
function RedemptionCard({
  item,
  onApprove,
  onReject,
  onFulfil,
}: {
  item: Redemption;
  onApprove: () => void;
  onReject: () => void;
  onFulfil: () => void;
}) {
  const profile = isPopulated(item.internProfileId) ? item.internProfileId : null;
  const reward = rewardOf(item);
  const cash = reward?.cashValue ?? 0;
  const awaitingPayout = item.status === 'approved';
  const closed = item.status === 'fulfilled' || item.status === 'rejected';

  const tone = awaitingPayout
    ? 'warning'
    : item.status === 'fulfilled'
      ? 'success'
      : item.status === 'rejected'
        ? 'grey'
        : 'primary';

  return (
    <Card
      sx={{
        transition: (t) =>
          t.transitions.create(['box-shadow', 'transform', 'border-color'], { duration: 200 }),
        '&:hover': {
          transform: { md: 'translateY(-2px)' },
          borderColor: 'primary.light',
          boxShadow: (t) => t.customShadows.cardHover,
        },
        // The one state that must be chased: money we owe but have not sent.
        ...(awaitingPayout && { borderColor: 'warning.light' }),
      }}
    >
      <CardContent
        sx={{ p: { xs: 2, sm: 2.5 }, pb: 1.5, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}
      >
        <Stack direction="row" spacing={2} alignItems="flex-start">
          {/* Value block — what actually has to move. */}
          <Stack
            alignItems="center"
            justifyContent="center"
            sx={{
              flexShrink: 0,
              minWidth: 72,
              px: 1,
              height: 56,
              borderRadius: 2.5,
              bgcolor: tone === 'grey' ? 'grey.200' : `${tone}.lighter`,
              color: tone === 'grey' ? 'text.disabled' : `${tone}.darker`,
            }}
          >
            <Typography className="tnum" sx={{ fontWeight: 800, fontSize: 17, lineHeight: 1 }}>
              {cash > 0 ? fmtMoney(cash) : fmtNumber(item.pointsSpent)}
            </Typography>
            <Typography sx={{ fontSize: 10, fontWeight: 600, opacity: 0.8, mt: 0.25 }}>
              {cash > 0 ? 'to pay' : 'pts spent'}
            </Typography>
          </Stack>

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 700, flexGrow: 1, minWidth: 0, wordBreak: 'break-word' }}
              >
                {reward?.name ?? nameOf(item.rewardId)}
              </Typography>
              <StatusChip status={item.status} sx={{ flexShrink: 0 }} />
            </Stack>

            <Typography variant="body2" sx={{ mt: 0.25, wordBreak: 'break-word' }}>
              {profile ? (
                <Box
                  component={Link}
                  href={`/admin/interns/${profile._id}`}
                  sx={{
                    color: 'primary.main',
                    fontWeight: 600,
                    textDecoration: 'none',
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  {internLabel(profile)}
                </Box>
              ) : (
                <Box component="span" sx={{ color: 'text.disabled' }}>
                  Unknown intern
                </Box>
              )}
            </Typography>

            {/* Everything the desk does not act on is quiet text, not a chip row. */}
            <Stack
              direction="row"
              alignItems="center"
              sx={{
                mt: 1,
                gap: 1,
                flexWrap: 'wrap',
                typography: 'caption',
                color: 'text.secondary',
              }}
            >
              <Box component="span">{SOURCE_LABELS[item.source] ?? item.source}</Box>
              {cash > 0 && item.pointsSpent > 0 && (
                <>
                  <Dot />
                  <Box component="span" className="tnum">
                    {fmtNumber(item.pointsSpent)} pts spent
                  </Box>
                </>
              )}
              {item.period && (
                <>
                  <Dot />
                  <Box component="span" className="tnum">
                    {item.period}
                  </Box>
                </>
              )}
              <Dot />
              <Box component="span">
                Requested {fmtDateTime(item.requestedAt || item.createdAt)}
              </Box>
              {item.decidedAt && (
                <>
                  <Dot />
                  <Box component="span">Decided {fmtDateTime(item.decidedAt)}</Box>
                </>
              )}
              {item.fulfilledAt && (
                <>
                  <Dot />
                  <Box component="span">Fulfilled {fmtDateTime(item.fulfilledAt)}</Box>
                </>
              )}
            </Stack>

            {item.fulfillmentNote && (
              <Box
                sx={{
                  mt: 1.25,
                  px: 1.5,
                  py: 1,
                  borderRadius: 1.5,
                  bgcolor: 'success.lighter',
                  color: 'success.darker',
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                  Transfer reference
                </Typography>
                <Typography variant="caption" sx={{ wordBreak: 'break-word' }}>
                  {item.fulfillmentNote}
                </Typography>
              </Box>
            )}

            {item.rejectionReason && (
              <Box
                sx={{
                  mt: 1.25,
                  px: 1.5,
                  py: 1,
                  borderRadius: 1.5,
                  bgcolor: 'error.lighter',
                  color: 'error.darker',
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                  Rejected
                </Typography>
                <Typography variant="caption">{item.rejectionReason}</Typography>
              </Box>
            )}
          </Box>
        </Stack>
      </CardContent>

      {!closed && (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ px: { xs: 2, sm: 2.5 }, pb: 2 }}
        >
          {item.status === 'requested' && (
            <Button
              size="small"
              variant="contained"
              color="success"
              startIcon={<CheckIcon />}
              onClick={onApprove}
            >
              Approve
            </Button>
          )}
          {awaitingPayout && (
            <Button
              size="small"
              variant="contained"
              color="warning"
              startIcon={<LocalShippingIcon />}
              onClick={onFulfil}
            >
              Record payout
            </Button>
          )}
          <Box sx={{ flexGrow: 1 }} />
          {/* The backend only rejects a `requested` redemption — an approved one
              has to be fulfilled or corrected by hand. */}
          {item.status === 'requested' && (
            <Button size="small" color="error" startIcon={<CloseIcon />} onClick={onReject}>
              Reject
            </Button>
          )}
        </Stack>
      )}
    </Card>
  );
}

// ── screen ───────────────────────────────────────────────────────────────

function RedemptionsBody() {
  const { show, snackbar } = useSnack();
  const [status, setStatus] = useState<string>(NEEDS_ACTION);

  const queue = useAsync(
    async () => asList<Redemption>((await listRedemptions({ status: status || undefined })).items),
    [status]
  );
  const rows = queue.data ?? [];

  const [rejecting, setRejecting] = useState<Redemption | null>(null);
  const [approving, setApproving] = useState<Redemption | null>(null);
  const [fulfilling, setFulfilling] = useState<Redemption | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [fulfilError, setFulfilError] = useState<unknown>(null);

  /** Statuses the current filter shows ('' = every status). */
  const visibleStatuses = status === '' ? null : status.split(',');

  /**
   * Optimistic update: a row only drops out when its NEXT status falls outside
   * the filter (approving inside the "needs action" view keeps it, now awaiting a
   * payout). Anything still visible is reloaded so its chips are honest.
   */
  const runAction = async (
    item: Redemption,
    action: () => Promise<unknown>,
    message: string,
    nextStatus: RedemptionStatus
  ) => {
    const dropsOut = !!visibleStatuses && !visibleStatuses.includes(nextStatus);
    const index = rows.findIndex((r) => r._id === item._id);
    if (dropsOut) queue.setData((cur) => (cur ?? []).filter((r) => r._id !== item._id));
    try {
      await action();
      show(message);
      if (!dropsOut) queue.reload();
    } catch (err) {
      if (dropsOut) {
        queue.setData((cur) => {
          const next = [...(cur ?? [])];
          next.splice(Math.min(Math.max(index, 0), next.length), 0, item);
          return next;
        });
      }
      show(errorMessage(err, 'Action failed — nothing was changed.'), 'error');
      throw err;
    }
  };

  const runFulfil = async () => {
    if (!fulfilling) return;
    if (!note.trim()) {
      setFulfilError(new Error('A transfer reference is required'));
      return;
    }
    setBusy(true);
    setFulfilError(null);
    try {
      await runAction(
        fulfilling,
        () => fulfillRedemption(fulfilling._id, note.trim()),
        'Marked fulfilled',
        'fulfilled'
      );
      setFulfilling(null);
      setNote('');
    } catch {
      // runAction already surfaced the error in a toast.
    } finally {
      setBusy(false);
    }
  };

  const decisionRows = rows.filter((r) => r.status === 'requested');
  const payoutRows = rows.filter((r) => r.status === 'approved');
  const payoutCash = payoutRows.reduce((sum, r) => sum + (rewardOf(r)?.cashValue ?? 0), 0);

  const groups = GROUP_ORDER.map((key) => ({
    key,
    items: rows.filter((r) => r.status === key),
  })).filter((g) => g.items.length > 0);

  return (
    <Stack spacing={2.5}>
      {/* Toolbar: the filter that scopes the queue, then a manual refresh. */}
      <Stack direction="row" spacing={1.5} alignItems="center">
        <TextField
          select
          size="small"
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          sx={{ width: { xs: '100%', sm: 210 } }}
        >
          <MenuItem value={NEEDS_ACTION}>{STATUS_LABELS[NEEDS_ACTION]}</MenuItem>
          <MenuItem value="">All statuses</MenuItem>
          {STATUSES.map((s) => (
            <MenuItem key={s} value={s}>
              {STATUS_LABELS[s]}
            </MenuItem>
          ))}
        </TextField>
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="Refresh">
          <IconButton
            onClick={queue.reload}
            aria-label="Refresh redemptions"
            sx={{ width: 44, height: 44 }}
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Awaiting payout is the thing this desk exists for — it never hides in a list. */}
      {(payoutRows.length > 0 || decisionRows.length > 0) && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          {payoutRows.length > 0 && (
            <QueueTile
              tone="warning"
              value={String(payoutRows.length)}
              label="awaiting payout"
              hint={
                payoutCash > 0
                  ? `${fmtMoney(payoutCash)} still to transfer by hand`
                  : 'Goodies still to ship'
              }
            />
          )}
          {decisionRows.length > 0 && (
            <QueueTile
              tone="primary"
              value={String(decisionRows.length)}
              label="awaiting a decision"
              hint="Points are already deducted until you approve or reject"
            />
          )}
        </Stack>
      )}

      <DataState
        loading={queue.loading && !queue.data}
        error={queue.error && !queue.data ? queue.error : undefined}
        onRetry={queue.reload}
        isEmpty={!rows.length}
        emptyTitle={status === NEEDS_ACTION ? 'Nothing to pay out' : 'No redemptions here'}
        emptyDescription={
          status === NEEDS_ACTION
            ? 'Every approved reward has a transfer reference on file. New requests will appear here.'
            : 'No redemptions match this filter — try "All statuses".'
        }
        skeletonRows={3}
      >
        <Stack spacing={3}>
          {groups.map((group) => (
            <Box key={group.key}>
              <SectionHead
                title={GROUP_COPY[group.key].title}
                count={`${group.items.length}`}
                description={GROUP_COPY[group.key].description}
                tone={group.key === 'approved' || group.key === 'requested' ? 'primary' : 'muted'}
              />
              <Stack spacing={1.5}>
                {group.items.map((item) => (
                  <RedemptionCard
                    key={item._id}
                    item={item}
                    onApprove={() => setApproving(item)}
                    onReject={() => setRejecting(item)}
                    onFulfil={() => {
                      setNote('');
                      setFulfilError(null);
                      setFulfilling(item);
                    }}
                  />
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      </DataState>

      <ConfirmDialog
        open={!!approving}
        title="Approve this redemption?"
        message="Approving reserves the stock. Record the transfer reference when you mark it fulfilled."
        confirmLabel="Approve"
        onClose={() => setApproving(null)}
        onConfirm={async () => {
          if (approving) {
            await runAction(
              approving,
              () => approveRedemption(approving._id),
              'Approved — now awaiting payout',
              'approved'
            );
          }
        }}
      />

      <ConfirmDialog
        open={!!rejecting}
        title="Reject this redemption?"
        message="Any points the intern spent are refunded automatically."
        confirmLabel="Reject"
        destructive
        requireReason
        reasonLabel="Reason"
        reasonPlaceholder="e.g. Out of stock — offer the voucher instead"
        onClose={() => setRejecting(null)}
        onConfirm={async (reason) => {
          if (rejecting) {
            await runAction(
              rejecting,
              () => rejectRedemption(rejecting._id, reason ?? ''),
              'Rejected — points refunded where applicable',
              'rejected'
            );
          }
        }}
      />

      <Dialog open={!!fulfilling} onClose={() => setFulfilling(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ pb: 1 }}>
          Record the payout
          <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
            {(fulfilling && rewardOf(fulfilling)?.name) || 'This reward'}
            {fulfilling && isPopulated(fulfilling.internProfileId)
              ? ` → ${internLabel(fulfilling.internProfileId)}`
              : ''}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ py: 1 }}>
            {fulfilError != null && <Alert severity="error">{errorMessage(fulfilError)}</Alert>}
            <Box sx={{ px: 1.75, py: 1.5, borderRadius: 2.5, bgcolor: 'warning.lighter' }}>
              <Typography variant="caption" sx={{ color: 'warning.darker' }}>
                Payouts are manual. The reference you type here is the only audit trail that the
                money or the parcel actually left — the intern sees it on their rewards page.
              </Typography>
            </Box>
            <TextField
              label="Transfer reference / tracking id"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              multiline
              minRows={2}
              required
              autoFocus
              placeholder="e.g. UPI 402913887744 · 12 Aug"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button color="inherit" onClick={() => setFulfilling(null)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={runFulfil}
            disabled={busy || !note.trim()}
            loading={busy}
          >
            Mark fulfilled
          </Button>
        </DialogActions>
      </Dialog>

      {snackbar}
    </Stack>
  );
}

export default function AdminRedemptionsPage() {
  return (
    <AdminScreen
      title="Redemptions"
      subtitle="Approve, reject and record manual payouts"
      back="/admin"
    >
      <RedemptionsBody />
    </AdminScreen>
  );
}
