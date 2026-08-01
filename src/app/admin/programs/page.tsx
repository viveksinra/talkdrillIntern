'use client';

import Link from 'next/link';
import React, { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import ConfirmDialog from '@/components/ConfirmDialog';
import { DataState, errorMessage } from '@/components/DataStates';
import {
  createProgram,
  deleteProgram,
  enrollInterns,
  listPrograms,
  listRewards,
  setLeaderboardEnabled,
  updateProgram,
} from '@/lib/api/adminInternship';
import {
  refId,
  type EnrollResult,
  type ProgramInput,
  type Reward,
  type Track,
  type VideoTier,
} from '@/lib/api/types';
import AdminScreen, { useSnack } from '../_shared/AdminScreen';
import {
  asList,
  fmtDate,
  fmtMoney,
  fmtNumber,
  parseEmails,
  toDateInput,
  TRACKS,
  type ProgramRow,
} from '../_shared/adminUtils';
import { useAsync } from '../_shared/useAsync';

/**
 * Programs are the batch container: they own enrolment, the leaderboard switch and
 * the video reward tiers. Tier thresholds are data on purpose — every cohort can
 * move the 10K/50K/100K bars without a deploy.
 */

const TRACK_LABELS: Record<Track, string> = {
  campus: 'Campus Ambassador',
  content: 'Content Creator',
  marketing: 'Digital Marketing',
};

const trackLabel = (track: Track | null | undefined) =>
  track ? TRACK_LABELS[track] : 'Any track';

// ── small layout atoms ───────────────────────────────────────────────────

function Dot() {
  return (
    <Box component="span" sx={{ color: 'text.disabled' }}>
      ·
    </Box>
  );
}

/** Typographic section head — never a filled slab competing with the cards under it. */
function SectionHead({
  title,
  count,
  description,
}: {
  title: string;
  count?: string;
  description: string;
}) {
  return (
    <Box sx={{ px: 0.5, mb: 1.5 }}>
      <Stack direction="row" alignItems="baseline" spacing={1}>
        <Typography variant="overline" sx={{ color: 'primary.main' }}>
          {title}
        </Typography>
        {count && (
          <Typography
            className="tnum"
            variant="caption"
            sx={{ color: 'text.disabled', fontWeight: 600 }}
          >
            {count}
          </Typography>
        )}
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {description}
      </Typography>
    </Box>
  );
}

/** Field group inside a dialog: an overline label, one line of why, then the fields. */
function FormSection({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <Typography variant="overline" sx={{ color: 'text.secondary', display: 'block' }}>
        {label}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          {hint}
        </Typography>
      )}
      <Stack spacing={2} sx={{ mt: hint ? 0 : 1.5 }}>
        {children}
      </Stack>
    </Box>
  );
}

// ── form plumbing (unchanged wire shape) ─────────────────────────────────

interface TierRow {
  key: string;
  label: string;
  minViews: string;
  rewardId: string;
  cashAmount: string;
  sortOrder: number;
}

interface FormState {
  name: string;
  slug: string;
  track: Track | '';
  description: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  leaderboardEnabled: boolean;
  baselineMinLikes: string;
  tiers: TierRow[];
}

const EMPTY_FORM: FormState = {
  name: '',
  slug: '',
  track: '',
  description: '',
  startDate: '',
  endDate: '',
  isActive: true,
  leaderboardEnabled: false,
  baselineMinLikes: '',
  tiers: [],
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function toForm(p: ProgramRow): FormState {
  return {
    name: p.name ?? '',
    slug: p.slug ?? '',
    track: p.track ?? '',
    description: p.description ?? '',
    startDate: toDateInput(p.startDate),
    endDate: toDateInput(p.endDate),
    isActive: p.isActive !== false,
    leaderboardEnabled: !!p.leaderboardEnabled,
    baselineMinLikes: p.baselineMinLikes == null ? '' : String(p.baselineMinLikes),
    tiers: (p.videoTiers ?? [])
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((t, i) => ({
        key: t.key ?? '',
        label: t.label ?? '',
        minViews: String(t.minViews ?? 0),
        rewardId: refId(t.rewardId ?? null),
        cashAmount: String(t.cashAmount ?? 0),
        sortOrder: t.sortOrder ?? i,
      })),
  };
}

function toPayload(form: FormState): ProgramInput {
  const videoTiers: VideoTier[] = form.tiers
    .filter((t) => t.key.trim())
    .map((t, i) => ({
      key: t.key.trim(),
      label: t.label.trim() || t.key.trim(),
      minViews: Number(t.minViews) || 0,
      rewardId: t.rewardId || null,
      cashAmount: Number(t.cashAmount) || 0,
      sortOrder: Number.isFinite(t.sortOrder) ? t.sortOrder : i,
    }));

  return {
    name: form.name.trim(),
    slug: slugify(form.slug || form.name),
    track: form.track || null,
    description: form.description.trim() || undefined,
    startDate: form.startDate || undefined,
    endDate: form.endDate || undefined,
    isActive: form.isActive,
    leaderboardEnabled: form.leaderboardEnabled,
    // Blank hands the like bar back to the batch's eligibility rules.
    baselineMinLikes: form.baselineMinLikes.trim() === '' ? null : Number(form.baselineMinLikes),
    videoTiers,
  };
}

// ── tier editor ──────────────────────────────────────────────────────────

function TierEditor({
  tiers,
  rewards,
  onChange,
}: {
  tiers: TierRow[];
  rewards: Reward[];
  onChange: (next: TierRow[]) => void;
}) {
  const update = (index: number, patch: Partial<TierRow>) =>
    onChange(tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)));

  return (
    <Box>
      <Stack spacing={1.5}>
        {tiers.length === 0 && (
          <Box sx={{ px: 1.75, py: 1.5, borderRadius: 2.5, bgcolor: 'grey.100' }}>
            <Typography variant="body2" color="text.secondary">
              No tiers yet — content-track videos in this batch will unlock nothing, whatever they
              score.
            </Typography>
          </Box>
        )}
        {tiers.map((tier, index) => (
          <Box key={index} sx={{ p: 1.75, borderRadius: 2.5, bgcolor: 'grey.100' }}>
            <Grid container spacing={1.5} alignItems="center">
              <Grid size={{ xs: 6, sm: 3 }}>
                <TextField
                  size="small"
                  label="Key"
                  value={tier.key}
                  onChange={(e) => update(index, { key: e.target.value })}
                  placeholder="10k"
                  required
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <TextField
                  size="small"
                  label="Label"
                  value={tier.label}
                  onChange={(e) => update(index, { label: e.target.value })}
                  placeholder="10K views"
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <TextField
                  size="small"
                  label="Min views"
                  type="number"
                  value={tier.minViews}
                  onChange={(e) => update(index, { minViews: e.target.value })}
                  inputProps={{ min: 0 }}
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <TextField
                  size="small"
                  label="Cash (₹)"
                  type="number"
                  value={tier.cashAmount}
                  onChange={(e) => update(index, { cashAmount: e.target.value })}
                  inputProps={{ min: 0 }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 10 }}>
                <TextField
                  size="small"
                  select
                  label="Reward (optional)"
                  value={tier.rewardId}
                  onChange={(e) => update(index, { rewardId: e.target.value })}
                >
                  <MenuItem value="">No catalog reward — cash only</MenuItem>
                  {rewards.map((r) => (
                    <MenuItem key={r._id} value={r._id}>
                      {r.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 2 }}>
                <Stack direction="row" justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}>
                  <Tooltip title="Remove tier">
                    <IconButton
                      onClick={() => onChange(tiers.filter((_, i) => i !== index))}
                      aria-label={`Remove tier ${tier.key || index + 1}`}
                      sx={{
                        width: 44,
                        height: 44,
                        color: 'text.disabled',
                        '&:hover': { color: 'error.main' },
                      }}
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Grid>
            </Grid>
          </Box>
        ))}
      </Stack>
      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={() =>
          onChange([
            ...tiers,
            {
              key: '',
              label: '',
              minViews: '',
              rewardId: '',
              cashAmount: '',
              sortOrder: tiers.length,
            },
          ])
        }
        sx={{ mt: 1.5 }}
      >
        Add tier
      </Button>
    </Box>
  );
}

// ── grid card ────────────────────────────────────────────────────────────

/**
 * Programs are compared side by side (which batch is running, how big, what it
 * pays), so they sit in a grid rather than a one-column stack of short cards.
 */
function ProgramCard({
  program,
  toggling,
  onToggleLeaderboard,
  onEnrol,
  onEdit,
  onDelete,
}: {
  program: ProgramRow;
  toggling: boolean;
  onToggleLeaderboard: () => void;
  onEnrol: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const inactive = program.isActive === false;
  const tiers = (program.videoTiers ?? [])
    .slice()
    .sort((a, b) => (a.minViews ?? 0) - (b.minViews ?? 0));
  const shown = tiers.slice(0, 4);

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: (t) =>
          t.transitions.create(['box-shadow', 'transform', 'border-color'], { duration: 200 }),
        '&:hover': {
          transform: { md: 'translateY(-2px)' },
          borderColor: 'primary.light',
          boxShadow: (t) => t.customShadows.cardHover,
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1, p: { xs: 2, sm: 2.5 }, pb: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 700, flexGrow: 1, minWidth: 0, wordBreak: 'break-word' }}
          >
            {program.name}
          </Typography>
          <Chip
            size="small"
            color={inactive ? 'default' : 'success'}
            variant={inactive ? 'outlined' : 'filled'}
            label={inactive ? 'Inactive' : 'Active'}
            sx={{ flexShrink: 0 }}
          />
        </Stack>

        <Stack
          direction="row"
          alignItems="center"
          sx={{ mt: 0.5, gap: 1, flexWrap: 'wrap', typography: 'caption', color: 'text.secondary' }}
        >
          <Box component="span">/{program.slug}</Box>
          <Dot />
          <Box component="span">{trackLabel(program.track)}</Box>
          {(program.startDate || program.endDate) && (
            <>
              <Dot />
              <Box component="span">
                {fmtDate(program.startDate)} → {fmtDate(program.endDate)}
              </Box>
            </>
          )}
        </Stack>

        {program.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {program.description}
          </Typography>
        )}

        <Stack direction="row" spacing={2} sx={{ mt: 1.5 }}>
          <Box>
            <Typography
              className="tnum"
              sx={{ fontWeight: 800, fontSize: 20, lineHeight: 1.2, color: 'primary.main' }}
            >
              {fmtNumber(program.internCount ?? 0)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              interns enrolled
            </Typography>
          </Box>
          {program.baselineMinLikes != null && (
            <Box>
              <Typography className="tnum" sx={{ fontWeight: 800, fontSize: 20, lineHeight: 1.2 }}>
                {fmtNumber(program.baselineMinLikes)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                likes to count
              </Typography>
            </Box>
          )}
        </Stack>

        {shown.length > 0 && (
          <Box sx={{ mt: 1.75, px: 1.5, py: 1.25, borderRadius: 2.5, bgcolor: 'grey.100' }}>
            <Typography variant="overline" sx={{ color: 'text.secondary' }}>
              Video reward tiers
            </Typography>
            <Stack spacing={0.5} sx={{ mt: 0.5 }}>
              {shown.map((t) => (
                <Stack key={t.key} direction="row" alignItems="baseline" spacing={1}>
                  <Typography
                    className="tnum"
                    variant="caption"
                    sx={{ fontWeight: 700, minWidth: 92 }}
                  >
                    {fmtNumber(t.minViews)} views
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    →
                  </Typography>
                  <Typography className="tnum" variant="caption" sx={{ fontWeight: 700 }}>
                    {fmtMoney(t.cashAmount)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {t.label || t.key}
                  </Typography>
                </Stack>
              ))}
              {tiers.length > shown.length && (
                <Typography variant="caption" color="text.secondary">
                  +{tiers.length - shown.length} more
                </Typography>
              )}
            </Stack>
          </Box>
        )}

        <FormControlLabel
          sx={{ mt: 1.25, ml: -0.5 }}
          control={
            <Switch
              size="small"
              checked={!!program.leaderboardEnabled}
              onChange={onToggleLeaderboard}
              disabled={toggling}
            />
          }
          label={
            <Typography variant="caption" color="text.secondary">
              Leaderboard visible to interns
            </Typography>
          }
        />
      </CardContent>

      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ px: { xs: 2, sm: 2.5 }, pb: 2, flexWrap: 'wrap', gap: 1 }}
      >
        <Button size="small" variant="contained" startIcon={<GroupAddIcon />} onClick={onEnrol}>
          Enrol
        </Button>
        <Button size="small" color="inherit" startIcon={<EditIcon />} onClick={onEdit}>
          Edit
        </Button>
        <Button
          size="small"
          color="inherit"
          component={Link}
          href={`/admin/interns?programId=${program._id}`}
        >
          Interns
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="Delete program">
          <IconButton
            size="small"
            onClick={onDelete}
            aria-label={`Delete ${program.name}`}
            sx={{ width: 44, height: 44, color: 'text.disabled', '&:hover': { color: 'error.main' } }}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Card>
  );
}

// ── screen ───────────────────────────────────────────────────────────────

function ProgramsBody() {
  const { show, snackbar } = useSnack();
  const programs = useAsync(async () => asList<ProgramRow>(await listPrograms()), []);
  const rewards = useAsync(async () => asList<Reward>(await listRewards()), []);
  const rows = programs.data ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProgramRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<unknown>(null);

  const [deleting, setDeleting] = useState<ProgramRow | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [enrollFor, setEnrollFor] = useState<ProgramRow | null>(null);
  const [enrollText, setEnrollText] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<unknown>(null);
  const [enrollResult, setEnrollResult] = useState<EnrollResult | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (p: ProgramRow) => {
    setEditing(p);
    setForm(toForm(p));
    setFormError(null);
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      setFormError(new Error('Name is required'));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = toPayload(form);
      if (editing) await updateProgram(editing._id, payload);
      else await createProgram(payload);
      setFormOpen(false);
      show(editing ? 'Program updated' : 'Program created');
      programs.reload();
    } catch (err) {
      setFormError(err);
    } finally {
      setSaving(false);
    }
  };

  const toggleLeaderboard = async (p: ProgramRow) => {
    const next = !p.leaderboardEnabled;
    setTogglingId(p._id);
    // Optimistic — the switch must feel instant; reverted below on failure.
    programs.setData((cur) =>
      (cur ?? []).map((row) => (row._id === p._id ? { ...row, leaderboardEnabled: next } : row))
    );
    try {
      await setLeaderboardEnabled(p._id, next);
      show(`Leaderboard ${next ? 'enabled' : 'disabled'} for ${p.name}`);
    } catch (err) {
      programs.setData((cur) =>
        (cur ?? []).map((row) =>
          row._id === p._id ? { ...row, leaderboardEnabled: !next } : row
        )
      );
      show(errorMessage(err, 'Could not change the leaderboard setting'), 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const runEnroll = async () => {
    if (!enrollFor) return;
    const emails = parseEmails(enrollText);
    if (!emails.length) {
      setEnrollError(new Error('Paste at least one email address'));
      return;
    }
    setEnrolling(true);
    setEnrollError(null);
    try {
      const result = await enrollInterns(enrollFor._id, emails);
      setEnrollResult(result);
      show(`${result.createdCount} created, ${result.updatedCount} already on file`, 'success');
      programs.reload();
    } catch (err) {
      setEnrollError(err);
    } finally {
      setEnrolling(false);
    }
  };

  const activeCount = rows.filter((p) => p.isActive !== false).length;
  const internTotal = rows.reduce((sum, p) => sum + (p.internCount ?? 0), 0);

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" justifyContent="flex-end">
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          New program
        </Button>
      </Stack>

      <Box>
        {rows.length > 0 && (
          <SectionHead
            title="Batches"
            count={`${activeCount} active of ${rows.length} · ${fmtNumber(internTotal)} interns`}
            description="A program holds enrolment, the leaderboard switch and the video reward tiers for one cohort."
          />
        )}

        <DataState
          loading={programs.loading && !programs.data}
          error={programs.error && !programs.data ? programs.error : undefined}
          onRetry={programs.reload}
          isEmpty={!rows.length}
          emptyTitle="No programs yet"
          emptyDescription="A program is one intern batch — it holds enrolment, the leaderboard switch and the video tiers."
          emptyAction={
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              New program
            </Button>
          }
          skeletonRows={2}
        >
          <Grid container spacing={2}>
            {rows.map((p) => (
              <Grid key={p._id} size={{ xs: 12, sm: 6 }}>
                <ProgramCard
                  program={p}
                  toggling={togglingId === p._id}
                  onToggleLeaderboard={() => toggleLeaderboard(p)}
                  onEdit={() => openEdit(p)}
                  onDelete={() => setDeleting(p)}
                  onEnrol={() => {
                    setEnrollFor(p);
                    setEnrollText('');
                    setEnrollError(null);
                    setEnrollResult(null);
                  }}
                />
              </Grid>
            ))}
          </Grid>
        </DataState>
      </Box>

      {/* ── program form ── */}
      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        fullWidth
        maxWidth="md"
        scroll="paper"
      >
        <DialogTitle sx={{ pb: 1 }}>
          {editing ? 'Edit program' : 'New program'}
          <Typography variant="body2" color="text.secondary">
            {editing
              ? 'Tier and baseline changes apply to videos evaluated from now on.'
              : 'One batch of interns, with its own reward thresholds.'}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ py: 1 }}>
            {formError != null && <Alert severity="error">{errorMessage(formError)}</Alert>}

            <FormSection label="The batch" hint="The slug appears in intern-facing links.">
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Name"
                    value={form.name}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        name: e.target.value,
                        // Slug follows the name until it is edited by hand.
                        slug: editing ? form.slug : slugify(e.target.value),
                      })
                    }
                    required
                    autoFocus
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Slug"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    helperText="Lowercase, unique"
                    required
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    select
                    label="Track"
                    value={form.track}
                    onChange={(e) => setForm({ ...form, track: e.target.value as Track | '' })}
                  >
                    <MenuItem value="">Any track</MenuItem>
                    {TRACKS.map((t) => (
                      <MenuItem key={t} value={t}>
                        {TRACK_LABELS[t]}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <TextField
                    label="Start date"
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <TextField
                    label="End date"
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
              <TextField
                label="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                multiline
                minRows={2}
              />
            </FormSection>

            <FormSection label="Visibility">
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1, sm: 3 }}>
                <Box>
                  <FormControlLabel
                    sx={{ m: 0 }}
                    control={
                      <Switch
                        checked={form.isActive}
                        onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      />
                    }
                    label={<Typography variant="body2">Active</Typography>}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', pl: 7.25 }}>
                    Inactive batches accept no new enrolments.
                  </Typography>
                </Box>
                <Box>
                  <FormControlLabel
                    sx={{ m: 0 }}
                    control={
                      <Switch
                        checked={form.leaderboardEnabled}
                        onChange={(e) =>
                          setForm({ ...form, leaderboardEnabled: e.target.checked })
                        }
                      />
                    }
                    label={<Typography variant="body2">Leaderboard visible</Typography>}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', pl: 7.25 }}>
                    Interns in this batch can see each other&apos;s ranking.
                  </Typography>
                </Box>
              </Stack>
            </FormSection>

            <FormSection
              label="What this batch pays"
              hint="Everything below moves real money — a video locks the single highest tier its 30-day views qualify for, and tiers never stack."
            >
              <Box sx={{ px: 1.75, py: 1.5, borderRadius: 2.5, bgcolor: 'warning.lighter' }}>
                <TextField
                  label="Baseline likes per video"
                  type="number"
                  value={form.baselineMinLikes}
                  onChange={(e) => setForm({ ...form, baselineMinLikes: e.target.value })}
                  inputProps={{ min: 0 }}
                  sx={{ maxWidth: { sm: 320 } }}
                />
                <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'warning.darker' }}>
                  Likes a video must clear to count toward the monthly stipend baseline. Leave blank
                  to use this batch&apos;s eligibility rules instead.
                </Typography>
              </Box>
              <TierEditor
                tiers={form.tiers}
                rewards={asList<Reward>(rewards.data)}
                onChange={(tiers) => setForm({ ...form, tiers })}
              />
            </FormSection>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button color="inherit" onClick={() => setFormOpen(false)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={save} disabled={saving} loading={saving}>
            {editing ? 'Save changes' : 'Create program'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── enrol ── */}
      <Dialog open={!!enrollFor} onClose={() => setEnrollFor(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ pb: 1 }}>
          Enrol interns
          <Typography variant="body2" color="text.secondary">
            {enrollFor?.name}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ py: 1 }}>
            {enrollError != null && <Alert severity="error">{errorMessage(enrollError)}</Alert>}
            {enrollResult && (
              <Alert severity="success">
                <Box component="span" className="tnum">
                  {enrollResult.createdCount}
                </Box>{' '}
                new profile(s),{' '}
                <Box component="span" className="tnum">
                  {enrollResult.updatedCount}
                </Box>{' '}
                already existed.
                {enrollResult.invalid.length > 0 && (
                  <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
                    {enrollResult.invalid.slice(0, 8).map((r, i) => (
                      <li key={`${r.email}-${i}`}>
                        <Typography variant="caption">
                          {r.email} — {r.reason}
                        </Typography>
                      </li>
                    ))}
                  </Box>
                )}
              </Alert>
            )}
            <TextField
              label="Email addresses"
              value={enrollText}
              onChange={(e) => setEnrollText(e.target.value)}
              multiline
              minRows={6}
              placeholder={'one@example.com\ntwo@example.com'}
              helperText={`${parseEmails(enrollText).length} valid email(s) detected. New profiles start as "invited" and link on first login.`}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button color="inherit" onClick={() => setEnrollFor(null)}>
            Close
          </Button>
          <Button variant="contained" onClick={runEnroll} disabled={enrolling} loading={enrolling}>
            Enrol
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        title="Delete this program?"
        message={
          deleting
            ? `“${deleting.name}” will be removed. Programs with enrolled interns are deactivated instead of deleted.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await deleteProgram(deleting._id);
          show('Program deleted');
          programs.reload();
        }}
      />

      {snackbar}
    </Stack>
  );
}

export default function AdminProgramsPage() {
  return (
    <AdminScreen
      title="Programs"
      subtitle="Batches, enrolment, leaderboard visibility and video reward tiers"
      back="/admin"
    >
      <ProgramsBody />
    </AdminScreen>
  );
}
