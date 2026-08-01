'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import React, { Suspense, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { Theme } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BookmarkAddedOutlinedIcon from '@mui/icons-material/BookmarkAddedOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import LanguageIcon from '@mui/icons-material/Language';
import LaunchIcon from '@mui/icons-material/Launch';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import RefreshIcon from '@mui/icons-material/Refresh';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import ConfirmDialog from '@/components/ConfirmDialog';
import { DataState, ErrorState, errorMessage, Loading } from '@/components/DataStates';
import EmptyState from '@/components/EmptyState';
import Label from '@/components/Label';
import MetaLine from '@/components/MetaLine';
import Reveal from '@/components/Reveal';
import SectionHead from '@/components/SectionHead';
import { ART } from '@/lib/art';
import { celebrate } from '@/lib/juice';
import {
  applicationOpening,
  applicationProfileId,
  decideApplication,
  getApplication,
  listAdminOpenings,
  listApplications,
  type AdminApplication,
  type AdminApplicationOpening,
  type ApplicationDecision,
} from '@/lib/api/adminInternship';
import type { ApplicationStatus } from '@/lib/api/openings';
import {
  formatStipend,
  LOCATION_LABEL,
  relativeFromNow,
  SUBMISSION_STATUS_LABEL,
} from '@/lib/api/openings';
import type { Track } from '@/lib/api/types';
import { FONT_DISPLAY } from '@/theme';
import AdminScreen, { useSnack } from '../_shared/AdminScreen';
import { asList, fmtDate, fmtDateTime, titleCase, TRACKS } from '../_shared/adminUtils';
import { useAsync } from '../_shared/useAsync';

/**
 * Hiring review queue — the public funnel's other end.
 *
 * Same shape as the verification queue on purpose: a 380px scan column and one
 * full-fidelity pane, because both screens are worked the same way (read a
 * stack, decide, move on). The difference is the stake. Approving a submission
 * moves points; **accepting an application creates a person's intern profile and
 * hands them portal access**, so that one button is the only coloured one on the
 * screen and it always asks first.
 */

// Sticky offsets derive from AppShell's app bar (toolbar + the 48px admin tab
// row), exactly as on /admin/verify — change them there, change them here.
const TOOLBAR_H = { xs: 56, sm: 64 };
const ADMIN_TAB_ROW_H = 48;
const LIST_TOP = { md: TOOLBAR_H.sm + ADMIN_TAB_ROW_H + 8 };
const LIST_MAX_H = `calc(100vh - ${TOOLBAR_H.sm + ADMIN_TAB_ROW_H + 32}px)`;

const PAGE_SIZE = 25;

/**
 * Tabs, in funnel order. `''` is "All", which also surfaces withdrawn rows.
 * Waitlist sits last on purpose: it is not a stage of the funnel but the people
 * who arrived after the deadline and are owed a shout when the role runs again.
 */
const STATUS_TABS: { value: '' | ApplicationStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'interviewing', label: 'Interviewing' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'waitlisted', label: 'Waitlist' },
];

/** Wording for a status, shared verbatim with what the applicant is shown. */
function statusText(status: ApplicationStatus): string {
  return SUBMISSION_STATUS_LABEL[status].label;
}

function StatusPill({ status }: { status: ApplicationStatus }) {
  const { label, color } = SUBMISSION_STATUS_LABEL[status];
  return (
    <Label color={color} variant="soft">
      {label}
    </Label>
  );
}

/** The four rejections that actually get written, one tap instead of one sentence. */
const CANNED_REASONS = [
  'Role filled',
  'Looking for more experience',
  'Not the right fit right now',
  'Incomplete application',
];

const SOCIAL_FIELDS: { key: 'instagram' | 'youtube' | 'linkedin' | 'other'; label: string }[] = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'other', label: 'Other' },
];

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

/** Applicants paste handles as often as links — only linkify what is actually a link. */
function ExternalLinkButton({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Button
      component="a"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      size="small"
      variant="outlined"
      color="inherit"
      startIcon={icon}
      endIcon={<LaunchIcon sx={{ fontSize: 14 }} />}
      sx={{ borderColor: 'divider', color: 'text.primary', minHeight: { xs: 40, sm: 34 } }}
    >
      {label}
    </Button>
  );
}

/**
 * The answers to the opening's custom questions, labelled with the question the
 * applicant was actually shown. Falls back to the raw key so a question deleted
 * from the opening after someone answered it still renders.
 */
function answerRows(
  app: AdminApplication,
  opening: AdminApplicationOpening | null
): { key: string; label: string; value: string }[] {
  const raw = app.answers;
  if (!raw || typeof raw !== 'object') return [];
  return Object.entries(raw)
    .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
    .map(([key, value]) => ({
      key,
      label: opening?.questions?.find((q) => q.key === key)?.label ?? titleCase(key),
      value: String(value),
    }));
}

/** Soft panel used for the pitch, each answer and the decision note. */
function ReadPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box
      sx={{
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
        {title}
      </Typography>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {children}
      </Typography>
    </Box>
  );
}

// ── list column ──────────────────────────────────────────────────────────

function ApplicationRow({
  app,
  index,
  focused,
  onFocus,
}: {
  app: AdminApplication;
  index: number;
  focused: boolean;
  onFocus: () => void;
}) {
  const opening = applicationOpening(app);
  const where = [app.city, app.college].filter(Boolean).join(' · ');

  return (
    <Reveal index={index}>
      <Box
        role="button"
        tabIndex={0}
        aria-current={focused}
        onClick={onFocus}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onFocus();
          }
        }}
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
          px: 1.5,
          py: 1.25,
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
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, wordBreak: 'break-word' }}>
            {app.fullName}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {opening?.title ?? 'Opening removed'}
          </Typography>
          {where && (
            <Typography variant="caption" color="text.disabled" noWrap sx={{ display: 'block' }}>
              {where}
            </Typography>
          )}
        </Box>
        <Stack alignItems="flex-end" spacing={0.5} sx={{ flexShrink: 0 }}>
          <StatusPill status={app.status} />
          <Typography variant="caption" color="text.disabled" noWrap>
            {relativeFromNow(app.createdAt) || 'today'}
          </Typography>
        </Stack>
      </Box>
    </Reveal>
  );
}

// ── review pane ──────────────────────────────────────────────────────────

interface PaneProps {
  app: AdminApplication;
  busy: boolean;
  notes: string;
  notesDirty: boolean;
  savingNotes: boolean;
  onNotesChange: (value: string) => void;
  onSaveNotes: () => void;
  onDecide: (status: ApplicationDecision) => void;
  onReject: () => void;
  onAccept: () => void;
  onBack?: () => void;
}

function ReviewPane({
  app,
  busy,
  notes,
  notesDirty,
  savingNotes,
  onNotesChange,
  onSaveNotes,
  onDecide,
  onReject,
  onAccept,
  onBack,
}: PaneProps) {
  const opening = applicationOpening(app);
  const answers = answerRows(app, opening);
  const profileId = applicationProfileId(app);
  const withdrawn = app.status === 'withdrawn';
  /** Still on the waitlist — the decision bar is a different set of choices. */
  const waitlisted = app.status === 'waitlisted';
  /**
   * Came in as interest, whatever happened since. They were never asked for a
   * pitch, the custom questions or a duration commitment, so the pane must not
   * read their silence on those as a red flag.
   */
  const registeredInterest = waitlisted || app.kind === 'interest';
  const socials = SOCIAL_FIELDS.map((f) => ({
    ...f,
    value: (app.socialHandles?.[f.key] ?? '').trim(),
  })).filter((f) => f.value.length > 0);

  return (
    <Card sx={{ overflow: 'visible' }}>
      <Box sx={{ p: { xs: 2, sm: 2.5 }, pb: 2 }}>
        {onBack && (
          <Button
            size="small"
            color="inherit"
            startIcon={<ArrowBackIcon />}
            onClick={onBack}
            sx={{ mb: 1, ml: -1 }}
          >
            All applications
          </Button>
        )}

        <SectionHead
          label={waitlisted ? 'On the waitlist' : 'Reviewing'}
          caption={`${registeredInterest ? 'Registered' : 'Applied'} ${fmtDateTime(app.createdAt)}`}
          sx={{ mb: 1 }}
          action={<StatusPill status={app.status} />}
        />

        {/* The page's one display moment: the person being decided about. */}
        <Typography
          sx={{
            fontFamily: FONT_DISPLAY,
            fontSize: { xs: 26, sm: 30 },
            fontWeight: 700,
            lineHeight: 1.15,
            wordBreak: 'break-word',
          }}
        >
          {app.fullName}
        </Typography>

        <Stack direction="row" sx={{ mt: 1.25, gap: 0.75, flexWrap: 'wrap' }}>
          <Button
            component="a"
            href={`mailto:${app.email}`}
            size="small"
            variant="outlined"
            color="inherit"
            startIcon={<MailOutlineIcon />}
            sx={{ borderColor: 'divider', color: 'text.primary', minHeight: { xs: 40, sm: 34 } }}
          >
            {app.email}
          </Button>
          {app.phone && (
            <Button
              component="a"
              href={`tel:${app.phone}`}
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<PhoneOutlinedIcon />}
              sx={{ borderColor: 'divider', color: 'text.primary', minHeight: { xs: 40, sm: 34 } }}
            >
              {app.phone}
            </Button>
          )}
        </Stack>

        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            {registeredInterest ? 'Interested in' : 'Applied for'}
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
            {opening ? (
              <Box
                component={Link}
                href={`/internships/${opening.slug}`}
                target="_blank"
                sx={{ color: 'primary.main', textDecoration: 'none' }}
              >
                {opening.title}
                <LaunchIcon sx={{ fontSize: 14, ml: 0.5, verticalAlign: 'middle' }} />
              </Box>
            ) : (
              <Box component="span" sx={{ color: 'text.secondary' }}>
                Opening no longer available
              </Box>
            )}
          </Typography>
          <MetaLine
            sx={{ mt: 0.5 }}
            parts={[
              opening?.category,
              opening?.locationType ? LOCATION_LABEL[opening.locationType] : null,
              opening?.duration,
              opening?.stipend ? formatStipend(opening.stipend) : null,
            ]}
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        <MetaLine
          parts={[
            app.college,
            app.city,
            app.graduationYear ? `Class of ${app.graduationYear}` : null,
            app.availableFrom ? `Available from ${fmtDate(app.availableFrom)}` : null,
          ]}
        />

        {/* An interest entry was never asked to commit, so it is not asked about here. */}
        {!registeredInterest && (
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1 }}>
            {app.confirmsDuration ? (
              <>
                <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
                <Typography variant="body2" sx={{ color: 'success.dark', fontWeight: 600 }}>
                  Confirmed they can commit to the full duration
                </Typography>
              </>
            ) : (
              <>
                <CloseIcon sx={{ fontSize: 16, color: 'warning.dark' }} />
                <Typography variant="body2" sx={{ color: 'warning.dark', fontWeight: 600 }}>
                  Did not confirm availability for the full duration
                </Typography>
              </>
            )}
          </Stack>
        )}
      </Box>

      <Stack spacing={2} sx={{ px: { xs: 2, sm: 2.5 }, pb: 2 }}>
        {/*
          Quiet, not an alarm: this person did nothing wrong, they simply arrived
          after the deadline. Everything below is thinner than a real application
          because we never asked them for more.
        */}
        {registeredInterest && (
          <Alert
            severity="info"
            variant="outlined"
            icon={<BookmarkAddedOutlinedIcon fontSize="inherit" />}
          >
            Registered interest while this role was closed · {fmtDateTime(app.createdAt)}
            {app.contactedAt && ` · told it reopened ${fmtDate(app.contactedAt)}`}
            {waitlisted && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                Move them into review when you run this role again — they never went through the
                full application, so there is less here than usual.
              </Typography>
            )}
          </Alert>
        )}

        {app.pitch?.trim() && (
          <ReadPanel title={registeredInterest ? 'What they told us' : 'Why they want it'}>
            {app.pitch}
          </ReadPanel>
        )}

        {answers.map((a) => (
          <ReadPanel key={a.key} title={a.label}>
            {a.value}
          </ReadPanel>
        ))}

        {(app.resumeUrl || app.portfolioUrl || socials.length > 0) && (
          <Box>
            <Typography
              variant="overline"
              sx={{ display: 'block', color: 'text.secondary', lineHeight: 1.6 }}
            >
              Links
            </Typography>
            <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
              {app.resumeUrl && (
                <ExternalLinkButton
                  href={app.resumeUrl}
                  label="Resume"
                  icon={<DescriptionOutlinedIcon />}
                />
              )}
              {app.portfolioUrl && (
                <ExternalLinkButton
                  href={app.portfolioUrl}
                  label="Portfolio"
                  icon={<LanguageIcon />}
                />
              )}
              {socials.map((s) =>
                isUrl(s.value) ? (
                  <ExternalLinkButton
                    key={s.key}
                    href={s.value}
                    label={s.label}
                    icon={<LaunchIcon sx={{ fontSize: 16 }} />}
                  />
                ) : (
                  // A handle, not a link — show it rather than build a 404.
                  <Label key={s.key} color="default" variant="outlined" sx={{ height: 34, px: 1 }}>
                    {s.label}: {s.value}
                  </Label>
                )
              )}
            </Stack>
          </Box>
        )}

        {app.decisionNote?.trim() && (
          <ReadPanel title={`Note sent to the applicant · ${fmtDate(app.decidedAt)}`}>
            {app.decisionNote}
          </ReadPanel>
        )}

        {profileId && (
          <Alert
            severity="success"
            icon={<HowToRegIcon />}
            action={
              <Button
                component={Link}
                href={`/admin/interns/${profileId}`}
                size="small"
                color="inherit"
              >
                Open profile
              </Button>
            }
          >
            Hired — {app.fullName} has an intern profile and portal access.
          </Alert>
        )}

        {/* Internal notes. Deliberately styled as a scratchpad, not as content. */}
        <Box>
          <TextField
            label="Internal notes"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            multiline
            minRows={2}
            fullWidth
            size="small"
            disabled={withdrawn}
            helperText="Internal — the applicant never sees this."
          />
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 0.75 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={onSaveNotes}
              disabled={withdrawn || !notesDirty || savingNotes}
              loading={savingNotes}
            >
              Save notes
            </Button>
          </Stack>
        </Box>
      </Stack>

      {/* Decisions stay reachable however long the application runs. */}
      <Stack
        sx={{
          position: 'sticky',
          bottom: 0,
          zIndex: 1,
          px: { xs: 1.5, sm: 2.5 },
          py: 1.5,
          gap: 1,
          bgcolor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
          borderBottomLeftRadius: 'inherit',
          borderBottomRightRadius: 'inherit',
        }}
      >
        {withdrawn ? (
          <Typography variant="body2" color="text.secondary">
            The applicant withdrew this application, so it can no longer be decided.
          </Typography>
        ) : waitlisted ? (
          /*
           * A waitlist is not a shortlist. The way out of it is the front of the
           * queue, not the end of it — so the primary action puts them into review
           * as a live applicant, and "Accept & enroll" is deliberately absent:
           * hiring straight off a waitlist skips the read we would give anyone else.
           */
          <>
            <Typography variant="caption" color="text.secondary">
              Moving them to review turns this into a live application, exactly as if they had
              applied while the role was open.
            </Typography>
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                startIcon={<StarBorderIcon />}
                disabled={busy}
                onClick={() => onDecide('shortlisted')}
                sx={{ borderColor: 'divider', minHeight: { xs: 44, sm: 36 } }}
              >
                Shortlist
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                startIcon={<CloseIcon />}
                disabled={busy}
                onClick={onReject}
                sx={{
                  borderColor: 'divider',
                  color: 'text.secondary',
                  minHeight: { xs: 44, sm: 36 },
                  '&:hover': {
                    color: 'error.main',
                    borderColor: 'error.main',
                    bgcolor: 'error.lighter',
                  },
                }}
              >
                Reject
              </Button>
              <Box sx={{ flexGrow: 1 }} />
              <Button
                size="small"
                variant="contained"
                startIcon={<PlaylistAddCheckIcon />}
                disabled={busy}
                onClick={() => onDecide('submitted')}
                sx={{ minHeight: { xs: 44, sm: 36 } }}
              >
                Move to review
              </Button>
            </Stack>
          </>
        ) : (
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<StarBorderIcon />}
              disabled={busy || app.status === 'shortlisted'}
              onClick={() => onDecide('shortlisted')}
              sx={{ borderColor: 'divider', minHeight: { xs: 44, sm: 36 } }}
            >
              Shortlist
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<RecordVoiceOverIcon />}
              disabled={busy || app.status === 'interviewing'}
              onClick={() => onDecide('interviewing')}
              sx={{ borderColor: 'divider', minHeight: { xs: 44, sm: 36 } }}
            >
              Interviewing
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<CloseIcon />}
              disabled={busy}
              onClick={onReject}
              sx={{
                borderColor: 'divider',
                color: 'text.secondary',
                minHeight: { xs: 44, sm: 36 },
                '&:hover': {
                  color: 'error.main',
                  borderColor: 'error.main',
                  bgcolor: 'error.lighter',
                },
              }}
            >
              Reject
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <Button
              size="small"
              variant="contained"
              color="success"
              startIcon={<HowToRegIcon />}
              disabled={busy || app.status === 'accepted'}
              onClick={onAccept}
              sx={{ minHeight: { xs: 44, sm: 36 } }}
            >
              {app.status === 'accepted' ? 'Already enrolled' : 'Accept & enroll'}
            </Button>
          </Stack>
        )}
      </Stack>
    </Card>
  );
}

// ── screen ───────────────────────────────────────────────────────────────

function ApplicationsBody() {
  const params = useSearchParams();
  const { show, snackbar } = useSnack();
  const mdUp = useMediaQuery((t: Theme) => t.breakpoints.up('md'));

  const [status, setStatus] = useState<'' | ApplicationStatus>('');
  // Pre-filtered by the "N to review" link on /admin/openings.
  const [openingId, setOpeningId] = useState(params.get('openingId') ?? '');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<'reject' | 'accept' | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [acceptTrack, setAcceptTrack] = useState<Track | ''>('');
  const [notes, setNotes] = useState('');
  const [savedNotes, setSavedNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [hired, setHired] = useState<{ name: string; profileId: string | null } | null>(null);

  // The list endpoint regex-scans name, email, college and city.
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [status, openingId, q]);

  const openings = useAsync(() => listAdminOpenings(), []);

  const list = useAsync(
    () =>
      listApplications({
        status: status || undefined,
        openingId: openingId || undefined,
        q: q || undefined,
        page: page + 1,
        limit: PAGE_SIZE,
      }),
    [status, openingId, q, page]
  );

  /**
   * Tab counts. There is no counts endpoint, so this asks for one row per tab and
   * reads `total` — six cheap queries, re-run only when the *other* filters move,
   * never when you switch tabs.
   */
  const counts = useAsync(async () => {
    const pairs = await Promise.all(
      STATUS_TABS.map(async (tab) => {
        const res = await listApplications({
          status: tab.value || undefined,
          openingId: openingId || undefined,
          q: q || undefined,
          page: 1,
          limit: 1,
        });
        return [tab.value, res.total] as const;
      })
    );
    return Object.fromEntries(pairs) as Record<string, number>;
  }, [openingId, q]);

  const rows = asList<AdminApplication>(list.data?.applications);
  const total = list.data?.total ?? rows.length;
  const rowKey = rows.map((r) => r._id).join(',');

  // The pane always points at something real: keep the current row if it survived
  // the reload, otherwise take the top of the list (desktop only — on a phone the
  // list IS the screen until a row is tapped).
  useEffect(() => {
    if (!mdUp) return;
    setFocusedId((cur) => (cur && rows.some((r) => r._id === cur) ? cur : (rows[0]?._id ?? null)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowKey, mdUp]);

  const detail = useAsync(
    async () => (focusedId ? getApplication(focusedId) : null),
    [focusedId]
  );
  const app = detail.data;

  // Notes are a controlled draft; reset whenever a different record lands.
  useEffect(() => {
    const value = app?.adminNotes ?? '';
    setNotes(value);
    setSavedNotes(value);
  }, [app?._id, app?.adminNotes]);

  const openingList = asList(openings.data);
  const filtered = Boolean(q || openingId || status);

  const refreshAll = () => {
    list.reload();
    counts.reload();
    detail.reload();
  };

  /**
   * Every decision goes through here so the queue, the counts and the pane agree.
   * Failures are re-thrown, not swallowed: from a dialog they surface inline where
   * the click happened, and the two bare buttons add their own toast below.
   */
  const runDecision = async (
    decision: ApplicationDecision,
    extra: { decisionNote?: string; track?: Track | null } = {}
  ) => {
    if (!app) return;
    // Read before the write — the server flips a promoted entry's kind back.
    const promoted = app.status === 'waitlisted' && decision === 'submitted';
    setBusy(true);
    try {
      const result = await decideApplication(app._id, { status: decision, ...extra });
      if (decision === 'accepted') {
        celebrate();
        setHired({
          name: result.application.fullName,
          profileId: result.internProfile?._id ?? applicationProfileId(result.application),
        });
      } else if (promoted) {
        show(`${result.application.fullName} is in review — off the waitlist, in the queue`);
      } else {
        show(`${result.application.fullName} marked ${statusText(decision).toLowerCase()}`);
      }
      refreshAll();
    } finally {
      setBusy(false);
    }
  };

  /**
   * Saving notes re-sends the current status — /decide is the only writer on this
   * record, so an internal note is a no-op decision that touches `adminNotes`.
   */
  const saveNotes = async () => {
    if (!app || app.status === 'withdrawn') return;
    setSavingNotes(true);
    try {
      await decideApplication(app._id, {
        status: app.status as ApplicationDecision,
        adminNotes: notes,
      });
      setSavedNotes(notes);
      show('Notes saved — internal only');
      list.reload();
    } catch (err) {
      show(errorMessage(err, 'Could not save the notes.'), 'error');
    } finally {
      setSavingNotes(false);
    }
  };

  const openReject = () => {
    setRejectNote('');
    setDialog('reject');
  };

  const openAccept = () => {
    const opening = app ? applicationOpening(app) : null;
    setAcceptTrack(opening?.track ?? '');
    setDialog('accept');
  };

  const clearFilters = () => {
    setStatus('');
    setOpeningId('');
    setSearch('');
    setQ('');
  };

  const paneProps: Omit<PaneProps, 'app' | 'onBack'> = {
    busy,
    notes,
    notesDirty: notes !== savedNotes,
    savingNotes,
    onNotesChange: setNotes,
    onSaveNotes: () => void saveNotes(),
    onDecide: (next) =>
      void runDecision(next).catch((err) =>
        show(errorMessage(err, 'Could not update the application.'), 'error')
      ),
    onReject: openReject,
    onAccept: openAccept,
  };

  /** Stands in for the pane while a record loads, fails, or none is picked. */
  const detailFallback = (withBack: boolean) => (
    <Card sx={{ p: { xs: 2, sm: 3 } }}>
      {withBack && (
        <Button
          size="small"
          color="inherit"
          startIcon={<ArrowBackIcon />}
          onClick={() => setFocusedId(null)}
          sx={{ mb: 1, ml: -1 }}
        >
          All applications
        </Button>
      )}
      {detail.error ? (
        <ErrorState
          error={detail.error}
          title="Could not open that application"
          onRetry={detail.reload}
        />
      ) : focusedId ? (
        <Loading label="Opening the application…" minHeight={180} />
      ) : (
        <EmptyState
          bare
          art={ART.mascot.thinking}
          title="Pick an application"
          description="Choose someone on the left to read their pitch and decide."
        />
      )}
    </Card>
  );

  const showFrom = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const showTo = page * PAGE_SIZE + rows.length;
  const lastPage = showTo >= total;

  const listCard = (
    <Card
      sx={{
        ...(mdUp && {
          position: 'sticky',
          top: LIST_TOP,
          maxHeight: LIST_MAX_H,
          display: 'flex',
          flexDirection: 'column',
        }),
      }}
    >
      <Box sx={{ overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
        {rows.map((row, i) => (
          <ApplicationRow
            key={row._id}
            app={row}
            index={i}
            focused={row._id === focusedId}
            onFocus={() => setFocusedId(row._id)}
          />
        ))}
      </Box>
      {total > PAGE_SIZE && (
        <>
          <Divider />
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.5}
            sx={{ px: 1.5, py: 0.75, flexShrink: 0 }}
          >
            <Typography variant="caption" color="text.secondary" className="tnum">
              {showFrom}–{showTo} of {total}
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            <IconButton
              size="small"
              aria-label="Previous page"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeftIcon />
            </IconButton>
            <IconButton
              size="small"
              aria-label="Next page"
              disabled={lastPage}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRightIcon />
            </IconButton>
          </Stack>
        </>
      )}
    </Card>
  );

  return (
    <Stack spacing={2}>
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
          label="Search name, email or college"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: '1 1 240px', minWidth: { sm: 200 } }}
        />
        <TextField
          select
          size="small"
          label="Opening"
          value={openingId}
          onChange={(e) => setOpeningId(e.target.value)}
          sx={{ flex: '1 1 220px', maxWidth: { sm: 280 } }}
        >
          <MenuItem value="">All openings</MenuItem>
          {openingList.map((o) => (
            <MenuItem key={o._id} value={o._id}>
              {o.title}
            </MenuItem>
          ))}
        </TextField>
        {filtered && (
          <Button size="small" color="inherit" onClick={clearFilters} sx={{ flexShrink: 0 }}>
            Clear filters
          </Button>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="Refresh">
          <IconButton onClick={refreshAll} aria-label="Refresh applications" sx={{ width: 44, height: 44 }}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tabs
          value={status}
          onChange={(_, next: '' | ApplicationStatus) => setStatus(next)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
        >
          {STATUS_TABS.map((tab) => {
            const count = counts.data?.[tab.value];
            return (
              <Tab
                key={tab.value || 'all'}
                value={tab.value}
                sx={{ minHeight: 48 }}
                label={
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Box component="span">{tab.label}</Box>
                    {typeof count === 'number' && (
                      <Label
                        color={status === tab.value ? 'primary' : 'default'}
                        variant="soft"
                        sx={{ height: 20, fontSize: 11 }}
                      >
                        {count}
                      </Label>
                    )}
                  </Stack>
                }
              />
            );
          })}
        </Tabs>
      </Box>

      <DataState
        loading={list.loading && !list.data}
        error={list.error && !list.data ? list.error : undefined}
        onRetry={list.reload}
        skeletonRows={3}
      >
        {rows.length === 0 ? (
          <EmptyState
            art={
              status === 'waitlisted'
                ? ART.empty.inboxZero
                : filtered
                  ? ART.empty.search
                  : ART.empty.inboxZero
            }
            title={
              status === 'waitlisted'
                ? 'Nobody on a waitlist'
                : filtered
                  ? 'No applications match those filters'
                  : 'No applications yet'
            }
            description={
              status === 'waitlisted'
                ? 'When a deadline has passed, people can still leave their details on the listing. They collect here so you can call them back when the role runs again.'
                : filtered
                  ? 'Try another status tab, or clear the search and opening filter.'
                  : 'Every application to a published opening lands here for review.'
            }
            action={
              filtered ? (
                <Button variant="outlined" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button component={Link} href="/admin/openings" variant="outlined">
                  Manage openings
                </Button>
              )
            }
          />
        ) : mdUp ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '380px minmax(0, 1fr)',
              gap: 2,
              alignItems: 'start',
            }}
          >
            {listCard}
            {app ? <ReviewPane key={app._id} app={app} {...paneProps} /> : detailFallback(false)}
          </Box>
        ) : focusedId ? (
          // Phone: the pane replaces the list rather than stacking under it.
          app ? (
            <ReviewPane key={app._id} app={app} {...paneProps} onBack={() => setFocusedId(null)} />
          ) : (
            detailFallback(true)
          )
        ) : (
          listCard
        )}
      </DataState>

      <ConfirmDialog
        open={dialog === 'reject'}
        title={app?.status === 'waitlisted' ? 'Turn down this interest?' : 'Reject this application?'}
        message={
          app?.status === 'waitlisted'
            ? 'They only left their details for when the role runs again — they see this decision, and the note below, on their applications page.'
            : 'The applicant sees this decision, and the note below, on their applications page.'
        }
        confirmLabel="Reject"
        destructive
        onClose={() => setDialog(null)}
        onConfirm={() => runDecision('rejected', { decisionNote: rejectNote.trim() || undefined })}
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
                color={rejectNote === reason ? 'primary' : 'default'}
                variant={rejectNote === reason ? 'filled' : 'outlined'}
                onClick={() => setRejectNote(reason)}
              />
            ))}
          </Stack>
        </Box>
        <TextField
          label="Note to the applicant (optional)"
          placeholder="e.g. We have filled this role for now"
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
          multiline
          minRows={2}
          helperText="Shown to the applicant. Leave it blank to reject without a reason."
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'accept'}
        title={`Accept ${app?.fullName ?? 'this applicant'}?`}
        message={
          <Stack spacing={1}>
            <Typography variant="body2">
              This is the hire action. Accepting creates their intern profile now, links{' '}
              <strong>{app?.email}</strong> to it and gives them portal access — tasks, points and
              rewards all start working immediately.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              They are also enrolled into whichever programs this opening is attached to.
            </Typography>
          </Stack>
        }
        confirmLabel="Accept & enroll"
        onClose={() => setDialog(null)}
        onConfirm={() => runDecision('accepted', { track: acceptTrack || null })}
      >
        <TextField
          select
          label="Track"
          value={acceptTrack}
          onChange={(e) => setAcceptTrack(e.target.value as Track | '')}
          helperText={
            acceptTrack
              ? `They will start on the ${titleCase(acceptTrack)} track.`
              : 'No track yet — you can set one later on their profile.'
          }
        >
          <MenuItem value="">Decide later</MenuItem>
          {TRACKS.map((t) => (
            <MenuItem key={t} value={t}>
              {titleCase(t)}
            </MenuItem>
          ))}
        </TextField>
      </ConfirmDialog>

      {/* The hire gets its own toast: it is the only action with somewhere to go next. */}
      <Snackbar
        open={!!hired}
        autoHideDuration={8000}
        onClose={() => setHired(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setHired(null)}
          action={
            <Button
              component={Link}
              href={hired?.profileId ? `/admin/interns/${hired.profileId}` : '/admin/interns'}
              size="small"
              color="inherit"
              sx={{ fontWeight: 700 }}
            >
              View intern
            </Button>
          }
        >
          {hired?.name} is enrolled — their intern profile is live.
        </Alert>
      </Snackbar>

      {snackbar}
    </Stack>
  );
}

export default function AdminApplicationsPage() {
  return (
    <AdminScreen
      title="Applications"
      subtitle="Review applicants and hire — accepting creates their intern profile"
      back="/admin"
    >
      <Suspense fallback={<Loading label="Loading applications…" />}>
        <ApplicationsBody />
      </Suspense>
    </AdminScreen>
  );
}
