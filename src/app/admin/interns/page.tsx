'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import React, { Suspense, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { DataState, errorMessage, Loading } from '@/components/DataStates';
import StatusChip from '@/components/StatusChip';
import { createIntern, listInterns, listPrograms } from '@/lib/api/adminInternship';
import type { InternStatus, Track } from '@/lib/api/types';
import AdminScreen, { useSnack } from '../_shared/AdminScreen';
import {
  asList,
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

/** Quiet caption line: dates, counts, programme names — middot separated. */
function MetaLine({ items }: { items: React.ReactNode[] }) {
  const parts = items.filter(Boolean);
  if (!parts.length) return null;
  return (
    <Stack
      direction="row"
      alignItems="center"
      sx={{
        mt: 1,
        gap: 0.75,
        flexWrap: 'wrap',
        typography: 'caption',
        color: 'text.secondary',
      }}
    >
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <Box component="span" sx={{ color: 'text.disabled' }}>
              ·
            </Box>
          )}
          {part}
        </React.Fragment>
      ))}
    </Stack>
  );
}

/**
 * One intern as a single tap target into their record. Status and track are the
 * only chips — programme, pending reviews and lifetime points are quiet text, so
 * a screen of forty interns reads as a list rather than a wall of pills.
 */
function InternCard({ intern }: { intern: InternRow }) {
  const name = internLabel(intern);
  const initial = (intern.fullName || intern.email || '?').trim().charAt(0).toUpperCase();
  const pending = intern.pendingSubmissions ?? 0;

  return (
    <Card
      sx={{
        height: '100%',
        overflow: 'hidden',
        transition: (t) =>
          t.transitions.create(['box-shadow', 'transform', 'border-color'], { duration: 200 }),
        '&:hover': {
          transform: { md: 'translateY(-2px)' },
          borderColor: 'primary.light',
          boxShadow: (t) => t.customShadows.cardHover,
        },
      }}
    >
      <CardActionArea
        component={Link}
        href={`/admin/interns/${intern._id}`}
        sx={{ p: { xs: 2, sm: 2.25 }, height: '100%', alignItems: 'flex-start' }}
      >
        <Stack direction="row" spacing={1.75} alignItems="flex-start" sx={{ width: '100%' }}>
          <Avatar
            sx={{
              flexShrink: 0,
              width: 44,
              height: 44,
              fontWeight: 800,
              bgcolor: 'primary.lighter',
              color: 'primary.dark',
            }}
          >
            {initial}
          </Avatar>

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, wordBreak: 'break-word' }}>
              {name}
            </Typography>
            {intern.fullName && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', wordBreak: 'break-all' }}
              >
                {intern.email}
              </Typography>
            )}

            <Stack direction="row" sx={{ mt: 1, gap: 0.75, flexWrap: 'wrap' }}>
              <StatusChip status={intern.status} />
              <Chip
                size="small"
                variant="outlined"
                label={titleCase(intern.track ?? 'no track')}
              />
            </Stack>

            <MetaLine
              items={[
                programNames(intern.programIds),
                `${fmtNumber(intern.totalPointsEarned ?? 0)} earned`,
                pending > 0 ? (
                  <Box component="span" sx={{ color: 'warning.dark', fontWeight: 700 }}>
                    {pending} to review
                  </Box>
                ) : null,
                !intern.userId ? (
                  <Box component="span" sx={{ color: 'text.disabled' }}>
                    Not signed in yet
                  </Box>
                ) : null,
              ]}
            />
          </Box>

          <Stack alignItems="flex-end" sx={{ flexShrink: 0, pl: 0.5 }}>
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

          <ChevronRightRoundedIcon
            sx={{ display: { xs: 'none', sm: 'block' }, color: 'text.disabled', mt: 0.5 }}
          />
        </Stack>
      </CardActionArea>
    </Card>
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

  // Debounced search — the list endpoint regex-scans email and name.
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const programs = useAsync(async () => asList<ProgramRow>(await listPrograms()), []);
  const interns = useAsync(
    () =>
      listInterns({
        q: q || undefined,
        track: track || undefined,
        status: status || undefined,
        programId: programId || undefined,
      }),
    [q, track, status, programId]
  );

  const rows = asList<InternRow>(interns.data?.items);
  const total = interns.data?.total ?? rows.length;
  const programList = asList<ProgramRow>(programs.data);
  const filtered = Boolean(q || track || status || programId);

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
      </Box>

      <Box>
        {/* Typographic section head, not a filled slab competing with the cards. */}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5, px: 0.5 }}>
          <Typography variant="overline" sx={{ color: 'primary.main' }}>
            {filtered ? 'Matching interns' : 'All interns'}
          </Typography>
          <Typography
            className="tnum"
            variant="caption"
            sx={{ color: 'text.disabled', fontWeight: 600 }}
          >
            {filtered ? `${rows.length} of ${total}` : fmtNumber(total)}
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setAddOpen(true)}
          >
            Add intern
          </Button>
        </Stack>

        <DataState
          loading={interns.loading && !interns.data}
          error={interns.error && !interns.data ? interns.error : undefined}
          onRetry={interns.reload}
          isEmpty={!rows.length}
          emptyTitle={filtered ? 'No interns match those filters' : 'No interns enrolled yet'}
          emptyDescription={
            filtered
              ? 'Try clearing a filter, or search by the email they signed up with.'
              : 'Add someone here, or bulk-enrol a whole batch from the Programs screen.'
          }
          emptyAction={
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
              Add intern
            </Button>
          }
          skeletonRows={4}
        >
          {/* Interns are compared against each other, so two-up from sm. */}
          <Grid container spacing={2}>
            {rows.map((intern) => (
              <Grid key={intern._id} size={{ xs: 12, sm: 6 }}>
                <InternCard intern={intern} />
              </Grid>
            ))}
          </Grid>
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
