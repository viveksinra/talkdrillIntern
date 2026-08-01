'use client';

import Link from 'next/link';
import React, { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Card from '@mui/material/Card';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import PublicIcon from '@mui/icons-material/Public';
import UnpublishedOutlinedIcon from '@mui/icons-material/UnpublishedOutlined';
import ConfirmDialog from '@/components/ConfirmDialog';
import { DataState, errorMessage } from '@/components/DataStates';
import EmptyState from '@/components/EmptyState';
import Label, { type LabelColor } from '@/components/Label';
import MetaLine from '@/components/MetaLine';
import Reveal from '@/components/Reveal';
import SectionHead from '@/components/SectionHead';
import { ART } from '@/lib/art';
import {
  getWaitlist,
  listAdminOpenings,
  markWaitlistContacted,
  reopenOpening,
  updateOpening,
  type AdminOpening,
  type OpeningStatus,
  type WaitlistEntry,
} from '@/lib/api/adminInternship';
import { formatStipend, LOCATION_LABEL, relativeFromNow } from '@/lib/api/openings';
import { FONT_DISPLAY, gradientTokens, textGradient } from '@/theme';
import AdminScreen, { ScrollArea, useSnack, type Snack } from '../_shared/AdminScreen';
import { fmtDate, fmtDateTime, fmtNumber } from '../_shared/adminUtils';
import { useAsync } from '../_shared/useAsync';

/**
 * The hiring board. Openings are the public funnel — everything here is either
 * "is this listing live?" or "how many people are waiting on us?", so those two
 * facts are the loudest things in every row.
 *
 * The whole board loads in one call (the endpoint caps at 200) and the status
 * tabs filter in memory. That is what makes the tab counts honest: a server-side
 * status filter can only ever tell you about the tab you are already on.
 */

const STATUS_LABELS: Record<OpeningStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  closed: 'Closed',
};

const STATUS_TONE: Record<OpeningStatus, LabelColor> = {
  draft: 'default',
  published: 'success',
  closed: 'warning',
};

const TRACK_LABELS: Record<string, string> = {
  campus: 'Campus Ambassador',
  content: 'Content Creator',
  marketing: 'Digital Marketing',
};

type TabKey = 'all' | OpeningStatus;
const TAB_KEYS: TabKey[] = ['all', 'draft', 'published', 'closed'];

/** Closed for applications even though the listing still says "published". */
function isExpired(o: AdminOpening): boolean {
  return !!o.applyBy && new Date(o.applyBy).getTime() < Date.now();
}

/**
 * A passed deadline is no longer a dead end — the listing keeps collecting
 * interest, so the fix is a new date rather than a rewrite. Drafts are left out:
 * an unpublished listing is edited, not reopened.
 */
function canReopen(o: AdminOpening): boolean {
  return isExpired(o) && o.status !== 'draft';
}

/** "1 person" / "4 people" — this phrasing shows up in four places. */
function people(n: number): string {
  return `${fmtNumber(n)} ${n === 1 ? 'person' : 'people'}`;
}

/** "3 people are waiting to hear about this role." */
function waitingSentence(n: number): string {
  return `${people(n)} ${n === 1 ? 'is' : 'are'} waiting to hear about this role.`;
}

function StatusLabel({ opening }: { opening: AdminOpening }) {
  return (
    <Stack spacing={0.5} alignItems="flex-start">
      <Label color={STATUS_TONE[opening.status] ?? 'default'} variant="soft">
        {STATUS_LABELS[opening.status] ?? opening.status}
      </Label>
      {/* Live in the list, but the deadline has passed — nobody can apply. */}
      {opening.status === 'published' && isExpired(opening) && (
        <Label color="error" variant="outlined">
          Deadline passed
        </Label>
      )}
    </Stack>
  );
}

/** Pending applications, as a pill that jumps straight to that opening's queue. */
function PendingLink({ openingId, count }: { openingId: string; count: number }) {
  return (
    <Box
      component={Link}
      href={`/admin/applications?openingId=${openingId}`}
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
      sx={{
        position: 'relative',
        zIndex: 2,
        display: 'inline-flex',
        textDecoration: 'none',
        borderRadius: 0.75,
        '&:hover > span': { filter: 'brightness(0.94)' },
      }}
    >
      <Label color="warning" variant="soft" sx={{ cursor: 'pointer' }}>
        {fmtNumber(count)} to review
      </Label>
    </Box>
  );
}

/**
 * The people who left their details after the deadline passed. On an expired row
 * this is the number worth acting on, so it is the amber one there and quiet
 * everywhere else. Opens the waitlist itself — the count is the way in.
 */
function WaitlistPill({
  opening,
  onOpen,
}: {
  opening: AdminOpening;
  onOpen: () => void;
}) {
  const count = opening.waitlistCount ?? 0;
  if (count <= 0) return null;
  const urgent = isExpired(opening);

  return (
    <Tooltip title={`See who is waiting for “${opening.title}” to run again`}>
      <ButtonBase
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onOpen();
        }}
        aria-label={`Open the waitlist — ${people(count)} waiting for ${opening.title}`}
        sx={{
          position: 'relative',
          zIndex: 2,
          borderRadius: 0.75,
          '&:hover > span': { filter: 'brightness(0.94)' },
        }}
      >
        <Label
          color={urgent ? 'warning' : 'default'}
          variant="soft"
          startIcon={<PeopleAltOutlinedIcon sx={{ fontSize: 14 }} />}
          sx={{ cursor: 'pointer' }}
        >
          {fmtNumber(count)} waiting
        </Label>
      </ButtonBase>
    </Tooltip>
  );
}

/** Offered wherever a deadline has already gone by. */
function ReopenButton({ opening, onOpen }: { opening: AdminOpening; onOpen: () => void }) {
  return (
    <Tooltip title="Give this listing a new last date to apply">
      <Box component="span" sx={{ position: 'relative', zIndex: 2 }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<EventRepeatIcon fontSize="small" />}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onOpen();
          }}
          sx={{ whiteSpace: 'nowrap' }}
        >
          Reopen
        </Button>
      </Box>
    </Tooltip>
  );
}

/**
 * Publish/unpublish without opening the editor — the one action a hiring board
 * needs at a glance. Sits above the row-wide link, hence the z-index.
 */
function PublishButton({
  opening,
  busy,
  onToggle,
}: {
  opening: AdminOpening;
  busy: boolean;
  onToggle: () => void;
}) {
  const live = opening.status === 'published';
  return (
    <Tooltip title={live ? 'Take this listing off the public site' : 'Make this listing public'}>
      <Box component="span" sx={{ position: 'relative', zIndex: 2 }}>
        <Button
          size="small"
          color={live ? 'inherit' : 'primary'}
          variant={live ? 'text' : 'outlined'}
          disabled={busy}
          startIcon={
            live ? <UnpublishedOutlinedIcon fontSize="small" /> : <PublicIcon fontSize="small" />
          }
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onToggle();
          }}
          sx={{ whiteSpace: 'nowrap' }}
        >
          {live ? 'Unpublish' : 'Publish'}
        </Button>
      </Box>
    </Tooltip>
  );
}

/** Title + slug + category — the identity cell, and the row-wide link target. */
function TitleCell({ opening }: { opening: AdminOpening }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Box
        component={Link}
        href={`/admin/openings/${opening._id}`}
        sx={{
          display: 'block',
          color: 'text.primary',
          textDecoration: 'none',
          fontWeight: 700,
          fontSize: 14,
          wordBreak: 'break-word',
          '&::after': { content: '""', position: 'absolute', inset: 0, zIndex: 1 },
        }}
      >
        {opening.title}
      </Box>
      <MetaLine
        sx={{ mt: 0.25 }}
        parts={[
          opening.category,
          `/${opening.slug}`,
          opening.activelyHiring && (
            <Box component="span" key="hiring" sx={{ color: 'success.dark', fontWeight: 700 }}>
              Actively hiring
            </Box>
          ),
        ]}
      />
    </Box>
  );
}

function rowRevealSx(index: number) {
  return {
    '@keyframes tdRowIn': {
      from: { opacity: 0, transform: 'translateY(10px)' },
      to: { opacity: 1, transform: 'translateY(0)' },
    },
    animation: 'tdRowIn .45s cubic-bezier(.16,1,.3,1) both',
    animationDelay: `${Math.min(index, 10) * 0.04}s`,
    '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
  };
}

function OpeningsTable({
  rows,
  busyId,
  onToggle,
  onWaitlist,
  onReopen,
}: {
  rows: AdminOpening[];
  busyId: string | null;
  onToggle: (o: AdminOpening) => void;
  onWaitlist: (o: AdminOpening) => void;
  onReopen: (o: AdminOpening) => void;
}) {
  const head = ['Opening', 'Status', 'Track', 'Apply by', 'Seats', 'Applications'];

  return (
    <ScrollArea>
      <Table size="small" sx={{ minWidth: 1040 }}>
        <TableHead>
          <TableRow>
            {head.map((h) => (
              <TableCell
                key={h}
                align={h === 'Seats' ? 'right' : 'left'}
                sx={{ typography: 'overline', color: 'text.secondary', whiteSpace: 'nowrap' }}
              >
                {h}
              </TableCell>
            ))}
            <TableCell sx={{ width: 240 }} />
            <TableCell sx={{ width: 40 }} />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((o, i) => {
            const pending = o.pendingApplications ?? 0;
            return (
              <TableRow
                key={o._id}
                hover
                sx={{
                  position: 'relative',
                  cursor: 'pointer',
                  '&:hover .td-chevron': { color: 'primary.main', transform: 'translateX(2px)' },
                  ...rowRevealSx(i),
                }}
              >
                <TableCell sx={{ maxWidth: 340 }}>
                  <TitleCell opening={o} />
                </TableCell>

                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <StatusLabel opening={o} />
                </TableCell>

                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {o.track ? (
                    <Label color="default" variant="soft">
                      {TRACK_LABELS[o.track] ?? o.track}
                    </Label>
                  ) : (
                    <Typography variant="caption" color="text.disabled">
                      No track
                    </Typography>
                  )}
                </TableCell>

                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Typography
                    variant="caption"
                    sx={{ color: isExpired(o) ? 'error.dark' : 'text.secondary' }}
                  >
                    {fmtDate(o.applyBy)}
                  </Typography>
                </TableCell>

                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  <Typography className="tnum" variant="body2" sx={{ fontWeight: 700 }}>
                    {fmtNumber(o.openings ?? 1)}
                  </Typography>
                </TableCell>

                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography
                      className="tnum"
                      variant="body2"
                      sx={{ fontWeight: 700, color: 'primary.main' }}
                    >
                      {fmtNumber(o.applicationCount ?? 0)}
                    </Typography>
                    {pending > 0 && <PendingLink openingId={o._id} count={pending} />}
                    <WaitlistPill opening={o} onOpen={() => onWaitlist(o)} />
                  </Stack>
                </TableCell>

                <TableCell align="right" sx={{ width: 240 }}>
                  <Stack direction="row" spacing={0.75} justifyContent="flex-end">
                    {canReopen(o) && <ReopenButton opening={o} onOpen={() => onReopen(o)} />}
                    <PublishButton
                      opening={o}
                      busy={busyId === o._id}
                      onToggle={() => onToggle(o)}
                    />
                  </Stack>
                </TableCell>

                <TableCell align="right" sx={{ width: 40 }}>
                  <ChevronRightRoundedIcon
                    className="td-chevron"
                    sx={{
                      fontSize: 20,
                      color: 'text.disabled',
                      transition: (t) =>
                        t.transitions.create(['color', 'transform'], { duration: 160 }),
                    }}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

/** The same row as a card, for widths where a six-column table would scroll. */
function OpeningRowCard({
  opening,
  index,
  busy,
  onToggle,
  onWaitlist,
  onReopen,
}: {
  opening: AdminOpening;
  index: number;
  busy: boolean;
  onToggle: () => void;
  onWaitlist: () => void;
  onReopen: () => void;
}) {
  const pending = opening.pendingApplications ?? 0;

  return (
    <Reveal index={index}>
      <Card
        sx={{
          position: 'relative',
          p: 2,
          height: '100%',
          transition: (t) =>
            t.transitions.create(['box-shadow', 'border-color'], { duration: 180 }),
          '&:hover': { boxShadow: (t) => t.customShadows.cardHover, borderColor: 'primary.light' },
        }}
      >
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <TitleCell opening={opening} />
          <Box sx={{ flexShrink: 0 }}>
            <StatusLabel opening={opening} />
          </Box>
        </Stack>

        <MetaLine
          sx={{ mt: 1 }}
          parts={[
            LOCATION_LABEL[opening.locationType],
            formatStipend(opening.stipend),
            opening.duration,
            opening.applyBy ? `apply by ${fmtDate(opening.applyBy)}` : null,
          ]}
        />

        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ mt: 1.5, flexWrap: 'wrap', gap: 1 }}
        >
          <Typography className="tnum" variant="body2" sx={{ fontWeight: 700 }}>
            {fmtNumber(opening.applicationCount ?? 0)}
            <Box component="span" sx={{ fontWeight: 500, color: 'text.secondary' }}>
              {' '}
              applications
            </Box>
          </Typography>
          {pending > 0 && <PendingLink openingId={opening._id} count={pending} />}
          <WaitlistPill opening={opening} onOpen={onWaitlist} />
          <Box sx={{ flexGrow: 1 }} />
          {canReopen(opening) && <ReopenButton opening={opening} onOpen={onReopen} />}
          <PublishButton opening={opening} busy={busy} onToggle={onToggle} />
        </Stack>
      </Card>
    </Reveal>
  );
}

// ── reopen ───────────────────────────────────────────────────────────────

/**
 * A new deadline, and nothing else. The server is the authority on "is this
 * actually in the future" — ConfirmDialog surfaces its refusal inline, so a bad
 * date is answered where the click happened instead of by a toast.
 */
function ReopenDialog({
  opening,
  onClose,
  onDone,
}: {
  opening: AdminOpening;
  onClose: () => void;
  onDone: (waitlistCount: number) => void;
}) {
  const [date, setDate] = useState('');
  const waiting = opening.waitlistCount ?? 0;
  // en-CA renders ISO-ordered dates, so this is today in the browser's own zone.
  const today = new Date().toLocaleDateString('en-CA');

  return (
    <ConfirmDialog
      open
      title={`Reopen “${opening.title}”?`}
      message="Give it a new last date to apply and it starts taking applications again."
      confirmLabel="Reopen"
      onClose={onClose}
      onConfirm={async () => {
        if (!date) throw new Error('Pick the new last date to apply.');
        // End of the chosen day, so "apply by the 20th" includes the 20th — and
        // so picking today still counts as future, which the server requires.
        const applyBy = new Date(`${date}T23:59:59`).toISOString();
        const result = await reopenOpening(opening._id, { applyBy });
        onDone(result.waitlistCount);
      }}
    >
      {waiting > 0 && (
        <Alert severity="info" icon={<PeopleAltOutlinedIcon fontSize="inherit" />}>
          {waitingSentence(waiting)}
        </Alert>
      )}
      <TextField
        label="New last date to apply"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        InputLabelProps={{ shrink: true }}
        inputProps={{ min: today }}
        autoFocus
        helperText="Applications stay open until the end of this day."
      />
      {opening.status !== 'published' && (
        <Alert severity="warning" variant="outlined">
          This listing is not published, so a new date alone will not put it back on the public
          site — publish it too.
        </Alert>
      )}
    </ConfirmDialog>
  );
}

// ── waitlist ─────────────────────────────────────────────────────────────

/** One person waiting, written the way you would read a name off a list. */
function WaitlistRow({ entry }: { entry: WaitlistEntry }) {
  const pitch = entry.pitch?.trim();

  return (
    <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, wordBreak: 'break-word' }}>
            {entry.fullName}
          </Typography>
          <Box
            component="a"
            href={`mailto:${entry.email}`}
            sx={{
              display: 'inline-block',
              fontSize: 13,
              color: 'primary.main',
              textDecoration: 'none',
              wordBreak: 'break-all',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {entry.email}
          </Box>
          <MetaLine
            sx={{ mt: 0.25 }}
            parts={[
              entry.phone,
              entry.city,
              entry.college,
              entry.graduationYear ? `Class of ${entry.graduationYear}` : null,
            ]}
          />
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.25 }}>
            Registered {relativeFromNow(entry.createdAt) || 'today'} · {fmtDate(entry.createdAt)}
          </Typography>
          {pitch && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 0.75,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {pitch}
            </Typography>
          )}
        </Box>
        {entry.contactedAt && (
          <Tooltip title={`Marked contacted ${fmtDateTime(entry.contactedAt)}`}>
            <Box component="span" sx={{ flexShrink: 0 }}>
              <Label color="success" variant="soft">
                Contacted
              </Label>
            </Box>
          </Tooltip>
        )}
      </Stack>
    </Box>
  );
}

/**
 * Everyone waiting on one listing. Deliberately a reading surface with two
 * clerical actions: this screen never sends mail, and says so, because the whole
 * promise made to these people ("we'll email you") is kept by a human.
 */
function WaitlistDrawer({
  opening,
  onClose,
  show,
}: {
  opening: AdminOpening;
  onClose: () => void;
  show: Snack['show'];
}) {
  const waitlist = useAsync(() => getWaitlist(opening._id), [opening._id]);
  const [confirmContacted, setConfirmContacted] = useState(false);
  const [rawEmails, setRawEmails] = useState(false);

  const entries = waitlist.data?.waitlist ?? [];
  const emails = waitlist.data?.emails ?? [];
  const uncontacted = waitlist.data?.uncontacted ?? 0;
  const total = waitlist.data?.total ?? entries.length;

  const copyEmails = async () => {
    if (!emails.length) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(emails.join(', '));
      show(`${emails.length} address${emails.length === 1 ? '' : 'es'} copied`);
    } catch {
      // Blocked on insecure origins and in a few browsers — put the addresses on
      // screen instead of leaving the click with nothing to show for it.
      setRawEmails(true);
      show('Could not reach the clipboard — the full list is on screen, copy it there.', 'warning');
    }
  };

  return (
    <>
      <Drawer
        anchor="right"
        open
        onClose={onClose}
        slotProps={{ paper: { sx: { width: { xs: '100%', sm: 460 }, maxWidth: '100%' } } }}
      >
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 1,
            px: 2,
            pt: 2,
            pb: 1.75,
            bgcolor: 'background.paper',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <SectionHead label="Waitlist" count={total} caption={opening.title} sx={{ mb: 0 }} />
            </Box>
            <IconButton size="small" onClick={onClose} aria-label="Close the waitlist">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Copy the addresses and mail them yourself — nothing is sent from here.
          </Typography>

          <Stack direction="row" sx={{ mt: 1.5, gap: 1, flexWrap: 'wrap' }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ContentCopyIcon fontSize="small" />}
              disabled={!emails.length}
              onClick={() => void copyEmails()}
            >
              Copy all emails
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<MarkEmailReadOutlinedIcon fontSize="small" />}
              disabled={uncontacted === 0}
              onClick={() => setConfirmContacted(true)}
              sx={{ borderColor: 'divider', color: 'text.primary' }}
            >
              {uncontacted > 0 ? `Mark all as contacted (${uncontacted})` : 'Everyone marked'}
            </Button>
          </Stack>

          {rawEmails && (
            <TextField
              value={emails.join(', ')}
              multiline
              minRows={2}
              maxRows={6}
              fullWidth
              size="small"
              sx={{ mt: 1.5 }}
              slotProps={{ htmlInput: { readOnly: true, 'aria-label': 'All waitlist addresses' } }}
            />
          )}
        </Box>

        <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
          <DataState
            loading={waitlist.loading && !waitlist.data}
            error={waitlist.error && !waitlist.data ? waitlist.error : undefined}
            onRetry={waitlist.reload}
            skeletonRows={3}
          >
            {entries.length === 0 ? (
              <Box sx={{ p: 2 }}>
                <EmptyState
                  bare
                  art={ART.empty.inboxZero}
                  title="Nobody waiting yet"
                  description="Once the deadline is past, anyone who finds this listing can still leave their details — they land here."
                />
              </Box>
            ) : (
              entries.map((entry) => <WaitlistRow key={entry._id} entry={entry} />)
            )}
          </DataState>
        </Box>
      </Drawer>

      <ConfirmDialog
        open={confirmContacted}
        title="Mark everyone as contacted?"
        message={`This only updates our own record for the ${people(
          uncontacted
        )} not marked yet. No email goes out — send that from your own inbox first.`}
        confirmLabel="Mark as contacted"
        onClose={() => setConfirmContacted(false)}
        onConfirm={async () => {
          const updated = await markWaitlistContacted(opening._id);
          show(`${people(updated)} marked as contacted`);
          waitlist.reload();
        }}
      />
    </>
  );
}

function OpeningsBody() {
  const { show, snackbar } = useSnack();
  const [tab, setTab] = useState<TabKey>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [waitlistFor, setWaitlistFor] = useState<AdminOpening | null>(null);
  const [reopenFor, setReopenFor] = useState<AdminOpening | null>(null);

  const openings = useAsync(() => listAdminOpenings(), []);
  const all = useMemo(() => openings.data ?? [], [openings.data]);

  const counts = useMemo(() => {
    const by: Record<TabKey, number> = { all: all.length, draft: 0, published: 0, closed: 0 };
    for (const o of all) if (by[o.status] !== undefined) by[o.status] += 1;
    return by;
  }, [all]);

  const rows = useMemo(
    () => (tab === 'all' ? all : all.filter((o) => o.status === tab)),
    [all, tab]
  );

  const totalApplications = all.reduce((sum, o) => sum + (o.applicationCount ?? 0), 0);
  const totalPending = all.reduce((sum, o) => sum + (o.pendingApplications ?? 0), 0);
  const totalWaiting = all.reduce((sum, o) => sum + (o.waitlistCount ?? 0), 0);

  /**
   * Optimistic: the row flips immediately and rolls back if the PUT fails. A
   * one-key body is a safe partial update — the controller patches only what it
   * is given, so nothing else on the document is touched.
   */
  const togglePublish = async (o: AdminOpening) => {
    const next: OpeningStatus = o.status === 'published' ? 'draft' : 'published';
    const previous = o.status;
    setBusyId(o._id);
    openings.setData((list) =>
      (list ?? []).map((row) => (row._id === o._id ? { ...row, status: next } : row))
    );
    try {
      await updateOpening(o._id, { status: next });
      show(next === 'published' ? `“${o.title}” is live` : `“${o.title}” is back to draft`);
    } catch (err) {
      openings.setData((list) =>
        (list ?? []).map((row) => (row._id === o._id ? { ...row, status: previous } : row))
      );
      show(errorMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Stack spacing={2.5}>
      {/* The one number a hiring board is judged on. Everything else is a row. */}
      {all.length > 0 && (
        <Card sx={{ px: { xs: 2, sm: 2.5 }, py: 2 }}>
          <Stack direction="row" spacing={2} alignItems="baseline" sx={{ flexWrap: 'wrap' }}>
            <Typography
              className="tnum"
              sx={{
                fontFamily: FONT_DISPLAY,
                fontSize: { xs: 34, sm: 42 },
                lineHeight: 1,
                ...textGradient(gradientTokens.violet),
              }}
            >
              {fmtNumber(totalApplications)}
            </Typography>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                applications across {fmtNumber(counts.published)} live listing
                {counts.published === 1 ? '' : 's'}
              </Typography>
              <MetaLine
                parts={[
                  `${fmtNumber(counts.draft)} draft`,
                  `${fmtNumber(counts.closed)} closed`,
                  totalWaiting > 0 ? (
                    <Box component="span" key="waiting" sx={{ color: 'warning.dark', fontWeight: 700 }}>
                      {people(totalWaiting)} waiting for a role to reopen
                    </Box>
                  ) : null,
                  // Only claim an empty desk when both queues really are empty.
                  totalPending === 0 && totalWaiting === 0 ? 'nothing waiting on us' : null,
                ]}
              />
            </Box>
            <Box sx={{ flexGrow: 1 }} />
            {totalPending > 0 && (
              <Button
                size="small"
                variant="outlined"
                component={Link}
                href="/admin/applications"
                sx={{ flexShrink: 0 }}
              >
                {fmtNumber(totalPending)} awaiting a decision
              </Button>
            )}
          </Stack>
        </Card>
      )}

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v as TabKey)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        {TAB_KEYS.map((key) => (
          <Tab
            key={key}
            value={key}
            label={`${key === 'all' ? 'All' : STATUS_LABELS[key]} (${fmtNumber(counts[key])})`}
          />
        ))}
      </Tabs>

      <Box>
        {rows.length > 0 && (
          <SectionHead
            label={tab === 'all' ? 'All listings' : `${STATUS_LABELS[tab as OpeningStatus]} listings`}
            count={rows.length}
            caption="Row opens the editor. Publish puts it on intern.talkdrill.com immediately."
          />
        )}

        <DataState
          loading={openings.loading && !openings.data}
          error={openings.error && !openings.data ? openings.error : undefined}
          onRetry={openings.reload}
          skeletonRows={4}
        >
          {rows.length === 0 ? (
            <EmptyState
              art={tab === 'all' ? ART.mascot.megaphone : ART.empty.search}
              title={tab === 'all' ? 'No openings yet' : `Nothing in ${STATUS_LABELS[tab as OpeningStatus]}`}
              description={
                tab === 'all'
                  ? 'Write the first listing — it goes live on the public site the moment you publish it.'
                  : 'Switch tabs to see the rest of the board.'
              }
              action={
                tab === 'all' ? (
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    component={Link}
                    href="/admin/openings/new"
                  >
                    New opening
                  </Button>
                ) : (
                  <Button variant="outlined" onClick={() => setTab('all')}>
                    Show all
                  </Button>
                )
              }
            />
          ) : (
            <>
              <Card sx={{ display: { xs: 'none', md: 'block' } }}>
                <OpeningsTable
                  rows={rows}
                  busyId={busyId}
                  onToggle={togglePublish}
                  onWaitlist={setWaitlistFor}
                  onReopen={setReopenFor}
                />
                <Divider />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', px: 2, py: 1.25 }}
                >
                  Showing {fmtNumber(rows.length)} of {fmtNumber(all.length)} listings.
                </Typography>
              </Card>

              <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                <Grid container spacing={1.5}>
                  {rows.map((o, i) => (
                    <Grid key={o._id} size={{ xs: 12, sm: 6 }}>
                      <OpeningRowCard
                        opening={o}
                        index={i}
                        busy={busyId === o._id}
                        onToggle={() => togglePublish(o)}
                        onWaitlist={() => setWaitlistFor(o)}
                        onReopen={() => setReopenFor(o)}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </>
          )}
        </DataState>
      </Box>

      {reopenFor && (
        <ReopenDialog
          opening={reopenFor}
          onClose={() => setReopenFor(null)}
          onDone={(waiting) => {
            show(
              waiting > 0
                ? `Reopened — ${people(waiting)} ${waiting === 1 ? 'is' : 'are'} waiting to hear`
                : 'Reopened — it is taking applications again'
            );
            // ConfirmDialog closes itself once onConfirm resolves.
            openings.reload();
          }}
        />
      )}

      {waitlistFor && (
        <WaitlistDrawer
          opening={waitlistFor}
          onClose={() => setWaitlistFor(null)}
          show={show}
        />
      )}

      {snackbar}
    </Stack>
  );
}

export default function AdminOpeningsPage() {
  return (
    <AdminScreen
      title="Openings"
      subtitle="The public internship listings, and how many people are waiting on us"
      back="/admin"
      action={
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          component={Link}
          href="/admin/openings/new"
        >
          New opening
        </Button>
      }
    >
      <OpeningsBody />
    </AdminScreen>
  );
}
