'use client';

import React, { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import RedeemIcon from '@mui/icons-material/Redeem';
import RuleIcon from '@mui/icons-material/Rule';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import Art from '@/components/Art';
import ConfirmDialog from '@/components/ConfirmDialog';
import { DataState, errorMessage } from '@/components/DataStates';
import EmptyState from '@/components/EmptyState';
import Label from '@/components/Label';
import MetaLine from '@/components/MetaLine';
import PointsBadge from '@/components/PointsBadge';
import SectionHead from '@/components/SectionHead';
import { ART, rewardFallbackArt } from '@/lib/art';
import {
  createReward,
  deleteReward,
  listPrograms,
  listRewards,
  updateReward,
} from '@/lib/api/adminInternship';
import {
  refId,
  type Reward,
  type RewardInput,
  type RewardType,
  type RewardUnlockType,
  type Track,
} from '@/lib/api/types';
import AdminScreen, { useSnack } from '../_shared/AdminScreen';
import {
  asList,
  fmtMoney,
  fmtNumber,
  REWARD_TYPES,
  TRACKS,
  type ProgramRow,
} from '../_shared/adminUtils';
import { useAsync } from '../_shared/useAsync';

/**
 * One catalog, three unlock paths. The form follows the chosen unlockType because
 * the backend rejects a points_redeemable reward with no pointsCost, and a
 * pointsCost on an eligibility-gated reward would just mislead the intern.
 */

// ── vocabulary ───────────────────────────────────────────────────────────

const UNLOCK_TYPES: RewardUnlockType[] = [
  'points_redeemable',
  'eligibility_gated',
  'admin_granted',
];

const UNLOCK_LABELS: Record<RewardUnlockType, string> = {
  points_redeemable: 'Points redeemable',
  eligibility_gated: 'Eligibility gated',
  admin_granted: 'Admin granted',
};

const UNLOCK_HELP: Record<RewardUnlockType, string> = {
  points_redeemable: 'Interns spend points to claim this themselves.',
  eligibility_gated:
    'An eligibility rule unlocks this — set the conditions on the Eligibility screen.',
  admin_granted: 'Handed out by an admin from the intern record. Never self-claimable.',
};

const UNLOCK_ICONS: Record<RewardUnlockType, React.ReactElement> = {
  points_redeemable: <RedeemIcon sx={{ fontSize: 16 }} />,
  eligibility_gated: <RuleIcon sx={{ fontSize: 16 }} />,
  admin_granted: <VolunteerActivismIcon sx={{ fontSize: 16 }} />,
};

const TYPE_LABELS: Record<RewardType, string> = {
  cash: 'Cash',
  goodie: 'Goodie',
  gift: 'Gift',
  certificate: 'Certificate',
  perk: 'Perk',
  coins: 'App coins',
};

const TRACK_LABELS: Record<Track, string> = {
  campus: 'Campus Ambassador',
  content: 'Content Creator',
  marketing: 'Digital Marketing',
};

const trackLabel = (track: Track | null | undefined) =>
  track ? TRACK_LABELS[track] : 'Any track';

// ── small layout atoms ───────────────────────────────────────────────────

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

interface FormState {
  name: string;
  description: string;
  type: RewardType;
  unlockType: RewardUnlockType;
  pointsCost: string;
  cashValue: string;
  stock: string;
  imageUrl: string;
  track: Track | '';
  programIds: string[];
  isActive: boolean;
  sortOrder: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  type: 'goodie',
  unlockType: 'points_redeemable',
  pointsCost: '100',
  cashValue: '0',
  stock: '',
  imageUrl: '',
  track: '',
  programIds: [],
  isActive: true,
  sortOrder: '0',
};

function toForm(r: Reward): FormState {
  return {
    name: r.name ?? '',
    description: r.description ?? '',
    type: r.type,
    unlockType: r.unlockType,
    pointsCost: String(r.pointsCost ?? 0),
    cashValue: String(r.cashValue ?? 0),
    stock: r.stock === null || r.stock === undefined ? '' : String(r.stock),
    imageUrl: r.imageUrl ?? '',
    track: r.track ?? '',
    programIds: (r.programIds ?? []).map((p) => refId(p)).filter(Boolean),
    isActive: r.isActive !== false,
    sortOrder: String(r.sortOrder ?? 0),
  };
}

function toPayload(form: FormState): RewardInput {
  const isRedeemable = form.unlockType === 'points_redeemable';
  return {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    type: form.type,
    unlockType: form.unlockType,
    // A non-redeemable reward must not carry a price tag.
    pointsCost: isRedeemable ? Number(form.pointsCost) || 0 : 0,
    cashValue: Number(form.cashValue) || 0,
    stock: form.stock.trim() === '' ? null : Number(form.stock),
    imageUrl: form.imageUrl.trim() || undefined,
    track: form.track || null,
    programIds: form.programIds,
    isActive: form.isActive,
    sortOrder: Number(form.sortOrder) || 0,
  };
}

// ── grid card ────────────────────────────────────────────────────────────

/**
 * The catalog is browsed by comparison — what it costs, what it is worth, how much
 * is left — so rewards sit two-up in a grid, matching the intern-facing catalog.
 */
function RewardCard({
  reward,
  onEdit,
  onDelete,
}: {
  reward: Reward;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const stocked = reward.stock !== null && reward.stock !== undefined;
  const remaining = stocked ? Math.max(0, (reward.stock as number) - (reward.stockUsed ?? 0)) : null;
  const soldOut = remaining === 0;
  const inactive = reward.isActive === false;
  const usedPct =
    stocked && (reward.stock as number) > 0
      ? Math.min(100, Math.round(((reward.stockUsed ?? 0) / (reward.stock as number)) * 100))
      : 0;

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: (t) =>
          t.transitions.create(['box-shadow', 'transform', 'border-color'], { duration: 200 }),
        '&:hover': {
          transform: { md: 'translateY(-2px)' },
          borderColor: 'primary.light',
          boxShadow: (t) => t.customShadows.cardHover,
        },
        // The one state that needs chasing: still live in the catalog, nothing left to give.
        ...(soldOut && !inactive && { borderColor: 'error.light' }),
      }}
    >
      {reward.imageUrl && (
        // Reward art is uploaded to S3, outside next/image's configured domains.
        <Box
          component="img"
          src={reward.imageUrl}
          alt=""
          loading="lazy"
          sx={{ width: '100%', height: 132, objectFit: 'cover', display: 'block' }}
        />
      )}

      <CardContent sx={{ flexGrow: 1, p: { xs: 2, sm: 2.5 }, pb: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          {/* No uploaded art? Fall back to the clay illustration for this kind of reward. */}
          {!reward.imageUrl && (
            <Art
              src={rewardFallbackArt(reward.name, reward.type)}
              size={40}
              sx={{ flexShrink: 0, mt: -0.25 }}
            />
          )}
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 700, flexGrow: 1, minWidth: 0, wordBreak: 'break-word' }}
          >
            {reward.name}
          </Typography>
          <Label variant="outlined" sx={{ flexShrink: 0 }}>
            {TYPE_LABELS[reward.type] ?? reward.type}
          </Label>
          {inactive && (
            <Label color="default" sx={{ flexShrink: 0 }}>
              Inactive
            </Label>
          )}
        </Stack>

        {reward.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {reward.description}
          </Typography>
        )}

        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          sx={{ mt: 1.25, flexWrap: 'wrap', gap: 1 }}
        >
          {reward.unlockType === 'points_redeemable' && (
            <PointsBadge points={reward.pointsCost ?? 0} size="sm" label="to claim" />
          )}
          {reward.cashValue > 0 && (
            <Typography className="tnum" variant="body2" sx={{ fontWeight: 700 }}>
              {fmtMoney(reward.cashValue)}
            </Typography>
          )}
        </Stack>

        {/* How it unlocks is the field with money consequences — it gets a full line. */}
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          sx={{ mt: 1.25, color: 'text.secondary' }}
        >
          {UNLOCK_ICONS[reward.unlockType]}
          <Typography variant="caption">{UNLOCK_HELP[reward.unlockType]}</Typography>
        </Stack>

        {stocked && (
          <Box sx={{ mt: 1.25 }}>
            <LinearProgress
              variant="determinate"
              value={usedPct}
              color={soldOut ? 'error' : 'primary'}
              sx={{ height: 6 }}
            />
            <Typography
              className="tnum"
              variant="caption"
              sx={{ display: 'block', mt: 0.5, color: soldOut ? 'error.dark' : 'text.secondary' }}
            >
              {soldOut
                ? `Out of stock — all ${fmtNumber(reward.stock)} claimed`
                : `${fmtNumber(remaining)} left of ${fmtNumber(reward.stock)}`}
            </Typography>
          </Box>
        )}

        <MetaLine
          sx={{ mt: 1.25, rowGap: 0.5 }}
          parts={[trackLabel(reward.track), !stocked && 'Unlimited stock']}
        />
      </CardContent>

      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ px: { xs: 2, sm: 2.5 }, pb: 2 }}
      >
        <Button size="small" color="inherit" startIcon={<EditIcon />} onClick={onEdit}>
          Edit
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="Delete reward">
          <IconButton
            size="small"
            onClick={onDelete}
            aria-label={`Delete ${reward.name}`}
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

function RewardsBody() {
  const { show, snackbar } = useSnack();
  const [unlockFilter, setUnlockFilter] = useState<RewardUnlockType | ''>('');
  const [trackFilter, setTrackFilter] = useState<Track | ''>('');

  const programs = useAsync(async () => asList<ProgramRow>(await listPrograms()), []);
  const rewards = useAsync(
    async () =>
      asList<Reward>(
        await listRewards({
          unlockType: unlockFilter || undefined,
          track: trackFilter || undefined,
        })
      ),
    [unlockFilter, trackFilter]
  );

  const rows = rewards.data ?? [];
  const programList = asList<ProgramRow>(programs.data);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Reward | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<unknown>(null);
  const [deleting, setDeleting] = useState<Reward | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (r: Reward) => {
    setEditing(r);
    setForm(toForm(r));
    setFormError(null);
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      setFormError(new Error('Name is required'));
      return;
    }
    if (form.unlockType === 'points_redeemable' && !(Number(form.pointsCost) > 0)) {
      setFormError(new Error('A points-redeemable reward needs a points cost above 0'));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = toPayload(form);
      if (editing) await updateReward(editing._id, payload);
      else await createReward(payload);
      setFormOpen(false);
      show(editing ? 'Reward updated' : 'Reward created');
      rewards.reload();
    } catch (err) {
      setFormError(err);
    } finally {
      setSaving(false);
    }
  };

  const isRedeemable = form.unlockType === 'points_redeemable';
  const filtered = !!unlockFilter || !!trackFilter;
  const liveCount = rows.filter((r) => r.isActive !== false).length;

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
          label="Unlock type"
          value={unlockFilter}
          onChange={(e) => setUnlockFilter(e.target.value as RewardUnlockType | '')}
          sx={{ width: { xs: '100%', sm: 200 } }}
        >
          <MenuItem value="">All unlock types</MenuItem>
          {UNLOCK_TYPES.map((u) => (
            <MenuItem key={u} value={u}>
              {UNLOCK_LABELS[u]}
            </MenuItem>
          ))}
        </TextField>
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
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
          sx={{ flexShrink: 0 }}
        >
          New reward
        </Button>
      </Stack>

      <Box>
        {rows.length > 0 && (
          <SectionHead
            label={filtered ? 'Matching rewards' : 'Catalog'}
            count={rows.length}
            caption={`${liveCount} live · Cash, goodies, certificates and perks — one catalog covers all three unlock paths.`}
          />
        )}

        <DataState
          loading={rewards.loading && !rewards.data}
          error={rewards.error && !rewards.data ? rewards.error : undefined}
          onRetry={rewards.reload}
          skeletonRows={3}
        >
          {rows.length === 0 ? (
            <EmptyState
              art={filtered ? ART.empty.search : ART.empty.rewards}
              title={filtered ? 'No rewards match these filters' : 'No rewards in the catalog'}
              description={
                filtered
                  ? 'Clear the unlock type or track filter, or add a reward for this audience.'
                  : 'Add cash stipends, goodies and certificates — one catalog covers all three unlock paths.'
              }
              action={
                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                  New reward
                </Button>
              }
            />
          ) : (
            <Grid container spacing={2}>
              {rows.map((r) => (
                <Grid key={r._id} size={{ xs: 12, sm: 6 }}>
                  <RewardCard
                    reward={r}
                    onEdit={() => openEdit(r)}
                    onDelete={() => setDeleting(r)}
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </DataState>
      </Box>

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        fullWidth
        maxWidth="sm"
        scroll="paper"
      >
        <DialogTitle sx={{ pb: 1 }}>
          {editing ? 'Edit reward' : 'New reward'}
          <Typography variant="body2" color="text.secondary">
            {editing
              ? 'Changes show in the intern catalog immediately.'
              : 'One entry covers what it is, how it unlocks and what it costs us.'}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ py: 1 }}>
            {formError != null && <Alert severity="error">{errorMessage(formError)}</Alert>}

            <FormSection label="The reward" hint="What the intern sees on the catalog card.">
              <TextField
                label="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoFocus
              />
              <TextField
                label="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                multiline
                minRows={2}
              />
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    select
                    label="Type"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as RewardType })}
                  >
                    {REWARD_TYPES.map((t) => (
                      <MenuItem key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Image URL"
                    value={form.imageUrl}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                    helperText="Optional — shown at the top of the card"
                  />
                </Grid>
              </Grid>
            </FormSection>

            {/* Unlock path decides who can take this and what it costs — it leads. */}
            <FormSection
              label="How it unlocks"
              hint="This is the field with money consequences. It cannot be changed silently once interns can see the reward."
            >
              <Box sx={{ px: 1.75, py: 1.75, borderRadius: 2.5, bgcolor: 'primary.lighter' }}>
                <TextField
                  select
                  label="Unlock type"
                  value={form.unlockType}
                  onChange={(e) =>
                    setForm({ ...form, unlockType: e.target.value as RewardUnlockType })
                  }
                >
                  {UNLOCK_TYPES.map((u) => (
                    <MenuItem key={u} value={u}>
                      {UNLOCK_LABELS[u]}
                    </MenuItem>
                  ))}
                </TextField>
                <Typography
                  variant="caption"
                  sx={{ display: 'block', mt: 1, color: 'primary.darker' }}
                >
                  {UNLOCK_HELP[form.unlockType]}
                </Typography>

                {/* Only a points-redeemable reward carries a price tag. */}
                {isRedeemable && (
                  <TextField
                    label="Points cost"
                    type="number"
                    value={form.pointsCost}
                    onChange={(e) => setForm({ ...form, pointsCost: e.target.value })}
                    inputProps={{ min: 1, step: 1 }}
                    required
                    helperText="Must be above 0 — this is what gets deducted on claim"
                    sx={{
                      mt: 2,
                      maxWidth: { sm: 240 },
                      '& .MuiFormHelperText-root': { color: 'primary.darker' },
                    }}
                  />
                )}
              </Box>
            </FormSection>

            <FormSection
              label="Value and stock"
              hint="Cash value drives the payout queue; stock stops us promising more than we have."
            >
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Cash value (₹)"
                    type="number"
                    value={form.cashValue}
                    onChange={(e) => setForm({ ...form, cashValue: e.target.value })}
                    inputProps={{ min: 0 }}
                    helperText={
                      form.type === 'cash' ? 'Paid by manual bank transfer' : 'Book value, optional'
                    }
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Stock"
                    type="number"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    inputProps={{ min: 0 }}
                    helperText="Blank = unlimited"
                  />
                </Grid>
              </Grid>
            </FormSection>

            <FormSection label="Where it appears" hint="Leave both open to offer it to everyone.">
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
                        if (!ids.length) return 'All programs';
                        return ids
                          .map((id) => programList.find((p) => p._id === id)?.name ?? id)
                          .join(', ');
                      },
                    }}
                  >
                    {programList.map((p) => (
                      <MenuItem key={p._id} value={p._id}>
                        <Checkbox
                          size="small"
                          checked={form.programIds.includes(p._id)}
                          sx={{ mr: 1 }}
                        />
                        {p.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Sort order"
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                    helperText="Lower shows first"
                  />
                </Grid>
              </Grid>
              <FormControlLabel
                sx={{ pl: 0.5 }}
                control={
                  <Switch
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />
                }
                label={<Typography variant="body2">Active — visible in the catalog</Typography>}
              />
            </FormSection>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button color="inherit" onClick={() => setFormOpen(false)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={save} disabled={saving} loading={saving}>
            {editing ? 'Save changes' : 'Create reward'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        title="Delete this reward?"
        message={
          deleting
            ? `“${deleting.name}” will be removed. Rewards with redemption history are deactivated instead.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await deleteReward(deleting._id);
          show('Reward deleted');
          rewards.reload();
        }}
      />

      {snackbar}
    </Stack>
  );
}

export default function AdminRewardsPage() {
  return (
    <AdminScreen
      title="Reward catalog"
      subtitle="Cash, goodies, certificates and perks across all three unlock paths"
      back="/admin"
    >
      <RewardsBody />
    </AdminScreen>
  );
}
