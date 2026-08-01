'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import CurrencyRupeeRoundedIcon from '@mui/icons-material/CurrencyRupeeRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import LaptopMacRoundedIcon from '@mui/icons-material/LaptopMacRounded';
import Art from '@/components/Art';
import EmptyState from '@/components/EmptyState';
import Label from '@/components/Label';
import PublicShell from '@/components/PublicShell';
import Reveal from '@/components/Reveal';
import SectionHead from '@/components/SectionHead';
import { AMBER_HAIRLINE, EYEBROW, INK, NIGHT_PILL_SX, NIGHT_SKY, STARFIELD } from '@/components/night';
import { ART } from '@/lib/art';
import { useAuth } from '@/lib/auth/AuthContext';
import { celebrate } from '@/lib/juice';
import { FONT_DISPLAY } from '@/theme';
import {
  applyToOpening,
  formatListingDate,
  formatStipend,
  getOpeningWithMine,
  LOCATION_LABEL,
  SUBMISSION_STATUS_LABEL,
  type ApplyPayload,
  type MyApplicationSummary,
  type Opening,
  type OpeningQuestion,
} from '@/lib/api/openings';

/**
 * The application form for one opening.
 *
 * Unlike the listing pages this route is deliberately CLIENT-ONLY and behind
 * auth: an application belongs to a TalkDrill account, and there is nothing
 * here worth indexing (the role's own page at /internships/[slug] is the
 * indexable surface). The guard is hand-rolled rather than <RequireAuth> so the
 * candidate lands back on this exact form after signing in — losing a
 * half-considered pitch to a redirect is how applications get abandoned.
 */

interface FormState {
  fullName: string;
  phone: string;
  city: string;
  college: string;
  graduationYear: string;
  pitch: string;
  resumeUrl: string;
  portfolioUrl: string;
  instagram: string;
  youtube: string;
  linkedin: string;
  availableFrom: string;
}

const EMPTY_FORM: FormState = {
  fullName: '',
  phone: '',
  city: '',
  college: '',
  graduationYear: '',
  pitch: '',
  resumeUrl: '',
  portfolioUrl: '',
  instagram: '',
  youtube: '',
  linkedin: '',
  availableFrom: '',
};

/** Answers are namespaced in the error map so a question key never collides
 *  with a form field name (a question could legitimately be called "city"). */
const errKey = (q: OpeningQuestion) => `answer:${q.key}`;

const clean = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

/* -------------------------------------------------------------- SUB-VIEWS */

function CenteredSpinner() {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
      <CircularProgress />
    </Box>
  );
}

/** Night band carrying the role you are applying to, so the form never floats
 *  free of its context on a long scroll. In interest mode it says plainly what
 *  this form now is — a waitlist, not an application. */
function ApplyHeader({ opening, isInterest }: { opening: Opening; isInterest: boolean }) {
  const facts: { icon: React.ReactNode; text: string }[] = [
    {
      icon: <LaptopMacRoundedIcon sx={{ fontSize: 16 }} />,
      text:
        LOCATION_LABEL[opening.locationType] +
        (opening.city && opening.locationType !== 'wfh' ? ` · ${opening.city}` : ''),
    },
    ...(opening.duration
      ? [{ icon: <AccessTimeRoundedIcon sx={{ fontSize: 16 }} />, text: opening.duration }]
      : []),
    {
      icon: <CurrencyRupeeRoundedIcon sx={{ fontSize: 16 }} />,
      text: formatStipend(opening.stipend),
    },
    ...(opening.applyBy
      ? [
          {
            icon: <EventAvailableRoundedIcon sx={{ fontSize: 16 }} />,
            text: isInterest
              ? `Closed ${formatListingDate(opening.applyBy)}`
              : `Apply by ${formatListingDate(opening.applyBy)}`,
          },
        ]
      : []),
  ];

  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        color: '#fff',
        background: NIGHT_SKY,
        '&::before': STARFIELD,
        '&::after': AMBER_HAIRLINE,
      }}
    >
      <Container maxWidth="md" sx={{ py: { xs: 4, md: 5.5 }, position: 'relative', zIndex: 1 }}>
        <Button
          component={Link}
          href={`/internships/${opening.slug}`}
          startIcon={<ArrowBackRoundedIcon />}
          sx={{
            mb: 1.5,
            ml: -1.5,
            color: INK.muted,
            fontWeight: 600,
            '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' },
          }}
        >
          Back to the role
        </Button>

        <Typography sx={{ ...EYEBROW, color: INK.amber, mb: 1 }}>
          {isInterest
            ? 'Register your interest'
            : opening.category
              ? `Apply · ${opening.category}`
              : 'Apply'}
        </Typography>
        <Typography variant="h3" component="h1" sx={{ mb: 2 }}>
          {opening.title}
        </Typography>

        {isInterest && (
          <Typography sx={{ color: INK.muted, maxWidth: 560, mb: 2.5 }}>
            This round has closed. Leave your details and we&apos;ll email you the moment it opens
            again.
          </Typography>
        )}

        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
          {facts.map((fact) => (
            <Box key={fact.text} sx={NIGHT_PILL_SX}>
              <Box sx={{ display: 'flex', color: INK.amber }}>{fact.icon}</Box>
              {fact.text}
            </Box>
          ))}
        </Stack>
      </Container>
    </Box>
  );
}

/** The one big moment on this page — submitted, already applied, or already
 *  on the waitlist. */
function OutcomePanel({
  art,
  eyebrow,
  title,
  body,
  meta,
  actions,
}: {
  art: string;
  eyebrow: string;
  title: string;
  body: string;
  meta?: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <Card sx={{ p: { xs: 3, md: 5 }, textAlign: 'center' }}>
      <Stack spacing={2} alignItems="center">
        <Art src={art} size={{ xs: 108, md: 120 }} />
        <Box>
          <Typography variant="overline" sx={{ color: 'primary.main', display: 'block' }}>
            {eyebrow}
          </Typography>
          <Typography
            component="h2"
            sx={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 600,
              fontSize: 'clamp(1.75rem, 1.4rem + 1.6vw, 2.5rem)',
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </Typography>
        </Box>
        {meta}
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 460 }}>
          {body}
        </Typography>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ pt: 1, width: { xs: '100%', sm: 'auto' } }}
        >
          {actions}
        </Stack>
      </Stack>
    </Card>
  );
}

/* ------------------------------------------------------------------ PAGE */

export default function ApplyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = React.use(params);
  const { ready, auth } = useAuth();
  const router = useRouter();

  const [opening, setOpening] = useState<Opening | null>(null);
  const [mine, setMine] = useState<MyApplicationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [confirmsDuration, setConfirmsDuration] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const formRef = useRef<HTMLFormElement | null>(null);

  // Auth is mandatory here, and the `next` param is the whole point: the
  // candidate must come back to THIS form, not to a generic dashboard.
  useEffect(() => {
    if (!ready || auth) return;
    router.replace(`/login?next=${encodeURIComponent(`/apply/${slug}`)}`);
  }, [ready, auth, router, slug]);

  useEffect(() => {
    if (!ready || !auth) return;
    let alive = true;
    setLoading(true);
    setLoadError(null);
    getOpeningWithMine(slug)
      .then((res) => {
        if (!alive) return;
        setOpening(res.opening);
        setMine(res.myApplication);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setLoadError(e instanceof Error ? e.message : 'Could not load this role.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [ready, auth, slug]);

  // Prefill the name from the account, but never overwrite something typed.
  useEffect(() => {
    const name = auth?.user?.name;
    if (!name) return;
    setForm((prev) => (prev.fullName ? prev : { ...prev, fullName: name }));
  }, [auth]);

  const questions: OpeningQuestion[] = useMemo(() => opening?.questions ?? [], [opening]);

  /**
   * Interest mode: the deadline has passed, so this form is a waitlist. We ask
   * for the contact details the team will need later and nothing else — a
   * required pitch or a "I can commit to the duration" checkbox would be
   * asking someone to promise against dates that do not exist yet.
   */
  const isInterest = !!opening && !opening.isOpen;

  const commitLabel = opening?.duration
    ? `I can commit to the full ${opening.duration}`
    : 'I can commit to the full internship duration';

  const setField = useCallback(
    (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { value } = event.target;
      setForm((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => (prev[key] ? { ...prev, [key]: '' } : prev));
    },
    []
  );

  const setAnswer = useCallback(
    (q: OpeningQuestion) =>
      (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { value } = event.target;
        setAnswers((prev) => ({ ...prev, [q.key]: value }));
        setErrors((prev) => (prev[errKey(q)] ? { ...prev, [errKey(q)]: '' } : prev));
      },
    []
  );

  /** Returns the error map so the caller can act on it without a state round-trip. */
  const validate = useCallback((): Record<string, string> => {
    const next: Record<string, string> = {};
    if (!form.fullName.trim()) next.fullName = 'Please tell us your name.';
    if (!isInterest && !form.pitch.trim()) {
      next.pitch = 'A pitch is required — a few honest lines is plenty.';
    }

    if (form.graduationYear.trim()) {
      const year = Number(form.graduationYear.trim());
      if (!Number.isInteger(year) || year < 1950 || year > 2100) {
        next.graduationYear = 'Enter a four-digit year.';
      }
    }

    // A waitlist entry never blocks on the role's own screening questions.
    if (!isInterest) {
      questions.forEach((q) => {
        if (q.required && !(answers[q.key] ?? '').trim()) {
          next[errKey(q)] = 'This one is required.';
        }
      });

      if (!confirmsDuration) next.confirmsDuration = 'Please confirm before submitting.';
    }
    return next;
  }, [form, answers, questions, confirmsDuration, isInterest]);

  const handleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (busy || !opening) return;

    setSubmitError(null);
    const found = validate();
    setErrors(found);

    const firstKey = Object.keys(found)[0];
    if (firstKey) {
      // Take the candidate to the problem — a disabled button explains nothing.
      const field = formRef.current?.querySelector<HTMLElement>(`[name="${firstKey}"]`);
      field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      field?.focus({ preventScroll: true });
      return;
    }

    const trimmedAnswers: Record<string, string> = {};
    questions.forEach((q) => {
      const value = (answers[q.key] ?? '').trim();
      if (value) trimmedAnswers[q.key] = value;
    });

    const socialHandles: NonNullable<ApplyPayload['socialHandles']> = {};
    if (clean(form.instagram)) socialHandles.instagram = form.instagram.trim();
    if (clean(form.youtube)) socialHandles.youtube = form.youtube.trim();
    if (clean(form.linkedin)) socialHandles.linkedin = form.linkedin.trim();

    const payload: ApplyPayload = {
      slug: opening.slug,
      fullName: form.fullName.trim(),
      phone: clean(form.phone),
      city: clean(form.city),
      college: clean(form.college),
      graduationYear: form.graduationYear.trim() ? Number(form.graduationYear.trim()) : undefined,
      pitch: isInterest ? clean(form.pitch) : form.pitch.trim(),
      answers: Object.keys(trimmedAnswers).length ? trimmedAnswers : undefined,
      resumeUrl: clean(form.resumeUrl),
      portfolioUrl: clean(form.portfolioUrl),
      socialHandles: Object.keys(socialHandles).length ? socialHandles : undefined,
      availableFrom: clean(form.availableFrom),
      // Nothing to commit to yet when the next round has no dates.
      confirmsDuration: isInterest ? false : true,
    };

    setBusy(true);
    try {
      await applyToOpening(payload);
      // No confetti for "we'll tell you later" — the good news has not happened.
      if (!isInterest) celebrate();
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: unknown) {
      setSubmitError(
        e instanceof Error
          ? e.message
          : isInterest
            ? 'Could not register your interest.'
            : 'Could not send your application.'
      );
    } finally {
      setBusy(false);
    }
  };

  /* ------------------------------------------------------------- GATES */

  if (!ready || (ready && !auth)) {
    return (
      <PublicShell>
        <CenteredSpinner />
      </PublicShell>
    );
  }

  if (loading) {
    return (
      <PublicShell>
        <CenteredSpinner />
      </PublicShell>
    );
  }

  if (loadError || !opening) {
    return (
      <PublicShell>
        <Container maxWidth="sm" sx={{ py: { xs: 6, md: 10 } }}>
          <EmptyState
            art={ART.empty.error}
            title="We could not open this role"
            description={loadError ?? 'The link may be out of date, or the role has been removed.'}
            action={
              <Button component={Link} href="/internships" variant="contained">
                Browse open roles
              </Button>
            }
          />
        </Container>
      </PublicShell>
    );
  }

  const alreadyApplied = mine !== null;
  const onWaitlist = mine?.status === 'waitlisted';
  // A closed role is no longer a dead end — the form stays, as a waitlist.
  const showForm = !submitted && !alreadyApplied;
  const submitLabel = isInterest ? 'Register my interest' : 'Submit application';
  const email = auth?.user?.email ?? 'you';

  /* ------------------------------------------------------------ RENDER */

  return (
    <PublicShell>
      <ApplyHeader opening={opening} isInterest={isInterest} />

      <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 }, pb: { xs: 14, md: 8 } }}>
        {submitted && (
          <OutcomePanel
            art={isInterest ? ART.mascot.sleeping : ART.character.present}
            eyebrow={isInterest ? 'On the list' : 'All done'}
            title={isInterest ? "You're on the list" : 'Application submitted'}
            body={
              isInterest
                ? `We'll email ${email} when this role opens again.`
                : "We read every application. You'll hear from us by email — keep an eye on the inbox for the account you applied with."
            }
            actions={
              <>
                <Button component={Link} href="/applications" variant="contained" size="large">
                  {isInterest ? 'View my submissions' : 'Track my applications'}
                </Button>
                <Button component={Link} href="/internships" variant="outlined" size="large">
                  Browse open roles
                </Button>
              </>
            }
          />
        )}

        {!submitted && alreadyApplied && mine && (
          <OutcomePanel
            art={
              onWaitlist
                ? ART.mascot.sleeping
                : mine.status === 'withdrawn' || mine.status === 'rejected'
                  ? ART.character.question
                  : ART.character.present
            }
            eyebrow={onWaitlist ? 'Already on the list' : 'Already on file'}
            title={
              onWaitlist
                ? "You're already on the list for this role"
                : mine.status === 'withdrawn'
                  ? 'You withdrew this application'
                  : "You've already applied"
            }
            body={
              mine.decisionNote
                ? mine.decisionNote
                : onWaitlist
                  ? "We have your details. You'll get an email as soon as this role runs again — there's nothing else to do."
                  : mine.status === 'withdrawn'
                    ? 'This application is no longer in the queue. You can still apply to any other open role.'
                    : 'One application per role is enough — sending another will not move you up the queue.'
            }
            meta={
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" justifyContent="center">
                <Label color={SUBMISSION_STATUS_LABEL[mine.status].color} variant="soft">
                  {SUBMISSION_STATUS_LABEL[mine.status].label}
                </Label>
                <Typography variant="body2" color="text.secondary">
                  {onWaitlist ? 'Registered' : 'Applied'} {formatListingDate(mine.appliedAt)}
                </Typography>
              </Stack>
            }
            actions={
              <>
                <Button component={Link} href="/applications" variant="contained" size="large">
                  {onWaitlist ? 'View my submissions' : 'View my applications'}
                </Button>
                <Button component={Link} href="/internships" variant="outlined" size="large">
                  Browse open roles
                </Button>
              </>
            }
          />
        )}

        {showForm && (
          <Box component="form" ref={formRef} onSubmit={handleSubmit} noValidate>
            {submitError && (
              <Alert severity="error" sx={{ mb: 3 }} onClose={() => setSubmitError(null)}>
                {submitError}
              </Alert>
            )}

            <Stack spacing={3}>
              {/* ------------------------------------------------ ABOUT YOU */}
              <Reveal index={0}>
                <Card sx={{ p: { xs: 2.5, md: 3.5 } }}>
                  <SectionHead
                    label="About you"
                    caption={
                      isInterest
                        ? 'The basics, so we know who to reach when this role runs again.'
                        : 'The basics, so we know who we are reading.'
                    }
                    sx={{ mb: 2.5 }}
                  />
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        name="fullName"
                        label="Full name"
                        required
                        value={form.fullName}
                        onChange={setField('fullName')}
                        error={Boolean(errors.fullName)}
                        helperText={errors.fullName || ' '}
                        autoComplete="name"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        name="email"
                        label="Email"
                        value={auth?.user?.email ?? ''}
                        helperText="This is the account you're applying with"
                        slotProps={{ input: { readOnly: true } }}
                        sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'grey.100' } }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        name="phone"
                        label="Phone"
                        type="tel"
                        value={form.phone}
                        onChange={setField('phone')}
                        autoComplete="tel"
                        helperText=" "
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        name="city"
                        label="City"
                        value={form.city}
                        onChange={setField('city')}
                        autoComplete="address-level2"
                        helperText=" "
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 8 }}>
                      <TextField
                        name="college"
                        label="College or university"
                        value={form.college}
                        onChange={setField('college')}
                        helperText=" "
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        name="graduationYear"
                        label="Graduation year"
                        type="number"
                        value={form.graduationYear}
                        onChange={setField('graduationYear')}
                        error={Boolean(errors.graduationYear)}
                        helperText={errors.graduationYear || ' '}
                        slotProps={{ htmlInput: { inputMode: 'numeric', min: 1950, max: 2100 } }}
                      />
                    </Grid>
                  </Grid>
                </Card>
              </Reveal>

              {/* --------------------------------------- YOUR APPLICATION */}
              <Reveal index={1}>
                <Card sx={{ p: { xs: 2.5, md: 3.5 } }}>
                  <SectionHead
                    label={isInterest ? 'Register your interest' : 'Your application'}
                    caption={
                      isInterest
                        ? 'Nothing below is required — it just helps us remember you.'
                        : 'This is the part we actually read.'
                    }
                    sx={{ mb: 2.5 }}
                  />
                  <Stack spacing={2.5}>
                    <TextField
                      name="pitch"
                      label={
                        isInterest ? "Anything you'd like us to know (optional)" : 'Your pitch'
                      }
                      required={!isInterest}
                      multiline
                      rows={isInterest ? 4 : 6}
                      value={form.pitch}
                      onChange={setField('pitch')}
                      error={Boolean(errors.pitch)}
                      helperText={
                        errors.pitch ||
                        (isInterest
                          ? 'Why this role interests you, or what you have done before.'
                          : 'What makes you right for this role? Be specific.')
                      }
                    />

                    {questions.map((q) => {
                      const value = answers[q.key] ?? '';
                      const error = errors[errKey(q)];
                      // On a waitlist every screening question is optional.
                      const required = !isInterest && q.required;
                      const helper =
                        error ||
                        q.helperText ||
                        (q.maxLength ? `${value.length}/${q.maxLength}` : ' ');

                      if (q.type === 'select') {
                        return (
                          <TextField
                            key={q.key}
                            name={errKey(q)}
                            select
                            label={q.label}
                            required={required}
                            value={value}
                            onChange={setAnswer(q)}
                            error={Boolean(error)}
                            helperText={helper}
                          >
                            {(q.options ?? []).map((option) => (
                              <MenuItem key={option} value={option}>
                                {option}
                              </MenuItem>
                            ))}
                          </TextField>
                        );
                      }

                      return (
                        <TextField
                          key={q.key}
                          name={errKey(q)}
                          label={q.label}
                          required={required}
                          value={value}
                          onChange={setAnswer(q)}
                          error={Boolean(error)}
                          helperText={helper}
                          multiline={q.type === 'textarea'}
                          rows={q.type === 'textarea' ? 4 : undefined}
                          type={q.type === 'url' ? 'url' : 'text'}
                          placeholder={q.type === 'url' ? 'https://' : undefined}
                          slotProps={
                            q.maxLength ? { htmlInput: { maxLength: q.maxLength } } : undefined
                          }
                        />
                      );
                    })}
                  </Stack>
                </Card>
              </Reveal>

              {/* ------------------------------- LINKS AND AVAILABILITY */}
              <Reveal index={2}>
                <Card sx={{ p: { xs: 2.5, md: 3.5 } }}>
                  <SectionHead
                    label="Links and availability"
                    caption="Anything that shows your work helps. Leave blank what you do not have."
                    sx={{ mb: 2.5 }}
                  />
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        name="resumeUrl"
                        label="Resume link"
                        type="url"
                        placeholder="https://"
                        value={form.resumeUrl}
                        onChange={setField('resumeUrl')}
                        helperText="A public Drive or Dropbox link works"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        name="portfolioUrl"
                        label="Portfolio or website"
                        type="url"
                        placeholder="https://"
                        value={form.portfolioUrl}
                        onChange={setField('portfolioUrl')}
                        helperText=" "
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        name="instagram"
                        label="Instagram"
                        value={form.instagram}
                        onChange={setField('instagram')}
                        placeholder="@username"
                        helperText=" "
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        name="youtube"
                        label="YouTube"
                        value={form.youtube}
                        onChange={setField('youtube')}
                        placeholder="Channel name or link"
                        helperText=" "
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        name="linkedin"
                        label="LinkedIn"
                        value={form.linkedin}
                        onChange={setField('linkedin')}
                        placeholder="Profile link"
                        helperText=" "
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        name="availableFrom"
                        label="Available from"
                        type="date"
                        value={form.availableFrom}
                        onChange={setField('availableFrom')}
                        slotProps={{ inputLabel: { shrink: true } }}
                        helperText="The earliest date you could start"
                      />
                    </Grid>

                    {/* Hidden in interest mode: there are no dates yet, so there
                        is nothing honest to ask someone to commit to. */}
                    {!isInterest && (
                      <Grid size={{ xs: 12 }}>
                        <Box
                          sx={{
                            mt: { xs: 0, sm: 1 },
                            p: 2,
                            borderRadius: 2.5,
                            border: '1px solid',
                            borderColor: errors.confirmsDuration ? 'error.main' : 'divider',
                            bgcolor: (theme) =>
                              errors.confirmsDuration
                                ? alpha(theme.palette.error.main, 0.04)
                                : 'grey.100',
                          }}
                        >
                          <FormControlLabel
                            control={
                              <Checkbox
                                name="confirmsDuration"
                                checked={confirmsDuration}
                                onChange={(e) => {
                                  setConfirmsDuration(e.target.checked);
                                  setErrors((prev) =>
                                    prev.confirmsDuration ? { ...prev, confirmsDuration: '' } : prev
                                  );
                                }}
                              />
                            }
                            label={
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {commitLabel}
                              </Typography>
                            }
                            sx={{ alignItems: 'flex-start', m: 0, '& .MuiCheckbox-root': { pt: 0.25 } }}
                          />
                          {errors.confirmsDuration && (
                            <FormHelperText error sx={{ ml: 4.25, mt: 0 }}>
                              {errors.confirmsDuration}
                            </FormHelperText>
                          )}
                        </Box>
                      </Grid>
                    )}
                  </Grid>
                </Card>
              </Reveal>

              {/* Desktop submit. The phone gets the sticky bar below instead. */}
              <Stack
                direction="row"
                spacing={2}
                alignItems="center"
                sx={{ display: { xs: 'none', md: 'flex' } }}
              >
                <Button type="submit" variant="contained" size="large" disabled={busy} sx={{ px: 5 }}>
                  {busy ? 'Sending…' : submitLabel}
                </Button>
                <Typography variant="caption" color="text.secondary">
                  {isInterest
                    ? 'One email when this role reopens — nothing else.'
                    : 'You can withdraw any time from My applications.'}
                </Typography>
              </Stack>
            </Stack>
          </Box>
        )}
      </Container>

      {/* Sticky phone submit — rendered at the page root, outside every Reveal,
          because an animated ancestor's transform would trap position: fixed. */}
      {showForm && (
        <Box
          sx={{
            display: { xs: 'block', md: 'none' },
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: (theme) => theme.zIndex.appBar,
            px: 2,
            pt: 1.5,
            pb: 'calc(12px + env(safe-area-inset-bottom))',
            bgcolor: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(12px)',
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Button
            fullWidth
            variant="contained"
            size="large"
            disabled={busy}
            onClick={() => handleSubmit()}
          >
            {busy ? 'Sending…' : submitLabel}
          </Button>
        </Box>
      )}
    </PublicShell>
  );
}
