'use client';

import Link from 'next/link';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import useMediaQuery from '@mui/material/useMediaQuery';
import type { Theme } from '@mui/material/styles';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import TuneIcon from '@mui/icons-material/Tune';
import ConfirmDialog from '@/components/ConfirmDialog';
import { DataState, errorMessage } from '@/components/DataStates';
import EmptyState from '@/components/EmptyState';
import Label from '@/components/Label';
import MetaLine from '@/components/MetaLine';
import ProofPreview from '@/components/ProofPreview';
import Reveal from '@/components/Reveal';
import SectionHead from '@/components/SectionHead';
import StatusChip from '@/components/StatusChip';
import { ART } from '@/lib/art';
import { celebrate, celebrateOnce, haptic, playSfx } from '@/lib/juice';
import {
  approveSubmission,
  bulkApproveSubmissions,
  getSubmissionQueue,
  listPrograms,
  rejectSubmission,
} from '@/lib/api/adminInternship';
import { isPopulated, type ProofType, type SubmissionQueueItem, type Track } from '@/lib/api/types';
import { FONT_DISPLAY } from '@/theme';
import AdminScreen, { useSnack } from '../_shared/AdminScreen';
import {
  asList,
  fmtDate,
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
 * On a phone that is one column of self-contained cards. On a desktop it is a
 * mail client: a 380px scan column on the left, one full-fidelity review pane on
 * the right (proof at full size + the instructions the work is judged against),
 * and j/k/a/r under the fingers so a batch is cleared without the mouse.
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

/**
 * Every sticky offset on this page derives from one measurement, kept here so a
 * change to the shell is a one-line change here.
 *
 * AppShell's AppBar is `position: sticky` and stacks two things: the MUI Toolbar
 * (56px on xs, 64px from sm up — theme keeps the defaults) and, for admins, the
 * 48px section-tab row. Anything that sticks inside the page body must clear both.
 */
const TOOLBAR_H = { xs: 56, sm: 64 };
const ADMIN_TAB_ROW_H = 48;
/** Top offset for the queue's own sticky toolbar: right under the app bar. */
const STICKY_TOP = { xs: TOOLBAR_H.xs + ADMIN_TAB_ROW_H, sm: TOOLBAR_H.sm + ADMIN_TAB_ROW_H };
/** …and the split-pane list sticks under that toolbar (56px tall + 8px breathing room). */
const LIST_TOP = { md: STICKY_TOP.sm + 64 };
const LIST_MAX_H = `calc(100vh - ${STICKY_TOP.sm + 88}px)`;

/** The five rejections reviewers actually write, one tap instead of one sentence. */
const CANNED_REASONS = [
  'Screenshot unclear',
  'Wrong link',
  'Duplicate proof',
  "Handle doesn't match",
  'Incomplete task',
];

/**
 * Tap targets stay 44px on a phone and tighten up on a mouse, where a dense
 * queue is faster to work than a column of big slabs.
 */
const compactAction = { minHeight: { xs: 44, sm: 36 }, px: { xs: 2, sm: 1.75 } };

function isFlagged(item: SubmissionQueueItem): boolean {
  return item.needsStricterReview || item.flags.length > 0;
}

/**
 * Sort weight for "flagged first". `needsStricterReview` counts as one flag so a
 * row the fraud service marked but did not itemise still floats to the top.
 */
function flagWeight(item: SubmissionQueueItem): number {
  return item.flags.length || (item.needsStricterReview ? 1 : 0);
}

/** "2h ago" — a queue is read in elapsed time, not in timestamps. */
function relTime(value?: string | null): string {
  if (!value) return '—';
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return '—';
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days <= 30) return `${days}d ago`;
  return fmtDate(value);
}

/** Metadata shared by the phone card and the desktop review pane. */
function metaParts(item: SubmissionQueueItem): React.ReactNode[] {
  const task = taskOf(item);
  const profile = isPopulated(item.internProfileId) ? item.internProfileId : null;
  const attempt = task?.submissionCount ?? 0;
  return [
    profile?.track ? titleCase(profile.track) : null,
    titleCase(item.proofType),
    profile?.email && profile.fullName ? profile.email : null,
    task?.period ? `Period ${task.period}` : null,
    attempt > 1 ? (
      <Box key="attempt" component="span" sx={{ color: 'warning.dark', fontWeight: 700 }}>
        Attempt {attempt}
      </Box>
    ) : null,
  ].filter(Boolean) as React.ReactNode[];
}

// ── phone: one self-contained card per submission ────────────────────────

function QueueCard({
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
  const profile = isPopulated(item.internProfileId) ? item.internProfileId : null;
  const points = template?.points ?? 0;
  const flagged = isFlagged(item);

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
            <Stack direction="row" spacing={0.75} alignItems="flex-start">
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 700, flexGrow: 1, minWidth: 0, wordBreak: 'break-word' }}
              >
                {template?.title ?? 'Task'}
              </Typography>
              {/* At most two pills: mandatory work changes the stakes, flags change the care. */}
              {template?.isMandatory && (
                <Label color="primary" variant="soft">
                  Mandatory
                </Label>
              )}
              {flagged && (
                <Label
                  color="warning"
                  variant="soft"
                  startIcon={<ReportProblemIcon sx={{ fontSize: 14 }} />}
                >
                  {item.flags.length || 'Check'}
                </Label>
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

            <MetaLine parts={metaParts(item)} sx={{ mt: 0.5 }} />
          </Box>
        </Stack>

        {template?.instructions && (
          <Box
            sx={{
              mt: 1.5,
              p: 1.5,
              borderRadius: 2,
              bgcolor: 'grey.50',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography
              variant="overline"
              sx={{ display: 'block', color: 'text.secondary', lineHeight: 1.6 }}
            >
              What they were asked to do
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {template.instructions}
            </Typography>
          </Box>
        )}

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
        <ActionButtons onApprove={onApprove} onReject={onReject} onOverride={onOverride} />
      </Stack>
    </Card>
  );
}

/** The two decisions, always in the same order, on the card and in the pane. */
function ActionButtons({
  onApprove,
  onReject,
  onOverride,
}: {
  onApprove: () => void;
  onReject: () => void;
  onOverride: () => void;
}) {
  return (
    <>
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
    </>
  );
}

// ── desktop: scan column + review pane ───────────────────────────────────

function QueueListRow({
  item,
  index,
  checked,
  focused,
  onToggle,
  onFocus,
}: {
  item: SubmissionQueueItem;
  index: number;
  checked: boolean;
  focused: boolean;
  onToggle: () => void;
  onFocus: () => void;
}) {
  const template = templateOf(item);
  const profile = isPopulated(item.internProfileId) ? item.internProfileId : null;
  const flagged = isFlagged(item);

  return (
    <Reveal index={index}>
      <Box
        data-row-id={item._id}
        role="button"
        tabIndex={-1}
        aria-current={focused}
        onClick={onFocus}
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 0.5,
          pl: 0.5,
          pr: 1.25,
          py: 1,
          cursor: 'pointer',
          borderLeft: '3px solid',
          borderColor: focused ? 'primary.main' : 'transparent',
          bgcolor: focused ? 'primary.lighter' : 'transparent',
          borderBottom: '1px solid',
          borderBottomColor: 'divider',
          transition: (t: Theme) => t.transitions.create('background-color', { duration: 120 }),
          '&:hover': { bgcolor: focused ? 'primary.lighter' : 'action.hover' },
        }}
      >
        <Checkbox
          size="small"
          checked={checked}
          onClick={(e) => e.stopPropagation()}
          onChange={onToggle}
          inputProps={{ 'aria-label': `Select submission from ${internLabel(profile)}` }}
          sx={{ mt: -0.25 }}
        />
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700, minWidth: 0 }}>
              {internLabel(profile)}
            </Typography>
            {flagged && (
              <ReportProblemIcon sx={{ fontSize: 15, color: 'warning.main', flexShrink: 0 }} />
            )}
          </Stack>
          <Typography variant="body2" color="text.secondary" noWrap>
            {template?.title ?? 'Task'}
          </Typography>
          <Typography variant="caption" color="text.disabled">
            {relTime(item.submittedAt || item.createdAt)}
          </Typography>
        </Box>
        <Stack alignItems="flex-end" sx={{ flexShrink: 0, pt: 0.25 }}>
          <Typography
            className="tnum"
            sx={{ fontWeight: 800, fontSize: 14, lineHeight: 1, color: 'primary.main' }}
          >
            {template?.points ?? 0}
          </Typography>
          <Typography sx={{ fontSize: 9, fontWeight: 700, color: 'text.disabled' }}>pts</Typography>
        </Stack>
      </Box>
    </Reveal>
  );
}

function ReviewPane({
  item,
  onApprove,
  onReject,
  onOverride,
}: {
  item: SubmissionQueueItem;
  onApprove: () => void;
  onReject: () => void;
  onOverride: () => void;
}) {
  const template = templateOf(item);
  const profile = isPopulated(item.internProfileId) ? item.internProfileId : null;
  const points = template?.points ?? 0;
  const flagged = isFlagged(item);

  return (
    <Card sx={{ overflow: 'visible' }}>
      <Box sx={{ p: 2.5, pb: 2 }}>
        <SectionHead
          label="Reviewing"
          caption={`Submitted ${fmtDateTime(item.submittedAt || item.createdAt)}`}
          sx={{ mb: 1.25 }}
        />
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: 'wrap' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, wordBreak: 'break-word' }}>
                {template?.title ?? 'Task'}
              </Typography>
              {template?.isMandatory && (
                <Label color="primary" variant="soft">
                  Mandatory
                </Label>
              )}
              {flagged && (
                <Label
                  color="warning"
                  variant="soft"
                  startIcon={<ReportProblemIcon sx={{ fontSize: 14 }} />}
                >
                  {item.flags.length ? `${item.flags.length} flag${item.flags.length > 1 ? 's' : ''}` : 'Check closely'}
                </Label>
              )}
              {item.status !== 'pending' && <StatusChip status={item.status} />}
            </Stack>

            <Typography variant="body2" sx={{ mt: 0.5 }}>
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

            <MetaLine parts={metaParts(item)} sx={{ mt: 0.5 }} />
          </Box>

          {/* The one display numeral on the screen: what approving costs the budget. */}
          <Stack
            alignItems="center"
            justifyContent="center"
            sx={{
              flexShrink: 0,
              minWidth: 84,
              px: 1.5,
              py: 1,
              borderRadius: 2.5,
              bgcolor: flagged ? 'warning.lighter' : 'primary.lighter',
              color: flagged ? 'warning.darker' : 'primary.dark',
            }}
          >
            <Typography
              className="tnum"
              sx={{ fontFamily: FONT_DISPLAY, fontSize: 34, fontWeight: 700, lineHeight: 1 }}
            >
              {points}
            </Typography>
            <Typography
              sx={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', opacity: 0.72, mt: 0.5 }}
            >
              POINTS
            </Typography>
          </Stack>
        </Stack>
      </Box>

      {/* What the proof is judged against — the reviewer's half of the contract. */}
      {template?.instructions && (
        <Box
          sx={{
            mx: 2.5,
            mb: 2,
            p: 2,
            borderRadius: 2,
            bgcolor: 'grey.50',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography
            variant="overline"
            sx={{ display: 'block', color: 'text.secondary', lineHeight: 1.6 }}
          >
            What they were asked to do
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {template.instructions}
          </Typography>
        </Box>
      )}

      <Box sx={{ px: 2.5, pb: 2 }}>
        <ProofPreview
          proofType={item.proofType}
          files={item.files}
          textValue={item.textValue}
          linkUrl={item.linkUrl}
          usernameValue={item.usernameValue}
          note={item.note}
          flags={item.flags}
          needsStricterReview={item.needsStricterReview}
        />

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
      </Box>

      {/* Decisions stay reachable however long the proof is. */}
      <Stack
        direction="row"
        alignItems="center"
        sx={{
          position: 'sticky',
          bottom: 0,
          zIndex: 1,
          px: 2.5,
          py: 1.5,
          gap: 1,
          flexWrap: 'wrap',
          bgcolor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
          borderBottomLeftRadius: 'inherit',
          borderBottomRightRadius: 'inherit',
        }}
      >
        <Typography variant="caption" color="text.disabled">
          j/k navigate · a approve · r reject
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <ActionButtons onApprove={onApprove} onReject={onReject} onOverride={onOverride} />
      </Stack>
    </Card>
  );
}

// ── screen ───────────────────────────────────────────────────────────────

function VerifyBody() {
  const { show, snackbar } = useSnack();
  const mdUp = useMediaQuery((t: Theme) => t.breakpoints.up('md'));
  const [track, setTrack] = useState<Track | ''>('');
  const [programId, setProgramId] = useState('');
  const [limit, setLimit] = useState(50);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [overridePoints, setOverridePoints] = useState('');
  const [rejectReason, setRejectReason] = useState('');

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

  /**
   * The view order. The page has always promised "flagged ones first" — this is
   * where that becomes true: most flags first, then oldest first so nothing rots
   * at the bottom. The raw `items` array keeps its server order, because the
   * optimistic restore below splices rows back into *that* list.
   */
  const rows = useMemo(() => {
    const visible = flaggedOnly ? items.filter(isFlagged) : items;
    return [...visible].sort((a, b) => {
      const byFlags = flagWeight(b) - flagWeight(a);
      if (byFlags) return byFlags;
      const at = new Date(a.submittedAt || a.createdAt || 0).getTime();
      const bt = new Date(b.submittedAt || b.createdAt || 0).getTime();
      return at - bt;
    });
  }, [items, flaggedOnly]);

  const rowKey = rows.map((r) => r._id).join(',');

  // Keep the review pane pointed at something real as rows leave the queue.
  useEffect(() => {
    setFocusedId((cur) => (cur && rows.some((r) => r._id === cur) ? cur : (rows[0]?._id ?? null)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowKey]);

  const listRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!focusedId) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-row-id="${focusedId}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [focusedId]);

  const focusedItem = rows.find((r) => r._id === focusedId) ?? null;

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

  const approve = async (item: SubmissionQueueItem, pointsOverride?: number) => {
    // Cheap feedback on the way out — a cleared row should feel cleared.
    playSfx('correct');
    haptic(12);
    await runOnRow(
      item,
      () => approveSubmission(item._id, pointsOverride === undefined ? {} : { pointsOverride }),
      `Approved — ${internLabel(isPopulated(item.internProfileId) ? item.internProfileId : null)}`
    );
  };

  const reject = (item: SubmissionQueueItem, reason: string) =>
    runOnRow(item, () => rejectSubmission(item._id, reason), 'Rejected — the intern can resubmit.');

  const openReject = (item: SubmissionQueueItem) => {
    setRejectReason('');
    setPending({ item, kind: 'reject' });
  };

  const openOverride = (item: SubmissionQueueItem) => {
    setOverridePoints(String(templateOf(item)?.points ?? 0));
    setPending({ item, kind: 'override' });
  };

  /** Approve the focused row and move the cursor on, so the next one is already up. */
  const advanceFrom = (item: SubmissionQueueItem) => {
    const idx = rows.findIndex((r) => r._id === item._id);
    setFocusedId(rows[idx + 1]?._id ?? rows[idx - 1]?._id ?? null);
  };

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
      if (!failedCount) celebrate();
      // Failures leave rows pending on the server — reload so the list matches it.
      if (failedCount) queue.reload();
    } catch (err) {
      queue.setData((cur) => (cur ? { ...cur, items: snapshot, total: snapshot.length } : cur));
      setSelected(batch.map((i) => i._id));
      show(errorMessage(err, 'Bulk approve failed — nothing was changed.'), 'error');
    }
  };

  // ── keyboard: j/k/a/r on md+ ───────────────────────────────────────────
  // The handler is held in a ref so the window listener is bound once per
  // breakpoint change instead of on every render.
  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandlerRef.current = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // A dialog owns the keyboard while it is open.
    if (pending || bulkOpen) return;
    const active = document.activeElement as HTMLElement | null;
    const tag = active?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || active?.isContentEditable) {
      return;
    }
    const key = e.key.toLowerCase();
    if (!['j', 'k', 'a', 'r'].includes(key)) return;
    if (!rows.length) return;
    e.preventDefault();

    const idx = rows.findIndex((r) => r._id === focusedId);
    if (key === 'j' || key === 'k') {
      const from = idx < 0 ? (key === 'j' ? -1 : 1) : idx;
      const next = key === 'j' ? Math.min(from + 1, rows.length - 1) : Math.max(from - 1, 0);
      setFocusedId(rows[next]._id);
      return;
    }
    const item = idx >= 0 ? rows[idx] : null;
    if (!item) return;
    if (key === 'a') {
      advanceFrom(item);
      void approve(item);
    } else {
      openReject(item);
    }
  };

  useEffect(() => {
    if (!mdUp) return undefined;
    const listener = (e: KeyboardEvent) => keyHandlerRef.current(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [mdUp]);

  // ── the empty queue is a win, and wins get celebrated (once a day) ─────
  const queueClear = !queue.loading && !queue.error && items.length === 0;
  useEffect(() => {
    if (queueClear) celebrateOnce(`verify-zero-${new Date().toISOString().slice(0, 10)}`);
  }, [queueClear]);

  const allSelected = rows.length > 0 && rows.every((r) => selectedSet.has(r._id));
  const flaggedCount = items.filter(isFlagged).length;

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
        <Chip
          icon={<ReportProblemIcon />}
          label="Flagged only"
          color={flaggedOnly ? 'warning' : 'default'}
          variant={flaggedOnly ? 'filled' : 'outlined'}
          onClick={() => setFlaggedOnly((v) => !v)}
          aria-pressed={flaggedOnly}
          sx={{ height: 40, borderRadius: 20, fontWeight: 600 }}
        />
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="Refresh queue">
          <IconButton onClick={queue.reload} aria-label="Refresh queue" sx={{ width: 44, height: 44 }}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      {rows.length > 0 && (
        <Stack
          direction="row"
          alignItems="center"
          sx={{
            position: 'sticky',
            top: STICKY_TOP,
            zIndex: 3,
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
            onChange={() => setSelected(allSelected ? [] : rows.map((i) => i._id))}
            inputProps={{ 'aria-label': 'Select all visible submissions' }}
          />
          <Typography variant="body2" className="tnum" sx={{ fontWeight: 600 }}>
            {selectedInView.length
              ? `${selectedInView.length} selected`
              : flaggedOnly
                ? `${rows.length} flagged of ${items.length} loaded`
                : `${rows.length} of ${total} pending`}
          </Typography>
          {!flaggedOnly && flaggedCount > 0 && (
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'warning.dark' }}>
              <ReportProblemIcon sx={{ fontSize: 15 }} />
              <Typography variant="caption" className="tnum" sx={{ fontWeight: 700 }}>
                {flaggedCount} flagged, first
              </Typography>
            </Stack>
          )}
          <Box sx={{ flexGrow: 1 }} />
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{ display: { xs: 'none', md: 'block' } }}
          >
            j/k navigate · a approve · r reject
          </Typography>
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
        skeletonRows={3}
      >
        {rows.length === 0 ? (
          items.length === 0 ? (
            <EmptyState
              art={ART.empty.inboxZero}
              title="Queue is clear"
              description="No pending submissions match these filters. Nice work."
            />
          ) : (
            <EmptyState
              art={ART.empty.search}
              title="Nothing flagged here"
              description="No submission in this batch tripped an automated check."
              action={
                <Button variant="outlined" onClick={() => setFlaggedOnly(false)}>
                  Show all {items.length}
                </Button>
              }
            />
          )
        ) : mdUp ? (
          // Split pane: scan on the left, review on the right.
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '380px minmax(0, 1fr)',
              gap: 2,
              alignItems: 'start',
            }}
          >
            <Card
              ref={listRef}
              sx={{
                position: 'sticky',
                top: LIST_TOP,
                maxHeight: LIST_MAX_H,
                overflowY: 'auto',
                overflowX: 'hidden',
              }}
            >
              {rows.map((item, i) => (
                <QueueListRow
                  key={item._id}
                  item={item}
                  index={i}
                  checked={selectedSet.has(item._id)}
                  focused={item._id === focusedId}
                  onToggle={() =>
                    setSelected((cur) =>
                      cur.includes(item._id) ? cur.filter((s) => s !== item._id) : [...cur, item._id]
                    )
                  }
                  onFocus={() => setFocusedId(item._id)}
                />
              ))}
            </Card>

            {focusedItem && (
              <ReviewPane
                key={focusedItem._id}
                item={focusedItem}
                onApprove={() => {
                  advanceFrom(focusedItem);
                  void approve(focusedItem);
                }}
                onReject={() => openReject(focusedItem)}
                onOverride={() => openOverride(focusedItem)}
              />
            )}
          </Box>
        ) : (
          <Stack spacing={1.5}>
            {rows.map((item, i) => (
              <Reveal key={item._id} index={i}>
                <QueueCard
                  item={item}
                  selected={selectedSet.has(item._id)}
                  onToggle={() =>
                    setSelected((cur) =>
                      cur.includes(item._id) ? cur.filter((s) => s !== item._id) : [...cur, item._id]
                    )
                  }
                  onApprove={() => void approve(item)}
                  onReject={() => openReject(item)}
                  onOverride={() => openOverride(item)}
                />
              </Reveal>
            ))}
          </Stack>
        )}
      </DataState>

      <ConfirmDialog
        open={!!pending && pending.kind === 'reject'}
        title="Reject this submission?"
        message="The intern sees this reason and can submit again."
        confirmLabel="Reject"
        destructive
        onClose={() => setPending(null)}
        onConfirm={async () => {
          const reason = rejectReason.trim();
          // The reason is not optional — an intern cannot fix "no".
          if (!reason) throw new Error('Add a reason — the intern sees this.');
          if (pending) await reject(pending.item, reason);
        }}
      >
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
            Common reasons
          </Typography>
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}>
            {CANNED_REASONS.map((reason) => (
              <Chip
                key={reason}
                label={reason}
                size="small"
                color={rejectReason === reason ? 'primary' : 'default'}
                variant={rejectReason === reason ? 'filled' : 'outlined'}
                onClick={() => setRejectReason(reason)}
              />
            ))}
          </Stack>
        </Box>
        <TextField
          label="Reason for rejection"
          placeholder="e.g. Screenshot does not show the post date"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          multiline
          minRows={2}
          helperText="Tap a chip or write your own — the intern sees this message."
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={!!pending && pending.kind === 'override'}
        title="Approve with custom points"
        message="Use this when the work was partial — the ledger records the amount you enter."
        confirmLabel="Approve"
        onClose={() => setPending(null)}
        onConfirm={async () => {
          const value = Number(overridePoints);
          if (!Number.isFinite(value) || value < 0) throw new Error('Enter 0 or more points');
          if (pending) {
            advanceFrom(pending.item);
            await approve(pending.item, Math.round(value));
          }
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
