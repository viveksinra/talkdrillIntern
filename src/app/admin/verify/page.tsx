'use client';

import Link from 'next/link';
import React, { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { Theme } from '@mui/material/styles';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import TuneIcon from '@mui/icons-material/Tune';
import ConfirmDialog from '@/components/ConfirmDialog';
import { DataState, errorMessage } from '@/components/DataStates';
import ProofPreview from '@/components/ProofPreview';
import StatusChip from '@/components/StatusChip';
import {
  approveSubmission,
  bulkApproveSubmissions,
  getSubmissionQueue,
  listPrograms,
  rejectSubmission,
} from '@/lib/api/adminInternship';
import { isPopulated, type ProofType, type SubmissionQueueItem, type Track } from '@/lib/api/types';
import AdminScreen, { useSnack } from '../_shared/AdminScreen';
import {
  asList,
  fmtDateTime,
  internLabel,
  titleCase,
  TRACKS,
  type ProgramRow,
} from '../_shared/adminUtils';
import { useAsync } from '../_shared/useAsync';

/**
 * Verification queue — the screen the programme lives or dies on. A reviewer
 * clears dozens of rows in a sitting, so every action is optimistic: the row
 * leaves the list on click and is put back exactly where it was if the API says no.
 *
 * Layout follows the same logic: one narrow scan column (who / what / the proof
 * itself) and the two actions always in the same place at the foot of the card,
 * so twenty reviews are twenty identical eye movements.
 */

/** Populated shapes the queue endpoint adds on top of the plain Submission. */
interface QueueTemplate {
  _id: string;
  title?: string;
  points?: number;
  proofType?: ProofType;
  isMandatory?: boolean;
  requiresDashboardProof?: boolean;
  instructions?: string;
}

interface QueueAssignedTask {
  _id: string;
  templateId?: string | QueueTemplate;
  dueDate?: string;
  period?: string | null;
  status?: string;
  submissionCount?: number;
}

function templateOf(item: SubmissionQueueItem): QueueTemplate | null {
  const task = item.assignedTaskId as unknown as QueueAssignedTask | string | null;
  if (!task || typeof task === 'string') return null;
  const template = task.templateId;
  if (!template || typeof template === 'string') return null;
  return template;
}

function taskOf(item: SubmissionQueueItem): QueueAssignedTask | null {
  const task = item.assignedTaskId as unknown as QueueAssignedTask | string | null;
  if (!task || typeof task === 'string') return null;
  return task;
}

interface PendingAction {
  item: SubmissionQueueItem;
  kind: 'reject' | 'override';
}

/** Middot between two pieces of quiet metadata. */
function Dot() {
  return (
    <Box component="span" sx={{ color: 'text.disabled' }}>
      ·
    </Box>
  );
}

/**
 * Tap targets stay 44px on a phone and tighten up on a mouse, where a dense
 * queue is faster to work than a column of big slabs.
 */
const compactAction = { minHeight: { xs: 44, sm: 36 }, px: { xs: 2, sm: 1.75 } };

function QueueRow({
  item,
  selected,
  onToggle,
  onApprove,
  onReject,
  onOverride,
}: {
  item: SubmissionQueueItem;
  selected: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
  onOverride: () => void;
}) {
  const template = templateOf(item);
  const task = taskOf(item);
  const profile = isPopulated(item.internProfileId) ? item.internProfileId : null;
  const points = template?.points ?? 0;
  const flagged = item.needsStricterReview || item.flags.length > 0;
  const attempt = task?.submissionCount ?? 0;

  // Quiet metadata: chips here fought the one chip that carries meaning.
  const meta: React.ReactNode[] = [];
  if (profile?.track) meta.push(titleCase(profile.track));
  meta.push(titleCase(item.proofType));
  if (profile?.email && profile.fullName) meta.push(profile.email);
  if (task?.period) meta.push(`Period ${task.period}`);

  return (
    <Card
      sx={{
        transition: (t: Theme) =>
          t.transitions.create(['box-shadow', 'border-color'], { duration: 200 }),
        '&:hover': {
          borderColor: flagged ? 'warning.main' : 'primary.light',
          boxShadow: (t: Theme) => t.customShadows.cardHover,
        },
        // The one state worth a coloured border: automated checks want a closer look.
        ...(flagged && { borderColor: 'warning.light' }),
      }}
    >
      <CardContent sx={{ p: { xs: 1.75, sm: 2.25 }, pb: { xs: 1.5, sm: 2 } }}>
        <Stack direction="row" spacing={{ xs: 1, sm: 1.5 }} alignItems="flex-start">
          <Checkbox
            checked={selected}
            onChange={onToggle}
            inputProps={{ 'aria-label': `Select submission from ${internLabel(profile)}` }}
            sx={{ mt: -0.75, ml: -1.25 }}
          />

          {/* Points lead the row: what this review is worth, in one glance. */}
          <Stack
            alignItems="center"
            justifyContent="center"
            sx={{
              flexShrink: 0,
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: flagged ? 'warning.lighter' : 'primary.lighter',
              color: flagged ? 'warning.darker' : 'primary.dark',
            }}
          >
            <Typography className="tnum" sx={{ fontWeight: 800, fontSize: 16, lineHeight: 1 }}>
              {points}
            </Typography>
            <Typography sx={{ fontSize: 9, fontWeight: 700, opacity: 0.75, mt: 0.25 }}>
              pts
            </Typography>
          </Stack>

          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 700, flexGrow: 1, minWidth: 0, wordBreak: 'break-word' }}
              >
                {template?.title ?? 'Task'}
              </Typography>
              {/* One categorical chip only — mandatory work changes the stakes. */}
              {template?.isMandatory && (
                <Chip size="small" color="primary" variant="outlined" label="Mandatory" />
              )}
              {/* The queue is pending by definition; only an oddity is worth a chip. */}
              {item.status !== 'pending' && <StatusChip status={item.status} />}
            </Stack>

            <Typography variant="body2" sx={{ mt: 0.25, wordBreak: 'break-word' }}>
              {profile ? (
                <Box
                  component={Link}
                  href={`/admin/interns/${profile._id}`}
                  sx={{ color: 'primary.main', fontWeight: 600, textDecoration: 'none' }}
                >
                  {internLabel(profile)}
                </Box>
              ) : (
                <Box component="span" sx={{ color: 'text.secondary' }}>
                  Unknown intern
                </Box>
              )}
            </Typography>

            <Stack
              direction="row"
              alignItems="center"
              sx={{
                mt: 0.5,
                gap: 0.75,
                flexWrap: 'wrap',
                typography: 'caption',
                color: 'text.secondary',
              }}
            >
              {meta.map((entry, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <Dot />}
                  <Box component="span" sx={{ wordBreak: 'break-word' }}>
                    {entry}
                  </Box>
                </React.Fragment>
              ))}
              {attempt > 1 && (
                <>
                  {meta.length > 0 && <Dot />}
                  <Box component="span" sx={{ color: 'warning.dark', fontWeight: 700 }}>
                    Attempt {attempt}
                  </Box>
                </>
              )}
            </Stack>
          </Box>
        </Stack>

        {/* The proof itself — never behind a click. */}
        <Box sx={{ mt: 1.5 }}>
          <ProofPreview
            proofType={item.proofType}
            files={item.files}
            textValue={item.textValue}
            linkUrl={item.linkUrl}
            usernameValue={item.usernameValue}
            note={item.note}
            flags={item.flags}
            needsStricterReview={item.needsStricterReview}
            compact
          />
        </Box>

        {template?.requiresDashboardProof && !item.files.length && (
          <Box
            sx={{
              mt: 1.5,
              px: 1.5,
              py: 1,
              borderRadius: 1.5,
              bgcolor: 'warning.lighter',
              color: 'warning.darker',
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              This task expects a dashboard screenshot, and none was attached.
            </Typography>
          </Box>
        )}
      </CardContent>

      <Divider />
      <Stack
        direction="row"
        alignItems="center"
        sx={{ px: { xs: 1.5, sm: 2 }, py: 1.25, gap: 1, flexWrap: 'wrap' }}
      >
        <Typography variant="caption" color="text.secondary">
          Submitted {fmtDateTime(item.submittedAt || item.createdAt)}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        {/* Quiet until you mean it: reject only turns red under the pointer. */}
        <Button
          variant="outlined"
          size="small"
          color="inherit"
          startIcon={<CloseIcon />}
          onClick={onReject}
          sx={{
            ...compactAction,
            color: 'text.secondary',
            borderColor: 'divider',
            '&:hover': { color: 'error.main', borderColor: 'error.main', bgcolor: 'error.lighter' },
          }}
        >
          Reject
        </Button>
        <Button
          variant="contained"
          size="small"
          color="success"
          startIcon={<CheckIcon />}
          onClick={onApprove}
          sx={compactAction}
        >
          Approve
        </Button>
        <Tooltip title="Approve with custom points">
          <IconButton
            onClick={onOverride}
            aria-label="Approve with custom points"
            sx={{ width: { xs: 44, sm: 36 }, height: { xs: 44, sm: 36 } }}
          >
            <TuneIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Card>
  );
}

function VerifyBody() {
  const { show, snackbar } = useSnack();
  const [track, setTrack] = useState<Track | ''>('');
  const [programId, setProgramId] = useState('');
  const [limit, setLimit] = useState(50);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [overridePoints, setOverridePoints] = useState('');

  const programs = useAsync(async () => asList<ProgramRow>(await listPrograms()), []);

  const queue = useAsync(
    () =>
      getSubmissionQueue({
        track: track || undefined,
        programId: programId || undefined,
        limit,
      }),
    [track, programId, limit]
  );

  const items = queue.data?.items ?? [];
  const total = queue.data?.total ?? 0;
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedInView = items.filter((i) => selectedSet.has(i._id));

  const drop = (id: string) => {
    queue.setData((cur) =>
      cur ? { ...cur, items: cur.items.filter((i) => i._id !== id), total: Math.max(0, cur.total - 1) } : cur
    );
    setSelected((cur) => cur.filter((s) => s !== id));
  };

  const restore = (item: SubmissionQueueItem, index: number) => {
    queue.setData((cur) => {
      if (!cur) return cur;
      const next = [...cur.items];
      next.splice(Math.min(Math.max(index, 0), next.length), 0, item);
      return { ...cur, items: next, total: cur.total + 1 };
    });
  };

  /** Optimistic single-row action: remove now, put it back on failure. */
  const runOnRow = async (
    item: SubmissionQueueItem,
    action: () => Promise<unknown>,
    successMessage: string
  ) => {
    const index = items.findIndex((i) => i._id === item._id);
    drop(item._id);
    try {
      await action();
      show(successMessage, 'success');
    } catch (err) {
      restore(item, index);
      show(errorMessage(err, 'Action failed — the row has been restored.'), 'error');
    }
  };

  const approve = (item: SubmissionQueueItem, pointsOverride?: number) =>
    runOnRow(
      item,
      () => approveSubmission(item._id, pointsOverride === undefined ? {} : { pointsOverride }),
      `Approved — ${internLabel(isPopulated(item.internProfileId) ? item.internProfileId : null)}`
    );

  const reject = (item: SubmissionQueueItem, reason: string) =>
    runOnRow(item, () => rejectSubmission(item._id, reason), 'Rejected — the intern can resubmit.');

  const bulkApprove = async () => {
    const batch = selectedInView;
    if (!batch.length) return;
    const snapshot = items;
    queue.setData((cur) =>
      cur
        ? {
            ...cur,
            items: cur.items.filter((i) => !selectedSet.has(i._id)),
            total: Math.max(0, cur.total - batch.length),
          }
        : cur
    );
    setSelected([]);
    try {
      const result = await bulkApproveSubmissions(batch.map((i) => i._id));
      const failedCount = result.failed.length;
      show(
        `${result.approved.length} approved${failedCount ? `, ${failedCount} failed` : ''}`,
        failedCount ? 'warning' : 'success'
      );
      // Failures leave rows pending on the server — reload so the list matches it.
      if (failedCount) queue.reload();
    } catch (err) {
      queue.setData((cur) => (cur ? { ...cur, items: snapshot, total: snapshot.length } : cur));
      setSelected(batch.map((i) => i._id));
      show(errorMessage(err, 'Bulk approve failed — nothing was changed.'), 'error');
    }
  };

  const allSelected = items.length > 0 && selectedInView.length === items.length;
  const flaggedCount = items.filter((i) => i.needsStricterReview || i.flags.length).length;

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ flexWrap: 'wrap', gap: 1.5 }}>
        <TextField
          select
          size="small"
          label="Track"
          value={track}
          onChange={(e) => setTrack(e.target.value as Track | '')}
          sx={{ flex: '1 1 150px', maxWidth: { sm: 190 } }}
        >
          <MenuItem value="">All tracks</MenuItem>
          {TRACKS.map((t) => (
            <MenuItem key={t} value={t}>
              {titleCase(t)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Program"
          value={programId}
          onChange={(e) => setProgramId(e.target.value)}
          sx={{ flex: '1 1 180px', maxWidth: { sm: 240 } }}
        >
          <MenuItem value="">All programs</MenuItem>
          {asList<ProgramRow>(programs.data).map((p) => (
            <MenuItem key={p._id} value={p._id}>
              {p.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Show"
          value={String(limit)}
          onChange={(e) => setLimit(Number(e.target.value))}
          sx={{ flex: '0 1 100px' }}
        >
          {[25, 50, 100, 200].map((n) => (
            <MenuItem key={n} value={String(n)}>
              {n}
            </MenuItem>
          ))}
        </TextField>
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="Refresh queue">
          <IconButton onClick={queue.reload} aria-label="Refresh queue" sx={{ width: 44, height: 44 }}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      {items.length > 0 && (
        <Stack
          direction="row"
          alignItems="center"
          sx={{
            position: 'sticky',
            // Sits just under AppShell's sticky app bar (toolbar + admin tab row).
            top: { xs: 104, sm: 112 },
            zIndex: 2,
            py: 0.75,
            pl: 0.5,
            pr: 1.25,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2.5,
            boxShadow: (t: Theme) => t.customShadows.z8,
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          <Checkbox
            checked={allSelected}
            indeterminate={selectedInView.length > 0 && !allSelected}
            onChange={() => setSelected(allSelected ? [] : items.map((i) => i._id))}
            inputProps={{ 'aria-label': 'Select all visible submissions' }}
          />
          <Typography variant="body2" className="tnum" sx={{ fontWeight: 600 }}>
            {selectedInView.length
              ? `${selectedInView.length} selected`
              : `${items.length} of ${total} pending`}
          </Typography>
          {flaggedCount > 0 && (
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'warning.dark' }}>
              <ReportProblemIcon sx={{ fontSize: 15 }} />
              <Typography variant="caption" className="tnum" sx={{ fontWeight: 700 }}>
                {flaggedCount} flagged
              </Typography>
            </Stack>
          )}
          <Box sx={{ flexGrow: 1 }} />
          <Button
            variant="contained"
            size="small"
            color="success"
            startIcon={<CheckIcon />}
            disabled={!selectedInView.length}
            onClick={() => setBulkOpen(true)}
            sx={compactAction}
          >
            Approve selected
          </Button>
        </Stack>
      )}

      <DataState
        loading={queue.loading && !queue.data}
        error={queue.error && !queue.data ? queue.error : undefined}
        onRetry={queue.reload}
        isEmpty={!items.length}
        emptyTitle="Queue is clear"
        emptyDescription="No pending submissions match these filters. Nice work."
        skeletonRows={3}
      >
        <Stack spacing={1.5}>
          {items.map((item) => (
            <QueueRow
              key={item._id}
              item={item}
              selected={selectedSet.has(item._id)}
              onToggle={() =>
                setSelected((cur) =>
                  cur.includes(item._id) ? cur.filter((s) => s !== item._id) : [...cur, item._id]
                )
              }
              onApprove={() => approve(item)}
              onReject={() => setPending({ item, kind: 'reject' })}
              onOverride={() => {
                setOverridePoints(String(templateOf(item)?.points ?? 0));
                setPending({ item, kind: 'override' });
              }}
            />
          ))}
        </Stack>
      </DataState>

      <ConfirmDialog
        open={!!pending && pending.kind === 'reject'}
        title="Reject this submission?"
        message="The intern sees this reason and can submit again."
        confirmLabel="Reject"
        destructive
        requireReason
        reasonLabel="Reason for rejection"
        reasonPlaceholder="e.g. Screenshot does not show the post date"
        onClose={() => setPending(null)}
        onConfirm={async (reason) => {
          if (pending) await reject(pending.item, reason ?? '');
        }}
      />

      <ConfirmDialog
        open={!!pending && pending.kind === 'override'}
        title="Approve with custom points"
        message="Use this when the work was partial — the ledger records the amount you enter."
        confirmLabel="Approve"
        onClose={() => setPending(null)}
        onConfirm={async () => {
          const value = Number(overridePoints);
          if (!Number.isFinite(value) || value < 0) throw new Error('Enter 0 or more points');
          if (pending) await approve(pending.item, Math.round(value));
        }}
      >
        <TextField
          label="Points to award"
          type="number"
          value={overridePoints}
          onChange={(e) => setOverridePoints(e.target.value)}
          inputProps={{ min: 0, step: 1 }}
          autoFocus
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={bulkOpen}
        title={`Approve ${selectedInView.length} submission(s)?`}
        message="Each one awards its task's points. Any that were already reviewed are reported back as failures."
        confirmLabel="Approve all"
        onClose={() => setBulkOpen(false)}
        onConfirm={bulkApprove}
      />

      {snackbar}
    </Stack>
  );
}

export default function AdminVerifyPage() {
  return (
    <AdminScreen
      title="Verification queue"
      subtitle="Pending proof submissions, flagged ones first"
      back="/admin"
    >
      <VerifyBody />
    </AdminScreen>
  );
}
