'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
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
import Alert from '@mui/material/Alert';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import SendIcon from '@mui/icons-material/Send';
import ConfirmDialog from '@/components/ConfirmDialog';
import { DataState, errorMessage } from '@/components/DataStates';
import {
  createAssignments,
  createTaskTemplate,
  deleteTaskTemplate,
  listPrograms,
  listTaskTemplates,
  updateTaskTemplate,
} from '@/lib/api/adminInternship';
import {
  refId,
  type AssignmentBulkResult,
  type ProofType,
  type TaskCadence,
  type TaskTemplate,
  type TaskTemplateInput,
  type Track,
} from '@/lib/api/types';
import AdminScreen, { useSnack } from '../_shared/AdminScreen';
import {
  asList,
  CADENCES,
  fmtDate,
  parseEmails,
  PROOF_TYPES,
  titleCase,
  toDateInput,
  TRACKS,
  type ProgramRow,
} from '../_shared/adminUtils';
import { useAsync } from '../_shared/useAsync';

/** Task templates + the bulk-assign action that turns one into real work. */

// ── vocabulary ───────────────────────────────────────────────────────────

const TRACK_LABELS: Record<Track, string> = {
  campus: 'Campus Ambassador',
  content: 'Content Creator',
  marketing: 'Digital Marketing',
};

const CADENCE_LABELS: Record<TaskCadence, string> = {
  'one-time': 'One-time',
  'daily-streak': 'Daily streak',
  recurring: 'Recurring monthly',
};

const CADENCE_HELP: Record<TaskCadence, string> = {
  'one-time': 'Assigned once. The intern submits proof a single time.',
  'daily-streak': 'The intern can submit every day; streaks build points.',
  recurring: 'Buckets per month, so monthly stipend rules can count it.',
};

const PROOF_LABELS: Record<ProofType, string> = {
  screenshot: 'Screenshot',
  link: 'Link',
  text: 'Text',
  username: 'Username',
  'video-metric': 'Video metric',
  file: 'File',
};

const trackLabel = (track: Track | null | undefined) =>
  track ? TRACK_LABELS[track] : 'Any track';

// ── small layout atoms ───────────────────────────────────────────────────

/** Quiet middot between two pieces of metadata. */
function Dot() {
  return (
    <Box component="span" sx={{ color: 'text.disabled' }}>
      ·
    </Box>
  );
}

/** Typographic section head — never a filled slab that competes with the cards. */
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

/**
 * A toggle that changes what the programme owes people. It gets a tinted block and
 * a one-line consequence so nobody flips it by accident in a wall of switches.
 */
function ConsequenceSwitch({
  checked,
  onChange,
  label,
  help,
  tone = 'primary',
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  help: string;
  tone?: 'primary' | 'warning';
}) {
  return (
    <Box
      sx={{
        px: 1.75,
        py: 1.25,
        borderRadius: 2.5,
        bgcolor: checked ? `${tone}.lighter` : 'grey.100',
        transition: (t) => t.transitions.create('background-color', { duration: 160 }),
      }}
    >
      <FormControlLabel
        sx={{ m: 0, display: 'flex' }}
        control={
          <Switch color={tone} checked={checked} onChange={(e) => onChange(e.target.checked)} />
        }
        label={
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {label}
          </Typography>
        }
      />
      <Typography
        variant="caption"
        sx={{ display: 'block', pl: 7.25, color: checked ? `${tone}.darker` : 'text.secondary' }}
      >
        {help}
      </Typography>
    </Box>
  );
}

// ── form plumbing (unchanged wire shape) ─────────────────────────────────

interface FormState {
  title: string;
  description: string;
  instructions: string;
  track: Track | '';
  points: string;
  proofType: TaskTemplateInput['proofType'];
  cadence: TaskTemplateInput['cadence'];
  isMandatory: boolean;
  requiresDashboardProof: boolean;
  isActive: boolean;
  category: string;
  tags: string;
  deadline: string;
  programIds: string[];
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  instructions: '',
  track: '',
  points: '10',
  proofType: 'screenshot',
  cadence: 'one-time',
  isMandatory: false,
  requiresDashboardProof: false,
  isActive: true,
  category: '',
  tags: '',
  deadline: '',
  programIds: [],
};

function toForm(t: TaskTemplate): FormState {
  return {
    title: t.title ?? '',
    description: t.description ?? '',
    instructions: t.instructions ?? '',
    track: t.track ?? '',
    points: String(t.points ?? 0),
    proofType: t.proofType,
    cadence: t.cadence,
    isMandatory: !!t.isMandatory,
    requiresDashboardProof: !!t.requiresDashboardProof,
    isActive: t.isActive !== false,
    category: t.category ?? '',
    tags: (t.tags ?? []).join(', '),
    deadline: toDateInput(t.deadline),
    programIds: (t.programIds ?? []).map((p) => refId(p)).filter(Boolean),
  };
}

function toPayload(form: FormState): TaskTemplateInput {
  return {
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    instructions: form.instructions.trim() || undefined,
    track: form.track || null,
    points: Number(form.points) || 0,
    proofType: form.proofType,
    cadence: form.cadence,
    isMandatory: form.isMandatory,
    requiresDashboardProof: form.requiresDashboardProof,
    isActive: form.isActive,
    category: form.category.trim() || undefined,
    tags: form.tags
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    deadline: form.deadline || undefined,
    programIds: form.programIds,
  };
}

// ── list row ─────────────────────────────────────────────────────────────

/**
 * One template as a full-width row: this is a queue of work definitions, read top
 * to bottom, so it stays a single column. Points lead (same block as the intern's
 * task card), the taxonomy is quiet text and only Mandatory/Inactive get a chip.
 */
function TemplateCard({
  template,
  programs,
  onEdit,
  onAssign,
  onDelete,
}: {
  template: TaskTemplate;
  programs: ProgramRow[];
  onEdit: () => void;
  onAssign: () => void;
  onDelete: () => void;
}) {
  const names = (template.programIds ?? [])
    .map((p) => programs.find((prog) => prog._id === refId(p))?.name)
    .filter(Boolean) as string[];
  const inactive = template.isActive === false;

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
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 2.5 }, pb: 1.5 }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Stack
            alignItems="center"
            justifyContent="center"
            sx={{
              flexShrink: 0,
              width: 56,
              height: 56,
              borderRadius: 2.5,
              bgcolor: inactive ? 'grey.200' : 'primary.lighter',
              color: inactive ? 'text.disabled' : 'primary.dark',
            }}
          >
            <Typography className="tnum" sx={{ fontWeight: 800, fontSize: 18, lineHeight: 1 }}>
              {template.points ?? 0}
            </Typography>
            <Typography sx={{ fontSize: 10, fontWeight: 600, opacity: 0.8, mt: 0.25 }}>
              pts
            </Typography>
          </Stack>

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 700, flexGrow: 1, minWidth: 0, wordBreak: 'break-word' }}
              >
                {template.title}
              </Typography>
              {template.isMandatory && (
                <Chip size="small" color="primary" label="Mandatory" sx={{ flexShrink: 0 }} />
              )}
              {inactive && (
                <Chip size="small" variant="outlined" label="Inactive" sx={{ flexShrink: 0 }} />
              )}
            </Stack>

            {template.description && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mt: 0.5,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {template.description}
              </Typography>
            )}

            {/* Taxonomy as quiet text — six chips in a row read as decoration. */}
            <Stack
              direction="row"
              alignItems="center"
              sx={{
                mt: 1.25,
                gap: 1,
                flexWrap: 'wrap',
                typography: 'caption',
                color: 'text.secondary',
              }}
            >
              <Box component="span">{trackLabel(template.track)}</Box>
              <Dot />
              <Box component="span">{CADENCE_LABELS[template.cadence] ?? template.cadence}</Box>
              <Dot />
              <Box component="span">
                {PROOF_LABELS[template.proofType] ?? titleCase(template.proofType)} proof
              </Box>
              {template.requiresDashboardProof && (
                <>
                  <Dot />
                  <Box component="span">+ dashboard screenshot</Box>
                </>
              )}
              {template.category && (
                <>
                  <Dot />
                  <Box component="span">{template.category}</Box>
                </>
              )}
              {template.deadline && (
                <>
                  <Dot />
                  <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Due {fmtDate(template.deadline)}
                  </Box>
                </>
              )}
            </Stack>

            <Typography
              variant="caption"
              sx={{ display: 'block', mt: 0.5, color: names.length ? 'text.secondary' : 'text.disabled' }}
            >
              {names.length ? `Programs: ${names.join(', ')}` : 'Not linked to any program'}
            </Typography>
          </Box>
        </Stack>
      </CardContent>

      {/* Compact, right-aligned actions — never a column of full-width slabs. */}
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ px: { xs: 2, sm: 2.5 }, pb: 2, pt: 0 }}
      >
        <Button size="small" variant="contained" startIcon={<SendIcon />} onClick={onAssign}>
          Assign
        </Button>
        <Button size="small" color="inherit" startIcon={<EditIcon />} onClick={onEdit}>
          Edit
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="Delete template">
          <IconButton
            size="small"
            onClick={onDelete}
            aria-label={`Delete ${template.title}`}
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

function TasksBody() {
  const { show, snackbar } = useSnack();
  const [trackFilter, setTrackFilter] = useState<Track | ''>('');
  const [programFilter, setProgramFilter] = useState('');

  const programs = useAsync(async () => asList<ProgramRow>(await listPrograms()), []);
  const templates = useAsync(
    async () =>
      asList<TaskTemplate>(
        await listTaskTemplates({
          track: trackFilter || undefined,
          programId: programFilter || undefined,
        })
      ),
    [trackFilter, programFilter]
  );

  const programList = asList<ProgramRow>(programs.data);
  const rows = templates.data ?? [];

  const [editing, setEditing] = useState<TaskTemplate | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<unknown>(null);

  const [deleting, setDeleting] = useState<TaskTemplate | null>(null);

  const [assignFor, setAssignFor] = useState<TaskTemplate | null>(null);
  const [assignMode, setAssignMode] = useState<'emails' | 'program'>('emails');
  const [assignEmails, setAssignEmails] = useState('');
  const [assignProgram, setAssignProgram] = useState('');
  const [assignDue, setAssignDue] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<unknown>(null);
  const [assignResult, setAssignResult] = useState<AssignmentBulkResult | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, programIds: programFilter ? [programFilter] : [] });
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (t: TaskTemplate) => {
    setEditing(t);
    setForm(toForm(t));
    setFormError(null);
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) {
      setFormError(new Error('Title is required'));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = toPayload(form);
      if (editing) await updateTaskTemplate(editing._id, payload);
      else await createTaskTemplate(payload);
      setFormOpen(false);
      show(editing ? 'Template updated' : 'Template created');
      templates.reload();
    } catch (err) {
      setFormError(err);
    } finally {
      setSaving(false);
    }
  };

  const openAssign = (t: TaskTemplate) => {
    setAssignFor(t);
    setAssignMode('emails');
    setAssignEmails('');
    setAssignProgram(programFilter || refId(t.programIds?.[0]) || '');
    setAssignDue(toDateInput(t.deadline));
    setAssignError(null);
    setAssignResult(null);
  };

  const runAssign = async () => {
    if (!assignFor) return;
    const emails = assignMode === 'emails' ? parseEmails(assignEmails) : [];
    if (assignMode === 'emails' && !emails.length) {
      setAssignError(new Error('Paste at least one email address'));
      return;
    }
    if (assignMode === 'program' && !assignProgram) {
      setAssignError(new Error('Pick a program'));
      return;
    }
    setAssigning(true);
    setAssignError(null);
    try {
      const result = await createAssignments({
        templateId: assignFor._id,
        emails: assignMode === 'emails' ? emails : undefined,
        programId: assignMode === 'program' ? assignProgram : undefined,
        dueDate: assignDue || undefined,
      });
      setAssignResult(result);
      show(
        `${result.createdCount} assigned${result.skippedCount ? `, ${result.skippedCount} skipped` : ''}`,
        result.createdCount ? 'success' : 'warning'
      );
    } catch (err) {
      setAssignError(err);
    } finally {
      setAssigning(false);
    }
  };

  const mandatoryCount = rows.filter((t) => t.isMandatory).length;
  const filtered = !!trackFilter || !!programFilter;

  return (
    <Stack spacing={2.5}>
      {/* Toolbar: filters left, the one primary action right. */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', sm: 'center' }}
      >
        <TextField
          select
          size="small"
          label="Track"
          value={trackFilter}
          onChange={(e) => setTrackFilter(e.target.value as Track | '')}
          sx={{ width: { xs: '100%', sm: 190 } }}
        >
          <MenuItem value="">All tracks</MenuItem>
          {TRACKS.map((t) => (
            <MenuItem key={t} value={t}>
              {TRACK_LABELS[t]}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Program"
          value={programFilter}
          onChange={(e) => setProgramFilter(e.target.value)}
          sx={{ width: { xs: '100%', sm: 210 } }}
        >
          <MenuItem value="">All programs</MenuItem>
          {programList.map((p) => (
            <MenuItem key={p._id} value={p._id}>
              {p.name}
            </MenuItem>
          ))}
        </TextField>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
          sx={{ flexShrink: 0 }}
        >
          New template
        </Button>
      </Stack>

      <Box>
        {rows.length > 0 && (
          <SectionHead
            title={filtered ? 'Matching templates' : 'All templates'}
            count={`${rows.length} template${rows.length === 1 ? '' : 's'}${
              mandatoryCount ? ` · ${mandatoryCount} mandatory` : ''
            }`}
            description="Each template is a piece of work defined once, then assigned to interns or whole batches."
          />
        )}

        <DataState
          loading={templates.loading && !templates.data}
          error={templates.error && !templates.data ? templates.error : undefined}
          onRetry={templates.reload}
          isEmpty={!rows.length}
          emptyTitle={filtered ? 'No templates match these filters' : 'No task templates yet'}
          emptyDescription={
            filtered
              ? 'Clear the track or program filter, or create a template for this batch.'
              : 'Create a template, then assign it to a program or to specific interns.'
          }
          emptyAction={
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              New template
            </Button>
          }
          skeletonRows={3}
        >
          <Stack spacing={1.5}>
            {rows.map((t) => (
              <TemplateCard
                key={t._id}
                template={t}
                programs={programList}
                onEdit={() => openEdit(t)}
                onAssign={() => openAssign(t)}
                onDelete={() => setDeleting(t)}
              />
            ))}
          </Stack>
        </DataState>
      </Box>

      {/* ── template form ── */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} fullWidth maxWidth="sm" scroll="paper">
        <DialogTitle sx={{ pb: 1 }}>
          {editing ? 'Edit task template' : 'New task template'}
          <Typography variant="body2" color="text.secondary">
            {editing
              ? 'Changes apply to future assignments; work already assigned keeps its copy.'
              : 'Define the work once — you assign it in the next step.'}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ py: 1 }}>
            {formError != null && <Alert severity="error">{errorMessage(formError)}</Alert>}

            <FormSection label="The work" hint="What the intern sees on their task card.">
              <TextField
                label="Title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                autoFocus
              />
              <TextField
                label="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                multiline
                minRows={2}
                helperText="Short summary shown on the intern's task card"
              />
              <TextField
                label="Instructions"
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                multiline
                minRows={3}
                helperText="Step-by-step detail, including what proof to attach"
              />
            </FormSection>

            <FormSection
              label="Reward and proof"
              hint="Points are credited automatically the moment a submission is approved."
            >
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Points"
                    type="number"
                    value={form.points}
                    onChange={(e) => setForm({ ...form, points: e.target.value })}
                    inputProps={{ min: 0, step: 1 }}
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    select
                    label="Proof type"
                    value={form.proofType}
                    onChange={(e) =>
                      setForm({ ...form, proofType: e.target.value as FormState['proofType'] })
                    }
                  >
                    {PROOF_TYPES.map((p) => (
                      <MenuItem key={p} value={p}>
                        {PROOF_LABELS[p]}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    select
                    label="Cadence"
                    value={form.cadence}
                    onChange={(e) =>
                      setForm({ ...form, cadence: e.target.value as FormState['cadence'] })
                    }
                    helperText={CADENCE_HELP[form.cadence as TaskCadence]}
                  >
                    {CADENCES.map((c) => (
                      <MenuItem key={c} value={c}>
                        {CADENCE_LABELS[c]}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>
            </FormSection>

            <FormSection label="Who gets it" hint="Leave both open to reuse this across every batch.">
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
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
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Deadline"
                    type="date"
                    value={form.deadline}
                    onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                    helperText="Optional — can be overridden per assignment"
                  />
                </Grid>
              </Grid>
              <TextField
                select
                label="Programs"
                value={form.programIds}
                onChange={(e) =>
                  setForm({ ...form, programIds: e.target.value as unknown as string[] })
                }
                SelectProps={{
                  multiple: true,
                  renderValue: (selected) => {
                    const ids = selected as string[];
                    if (!ids.length) return 'None';
                    return ids
                      .map((id) => programList.find((p) => p._id === id)?.name ?? id)
                      .join(', ');
                  },
                }}
                helperText="A template can belong to several batches"
              >
                {programList.map((p) => (
                  <MenuItem key={p._id} value={p._id}>
                    <Checkbox size="small" checked={form.programIds.includes(p._id)} sx={{ mr: 1 }} />
                    {p.name}
                  </MenuItem>
                ))}
              </TextField>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Category"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    helperText="Optional grouping label"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Tags"
                    value={form.tags}
                    onChange={(e) => setForm({ ...form, tags: e.target.value })}
                    helperText="Comma separated"
                  />
                </Grid>
              </Grid>
            </FormSection>

            <FormSection
              label="Rules that cost money"
              hint="These two decide whether the work counts toward a stipend."
            >
              <ConsequenceSwitch
                checked={form.isMandatory}
                onChange={(next) => setForm({ ...form, isMandatory: next })}
                label="Mandatory"
                help="Counts toward stipend eligibility and the certificate. Interns cannot skip it."
              />
              <ConsequenceSwitch
                tone="warning"
                checked={form.requiresDashboardProof}
                onChange={(next) => setForm({ ...form, requiresDashboardProof: next })}
                label="Requires a dashboard screenshot"
                help="Reviewers must see analytics, not just the post. Slower to verify — use it where numbers matter."
              />
              <FormControlLabel
                sx={{ pl: 0.5 }}
                control={
                  <Switch
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />
                }
                label={
                  <Typography variant="body2">
                    Active — can be assigned to interns
                  </Typography>
                }
              />
            </FormSection>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button color="inherit" onClick={() => setFormOpen(false)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={save} disabled={saving} loading={saving}>
            {editing ? 'Save changes' : 'Create template'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── assign ── */}
      <Dialog open={!!assignFor} onClose={() => setAssignFor(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ pb: 1 }}>
          Assign this task
          <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
            {assignFor?.title}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ py: 1 }}>
            {assignError != null && <Alert severity="error">{errorMessage(assignError)}</Alert>}
            {assignResult && (
              <Alert severity={assignResult.createdCount ? 'success' : 'warning'}>
                <Box component="span" className="tnum">
                  {assignResult.createdCount}
                </Box>{' '}
                assigned,{' '}
                <Box component="span" className="tnum">
                  {assignResult.skippedCount}
                </Box>{' '}
                skipped.
                {assignResult.skipped.length > 0 && (
                  <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
                    {assignResult.skipped.slice(0, 8).map((r, i) => (
                      <li key={`${r.email}-${i}`}>
                        <Typography variant="caption">
                          {r.email || 'intern'} — {r.reason}
                        </Typography>
                      </li>
                    ))}
                  </Box>
                )}
              </Alert>
            )}
            <TextField
              select
              label="Assign to"
              value={assignMode}
              onChange={(e) => setAssignMode(e.target.value as 'emails' | 'program')}
            >
              <MenuItem value="emails">Specific emails</MenuItem>
              <MenuItem value="program">Everyone in a program</MenuItem>
            </TextField>
            {assignMode === 'emails' ? (
              <TextField
                label="Intern emails"
                value={assignEmails}
                onChange={(e) => setAssignEmails(e.target.value)}
                multiline
                minRows={4}
                placeholder={'one@example.com, two@example.com'}
                helperText={`${parseEmails(assignEmails).length} valid email(s) detected — interns must already exist`}
              />
            ) : (
              <TextField
                select
                label="Program"
                value={assignProgram}
                onChange={(e) => setAssignProgram(e.target.value)}
                helperText="Invited and active interns only"
              >
                {programList.map((p) => (
                  <MenuItem key={p._id} value={p._id}>
                    {p.name}
                    {p.internCount !== undefined ? ` · ${p.internCount} interns` : ''}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <TextField
              label="Due date"
              type="date"
              value={assignDue}
              onChange={(e) => setAssignDue(e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText="Blank uses the template deadline"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button color="inherit" onClick={() => setAssignFor(null)}>
            Close
          </Button>
          <Button variant="contained" onClick={runAssign} disabled={assigning} loading={assigning}>
            Assign
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        title="Delete this template?"
        message={
          deleting
            ? `“${deleting.title}” will be removed. Templates that already have assignments are deactivated instead.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await deleteTaskTemplate(deleting._id);
          show('Template deleted');
          templates.reload();
        }}
      />

      {snackbar}
    </Stack>
  );
}

export default function AdminTasksPage() {
  return (
    <AdminScreen
      title="Task templates"
      subtitle="Define work once, then assign it to interns or whole batches"
      back="/admin"
    >
      <TasksBody />
    </AdminScreen>
  );
}
