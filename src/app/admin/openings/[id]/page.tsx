'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { use, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ConfirmDialog from '@/components/ConfirmDialog';
import { errorMessage, Loading } from '@/components/DataStates';
import Label, { type LabelColor } from '@/components/Label';
import MetaLine from '@/components/MetaLine';
import SectionHead from '@/components/SectionHead';
import {
  createOpening,
  deleteOpening,
  EMPLOYMENT_TYPES,
  getAdminOpening,
  OPENING_STATUSES,
  updateOpening,
  type AdminOpening,
  type EmploymentType,
  type OpeningInput,
  type OpeningStatus,
} from '@/lib/api/adminInternship';
import { formatStipend, type LocationType, type StipendKind } from '@/lib/api/openings';
import type { Track } from '@/lib/api/types';
import AdminScreen, { useSnack } from '../../_shared/AdminScreen';
import { fmtDate, fmtNumber, toDateInput, TRACKS } from '../../_shared/adminUtils';
import { useAsync } from '../../_shared/useAsync';

/**
 * The opening editor — one long form, grouped the way a listing is actually
 * written: what the job is, when and where, what it pays, what it says, what it
 * asks. Everything lives in ONE form object with a generic `setField`, so adding
 * a field is one line here and one line in `toPayload`, not a new useState.
 *
 * Two things worth knowing:
 *  - `id === 'new'` is the create route; saving redirects onto the real id.
 *  - The backend patches only the keys it receives, and its date parser turns an
 *    empty value into "leave it alone" — so a date already on the document can be
 *    changed here but not blanked. `startWindow` is the exception: it is always
 *    sent whole, so clearing those two fields does clear them.
 */

type QuestionType = 'text' | 'textarea' | 'url' | 'select';

const QUESTION_TYPES: QuestionType[] = ['text', 'textarea', 'url', 'select'];
const LOCATION_TYPES: LocationType[] = ['wfh', 'onsite', 'hybrid'];
const STIPEND_KINDS: StipendKind[] = ['range', 'fixed', 'performance', 'unpaid'];
const STIPEND_PERIODS = ['month', 'week', 'total'] as const;

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

const STATUS_HELP: Record<OpeningStatus, string> = {
  draft: 'Invisible to the public. Work on it as long as you like.',
  published: 'Live on intern.talkdrill.com and accepting applications.',
  closed: 'Still readable, no longer accepting applications.',
};

const TRACK_LABELS: Record<Track, string> = {
  campus: 'Campus Ambassador',
  content: 'Content Creator',
  marketing: 'Digital Marketing',
};

const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  internship: 'Internship',
  'part-time': 'Part time',
  'full-time': 'Full time',
};

const LOCATION_LABELS: Record<LocationType, string> = {
  wfh: 'Work from home',
  onsite: 'In office',
  hybrid: 'Hybrid',
};

const STIPEND_KIND_LABELS: Record<StipendKind, string> = {
  range: 'Range (₹X – ₹Y)',
  fixed: 'Fixed amount',
  performance: 'Performance based',
  unpaid: 'Unpaid',
};

// ── form shape ───────────────────────────────────────────────────────────

interface SectionRow {
  heading: string;
  body: string;
  bullets: string[];
}

interface QuestionRow {
  key: string;
  label: string;
  type: QuestionType;
  options: string[];
  required: boolean;
  helperText: string;
}

interface Form {
  // basics
  title: string;
  slug: string;
  category: string;
  track: Track | 'none';
  status: OpeningStatus;
  activelyHiring: boolean;
  sortOrder: string;
  // logistics
  locationType: LocationType;
  city: string;
  employmentTypes: EmploymentType[];
  duration: string;
  startsImmediately: boolean;
  startDate: string;
  startFrom: string;
  startTo: string;
  applyBy: string;
  postedAt: string;
  seats: string;
  // stipend
  stipendKind: StipendKind;
  stipendPeriod: (typeof STIPEND_PERIODS)[number];
  stipendMin: string;
  stipendMax: string;
  fixedMin: string;
  fixedMax: string;
  incentiveMin: string;
  incentiveMax: string;
  stipendNote: string;
  // job offer
  jobOffer: boolean;
  jobOfferMin: string;
  jobOfferMax: string;
  // content
  about: string;
  responsibilities: string[];
  skills: string[];
  whoCanApply: string[];
  otherRequirements: string[];
  perks: string[];
  womenRestartWelcome: boolean;
  sections: SectionRow[];
  questions: QuestionRow[];
  // seo
  metaTitle: string;
  metaDescription: string;
}

const EMPTY_FORM: Form = {
  title: '',
  slug: '',
  category: '',
  track: 'none',
  status: 'draft',
  activelyHiring: false,
  sortOrder: '0',
  locationType: 'wfh',
  city: '',
  employmentTypes: ['internship'],
  duration: '2 Months',
  startsImmediately: true,
  startDate: '',
  startFrom: '',
  startTo: '',
  applyBy: '',
  postedAt: '',
  seats: '1',
  stipendKind: 'range',
  stipendPeriod: 'month',
  stipendMin: '',
  stipendMax: '',
  fixedMin: '',
  fixedMax: '',
  incentiveMin: '',
  incentiveMax: '',
  stipendNote: '',
  jobOffer: false,
  jobOfferMin: '',
  jobOfferMax: '',
  about: '',
  responsibilities: [],
  skills: [],
  whoCanApply: [],
  otherRequirements: [],
  perks: [],
  womenRestartWelcome: true,
  sections: [],
  questions: [],
  metaTitle: '',
  metaDescription: '',
};

const numStr = (value: number | null | undefined) =>
  value === null || value === undefined ? '' : String(value);

function fromOpening(o: AdminOpening): Form {
  const s = o.stipend ?? { kind: 'range' as StipendKind };
  return {
    title: o.title ?? '',
    slug: o.slug ?? '',
    category: o.category ?? '',
    track: o.track ?? 'none',
    status: o.status ?? 'draft',
    activelyHiring: !!o.activelyHiring,
    sortOrder: numStr(o.sortOrder) || '0',
    locationType: o.locationType ?? 'wfh',
    city: o.city ?? '',
    employmentTypes: (o.employmentTypes ?? []).filter((t): t is EmploymentType =>
      (EMPLOYMENT_TYPES as string[]).includes(t)
    ),
    duration: o.duration ?? '',
    startsImmediately: o.startsImmediately !== false,
    startDate: toDateInput(o.startDate),
    startFrom: toDateInput(o.startWindow?.from),
    startTo: toDateInput(o.startWindow?.to),
    applyBy: toDateInput(o.applyBy),
    postedAt: toDateInput(o.postedAt),
    seats: numStr(o.openings) || '1',
    stipendKind: s.kind ?? 'range',
    stipendPeriod: s.period ?? 'month',
    stipendMin: numStr(s.min),
    stipendMax: numStr(s.max),
    fixedMin: numStr(s.fixedPay?.min),
    fixedMax: numStr(s.fixedPay?.max),
    incentiveMin: numStr(s.incentivePay?.min),
    incentiveMax: numStr(s.incentivePay?.max),
    stipendNote: s.note ?? '',
    jobOffer: !!o.jobOffer?.available,
    jobOfferMin: numStr(o.jobOffer?.min),
    jobOfferMax: numStr(o.jobOffer?.max),
    about: o.about ?? '',
    responsibilities: o.responsibilities ?? [],
    skills: o.skills ?? [],
    whoCanApply: o.whoCanApply ?? [],
    otherRequirements: o.otherRequirements ?? [],
    perks: o.perks ?? [],
    womenRestartWelcome: o.womenRestartWelcome !== false,
    sections: (o.sections ?? []).map((sec) => ({
      heading: sec.heading ?? '',
      body: sec.body ?? '',
      bullets: sec.bullets ?? [],
    })),
    questions: (o.questions ?? []).map((q) => ({
      key: q.key ?? '',
      label: q.label ?? '',
      type: (q.type ?? 'textarea') as QuestionType,
      options: q.options ?? [],
      required: q.required !== false,
      helperText: q.helperText ?? '',
    })),
    metaTitle: o.seo?.metaTitle ?? '',
    metaDescription: o.seo?.metaDescription ?? '',
  };
}

const trim = (value: string) => value.trim();
const clean = (values: string[]) => values.map(trim).filter(Boolean);
const money = (value: string): number | undefined => {
  const t = value.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
};

function toPayload(form: Form): OpeningInput {
  // Performance-based and unpaid listings must not carry numbers: the public
  // card prints "Performance based", and a leftover ₹ range would contradict it.
  const paid = form.stipendKind === 'range' || form.stipendKind === 'fixed';
  const range = form.stipendKind === 'range';

  return {
    title: trim(form.title),
    slug: trim(form.slug) || undefined,
    category: trim(form.category) || undefined,
    track: form.track === 'none' ? null : form.track,
    status: form.status,
    activelyHiring: form.activelyHiring,
    sortOrder: money(form.sortOrder) ?? 0,

    locationType: form.locationType,
    city: trim(form.city),
    employmentTypes: form.employmentTypes,
    duration: trim(form.duration),
    startsImmediately: form.startsImmediately,
    startDate: form.startDate || undefined,
    // Always sent whole, so emptying both fields actually clears the window.
    startWindow: { from: form.startFrom || undefined, to: form.startTo || undefined },
    applyBy: form.applyBy || undefined,
    postedAt: form.postedAt || undefined,
    openings: money(form.seats) ?? 1,

    stipend: {
      kind: form.stipendKind,
      period: form.stipendPeriod,
      min: paid ? money(form.stipendMin) : undefined,
      max: range ? money(form.stipendMax) : undefined,
      fixedPay: paid ? { min: money(form.fixedMin), max: money(form.fixedMax) } : undefined,
      incentivePay: paid
        ? { min: money(form.incentiveMin), max: money(form.incentiveMax) }
        : undefined,
      note: trim(form.stipendNote) || undefined,
    },

    jobOffer: {
      available: form.jobOffer,
      min: form.jobOffer ? money(form.jobOfferMin) : undefined,
      max: form.jobOffer ? money(form.jobOfferMax) : undefined,
    },

    about: trim(form.about),
    responsibilities: clean(form.responsibilities),
    skills: clean(form.skills),
    whoCanApply: clean(form.whoCanApply),
    otherRequirements: clean(form.otherRequirements),
    perks: clean(form.perks),
    womenRestartWelcome: form.womenRestartWelcome,

    sections: form.sections
      .filter((s) => trim(s.heading))
      .map((s) => ({
        heading: trim(s.heading),
        body: trim(s.body) || undefined,
        bullets: clean(s.bullets),
      })),

    // The server slugifies `key` (falling back to the label), so a blank key is
    // fine — but a question with no label is dropped there, so drop it here too.
    questions: form.questions
      .filter((q) => trim(q.label))
      .map((q) => ({
        key: trim(q.key) || trim(q.label),
        label: trim(q.label),
        type: q.type,
        options: q.type === 'select' ? clean(q.options) : [],
        required: q.required,
        helperText: trim(q.helperText) || undefined,
      })),

    seo: {
      metaTitle: trim(form.metaTitle) || undefined,
      metaDescription: trim(form.metaDescription) || undefined,
    },
  };
}

// ── editing atoms ────────────────────────────────────────────────────────

/** One card per group of fields — overline head, one line of why, then fields. */
function Group({
  label,
  caption,
  children,
}: {
  label: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <Card sx={{ p: { xs: 2, sm: 2.5 } }}>
      <SectionHead label={label} caption={caption} />
      <Stack spacing={2}>{children}</Stack>
    </Card>
  );
}

/**
 * Repeatable single-line list (responsibilities, skills, perks…). Add and delete
 * only — order is the order you type them in, which is how listings are written.
 */
function ListEditor({
  label,
  hint,
  addLabel,
  placeholder,
  multiline,
  values,
  onChange,
}: {
  label: string;
  hint?: string;
  addLabel: string;
  placeholder?: string;
  multiline?: boolean;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <Box>
      <Typography variant="overline" sx={{ color: 'text.secondary', display: 'block' }}>
        {label}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {hint}
        </Typography>
      )}
      <Stack spacing={1}>
        {values.map((value, index) => (
          <Stack key={index} direction="row" spacing={0.5} alignItems="flex-start">
            <TextField
              size="small"
              value={value}
              placeholder={placeholder}
              multiline={multiline}
              onChange={(e) =>
                onChange(values.map((v, i) => (i === index ? e.target.value : v)))
              }
            />
            <IconButton
              aria-label={`Remove ${label} item ${index + 1}`}
              onClick={() => onChange(values.filter((_, i) => i !== index))}
              sx={{
                width: 44,
                height: 44,
                flexShrink: 0,
                color: 'text.disabled',
                '&:hover': { color: 'error.main' },
              }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}
      </Stack>
      <Button size="small" startIcon={<AddIcon />} onClick={() => onChange([...values, ''])} sx={{ mt: 1 }}>
        {addLabel}
      </Button>
    </Box>
  );
}

// ── screen ───────────────────────────────────────────────────────────────

function OpeningEditorBody({ id }: { id: string }) {
  const router = useRouter();
  const { show, snackbar } = useSnack();
  const isNew = id === 'new';

  const detail = useAsync(async () => (isNew ? null : await getAdminOpening(id)), [id]);

  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [record, setRecord] = useState<AdminOpening | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<unknown>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (detail.data) {
      setForm(fromOpening(detail.data));
      setRecord(detail.data);
    }
  }, [detail.data]);

  /** The whole reason this form is one object: every field edits through here. */
  const setField = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    if (!trim(form.title)) {
      setFormError(new Error('A title is required — everything else can wait.'));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = toPayload(form);
      if (isNew) {
        const created = await createOpening(payload);
        show('Opening created — it stays private until you publish it');
        router.replace(`/admin/openings/${created._id}`);
        return;
      }
      const updated = await updateOpening(id, payload);
      setRecord(updated);
      setForm(fromOpening(updated));
      show('Opening saved');
    } catch (err) {
      setFormError(err);
    } finally {
      setSaving(false);
    }
  };

  if (!isNew && detail.loading && !detail.data) return <Loading label="Loading opening…" />;
  if (!isNew && !detail.data) {
    return (
      <Alert
        severity="warning"
        action={
          <Button color="inherit" size="small" onClick={detail.reload}>
            Try again
          </Button>
        }
      >
        {errorMessage(detail.error, 'That opening could not be found.')}
      </Alert>
    );
  }

  const applications = record?.applicationCount ?? 0;
  const canDelete = !!record && applications === 0;
  const paid = form.stipendKind === 'range' || form.stipendKind === 'fixed';

  return (
    <Stack spacing={2.5}>
      {/* Identity strip: what this listing is right now, and the way out to the
          page an applicant actually sees. */}
      <Card sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
        >
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="h6" sx={{ wordBreak: 'break-word' }}>
              {trim(form.title) || 'Untitled opening'}
            </Typography>
            <MetaLine
              sx={{ mt: 0.5 }}
              parts={[
                form.slug ? `/internships/${form.slug}` : 'slug from the title',
                formatStipend({
                  kind: form.stipendKind,
                  period: form.stipendPeriod,
                  min: money(form.stipendMin),
                  max: money(form.stipendMax),
                }),
                form.applyBy ? `apply by ${fmtDate(form.applyBy)}` : null,
                record ? `${fmtNumber(applications)} applications` : null,
              ]}
            />
            <Stack direction="row" sx={{ mt: 1, gap: 0.75, flexWrap: 'wrap' }}>
              <Label color={STATUS_TONE[form.status]} variant="soft">
                {STATUS_LABELS[form.status]}
              </Label>
              {form.activelyHiring && (
                <Label color="success" variant="outlined">
                  Actively hiring
                </Label>
              )}
              {form.track !== 'none' && (
                <Label color="default" variant="soft">
                  {TRACK_LABELS[form.track]}
                </Label>
              )}
            </Stack>
          </Box>

          <Stack direction="row" spacing={1} sx={{ flexShrink: 0, flexWrap: 'wrap', gap: 1 }}>
            {record?.slug && (
              <Button
                size="small"
                color="inherit"
                component="a"
                href={`/internships/${record.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                endIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
              >
                View public page
              </Button>
            )}
            {record && applications > 0 && (
              <Button
                size="small"
                variant="outlined"
                component={Link}
                href={`/admin/applications?openingId=${record._id}`}
              >
                {fmtNumber(applications)} applications
              </Button>
            )}
          </Stack>
        </Stack>
      </Card>

      {formError != null && <Alert severity="error">{errorMessage(formError)}</Alert>}

      {/* ── basics ── */}
      <Group label="Basics" caption="The name of the role and whether anyone can see it.">
        <TextField
          label="Title"
          value={form.title}
          onChange={(e) => setField('title', e.target.value)}
          required
          autoFocus={isNew}
          helperText="Exactly as it should read on the listing card"
        />
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="URL slug"
              value={form.slug}
              onChange={(e) => setField('slug', e.target.value)}
              helperText={
                isNew
                  ? 'Blank derives it from the title'
                  : 'Changing this breaks every shared link to the old address'
              }
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Category"
              value={form.category}
              onChange={(e) => setField('category', e.target.value)}
              helperText="Short function label, e.g. Telecalling"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              select
              label="Track"
              value={form.track}
              onChange={(e) => setField('track', e.target.value as Track | 'none')}
              helperText="Where an accepted applicant lands in the portal"
            >
              <MenuItem value="none">None — does not map to a track</MenuItem>
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
              label="Status"
              value={form.status}
              onChange={(e) => setField('status', e.target.value as OpeningStatus)}
              helperText={STATUS_HELP[form.status]}
            >
              {OPENING_STATUSES.map((s) => (
                <MenuItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <TextField
              label="Sort order"
              type="number"
              value={form.sortOrder}
              onChange={(e) => setField('sortOrder', e.target.value)}
              helperText="Higher shows first"
            />
          </Grid>
        </Grid>
        <FormControlLabel
          sx={{ pl: 0.5 }}
          control={
            <Switch
              checked={form.activelyHiring}
              onChange={(e) => setField('activelyHiring', e.target.checked)}
            />
          }
          label={
            <Typography variant="body2">Actively hiring — shows the badge on the card</Typography>
          }
        />
      </Group>

      {/* ── logistics ── */}
      <Group label="Logistics" caption="Where, how long, and by when someone has to apply.">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              select
              label="Location type"
              value={form.locationType}
              onChange={(e) => setField('locationType', e.target.value as LocationType)}
            >
              {LOCATION_TYPES.map((l) => (
                <MenuItem key={l} value={l}>
                  {LOCATION_LABELS[l]}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="City"
              value={form.city}
              onChange={(e) => setField('city', e.target.value)}
              helperText={
                form.locationType === 'wfh' ? 'Optional for a work-from-home role' : 'Where they report'
              }
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              select
              label="Employment types"
              value={form.employmentTypes}
              onChange={(e) =>
                setField('employmentTypes', e.target.value as unknown as EmploymentType[])
              }
              SelectProps={{
                multiple: true,
                renderValue: (selected) => {
                  const types = selected as EmploymentType[];
                  if (!types.length) return 'Not specified';
                  return types.map((t) => EMPLOYMENT_LABELS[t]).join(' + ');
                },
              }}
              helperText="Both can apply — our listings run “Internship + Part time”"
            >
              {EMPLOYMENT_TYPES.map((t) => (
                <MenuItem key={t} value={t}>
                  <Checkbox
                    size="small"
                    checked={form.employmentTypes.includes(t)}
                    sx={{ mr: 1 }}
                  />
                  {EMPLOYMENT_LABELS[t]}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Duration"
              value={form.duration}
              onChange={(e) => setField('duration', e.target.value)}
              helperText="Free text, e.g. 2 Months"
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              label="Seats"
              type="number"
              value={form.seats}
              onChange={(e) => setField('seats', e.target.value)}
              inputProps={{ min: 1 }}
              helperText="How many we are hiring"
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              label="Apply by"
              type="date"
              value={form.applyBy}
              onChange={(e) => setField('applyBy', e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText="Past this, applications close"
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              label="Posted on"
              type="date"
              value={form.postedAt}
              onChange={(e) => setField('postedAt', e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText="Drives “posted N weeks ago”"
            />
          </Grid>
        </Grid>

        <Divider flexItem />

        <FormControlLabel
          sx={{ pl: 0.5 }}
          control={
            <Switch
              checked={form.startsImmediately}
              onChange={(e) => setField('startsImmediately', e.target.checked)}
            />
          }
          label={<Typography variant="body2">Starts immediately</Typography>}
        />
        {!form.startsImmediately && (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Start date"
                type="date"
                value={form.startDate}
                onChange={(e) => setField('startDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <TextField
                label="Can start from"
                type="date"
                value={form.startFrom}
                onChange={(e) => setField('startFrom', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <TextField
                label="Can start until"
                type="date"
                value={form.startTo}
                onChange={(e) => setField('startTo', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        )}
      </Group>

      {/* ── stipend ── */}
      <Group
        label="Stipend"
        caption="What the card prints. A performance-based or unpaid listing carries no numbers at all."
      >
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              select
              label="Stipend kind"
              value={form.stipendKind}
              onChange={(e) => setField('stipendKind', e.target.value as StipendKind)}
            >
              {STIPEND_KINDS.map((k) => (
                <MenuItem key={k} value={k}>
                  {STIPEND_KIND_LABELS[k]}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          {paid && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                label="Per"
                value={form.stipendPeriod}
                onChange={(e) =>
                  setField('stipendPeriod', e.target.value as Form['stipendPeriod'])
                }
              >
                <MenuItem value="month">Month</MenuItem>
                <MenuItem value="week">Week</MenuItem>
                <MenuItem value="total">Total for the internship</MenuItem>
              </TextField>
            </Grid>
          )}
        </Grid>

        {paid && (
          <Box sx={{ px: 1.75, py: 1.75, borderRadius: 2.5, bgcolor: 'primary.lighter' }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField
                  label={form.stipendKind === 'fixed' ? 'Amount (₹)' : 'Minimum (₹)'}
                  type="number"
                  value={form.stipendMin}
                  onChange={(e) => setField('stipendMin', e.target.value)}
                  inputProps={{ min: 0 }}
                />
              </Grid>
              {form.stipendKind === 'range' && (
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Maximum (₹)"
                    type="number"
                    value={form.stipendMax}
                    onChange={(e) => setField('stipendMax', e.target.value)}
                    inputProps={{ min: 0 }}
                  />
                </Grid>
              )}
            </Grid>
            <Typography variant="caption" sx={{ display: 'block', mt: 1.25, color: 'primary.darker' }}>
              Reads as “
              {formatStipend({
                kind: form.stipendKind,
                period: form.stipendPeriod,
                min: money(form.stipendMin),
                max: money(form.stipendMax),
              })}
              ” on the card.
            </Typography>
          </Box>
        )}

        {paid && (
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Fixed pay min (₹)"
                type="number"
                value={form.fixedMin}
                onChange={(e) => setField('fixedMin', e.target.value)}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Fixed pay max (₹)"
                type="number"
                value={form.fixedMax}
                onChange={(e) => setField('fixedMax', e.target.value)}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Incentive min (₹)"
                type="number"
                value={form.incentiveMin}
                onChange={(e) => setField('incentiveMin', e.target.value)}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Incentive max (₹)"
                type="number"
                value={form.incentiveMax}
                onChange={(e) => setField('incentiveMax', e.target.value)}
                inputProps={{ min: 0 }}
              />
            </Grid>
          </Grid>
        )}

        <TextField
          label="Stipend note"
          value={form.stipendNote}
          onChange={(e) => setField('stipendNote', e.target.value)}
          helperText="One line under the number, e.g. how the incentive is earned"
        />
      </Group>

      {/* ── job offer ── */}
      <Group label="Job offer" caption="Only fill this in when the listing really advertises a PPO.">
        <FormControlLabel
          sx={{ pl: 0.5 }}
          control={
            <Switch
              checked={form.jobOffer}
              onChange={(e) => setField('jobOffer', e.target.checked)}
            />
          }
          label={<Typography variant="body2">Full-time offer on completion</Typography>}
        />
        {form.jobOffer && (
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 4 }}>
              <TextField
                label="CTC min (₹)"
                type="number"
                value={form.jobOfferMin}
                onChange={(e) => setField('jobOfferMin', e.target.value)}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <TextField
                label="CTC max (₹)"
                type="number"
                value={form.jobOfferMax}
                onChange={(e) => setField('jobOfferMax', e.target.value)}
                inputProps={{ min: 0 }}
              />
            </Grid>
          </Grid>
        )}
      </Group>

      {/* ── content ── */}
      <Group label="Content" caption="The prose and the bullet lists an applicant reads.">
        <TextField
          label="About the internship"
          value={form.about}
          onChange={(e) => setField('about', e.target.value)}
          multiline
          minRows={4}
          helperText="The lead paragraph. Plain language, no jargon."
        />
        <ListEditor
          label="Responsibilities"
          hint="Day-to-day work, one line each."
          addLabel="Add responsibility"
          placeholder="Call 30 leads a day from the shared sheet"
          multiline
          values={form.responsibilities}
          onChange={(next) => setField('responsibilities', next)}
        />
        <ListEditor
          label="Skills"
          hint="Short tags — these render as pills."
          addLabel="Add skill"
          placeholder="Spoken English"
          values={form.skills}
          onChange={(next) => setField('skills', next)}
        />
        <ListEditor
          label="Who can apply"
          hint="The eligibility bullets."
          addLabel="Add criterion"
          placeholder="Available for a full-time internship for 2 months"
          multiline
          values={form.whoCanApply}
          onChange={(next) => setField('whoCanApply', next)}
        />
        <ListEditor
          label="Other requirements"
          addLabel="Add requirement"
          placeholder="Own laptop and a stable internet connection"
          multiline
          values={form.otherRequirements}
          onChange={(next) => setField('otherRequirements', next)}
        />
        <ListEditor
          label="Perks"
          hint="Certificate, letter of recommendation, flexible hours…"
          addLabel="Add perk"
          placeholder="Certificate"
          values={form.perks}
          onChange={(next) => setField('perks', next)}
        />
        <FormControlLabel
          sx={{ pl: 0.5 }}
          control={
            <Switch
              checked={form.womenRestartWelcome}
              onChange={(e) => setField('womenRestartWelcome', e.target.checked)}
            />
          }
          label={
            <Typography variant="body2">
              Women wanting to start or restart their career can also apply
            </Typography>
          }
        />
      </Group>

      {/* ── sections ── */}
      <Group
        label="Sections"
        caption="Everything role-specific: learning path, selection rounds, incentives. Content, not schema."
      >
        {form.sections.length === 0 && (
          <Box sx={{ px: 1.75, py: 1.5, borderRadius: 2.5, bgcolor: 'grey.100' }}>
            <Typography variant="body2" color="text.secondary">
              No extra sections — the listing shows the standard blocks only.
            </Typography>
          </Box>
        )}
        {form.sections.map((section, index) => (
          <Box key={index} sx={{ p: 1.75, borderRadius: 2.5, bgcolor: 'grey.100' }}>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <TextField
                size="small"
                label="Heading"
                value={section.heading}
                onChange={(e) =>
                  setField(
                    'sections',
                    form.sections.map((s, i) =>
                      i === index ? { ...s, heading: e.target.value } : s
                    )
                  )
                }
                required
              />
              <IconButton
                aria-label={`Remove section ${index + 1}`}
                onClick={() =>
                  setField(
                    'sections',
                    form.sections.filter((_, i) => i !== index)
                  )
                }
                sx={{
                  width: 44,
                  height: 44,
                  flexShrink: 0,
                  color: 'text.disabled',
                  '&:hover': { color: 'error.main' },
                }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Stack>
            <TextField
              size="small"
              label="Body"
              value={section.body}
              onChange={(e) =>
                setField(
                  'sections',
                  form.sections.map((s, i) => (i === index ? { ...s, body: e.target.value } : s))
                )
              }
              multiline
              minRows={2}
              sx={{ mt: 1.5 }}
              helperText="Optional paragraph above the bullets"
            />
            <Box sx={{ mt: 1.5 }}>
              <ListEditor
                label="Bullets"
                addLabel="Add bullet"
                multiline
                values={section.bullets}
                onChange={(next) =>
                  setField(
                    'sections',
                    form.sections.map((s, i) => (i === index ? { ...s, bullets: next } : s))
                  )
                }
              />
            </Box>
          </Box>
        ))}
        <Box>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() =>
              setField('sections', [...form.sections, { heading: '', body: '', bullets: [] }])
            }
          >
            Add section
          </Button>
        </Box>
      </Group>

      {/* ── questions ── */}
      <Group
        label="Application questions"
        caption="Asked on top of the standard profile fields. Every question is another thing between a good applicant and Submit — keep it short."
      >
        {form.questions.length === 0 && (
          <Box sx={{ px: 1.75, py: 1.5, borderRadius: 2.5, bgcolor: 'grey.100' }}>
            <Typography variant="body2" color="text.secondary">
              No extra questions — applicants fill in the standard form only.
            </Typography>
          </Box>
        )}
        {form.questions.map((question, index) => {
          const patch = (next: Partial<QuestionRow>) =>
            setField(
              'questions',
              form.questions.map((q, i) => (i === index ? { ...q, ...next } : q))
            );
          return (
            <Box key={index} sx={{ p: 1.75, borderRadius: 2.5, bgcolor: 'grey.100' }}>
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, sm: 7 }}>
                  <TextField
                    size="small"
                    label="Question"
                    value={question.label}
                    onChange={(e) => patch({ label: e.target.value })}
                    required
                  />
                </Grid>
                <Grid size={{ xs: 8, sm: 3 }}>
                  <TextField
                    size="small"
                    select
                    label="Answer type"
                    value={question.type}
                    onChange={(e) => patch({ type: e.target.value as QuestionType })}
                  >
                    {QUESTION_TYPES.map((t) => (
                      <MenuItem key={t} value={t}>
                        {t === 'textarea' ? 'Long text' : t === 'url' ? 'Link' : t === 'select' ? 'Choice' : 'Short text'}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 4, sm: 2 }}>
                  <Stack direction="row" justifyContent="flex-end">
                    <IconButton
                      aria-label={`Remove question ${index + 1}`}
                      onClick={() =>
                        setField(
                          'questions',
                          form.questions.filter((_, i) => i !== index)
                        )
                      }
                      sx={{
                        width: 44,
                        height: 44,
                        color: 'text.disabled',
                        '&:hover': { color: 'error.main' },
                      }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Grid>
                <Grid size={{ xs: 12, sm: 5 }}>
                  <TextField
                    size="small"
                    label="Answer key"
                    value={question.key}
                    onChange={(e) => patch({ key: e.target.value })}
                    helperText="Blank derives it from the question"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 7 }}>
                  <TextField
                    size="small"
                    label="Helper text"
                    value={question.helperText}
                    onChange={(e) => patch({ helperText: e.target.value })}
                  />
                </Grid>
                {question.type === 'select' && (
                  <Grid size={{ xs: 12 }}>
                    <ListEditor
                      label="Choices"
                      addLabel="Add choice"
                      values={question.options}
                      onChange={(next) => patch({ options: next })}
                    />
                  </Grid>
                )}
                <Grid size={{ xs: 12 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={question.required}
                        onChange={(e) => patch({ required: e.target.checked })}
                      />
                    }
                    label={<Typography variant="caption">Required</Typography>}
                  />
                </Grid>
              </Grid>
            </Box>
          );
        })}
        <Box>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() =>
              setField('questions', [
                ...form.questions,
                { key: '', label: '', type: 'textarea', options: [], required: true, helperText: '' },
              ])
            }
          >
            Add question
          </Button>
        </Box>
      </Group>

      {/* ── seo ── */}
      <Group label="SEO" caption="What Google and a shared link show. Blank falls back to the title.">
        <TextField
          label="Meta title"
          value={form.metaTitle}
          onChange={(e) => setField('metaTitle', e.target.value)}
          helperText={`${form.metaTitle.length}/60 characters is the sweet spot`}
        />
        <TextField
          label="Meta description"
          value={form.metaDescription}
          onChange={(e) => setField('metaDescription', e.target.value)}
          multiline
          minRows={2}
          helperText={`${form.metaDescription.length}/155 characters is the sweet spot`}
        />
      </Group>

      {/* Save stays reachable from anywhere in a form this long. */}
      <Paper
        elevation={0}
        sx={{
          position: 'sticky',
          bottom: 0,
          zIndex: 3,
          borderRadius: 2.5,
          border: 1,
          borderColor: 'divider',
          px: { xs: 1.5, sm: 2 },
          py: 1.5,
          backdropFilter: 'blur(6px)',
          backgroundColor: (t) => `${t.palette.background.paper}F2`,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button variant="contained" onClick={save} disabled={saving} loading={saving}>
            {isNew ? 'Create opening' : 'Save changes'}
          </Button>
          <Button color="inherit" component={Link} href="/admin/openings">
            Back to openings
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          {record && (
            <Tooltip
              title={
                canDelete
                  ? 'Delete this opening for good'
                  : `${fmtNumber(applications)} application${applications === 1 ? '' : 's'} on file — set it to Closed instead.`
              }
            >
              <Box component="span">
                <Button
                  color="error"
                  startIcon={<DeleteOutlineIcon />}
                  disabled={!canDelete}
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete
                </Button>
              </Box>
            </Tooltip>
          )}
        </Stack>
      </Paper>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this opening?"
        message={`“${trim(form.title) || form.slug}” disappears from the public site and from this board. Closing it instead keeps the page and its history.`}
        confirmLabel="Delete"
        destructive
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          // A refusal from the server is the real answer (it counts applications
          // at delete time) — ConfirmDialog shows its message verbatim.
          await deleteOpening(id);
          show('Opening deleted');
          router.replace('/admin/openings');
        }}
      />

      {snackbar}
    </Stack>
  );
}

export default function AdminOpeningEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const isNew = id === 'new';

  return (
    <AdminScreen
      title={isNew ? 'New opening' : 'Edit opening'}
      subtitle={
        isNew
          ? 'It stays private until you set the status to Published.'
          : 'Changes go live on the public page as soon as you save.'
      }
      back="/admin/openings"
      navKey="openings"
    >
      <OpeningEditorBody id={id} />
    </AdminScreen>
  );
}
