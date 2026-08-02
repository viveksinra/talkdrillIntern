'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import React, { useState } from 'react';
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
import MuiLink from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import EditIcon from '@mui/icons-material/Edit';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SavingsIcon from '@mui/icons-material/Savings';
import TuneIcon from '@mui/icons-material/Tune';
import { DataState, errorMessage, Loading } from '@/components/DataStates';
import EligibilityChecklist from '@/components/EligibilityChecklist';
import EmptyState from '@/components/EmptyState';
import Label, { type LabelColor } from '@/components/Label';
import MetaLine from '@/components/MetaLine';
import Reveal from '@/components/Reveal';
import SectionHead from '@/components/SectionHead';
import StatCard from '@/components/StatCard';
import { statusLabel, statusMeta } from '@/components/StatusChip';
import { ART } from '@/lib/art';
import {
  adjustPoints,
  getIntern,
  grantRedemption,
  listPrograms,
  listRewards,
  updateIntern,
} from '@/lib/api/adminInternship';
import {
  isPopulated,
  refId,
  type AssignedTask,
  type EligibilityProgress,
  type EligibilityState,
  type InternProfile,
  type InternStatus,
  type LedgerEntry,
  type Redemption,
  type Reward,
  type Track,
  type VideoSubmission,
} from '@/lib/api/types';
import AdminScreen, { useSnack } from '../../_shared/AdminScreen';
import ViewAsButton from '@/components/ViewAsButton';
import {
  asList,
  fmtDate,
  fmtDateTime,
  fmtMoney,
  fmtNumber,
  internLabel,
  nameOf,
  programNames,
  titleCase,
  TRACKS,
  type ProgramRow,
} from '../../_shared/adminUtils';
import { useAsync } from '../../_shared/useAsync';

/** One intern's whole record: profile, work, ledger, eligibility, rewards. */

const STATUSES: InternStatus[] = ['invited', 'active', 'paused', 'completed', 'removed'];

interface InternDetail {
  profile: InternProfile;
  tasks: AssignedTask[];
  points: { balance: number; totalEarned: number; entries: LedgerEntry[]; total: number };
  eligibility: unknown[];
  videos?: VideoSubmission[];
  redemptions?: Redemption[];
}

interface EligRow {
  key: string;
  statusId?: string;
  rewardName: string;
  ruleName?: string;
  status: EligibilityState;
  reason?: string;
  progress: EligibilityProgress[];
  period?: string | null;
}

/** StatusChip's colour map, reused for the quieter Label pill. */
function statusTone(status: string): LabelColor {
  return (statusMeta(status).color ?? 'default') as LabelColor;
}

/** Status as a soft Label — reads as data, where a Chip reads as a button. */
function StatusLabel({ status }: { status: string }) {
  return (
    <Label color={statusTone(status)} variant="soft">
      {statusLabel(status)}
    </Label>
  );
}

/** Label + value pair for the profile facts grid. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        variant="overline"
        sx={{ display: 'block', color: 'text.disabled', lineHeight: 1.8 }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
        {children}
      </Typography>
    </Box>
  );
}

/** A card of divided rows — used for tasks, the ledger and redemptions. */
function RowCard({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <Stack divider={<Divider flexItem />}>{children}</Stack>
    </Card>
  );
}

/**
 * The detail endpoint returns fresh engine output, but falls back to cached
 * InternshipEligibilityStatus documents when the engine errors — so both shapes
 * have to render.
 */
function normalizeEligibility(raw: unknown[]): EligRow[] {
  return raw.filter(Boolean).map((item, index) => {
    const row = item as Record<string, unknown>;
    const reward = row.rewardId as { name?: string } | string | null | undefined;
    const rule = row.ruleId as { name?: string } | string | null | undefined;
    return {
      key: String(row.statusId ?? row._id ?? row.ruleId ?? index),
      statusId: row.statusId ? String(row.statusId) : row._id ? String(row._id) : undefined,
      rewardName:
        (typeof row.rewardName === 'string' && row.rewardName) ||
        (reward && typeof reward === 'object' && reward.name) ||
        'Reward',
      ruleName:
        (typeof row.ruleName === 'string' && row.ruleName) ||
        (rule && typeof rule === 'object' ? rule.name : undefined) ||
        undefined,
      status: ((row.overriddenStatus as EligibilityState) ||
        (row.status as EligibilityState) ||
        'not_yet_eligible') as EligibilityState,
      reason: typeof row.reason === 'string' ? row.reason : undefined,
      progress: Array.isArray(row.progress) ? (row.progress as EligibilityProgress[]) : [],
      period: typeof row.period === 'string' ? row.period : null,
    };
  });
}

function ProfileTab({ detail, programs }: { detail: InternDetail; programs: ProgramRow[] }) {
  const p = detail.profile;
  const handles = p.socialHandles ?? {};
  const handleRows = Object.entries(handles).filter(([, v]) => !!v);
  const programLabel = p.programIds?.length
    ? p.programIds
        .map((ref) => {
          const id = refId(ref);
          return programs.find((prog) => prog._id === id)?.name ?? (isPopulated(ref) ? ref.name : id);
        })
        .join(', ')
    : '—';
  const videos = detail.videos ?? [];

  return (
    <Stack spacing={3}>
      <Box>
        <SectionHead
          label="Profile"
          caption="What the team recorded when this intern was enrolled."
        />
        <Card sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Field label="Email">{p.email}</Field>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Field label="Track">{titleCase(p.track ?? 'none')}</Field>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Field label="Activated">{fmtDate(p.activatedAt)}</Field>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Field label="Programs">{programLabel}</Field>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Field label="Onboarding accepted">{p.onboardingAccepted ? 'Yes' : 'Not yet'}</Field>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Field label="App link in bio">{p.appLinkInBio ? 'Yes' : 'No'}</Field>
            </Grid>
            {handleRows.length > 0 && (
              <Grid size={{ xs: 12 }}>
                <Typography
                  variant="overline"
                  sx={{ display: 'block', color: 'text.disabled', lineHeight: 1.8 }}
                >
                  Social handles
                </Typography>
                <MetaLine
                  parts={handleRows.map(([platform, handle]) => (
                    <Box key={platform} component="span">
                      <Box component="span" sx={{ color: 'text.disabled' }}>
                        {titleCase(platform)}{' '}
                      </Box>
                      <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>
                        {handle}
                      </Box>
                    </Box>
                  ))}
                />
              </Grid>
            )}
            {p.adminNotes && (
              <Grid size={{ xs: 12 }}>
                <Typography
                  variant="overline"
                  sx={{ display: 'block', color: 'text.disabled', lineHeight: 1.8 }}
                >
                  Admin notes — never shown to the intern
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {p.adminNotes}
                </Typography>
              </Grid>
            )}
          </Grid>
        </Card>
      </Box>

      {videos.length > 0 && (
        <Box>
          <SectionHead
            label="Video submissions"
            count={videos.length}
            caption="Most recent first. Metrics lock 30 days after posting."
          />
          <RowCard>
            {videos.slice(0, 10).map((v, i) => (
              <Reveal key={v._id} index={i}>
                <Stack
                  direction="row"
                  spacing={1.5}
                  alignItems="flex-start"
                  sx={{ p: { xs: 1.75, sm: 2 } }}
                >
                  <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <MuiLink
                      href={v.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="body2"
                      sx={{ fontWeight: 600, wordBreak: 'break-all' }}
                    >
                      {v.videoUrl}
                    </MuiLink>
                    <MetaLine
                      parts={[
                        titleCase(v.platform),
                        `posted ${fmtDate(v.postedAt)}`,
                        v.views30d !== null ? (
                          <Box component="span" className="tnum">
                            {fmtNumber(v.views30d)} views
                          </Box>
                        ) : null,
                        v.lockedTierKey ? (
                          <Box component="span" sx={{ color: 'success.dark', fontWeight: 700 }}>
                            tier {v.lockedTierKey}
                          </Box>
                        ) : null,
                      ]}
                    />
                  </Box>
                  <StatusLabel status={v.status} />
                </Stack>
              </Reveal>
            ))}
          </RowCard>
        </Box>
      )}
    </Stack>
  );
}

function TasksTab({ tasks }: { tasks: AssignedTask[] }) {
  if (!tasks.length) {
    return (
      <EmptyState
        art={ART.empty.inbox}
        title="No tasks assigned"
        description="Assign work to this intern from the Tasks screen."
      />
    );
  }
  return (
    <RowCard>
      {tasks.map((t, i) => (
        <Reveal key={t._id} index={i}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.25}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            sx={{ p: { xs: 1.75, sm: 2 } }}
          >
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {nameOf(t.templateId)}
              </Typography>
              <MetaLine
                parts={[
                  t.period,
                  t.dueDate ? `due ${fmtDate(t.dueDate)}` : null,
                  `${t.submissionCount} submission${t.submissionCount === 1 ? '' : 's'}`,
                ]}
              />
              {t.rejectionReason && (
                <Typography variant="caption" sx={{ color: 'error.dark', display: 'block', mt: 0.25 }}>
                  {t.rejectionReason}
                </Typography>
              )}
            </Box>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexShrink: 0 }}>
              {t.pointsAwarded > 0 && (
                <Typography
                  className="tnum"
                  variant="body2"
                  sx={{ fontWeight: 700, color: 'success.dark' }}
                >
                  +{fmtNumber(t.pointsAwarded)} pts
                </Typography>
              )}
              <StatusLabel status={t.status} />
            </Stack>
          </Stack>
        </Reveal>
      ))}
    </RowCard>
  );
}

function LedgerTab({ entries }: { entries: LedgerEntry[] }) {
  if (!entries.length) {
    return (
      <EmptyState
        art={ART.empty.ledger}
        title="No points movement yet"
        description="Every approval, adjustment and redemption lands here."
      />
    );
  }
  return (
    <RowCard>
      {entries.map((e, i) => (
        <Reveal key={e._id} index={i}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ p: { xs: 1.75, sm: 2 } }}>
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {titleCase(e.reason)}
              </Typography>
              <MetaLine
                parts={[
                  fmtDateTime(e.createdAt),
                  titleCase(e.actorType),
                  e.note ? (
                    <Box component="span" sx={{ color: 'text.primary' }}>
                      {e.note}
                    </Box>
                  ) : null,
                ]}
              />
            </Box>
            <Stack alignItems="flex-end" sx={{ flexShrink: 0 }}>
              <Typography
                className="tnum"
                variant="body2"
                sx={{ fontWeight: 800, color: e.delta < 0 ? 'error.main' : 'success.dark' }}
              >
                {e.delta < 0 ? '−' : '+'}
                {fmtNumber(Math.abs(e.delta))}
              </Typography>
              <Typography className="tnum" variant="caption" color="text.secondary">
                bal {fmtNumber(e.balanceAfter)}
              </Typography>
            </Stack>
          </Stack>
        </Reveal>
      ))}
    </RowCard>
  );
}

function RedemptionsTab({ redemptions }: { redemptions: Redemption[] }) {
  if (!redemptions.length) {
    return (
      <EmptyState
        art={ART.empty.rewards}
        title="Nothing claimed or granted yet"
        description="Rewards this intern redeems, and anything the team hands them, show up here."
      />
    );
  }
  return (
    <RowCard>
      {redemptions.map((r, i) => (
        <Reveal key={r._id} index={i}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ p: { xs: 1.75, sm: 2 } }}>
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {nameOf(r.rewardId)}
              </Typography>
              <MetaLine
                parts={[
                  titleCase(r.source),
                  `requested ${fmtDate(r.requestedAt)}`,
                  r.pointsSpent ? (
                    <Box component="span" className="tnum">
                      {fmtNumber(r.pointsSpent)} pts
                    </Box>
                  ) : null,
                  r.fulfillmentNote ? `ref ${r.fulfillmentNote}` : null,
                ]}
              />
            </Box>
            <StatusLabel status={r.status} />
          </Stack>
        </Reveal>
      ))}
    </RowCard>
  );
}

function InternDetailBody({ internId }: { internId: string }) {
  const { show, snackbar } = useSnack();
  const [tab, setTab] = useState(0);

  const detail = useAsync(async () => (await getIntern(internId)) as unknown as InternDetail, [
    internId,
  ]);
  const programs = useAsync(async () => asList<ProgramRow>(await listPrograms()), []);
  const rewards = useAsync(async () => asList<Reward>(await listRewards()), []);

  const d = detail.data;
  const programList = asList<ProgramRow>(programs.data);

  // points adjustment
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [delta, setDelta] = useState('');
  const [note, setNote] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState<unknown>(null);

  // reward grant
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantReward, setGrantReward] = useState('');
  const [grantNote, setGrantNote] = useState('');
  const [granting, setGranting] = useState(false);
  const [grantError, setGrantError] = useState<unknown>(null);

  // profile edit
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: '',
    track: '' as Track | '',
    status: 'invited' as InternStatus,
    adminNotes: '',
    instagram: '',
    youtube: '',
    linkedin: '',
    programIds: [] as string[],
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<unknown>(null);

  const openEdit = () => {
    if (!d) return;
    const p = d.profile;
    setEditForm({
      fullName: p.fullName ?? '',
      track: p.track ?? '',
      status: p.status,
      adminNotes: p.adminNotes ?? '',
      instagram: p.socialHandles?.instagram ?? '',
      youtube: p.socialHandles?.youtube ?? '',
      linkedin: p.socialHandles?.linkedin ?? '',
      programIds: (p.programIds ?? []).map((r) => refId(r)).filter(Boolean),
    });
    setEditError(null);
    setEditOpen(true);
  };

  const runAdjust = async () => {
    const value = Number(delta);
    if (!Number.isInteger(value) || value === 0) {
      setAdjustError(new Error('Enter a non-zero whole number'));
      return;
    }
    if (!note.trim()) {
      setAdjustError(new Error('A note is required — it is the audit trail'));
      return;
    }
    setAdjusting(true);
    setAdjustError(null);
    try {
      await adjustPoints({ internProfileId: internId, delta: value, note: note.trim() });
      setAdjustOpen(false);
      setDelta('');
      setNote('');
      show('Points adjusted');
      detail.reload();
    } catch (err) {
      setAdjustError(err);
    } finally {
      setAdjusting(false);
    }
  };

  const runGrant = async () => {
    if (!grantReward) {
      setGrantError(new Error('Pick a reward'));
      return;
    }
    setGranting(true);
    setGrantError(null);
    try {
      await grantRedemption({
        internProfileId: internId,
        rewardId: grantReward,
        note: grantNote.trim() || undefined,
      });
      setGrantOpen(false);
      setGrantReward('');
      setGrantNote('');
      show('Reward granted — fulfil it from the Redemptions screen');
      detail.reload();
    } catch (err) {
      setGrantError(err);
    } finally {
      setGranting(false);
    }
  };

  const runEdit = async () => {
    setSavingEdit(true);
    setEditError(null);
    try {
      // Send the emptied value, not undefined: JSON.stringify drops undefined keys,
      // so the controller's `if (b.x !== undefined)` guards never ran and a field
      // the admin deliberately cleared silently kept its old value. That matters
      // for handles — fraudChecks compares submitted proof against exactly these.
      await updateIntern(internId, {
        fullName: editForm.fullName.trim(),
        track: editForm.track || null,
        status: editForm.status,
        adminNotes: editForm.adminNotes.trim(),
        socialHandles: {
          instagram: editForm.instagram.trim(),
          youtube: editForm.youtube.trim(),
          linkedin: editForm.linkedin.trim(),
        },
        programIds: editForm.programIds,
      });
      setEditOpen(false);
      show('Profile updated');
      detail.reload();
    } catch (err) {
      setEditError(err);
    } finally {
      setSavingEdit(false);
    }
  };

  if (detail.loading && !d) return <Loading label="Loading intern…" />;
  if (!d) {
    return (
      <DataState loading={false} error={detail.error ?? new Error('Intern not found')} onRetry={detail.reload}>
        <span />
      </DataState>
    );
  }

  const eligibility = normalizeEligibility(d.eligibility ?? []);
  const points = d.points ?? { balance: 0, totalEarned: 0, entries: [], total: 0 };
  const tasks = d.tasks ?? [];
  // "Submitted" is the queue state — proof is in, nobody has ruled on it yet.
  const awaitingReview = tasks.filter((t) => t.status === 'submitted').length;
  const name = internLabel(d.profile);
  const initial = (d.profile.fullName || d.profile.email || '?').trim().charAt(0).toUpperCase();

  // Live preview of where the balance lands, so a typo is caught before Apply.
  const deltaValue = Number(delta);
  const deltaValid = delta.trim() !== '' && Number.isInteger(deltaValue) && deltaValue !== 0;
  const balanceAfter = Math.max(0, (points.balance ?? 0) + deltaValue);

  return (
    <Stack spacing={2.5}>
      {/* Identity strip: who this is, what state they are in, and the three
          actions that move points or profile data. Numbers live in the tiles
          below so the header stays a name, not a dashboard. */}
      <Card sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack direction="row" spacing={2} sx={{ minWidth: 0 }}>
          <Avatar
            sx={{
              width: 56,
              height: 56,
              flexShrink: 0,
              fontSize: 22,
              fontWeight: 800,
              bgcolor: 'primary.lighter',
              color: 'primary.dark',
            }}
          >
            {initial}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ wordBreak: 'break-word' }}>
              {name}
            </Typography>
            {d.profile.fullName && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', wordBreak: 'break-all' }}
              >
                {d.profile.email}
              </Typography>
            )}
            <Stack direction="row" sx={{ mt: 1, gap: 0.75, flexWrap: 'wrap' }}>
              <StatusLabel status={d.profile.status} />
              <Label color="default" variant="soft">
                {titleCase(d.profile.track ?? 'no track')}
              </Label>
              {!d.profile.userId && (
                <Label color="info" variant="outlined">
                  Not signed in yet
                </Label>
              )}
            </Stack>
            <MetaLine
              sx={{ mt: 1 }}
              parts={[
                programNames(d.profile.programIds),
                d.profile.activatedAt ? `activated ${fmtDate(d.profile.activatedAt)}` : null,
              ]}
            />
          </Box>
        </Stack>

        <Divider sx={{ my: 2 }} />

        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button
            size="small"
            variant="contained"
            startIcon={<TuneIcon />}
            onClick={() => {
              setAdjustError(null);
              setAdjustOpen(true);
            }}
          >
            Adjust points
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<CardGiftcardIcon />}
            onClick={() => {
              setGrantError(null);
              setGrantOpen(true);
            }}
          >
            Grant reward
          </Button>
          <Button size="small" startIcon={<EditIcon />} onClick={openEdit}>
            Edit profile
          </Button>
          <ViewAsButton intern={d.profile} />
          <Box sx={{ flexGrow: 1 }} />
          <Button
            size="small"
            component={Link}
            href="/admin/verify"
            endIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
          >
            Verification queue
          </Button>
        </Stack>
      </Card>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard
            title="Points balance"
            value={points.balance ?? 0}
            hint="Spendable right now"
            icon={<SavingsIcon />}
            tone="primary"
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4 }}>
          <StatCard
            title="Earned"
            value={points.totalEarned ?? 0}
            hint="Lifetime, all approvals"
            icon={<EmojiEventsIcon />}
            tone="success"
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4 }}>
          <StatCard
            title="In review"
            value={awaitingReview}
            hint="Tasks awaiting a decision"
            icon={<FactCheckIcon />}
            tone="warning"
            href="/admin/verify"
          />
        </Grid>
      </Grid>

      <Box>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v as number)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
        >
          <Tab label="Profile" />
          <Tab label={`Tasks (${tasks.length})`} />
          <Tab label={`Points (${points.entries?.length ?? 0})`} />
          <Tab label={`Eligibility (${eligibility.length})`} />
          <Tab label={`Redemptions (${d.redemptions?.length ?? 0})`} />
        </Tabs>

        {tab === 0 && <ProfileTab detail={d} programs={programList} />}
        {tab === 1 && <TasksTab tasks={tasks} />}
        {tab === 2 && <LedgerTab entries={points.entries ?? []} />}
        {tab === 3 &&
          (eligibility.length ? (
            <Stack spacing={1.5}>
              {eligibility.map((row, i) => (
                <Reveal key={row.key} index={i}>
                  <EligibilityChecklist
                    status={row.status}
                    progress={row.progress}
                    reason={row.reason}
                    rewardName={row.rewardName}
                    ruleName={row.ruleName}
                    period={row.period}
                  />
                </Reveal>
              ))}
            </Stack>
          ) : (
            <EmptyState
              art={ART.eligibility.hourglass}
              title="No eligibility rules apply"
              description="Create rules on the Eligibility screen to gate stipends and goodies."
            />
          ))}
        {tab === 4 && <RedemptionsTab redemptions={d.redemptions ?? []} />}
      </Box>

      {/* ── adjust points ── */}
      <Dialog open={adjustOpen} onClose={() => setAdjustOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Adjust points</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {adjustError != null && <Alert severity="error">{errorMessage(adjustError)}</Alert>}
            <Typography variant="body2" color="text.secondary">
              {name} has{' '}
              <Box component="span" className="tnum" sx={{ fontWeight: 700, color: 'text.primary' }}>
                {fmtNumber(points.balance ?? 0)}
              </Box>{' '}
              points right now.
            </Typography>
            <TextField
              label="Delta"
              type="number"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              helperText={
                deltaValid
                  ? `Balance becomes ${fmtNumber(balanceAfter)} points.`
                  : 'Negative to deduct. The balance cannot go below zero.'
              }
              autoFocus
            />
            <TextField
              label="Note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              multiline
              minRows={2}
              required
              helperText="Required — every adjustment is logged against your name."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setAdjustOpen(false)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={runAdjust} disabled={adjusting}>
            Apply
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── grant reward ── */}
      <Dialog open={grantOpen} onClose={() => setGrantOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Grant a reward</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {grantError != null && <Alert severity="error">{errorMessage(grantError)}</Alert>}
            <TextField
              select
              label="Reward"
              value={grantReward}
              onChange={(e) => setGrantReward(e.target.value)}
            >
              {asList<Reward>(rewards.data).map((r) => (
                <MenuItem key={r._id} value={r._id}>
                  {r.name}
                  {r.cashValue ? ` · ${fmtMoney(r.cashValue)}` : ''}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Note"
              value={grantNote}
              onChange={(e) => setGrantNote(e.target.value)}
              multiline
              minRows={2}
              helperText="Why this was granted. Costs the intern no points."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setGrantOpen(false)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={runGrant} disabled={granting}>
            Grant
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── edit profile ── */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Edit intern</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {editError != null && <Alert severity="error">{errorMessage(editError)}</Alert>}
            <TextField
              label="Full name"
              value={editForm.fullName}
              onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
            />
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField
                  select
                  label="Track"
                  value={editForm.track}
                  onChange={(e) => setEditForm({ ...editForm, track: e.target.value as Track | '' })}
                >
                  <MenuItem value="">None</MenuItem>
                  {TRACKS.map((t) => (
                    <MenuItem key={t} value={t}>
                      {titleCase(t)}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField
                  select
                  label="Status"
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm({ ...editForm, status: e.target.value as InternStatus })
                  }
                >
                  {STATUSES.map((s) => (
                    <MenuItem key={s} value={s}>
                      {titleCase(s)}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
            <TextField
              select
              label="Programs"
              value={editForm.programIds}
              onChange={(e) =>
                setEditForm({ ...editForm, programIds: e.target.value as unknown as string[] })
              }
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
                  <Checkbox size="small" checked={editForm.programIds.includes(p._id)} sx={{ mr: 1 }} />
                  {p.name}
                </MenuItem>
              ))}
            </TextField>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="Instagram"
                  value={editForm.instagram}
                  onChange={(e) => setEditForm({ ...editForm, instagram: e.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="YouTube"
                  value={editForm.youtube}
                  onChange={(e) => setEditForm({ ...editForm, youtube: e.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="LinkedIn"
                  value={editForm.linkedin}
                  onChange={(e) => setEditForm({ ...editForm, linkedin: e.target.value })}
                />
              </Grid>
            </Grid>
            <TextField
              label="Admin notes"
              value={editForm.adminNotes}
              onChange={(e) => setEditForm({ ...editForm, adminNotes: e.target.value })}
              multiline
              minRows={3}
              helperText="Never shown to the intern"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setEditOpen(false)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={runEdit} disabled={savingEdit}>
            Save changes
          </Button>
        </DialogActions>
      </Dialog>

      {snackbar}
    </Stack>
  );
}

export default function AdminInternDetailPage() {
  const params = useParams();
  const raw = params?.id;
  const internId = Array.isArray(raw) ? raw[0] : (raw ?? '');

  return (
    <AdminScreen title="Intern record" back="/admin/interns">
      {internId ? (
        <InternDetailBody internId={internId} />
      ) : (
        <Alert severity="error">Missing intern id in the URL.</Alert>
      )}
    </AdminScreen>
  );
}
