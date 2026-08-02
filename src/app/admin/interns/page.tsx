'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import React, { Suspense, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { DataState, errorMessage, Loading } from '@/components/DataStates';
import EmptyState from '@/components/EmptyState';
import Label, { type LabelColor } from '@/components/Label';
import MetaLine from '@/components/MetaLine';
import Reveal from '@/components/Reveal';
import SectionHead from '@/components/SectionHead';
import { statusLabel } from '@/components/StatusChip';
import { ART } from '@/lib/art';
import { createIntern, listInterns, listPrograms } from '@/lib/api/adminInternship';
import type { InternStatus, Track } from '@/lib/api/types';
import ViewAsButton from '@/components/ViewAsButton';
import AdminScreen, { ScrollArea, useSnack } from '../_shared/AdminScreen';
import {
  asList,
  fmtDate,
  fmtNumber,
  internLabel,
  programNames,
  titleCase,
  TRACKS,
  type InternRow,
  type ProgramRow,
} from '../_shared/adminUtils';
import { useAsync } from '../_shared/useAsync';

const STATUSES: InternStatus[] = ['invited', 'active', 'paused', 'completed', 'removed'];

const PAGE_SIZE_OPTIONS = [10, 25, 50];

/** Status → Label tone. Quiet by default so a screen of rows is not a rainbow. */
const STATUS_TONE: Record<InternStatus, LabelColor> = {
  invited: 'info',
  active: 'success',
  paused: 'warning',
  completed: 'primary',
  removed: 'default',
};

function statusTone(status: string): LabelColor {
  return STATUS_TONE[status as InternStatus] ?? 'default';
}

/** Initials for the avatar — first letter of the name, or of the email. */
function initialOf(intern: InternRow): string {
  return (intern.fullName || intern.email || '?').trim().charAt(0).toUpperCase();
}

/** Row entrance, applied on <tr> — Reveal renders a div, which tbody rejects. */
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

/** The warning pill that jumps straight to the queue. Dead text before. */
function ToReviewLink({ count }: { count: number }) {
  return (
    <Box
      component={Link}
      href="/admin/verify"
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
        {count} to review
      </Label>
    </Box>
  );
}

/**
 * md+ reads as a real table: one row per intern, scannable columns, whole row a
 * link into the record. Below sm the same data folds into a compact card so a
 * 390px screen is not a sideways scroll.
 */
function InternsTable({ rows }: { rows: InternRow[] }) {
  const head = ['Intern', 'Track', 'Status', 'Points', 'To review', 'Joined'];

  return (
    <ScrollArea>
      <Table size="small" sx={{ minWidth: 880 }}>
        <TableHead>
          <TableRow>
            {head.map((h) => (
              <TableCell
                key={h}
                align={h === 'Points' ? 'right' : 'left'}
                sx={{ typography: 'overline', color: 'text.secondary', whiteSpace: 'nowrap' }}
              >
                {h}
              </TableCell>
            ))}
            <TableCell sx={{ width: 40 }} />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((intern, i) => {
            const pending = intern.pendingSubmissions ?? 0;
            const href = `/admin/interns/${intern._id}`;
            return (
              <TableRow
                key={intern._id}
                hover
                sx={{
                  position: 'relative',
                  cursor: 'pointer',
                  '&:hover .td-chevron': { color: 'primary.main', transform: 'translateX(2px)' },
                  ...rowRevealSx(i),
                }}
              >
                <TableCell sx={{ maxWidth: 320 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                    <Avatar
                      sx={{
                        width: 36,
                        height: 36,
                        fontSize: 15,
                        fontWeight: 800,
                        flexShrink: 0,
                        bgcolor: 'primary.lighter',
                        color: 'primary.dark',
                      }}
                    >
                      {initialOf(intern)}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      {/* The stretched link makes the whole row a target while
                          keeping the markup valid inside <tbody>. */}
                      <Box
                        component={Link}
                        href={href}
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
                        {internLabel(intern)}
                      </Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', wordBreak: 'break-all' }}
                      >
                        {intern.email}
                      </Typography>
                    </Box>
                  </Stack>
                </TableCell>

                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {intern.track ? (
                    <Label color="default" variant="soft">
                      {titleCase(intern.track)}
                    </Label>
                  ) : (
                    <Typography variant="caption" color="text.disabled">
                      —
                    </Typography>
                  )}
                </TableCell>

                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Stack spacing={0.5} alignItems="flex-start">
                    <Label color={statusTone(intern.status)} variant="soft">
                      {statusLabel(intern.status)}
                    </Label>
                    {!intern.userId && (
                      <Label color="info" variant="outlined">
                        Not signed in yet
                      </Label>
                    )}
                  </Stack>
                </TableCell>

                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  <Typography
                    className="tnum"
                    variant="body2"
                    sx={{ fontWeight: 800, color: 'primary.main' }}
                  >
                    {fmtNumber(intern.pointsBalance ?? 0)}
                  </Typography>
                  <Typography className="tnum" variant="caption" color="text.disabled">
                    {fmtNumber(intern.totalPointsEarned ?? 0)} earned
                  </Typography>
                </TableCell>

                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {pending > 0 ? (
                    <ToReviewLink count={pending} />
                  ) : (
                    <Typography variant="caption" color="text.disabled">
                      —
                    </Typography>
                  )}
                </TableCell>

                <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>
                  <Typography variant="caption">{fmtDate(intern.createdAt)}</Typography>
                </TableCell>

                {/* Shares the trailing cell with the chevron rather than adding a
                    column, so `head` stays in step with the body. position/zIndex
                    lift the button above the row-wide overlay link on the name
                    cell, which would otherwise swallow the click. */}
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  <Stack
                    direction="row"
                    spacing={0.5}
                    alignItems="center"
                    justifyContent="flex-end"
                    sx={{ position: 'relative', zIndex: 2 }}
                  >
                    <ViewAsButton intern={intern} variant="text" />
                    <ChevronRightRoundedIcon
                      className="td-chevron"
                      sx={{
                        fontSize: 20,
                        color: 'text.disabled',
                        transition: (t) =>
                          t.transitions.create(['color', 'transform'], { duration: 160 }),
                      }}
                    />
                  </Stack>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

/** xs fallback for the table — same six facts, stacked. */
function InternCard({ intern, index }: { intern: InternRow; index: number }) {
  const pending = intern.pendingSubmissions ?? 0;

  return (
    <Reveal index={index}>
      <Card
        sx={{
          position: 'relative',
          p: 2,
          transition: (t) => t.transitions.create(['box-shadow', 'border-color'], { duration: 180 }),
          '&:hover': { boxShadow: (t) => t.customShadows.cardHover, borderColor: 'primary.light' },
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Avatar
            sx={{
              width: 36,
              height: 36,
              fontSize: 15,
              fontWeight: 800,
              flexShrink: 0,
              bgcolor: 'primary.lighter',
              color: 'primary.dark',
            }}
          >
            {initialOf(intern)}
          </Avatar>

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Box
              component={Link}
              href={`/admin/interns/${intern._id}`}
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
              {internLabel(intern)}
            </Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', wordBreak: 'break-all' }}
            >
              {intern.email}
            </Typography>

            <Stack direction="row" sx={{ mt: 1, gap: 0.75, flexWrap: 'wrap' }}>
              <Label color={statusTone(intern.status)} variant="soft">
                {statusLabel(intern.status)}
              </Label>
              {intern.track && (
                <Label color="default" variant="soft">
                  {titleCase(intern.track)}
                </Label>
              )}
              {!intern.userId && (
                <Label color="info" variant="outlined">
                  Not signed in yet
                </Label>
              )}
              {pending > 0 && <ToReviewLink count={pending} />}
            </Stack>

            <MetaLine
              sx={{ mt: 1 }}
              parts={[
                programNames(intern.programIds),
                <Box component="span" key="earned" className="tnum">
                  {fmtNumber(intern.totalPointsEarned ?? 0)} earned
                </Box>,
                `joined ${fmtDate(intern.createdAt)}`,
              ]}
            />
          </Box>

          <Stack alignItems="flex-end" sx={{ flexShrink: 0 }}>
            <Typography
              className="tnum"
              sx={{ fontWeight: 800, fontSize: 18, lineHeight: 1.1, color: 'primary.main' }}
            >
              {fmtNumber(intern.pointsBalance ?? 0)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              pts
            </Typography>
          </Stack>
        </Stack>
      </Card>
    </Reveal>
  );
}

function InternsBody() {
  const params = useSearchParams();
  const { show, snackbar } = useSnack();

  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [track, setTrack] = useState<Track | ''>('');
  const [status, setStatus] = useState<InternStatus | ''>('');
  const [programId, setProgramId] = useState(params.get('programId') ?? '');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Debounced search — the list endpoint regex-scans email and name.
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // A narrowed result set has fewer pages — page 4 of the old filter is not a
  // valid page of the new one, so every filter change goes back to the top.
  useEffect(() => {
    setPage(0);
  }, [q, track, status, programId, rowsPerPage]);

  const programs = useAsync(async () => asList<ProgramRow>(await listPrograms()), []);
  const interns = useAsync(
    () =>
      listInterns({
        q: q || undefined,
        track: track || undefined,
        status: status || undefined,
        programId: programId || undefined,
        limit: rowsPerPage,
        skip: page * rowsPerPage,
      }),
    [q, track, status, programId, page, rowsPerPage]
  );

  const rows = asList<InternRow>(interns.data?.items);
  const total = interns.data?.total ?? rows.length;
  const programList = asList<ProgramRow>(programs.data);
  const filtered = Boolean(q || track || status || programId);

  const clearFilters = () => {
    setSearch('');
    setQ('');
    setTrack('');
    setStatus('');
    setProgramId('');
  };

  const [addOpen, setAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newTrack, setNewTrack] = useState<Track | ''>('');
  const [newPrograms, setNewPrograms] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<unknown>(null);

  const addIntern = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email.includes('@')) {
      setAddError(new Error('Enter a valid email address'));
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      await createIntern({
        email,
        fullName: newName.trim() || undefined,
        track: newTrack || undefined,
        programIds: newPrograms,
      });
      setAddOpen(false);
      setNewEmail('');
      setNewName('');
      setNewPrograms([]);
      show('Intern enrolled');
      interns.reload();
    } catch (err) {
      setAddError(err);
    } finally {
      setAdding(false);
    }
  };

  return (
    <Stack spacing={2.5}>
      {/* Filters stay on one line from sm up — this is a lookup tool first —
          and wrap rather than crush the search box when the width runs out. */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          flexWrap: 'wrap',
          alignItems: { sm: 'center' },
          gap: 1.25,
        }}
      >
        <TextField
          size="small"
          label="Search name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: '1 1 220px', minWidth: { sm: 180 } }}
        />
        <TextField
          select
          size="small"
          label="Track"
          value={track}
          onChange={(e) => setTrack(e.target.value as Track | '')}
          sx={{ width: { sm: 140 }, flexShrink: 0 }}
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
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as InternStatus | '')}
          sx={{ width: { sm: 140 }, flexShrink: 0 }}
        >
          <MenuItem value="">All statuses</MenuItem>
          {STATUSES.map((s) => (
            <MenuItem key={s} value={s}>
              {titleCase(s)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Program"
          value={programId}
          onChange={(e) => setProgramId(e.target.value)}
          sx={{ width: { sm: 170 }, flexShrink: 0 }}
        >
          <MenuItem value="">All programs</MenuItem>
          {programList.map((p) => (
            <MenuItem key={p._id} value={p._id}>
              {p.name}
            </MenuItem>
          ))}
        </TextField>
        {filtered && (
          <Button size="small" color="inherit" onClick={clearFilters} sx={{ flexShrink: 0 }}>
            Clear filters
          </Button>
        )}
      </Box>

      <Box>
        <SectionHead
          label={filtered ? 'Matching interns' : 'All interns'}
          count={total}
          caption={
            total > rows.length
              ? `Showing ${fmtNumber(page * rowsPerPage + (rows.length ? 1 : 0))}–${fmtNumber(
                  page * rowsPerPage + rows.length
                )}`
              : undefined
          }
          action={
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setAddOpen(true)}
            >
              Add intern
            </Button>
          }
        />

        <DataState
          loading={interns.loading && !interns.data}
          error={interns.error && !interns.data ? interns.error : undefined}
          onRetry={interns.reload}
          skeletonRows={4}
        >
          {!rows.length ? (
            <EmptyState
              art={filtered ? ART.empty.search : ART.mascot.wave}
              title={filtered ? 'No interns match those filters' : 'No interns enrolled yet'}
              description={
                filtered
                  ? 'Try clearing a filter, or search by the email they signed up with.'
                  : 'Add someone here, or bulk-enrol a whole batch from the Programs screen.'
              }
              action={
                filtered ? (
                  <Button variant="outlined" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setAddOpen(true)}
                  >
                    Add intern
                  </Button>
                )
              }
            />
          ) : (
            <>
              {/* One table on md+, the same rows as cards below it. */}
              <Card sx={{ display: { xs: 'none', md: 'block' } }}>
                <InternsTable rows={rows} />
                <Divider />
                <TablePagination
                  component="div"
                  count={total}
                  page={page}
                  onPageChange={(_, next) => setPage(next)}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={(e) => setRowsPerPage(Number(e.target.value))}
                  rowsPerPageOptions={PAGE_SIZE_OPTIONS}
                  labelRowsPerPage="Per page"
                />
              </Card>

              <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                <Grid container spacing={1.5}>
                  {rows.map((intern, i) => (
                    <Grid key={intern._id} size={{ xs: 12, sm: 6 }}>
                      <InternCard intern={intern} index={i} />
                    </Grid>
                  ))}
                </Grid>
                <TablePagination
                  component="div"
                  count={total}
                  page={page}
                  onPageChange={(_, next) => setPage(next)}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={(e) => setRowsPerPage(Number(e.target.value))}
                  rowsPerPageOptions={PAGE_SIZE_OPTIONS}
                  labelRowsPerPage="Per page"
                  sx={{ mt: 1, '& .MuiTablePagination-toolbar': { pl: 0 } }}
                />
              </Box>
            </>
          )}
        </DataState>
      </Box>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add an intern</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {addError != null && <Alert severity="error">{errorMessage(addError)}</Alert>}
            <TextField
              label="Email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              autoFocus
              required
              helperText="Their profile links to this email on first login"
            />
            <TextField
              label="Full name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <TextField
              select
              label="Track"
              value={newTrack}
              onChange={(e) => setNewTrack(e.target.value as Track | '')}
            >
              <MenuItem value="">Decide later</MenuItem>
              {TRACKS.map((t) => (
                <MenuItem key={t} value={t}>
                  {titleCase(t)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Programs"
              value={newPrograms}
              onChange={(e) => setNewPrograms(e.target.value as unknown as string[])}
              SelectProps={{
                multiple: true,
                renderValue: (selected) => {
                  const ids = selected as string[];
                  if (!ids.length) return 'None';
                  return ids.map((id) => programList.find((p) => p._id === id)?.name ?? id).join(', ');
                },
              }}
            >
              {programList.map((p) => (
                <MenuItem key={p._id} value={p._id}>
                  <Checkbox size="small" checked={newPrograms.includes(p._id)} sx={{ mr: 1 }} />
                  {p.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setAddOpen(false)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={addIntern} disabled={adding}>
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {snackbar}
    </Stack>
  );
}

export default function AdminInternsPage() {
  return (
    <AdminScreen title="Interns" subtitle="Search, filter and open an intern's full record" back="/admin">
      <Suspense fallback={<Loading label="Loading interns…" />}>
        <InternsBody />
      </Suspense>
    </AdminScreen>
  );
}
