'use client';

import Link from 'next/link';
import React, { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import GavelIcon from '@mui/icons-material/Gavel';
import RefreshIcon from '@mui/icons-material/Refresh';
import ConfirmDialog from '@/components/ConfirmDialog';
import { DataState, errorMessage } from '@/components/DataStates';
import EligibilityChecklist from '@/components/EligibilityChecklist';
import EmptyState from '@/components/EmptyState';
import Label from '@/components/Label';
import MetaLine from '@/components/MetaLine';
import SectionHead from '@/components/SectionHead';
import { ART } from '@/lib/art';
import {
  createRule,
  deleteRule,
  getProgramEligibility,
  listPrograms,
  listRewards,
  listRules,
  overrideEligibilityStatus,
  recomputeEligibility,
  updateRule,
} from '@/lib/api/adminInternship';
import {
  refId,
  type ConditionType,
  type EligibilityCondition,
  type EligibilityRule,
  type EligibilityRuleInput,
  type EligibilityState,
  type Reward,
  type RulePeriod,
  type Track,
} from '@/lib/api/types';
import AdminScreen, { useSnack } from '../_shared/AdminScreen';
import {
  asList,
  currentPeriod,
  ELIGIBILITY_STATES,
  fmtMoney,
  fmtNumber,
  nameOf,
  recentPeriods,
  RULE_PERIODS,
  titleCase,
  TRACKS,
  type EvaluationRow,
  type ProgramRow,
} from '../_shared/adminUtils';
import { useAsync } from '../_shared/useAsync';

/**
 * Eligibility rules are the stipend gate, and they are pure data: this screen is a
 * builder over the five condition types the engine understands. No threshold is
 * hardcoded anywhere — a batch can change what "eligible" means without a deploy.
 */

const CONDITION_TYPES: ConditionType[] = [
  'all_mandatory_tasks_approved',
  'min_approved_tasks',
  'min_points',
  'min_videos',
  'min_videos_with_min_likes',
];

type ParamKey = 'count' | 'points' | 'minLikes';

/** Which numeric params each condition type needs, mirroring CONDITION_SPECS. */
const CONDITION_PARAMS: Record<ConditionType, ParamKey[]> = {
  all_mandatory_tasks_approved: [],
  min_approved_tasks: ['count'],
  min_points: ['points'],
  min_videos: ['count'],
  min_videos_with_min_likes: ['count', 'minLikes'],
};

/**
 * The noun each condition counts. The builder reads as one sentence — "at least
 * [8] videos with enough likes — each with at least [10] likes" — so the noun is
 * the only thing the dropdown carries and the numbers live in the inputs.
 */
const CONDITION_NOUNS: Record<ConditionType, string> = {
  all_mandatory_tasks_approved: 'every mandatory task approved',
  min_approved_tasks: 'approved tasks',
  min_points: 'points earned',
  min_videos: 'videos posted',
  min_videos_with_min_likes: 'videos with enough likes',
};

/** Full sentence used in error messages and on the saved rule cards. */
const CONDITION_LABELS: Record<ConditionType, string> = {
  all_mandatory_tasks_approved: 'Every mandatory task approved',
  min_approved_tasks: 'At least N approved tasks',
  min_points: 'At least N points earned',
  min_videos: 'At least N videos posted',
  min_videos_with_min_likes: 'At least N videos with at least L likes',
};

interface ConditionRow {
  type: ConditionType;
  count: string;
  points: string;
  minLikes: string;
  label: string;
}

interface FormState {
  name: string;
  rewardId: string;
  programId: string;
  track: Track | '';
  period: RulePeriod;
  windowMonths: string;
  priority: string;
  autoGrant: boolean;
  isActive: boolean;
  conditions: ConditionRow[];
}

const EMPTY_CONDITION: ConditionRow = {
  type: 'all_mandatory_tasks_approved',
  count: '1',
  points: '100',
  minLikes: '10',
  label: '',
};

const EMPTY_FORM: FormState = {
  name: '',
  rewardId: '',
  programId: '',
  track: '',
  period: 'monthly',
  windowMonths: '2',
  priority: '0',
  autoGrant: false,
  isActive: true,
  conditions: [{ ...EMPTY_CONDITION }],
};

function toForm(rule: EligibilityRule): FormState {
  return {
    name: rule.name ?? '',
    rewardId: refId(rule.rewardId),
    programId: refId(rule.programId ?? null),
    track: rule.track ?? '',
    period: rule.period,
    windowMonths: String(rule.windowMonths ?? 2),
    priority: String(rule.priority ?? 0),
    autoGrant: !!rule.autoGrant,
    isActive: rule.isActive !== false,
    conditions: (rule.conditions ?? []).map((c) => ({
      type: c.type,
      count: String((c.params?.count as number) ?? 1),
      points: String((c.params?.points as number) ?? 100),
      minLikes: String((c.params?.minLikes as number) ?? 10),
      label: c.label ?? '',
    })),
  };
}

function toPayload(form: FormState): EligibilityRuleInput {
  const conditions: EligibilityCondition[] = form.conditions.map((row) => {
    const params: Record<string, number> = {};
    for (const key of CONDITION_PARAMS[row.type]) {
      // A blanked box must stay ABSENT, not become 0. The engine fails closed on a
      // missing threshold; sending 0 instead would make the condition vacuously
      // true for everyone and an autoGrant rule would pay the whole cohort.
      const raw = row[key].trim();
      if (raw !== '') params[key] = Number(raw);
    }
    return { type: row.type, params, label: row.label.trim() || undefined };
  });

  return {
    name: form.name.trim(),
    rewardId: form.rewardId,
    programId: form.programId || null,
    track: form.track || null,
    period: form.period,
    windowMonths: form.period === 'multi-month' ? Number(form.windowMonths) || 1 : null,
    priority: Number(form.priority) || 0,
    autoGrant: form.autoGrant,
    isActive: form.isActive,
    conditions,
  };
}

/** A saved condition, read back as the same sentence the builder writes. */
function conditionSummary(c: EligibilityCondition): string {
  const params = c.params ?? {};
  switch (c.type) {
    case 'min_approved_tasks':
      return `At least ${fmtNumber(params.count as number)} approved tasks`;
    case 'min_points':
      return `At least ${fmtNumber(params.points as number)} points earned`;
    case 'min_videos':
      return `At least ${fmtNumber(params.count as number)} videos posted`;
    case 'min_videos_with_min_likes':
      return `At least ${fmtNumber(params.count as number)} videos, each with at least ${fmtNumber(
        params.minLikes as number
      )} likes`;
    default:
      return CONDITION_LABELS[c.type] ?? titleCase(c.type);
  }
}

/** "2026-08" → "Aug 2026". Left as-is if it is not a period string. */
function fmtPeriod(period?: string | null): string {
  if (!period) return '';
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return period;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

/** Inline number box inside a condition sentence. */
function NumberSlot({
  value,
  onChange,
  ariaLabel,
  min,
}: {
  value: string;
  onChange: (next: string) => void;
  ariaLabel: string;
  min: number;
}) {
  return (
    <TextField
      size="small"
      type="number"
      fullWidth={false}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputProps={{ min, 'aria-label': ariaLabel, className: 'tnum' }}
      sx={{ width: 92, '& input': { textAlign: 'center', fontWeight: 700 } }}
    />
  );
}

/**
 * Each row reads as a sentence — "at least [8] videos with enough likes — each
 * with at least [10] likes" — because a stipend gate written as a form of
 * disconnected number boxes is where wrong thresholds come from.
 */
function ConditionEditor({
  rows,
  onChange,
}: {
  rows: ConditionRow[];
  onChange: (next: ConditionRow[]) => void;
}) {
  const update = (index: number, patch: Partial<ConditionRow>) =>
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  return (
    <Box>
      <Typography variant="overline" sx={{ color: 'primary.main' }}>
        Conditions
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        The intern must meet every one of these (AND). At least one is required.
      </Typography>

      <Stack spacing={1.25}>
        {rows.map((row, index) => {
          const params = CONDITION_PARAMS[row.type];
          const leadKey: ParamKey | null = params.includes('count')
            ? 'count'
            : params.includes('points')
              ? 'points'
              : null;

          return (
            <Box
              key={index}
              sx={{
                p: 1.75,
                borderRadius: 2.5,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'grey.100',
              }}
            >
              <Stack direction="row" alignItems="flex-start" spacing={1}>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.disabled', fontWeight: 700, display: 'block', mb: 0.75 }}
                  >
                    {index === 0 ? 'The intern must have' : 'and must have'}
                  </Typography>

                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 1,
                      typography: 'body2',
                    }}
                  >
                    {leadKey && (
                      <>
                        <Box component="span">at least</Box>
                        <NumberSlot
                          value={row[leadKey]}
                          onChange={(next) => update(index, { [leadKey]: next } as Partial<ConditionRow>)}
                          ariaLabel={leadKey === 'points' ? 'Minimum points' : 'Minimum count'}
                          min={1}
                        />
                      </>
                    )}
                    <TextField
                      size="small"
                      select
                      fullWidth={false}
                      value={row.type}
                      onChange={(e) => update(index, { type: e.target.value as ConditionType })}
                      SelectProps={{ inputProps: { 'aria-label': 'What to check' } }}
                      sx={{ flex: '1 1 180px', minWidth: 170, maxWidth: 300 }}
                    >
                      {CONDITION_TYPES.map((t) => (
                        <MenuItem key={t} value={t}>
                          {CONDITION_NOUNS[t]}
                        </MenuItem>
                      ))}
                    </TextField>
                    {params.includes('minLikes') && (
                      <>
                        <Box component="span">— each with at least</Box>
                        <NumberSlot
                          value={row.minLikes}
                          onChange={(next) => update(index, { minLikes: next })}
                          ariaLabel="Minimum likes per video"
                          min={1}
                        />
                        <Box component="span">likes</Box>
                      </>
                    )}
                  </Box>
                </Box>

                <Tooltip title={rows.length === 1 ? 'A rule needs at least one condition' : 'Remove this condition'}>
                  <Box component="span">
                    <IconButton
                      onClick={() => onChange(rows.filter((_, i) => i !== index))}
                      aria-label="Remove condition"
                      disabled={rows.length === 1}
                      sx={{ width: 44, height: 44 }}
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </Box>
                </Tooltip>
              </Stack>

              <TextField
                size="small"
                label="Label shown to the intern (optional)"
                value={row.label}
                onChange={(e) => update(index, { label: e.target.value })}
                placeholder="e.g. Post 4 reels this month"
                sx={{ mt: 1.5 }}
              />
            </Box>
          );
        })}
      </Stack>

      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={() => onChange([...rows, { ...EMPTY_CONDITION }])}
        sx={{ mt: 1.5 }}
      >
        Add another condition
      </Button>
    </Box>
  );
}

function RulesTab() {
  const { show, snackbar } = useSnack();
  const rules = useAsync(async () => asList<EligibilityRule>(await listRules()), []);
  const rewards = useAsync(async () => asList<Reward>(await listRewards()), []);
  const programs = useAsync(async () => asList<ProgramRow>(await listPrograms()), []);

  const rows = rules.data ?? [];
  const rewardList = asList<Reward>(rewards.data);
  const programList = asList<ProgramRow>(programs.data);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EligibilityRule | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<unknown>(null);
  const [deleting, setDeleting] = useState<EligibilityRule | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, conditions: [{ ...EMPTY_CONDITION }] });
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (rule: EligibilityRule) => {
    setEditing(rule);
    setForm(toForm(rule));
    setFormError(null);
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      setFormError(new Error('Name is required'));
      return;
    }
    if (!form.rewardId) {
      setFormError(new Error('Pick the reward this rule unlocks'));
      return;
    }
    if (!form.conditions.length) {
      setFormError(new Error('A rule needs at least one condition'));
      return;
    }
    if (form.period === 'multi-month' && !(Number(form.windowMonths) > 0)) {
      setFormError(new Error('Multi-month rules need a window above 0'));
      return;
    }
    // Every threshold must be above zero — a 0 bar is met by every intern, which
    // for an autoGrant rule means paying the whole cohort.
    const badThreshold = form.conditions.find((row) =>
      CONDITION_PARAMS[row.type].some((key) => !(Number(row[key]) > 0))
    );
    if (badThreshold) {
      setFormError(
        new Error(
          `“${CONDITION_LABELS[badThreshold.type]}” needs every number above 0 — a bar of 0 unlocks the reward for everyone.`
        )
      );
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = toPayload(form);
      if (editing) await updateRule(editing._id, payload);
      else await createRule(payload);
      setFormOpen(false);
      show(editing ? 'Rule updated' : 'Rule created');
      rules.reload();
    } catch (err) {
      setFormError(err);
    } finally {
      setSaving(false);
    }
  };

  // Plain-language restatement of what the form currently targets, shown right
  // above the condition builder.
  const targetReward = rewardList.find((r) => r._id === form.rewardId);
  const targetProgram = programList.find((p) => p._id === form.programId);
  const periodPhrase =
    form.period === 'monthly'
      ? 'every month'
      : form.period === 'multi-month'
        ? `over a ${form.windowMonths || '?'}-month window`
        : 'once, not per period';

  return (
    <Stack spacing={2}>
      <Box>
        <SectionHead
          label="Stipend rules"
          count={rows.length}
          caption="Each rule ties one reward to the conditions that unlock it."
          action={
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate}>
              New rule
            </Button>
          }
        />

        <DataState
          loading={rules.loading && !rules.data}
          error={rules.error && !rules.data ? rules.error : undefined}
          onRetry={rules.reload}
          skeletonRows={2}
        >
          {rows.length === 0 ? (
            <EmptyState
              art={ART.empty.inbox}
              title="No stipend rules yet"
              description="A rule ties a reward to conditions — for example: all mandatory tasks approved this month unlocks the stipend."
              action={
                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                  New rule
                </Button>
              }
            />
          ) : (
            <Stack spacing={2}>
              {rows.map((rule) => (
                <Card
                  key={rule._id}
                  sx={{
                    opacity: rule.isActive === false ? 0.72 : 1,
                    transition: (t) =>
                      t.transitions.create(['box-shadow', 'border-color'], { duration: 200 }),
                    '&:hover': {
                      borderColor: 'primary.light',
                      boxShadow: (t) => t.customShadows.cardHover,
                    },
                  }}
                >
                  <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
                    <Stack direction="row" spacing={1.5} justifyContent="space-between" alignItems="flex-start">
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, wordBreak: 'break-word' }}>
                          {rule.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Unlocks {nameOf(rule.rewardId)}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={0.75} sx={{ flexShrink: 0 }}>
                        {rule.autoGrant && <Label color="primary">Auto-grant</Label>}
                        {rule.isActive === false && <Label color="default">Inactive</Label>}
                      </Stack>
                    </Stack>

                    <MetaLine
                      sx={{ mt: 1, rowGap: 0.5 }}
                      parts={[
                        titleCase(rule.period),
                        rule.period === 'multi-month' ? `${rule.windowMonths}-month window` : null,
                        titleCase(rule.track ?? 'any track'),
                        rule.programId ? nameOf(rule.programId) : 'all programs',
                        `priority ${rule.priority ?? 0}`,
                      ]}
                    />

                    <Stack spacing={0.75} sx={{ mt: 1.75 }}>
                      {(rule.conditions ?? []).map((c, i) => (
                        <Stack key={`${c.type}-${i}`} direction="row" spacing={1.25} alignItems="flex-start">
                          <Box
                            sx={{
                              mt: '7px',
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              bgcolor: 'primary.main',
                              flexShrink: 0,
                            }}
                          />
                          <Typography variant="body2">
                            {conditionSummary(c)}
                            {c.label && (
                              <Box component="span" sx={{ color: 'text.secondary' }}>
                                {' '}
                                — shown as “{c.label}”
                              </Box>
                            )}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>

                  <Divider />
                  <Stack direction="row" spacing={1} sx={{ p: 1.5 }}>
                    <Button size="small" startIcon={<EditIcon />} onClick={() => openEdit(rule)}>
                      Edit
                    </Button>
                    <Box sx={{ flexGrow: 1 }} />
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteOutlineIcon />}
                      onClick={() => setDeleting(rule)}
                    >
                      Delete
                    </Button>
                  </Stack>
                </Card>
              ))}
            </Stack>
          )}
        </DataState>
      </Box>

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{editing ? 'Edit eligibility rule' : 'New eligibility rule'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 0.5 }}>
            {formError != null && <Alert severity="error">{errorMessage(formError)}</Alert>}
            <TextField
              label="Rule name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              autoFocus
              placeholder="e.g. Campus monthly stipend"
            />
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  label="Reward unlocked"
                  value={form.rewardId}
                  onChange={(e) => setForm({ ...form, rewardId: e.target.value })}
                  required
                >
                  {rewardList.map((r) => (
                    <MenuItem key={r._id} value={r._id}>
                      {r.name}
                      {r.cashValue ? ` · ${fmtMoney(r.cashValue)}` : ''}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  label="Program"
                  value={form.programId}
                  onChange={(e) => setForm({ ...form, programId: e.target.value })}
                >
                  <MenuItem value="">All programs</MenuItem>
                  {programList.map((p) => (
                    <MenuItem key={p._id} value={p._id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </TextField>
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
                      {titleCase(t)}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  select
                  label="Period"
                  value={form.period}
                  onChange={(e) => setForm({ ...form, period: e.target.value as RulePeriod })}
                  helperText="Monthly rules forfeit once the month closes"
                >
                  {RULE_PERIODS.map((p) => (
                    <MenuItem key={p} value={p}>
                      {titleCase(p)}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              {form.period === 'multi-month' && (
                <Grid size={{ xs: 6, sm: 2 }}>
                  <TextField
                    label="Window (months)"
                    type="number"
                    value={form.windowMonths}
                    onChange={(e) => setForm({ ...form, windowMonths: e.target.value })}
                    inputProps={{ min: 1 }}
                  />
                </Grid>
              )}
              <Grid size={{ xs: 6, sm: 2 }}>
                <TextField
                  label="Priority"
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  helperText="Lower first"
                />
              </Grid>
            </Grid>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.autoGrant}
                    onChange={(e) => setForm({ ...form, autoGrant: e.target.checked })}
                  />
                }
                label="Auto-grant when met (creates the redemption for you)"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />
                }
                label="Active"
              />
            </Stack>

            {/* Say plainly what this rule targets before asking for thresholds. */}
            <Box
              sx={{
                px: 2,
                py: 1.5,
                borderRadius: 2.5,
                bgcolor: 'primary.lighter',
                color: 'primary.darker',
              }}
            >
              <Typography variant="overline" sx={{ display: 'block', opacity: 0.75 }}>
                This rule targets
              </Typography>
              <Typography variant="body2">
                <Box component="strong">{targetReward?.name ?? 'a reward you have not picked yet'}</Box>
                {targetReward?.cashValue ? ` (${fmtMoney(targetReward.cashValue)})` : ''} for{' '}
                <Box component="strong">
                  {form.track ? `${titleCase(form.track)} track` : 'every track'}
                </Box>{' '}
                in <Box component="strong">{targetProgram?.name ?? 'every program'}</Box>, checked{' '}
                <Box component="strong">{periodPhrase}</Box>
                {form.autoGrant ? ' — and grants itself the moment it is met.' : '.'}
              </Typography>
            </Box>

            <ConditionEditor
              rows={form.conditions}
              onChange={(conditions) => setForm({ ...form, conditions })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setFormOpen(false)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={save} disabled={saving}>
            {editing ? 'Save changes' : 'Create rule'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        title="Delete this rule?"
        message={
          deleting
            ? `“${deleting.name}” and its cached eligibility statuses will be removed. Rewards already granted stay granted.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await deleteRule(deleting._id);
          show('Rule deleted');
          rules.reload();
        }}
      />

      {snackbar}
    </Stack>
  );
}

const BUCKETS: { key: EligibilityState; label: string; tint: string; ink: string }[] = [
  { key: 'eligible', label: 'Eligible', tint: 'info.lighter', ink: 'info.darker' },
  { key: 'earned', label: 'Earned', tint: 'success.lighter', ink: 'success.darker' },
  { key: 'not_yet_eligible', label: 'At risk', tint: 'warning.lighter', ink: 'warning.darker' },
  { key: 'forfeited', label: 'Forfeited', tint: 'error.lighter', ink: 'error.darker' },
];

function BoardTab() {
  const { show, snackbar } = useSnack();
  const [programId, setProgramId] = useState('');
  const [period, setPeriod] = useState(currentPeriod());
  const [recomputing, setRecomputing] = useState(false);

  const programs = useAsync(async () => asList<ProgramRow>(await listPrograms()), []);
  const programList = asList<ProgramRow>(programs.data);

  const board = useAsync(
    async () => (await getProgramEligibility({ programId: programId || undefined, period })).rows,
    [programId, period]
  );

  const rows = board.data ?? [];

  const [override, setOverride] = useState<{
    statusId: string;
    label: string;
    status: EligibilityState;
  } | null>(null);

  const runRecompute = async () => {
    setRecomputing(true);
    try {
      const result = await recomputeEligibility({ programId: programId || undefined, period });
      show(
        `Recomputed ${result.internsProcessed} intern(s) for ${fmtPeriod(result.period || period)}`
      );
      board.reload();
    } catch (err) {
      show(errorMessage(err, 'Recompute failed'), 'error');
    } finally {
      setRecomputing(false);
    }
  };

  const counts = BUCKETS.map((bucket) => ({
    ...bucket,
    count: rows.reduce(
      (sum, row) =>
        sum + (row.statuses ?? []).filter((s) => (s.status as EligibilityState) === bucket.key).length,
      0
    ),
  }));

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
        <TextField
          select
          size="small"
          label="Program"
          value={programId}
          onChange={(e) => setProgramId(e.target.value)}
          sx={{ minWidth: { sm: 200 } }}
        >
          <MenuItem value="">All programs</MenuItem>
          {programList.map((p) => (
            <MenuItem key={p._id} value={p._id}>
              {p.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Period"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          sx={{ minWidth: { sm: 160 } }}
        >
          {recentPeriods(12).map((p) => (
            <MenuItem key={p} value={p}>
              {fmtPeriod(p)}
            </MenuItem>
          ))}
        </TextField>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={runRecompute}
          disabled={recomputing}
        >
          {recomputing ? 'Recomputing…' : 'Recompute'}
        </Button>
      </Stack>

      {/* Where the cohort stands this period, before the per-intern detail. */}
      <Grid container spacing={2}>
        {counts.map((c) => (
          <Grid key={c.key} size={{ xs: 6, sm: 3 }}>
            <Box sx={{ px: 2, py: 1.5, borderRadius: 2.5, bgcolor: c.tint, color: c.ink }}>
              <Typography className="tnum" sx={{ fontWeight: 800, fontSize: 24, lineHeight: 1.2 }}>
                {fmtNumber(c.count)}
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {c.label}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      <Box>
        <SectionHead
          label={`Interns · ${fmtPeriod(period)}`}
          count={rows.length}
          caption="Each card shows every rule that applies, with the numbers behind the verdict."
        />

        <DataState
          loading={board.loading && !board.data}
          error={board.error && !board.data ? board.error : undefined}
          onRetry={board.reload}
          skeletonRows={3}
        >
          {rows.length === 0 ? (
            <EmptyState
              art={ART.mascot.thinking}
              title="No interns evaluated"
              description="Either the batch has no interns, or no rule applies to them yet. Recompute to refresh."
            />
          ) : (
            <Stack spacing={2}>
              {rows.map((row) => {
                const statuses = (row.statuses ?? []) as EvaluationRow[];
                return (
                  <Card key={row.internProfileId}>
                    <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          component={Link}
                          href={`/admin/interns/${row.internProfileId}`}
                          variant="subtitle2"
                          sx={{
                            fontWeight: 700,
                            color: 'primary.main',
                            textDecoration: 'none',
                            wordBreak: 'break-word',
                            '&:hover': { textDecoration: 'underline' },
                          }}
                        >
                          {row.fullName || row.email}
                        </Typography>
                        <MetaLine
                          parts={[
                            row.fullName ? row.email : null,
                            `${statuses.length} rule${statuses.length === 1 ? '' : 's'} apply`,
                          ]}
                        />
                      </Box>

                      {statuses.length ? (
                        <Stack
                          spacing={1.5}
                          divider={<Divider flexItem />}
                          sx={{ mt: 1.5 }}
                        >
                          {statuses.map((s, i) => (
                            <EligibilityChecklist
                              key={`${s.ruleId}-${i}`}
                              bare
                              status={s.status}
                              progress={s.progress ?? []}
                              reason={s.reason}
                              rewardName={s.rewardName || 'Reward'}
                              ruleName={s.ruleName}
                              period={s.period ?? period}
                              footer={
                                s.statusId ? (
                                  <Stack
                                    direction="row"
                                    spacing={1}
                                    alignItems="center"
                                    sx={{ flexWrap: 'wrap', gap: 1 }}
                                  >
                                    <Button
                                      size="small"
                                      startIcon={<GavelIcon />}
                                      onClick={() =>
                                        setOverride({
                                          statusId: String(s.statusId),
                                          label: `${row.email} — ${s.rewardName || s.ruleName || 'rule'}`,
                                          status: s.status,
                                        })
                                      }
                                    >
                                      Override
                                    </Button>
                                    {s.overridden && (
                                      <Typography variant="caption" color="text.secondary">
                                        Overridden by the team
                                        {s.overrideNote ? `: ${s.overrideNote}` : ''}
                                      </Typography>
                                    )}
                                  </Stack>
                                ) : undefined
                              }
                            />
                          ))}
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                          No rule applies to this intern — check the rule&apos;s track and program.
                        </Typography>
                      )}
                    </Box>
                  </Card>
                );
              })}
            </Stack>
          )}
        </DataState>
      </Box>

      <OverrideDialog
        target={override}
        onClose={() => setOverride(null)}
        onDone={(message) => {
          show(message);
          board.reload();
        }}
      />

      {snackbar}
    </Stack>
  );
}

function OverrideDialog({
  target,
  onClose,
  onDone,
}: {
  target: { statusId: string; label: string; status: EligibilityState } | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [status, setStatus] = useState<EligibilityState>('eligible');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  React.useEffect(() => {
    if (target) {
      setStatus(target.status);
      setNote('');
      setError(null);
    }
  }, [target]);

  const submit = async () => {
    if (!target) return;
    if (!note.trim()) {
      setError(new Error('A note is required — overrides are audited'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await overrideEligibilityStatus(target.statusId, { status, note: note.trim() });
      onDone(`Status overridden to ${titleCase(status)}`);
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!target} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Override eligibility</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {error != null && <Alert severity="error">{errorMessage(error)}</Alert>}
          <Typography variant="body2" color="text.secondary">
            {target?.label}
          </Typography>
          <TextField
            select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as EligibilityState)}
          >
            {ELIGIBILITY_STATES.map((s) => (
              <MenuItem key={s} value={s}>
                {titleCase(s)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={2}
            required
            helperText="Required — recorded against the status, kept across recomputes and logged against your name."
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={busy || !note.trim()}>
          Override
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function RulesPageBody() {
  const [tab, setTab] = useState(0);
  return (
    <Stack spacing={2.5}>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v as number)}
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Rules" />
        <Tab label="Eligibility board" />
      </Tabs>
      {tab === 0 ? <RulesTab /> : <BoardTab />}
    </Stack>
  );
}

export default function AdminRulesPage() {
  return (
    <AdminScreen
      title="Eligibility"
      subtitle="Stipend rules and who has earned them this period"
      back="/admin"
      navKey="eligibility"
    >
      <RulesPageBody />
    </AdminScreen>
  );
}
