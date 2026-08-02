'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import AppShell from '@/components/AppShell';
import Art from '@/components/Art';
import { ErrorState, Loading, errorMessage } from '@/components/DataStates';
import Label from '@/components/Label';
import Reveal from '@/components/Reveal';
import SectionHead from '@/components/SectionHead';
import { RequireAuth } from '@/lib/auth/guards';
import { useReadOnly } from '@/lib/auth/AuthContext';
import ReadOnlyNotice from '@/components/ReadOnlyNotice';
import { ART } from '@/lib/art';
import { celebrate, haptic } from '@/lib/juice';
import { getMe, updateMyProfile, type MeResponse } from '@/lib/api/internship';
import { isPopulated } from '@/lib/api/types';
import type { SocialHandles, Track, UpdateMyProfileBody } from '@/lib/api/types';
import { FONT_DISPLAY, hoverLift } from '@/theme';

const TRACKS: {
  value: Track;
  label: string;
  blurb: string;
  /** How this track turns work into points — one short line under the blurb. */
  earn: string;
  art: string;
}[] = [
  {
    value: 'campus',
    label: 'Campus Ambassador',
    blurb: 'Run demos, put up posters and bring your campus onto TalkDrill.',
    earn: 'Points for every approved task',
    art: ART.track.campus,
  },
  {
    value: 'content',
    label: 'Content Creator',
    blurb: 'Post reels and shorts about speaking English.',
    earn: 'Task points + rewards that scale with 30-day views',
    art: ART.track.content,
  },
  {
    value: 'marketing',
    label: 'Digital Marketing',
    blurb: 'Community outreach, groups and growth experiments with the team.',
    earn: 'Points for every approved task',
    art: ART.track.marketing,
  },
];

const HANDLE_FIELDS: { key: keyof SocialHandles; label: string; placeholder: string }[] = [
  { key: 'instagram', label: 'Instagram username', placeholder: 'yourhandle' },
  { key: 'youtube', label: 'YouTube channel', placeholder: '@yourchannel' },
  { key: 'linkedin', label: 'LinkedIn profile', placeholder: 'linkedin.com/in/you' },
  { key: 'other', label: 'Anything else', placeholder: 'X, Threads, blog…' },
];

/** The single guidelines sentence, split into the promises it actually makes. */
const GUIDELINES = [
  'My own work only',
  'Honest proof on every submission',
  'No fake metrics',
  'Rewards follow the reward table for my track',
];

const STEP_TITLES = ['Welcome', 'Pick your track', 'Where you post'];

/** 8px dots, the active one stretched to a 24px pill. */
function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <Stack
      direction="row"
      spacing={1}
      justifyContent="center"
      alignItems="center"
      aria-hidden
      sx={{ mb: 2 }}
    >
      {Array.from({ length: total }, (_, i) => (
        <Box
          key={i}
          sx={{
            height: 8,
            width: i === step ? 24 : 8,
            borderRadius: 99,
            bgcolor: i === step ? 'primary.main' : i < step ? 'primary.light' : 'divider',
            transition: (t) =>
              t.transitions.create(['width', 'background-color'], { duration: 260 }),
          }}
        />
      ))}
    </Stack>
  );
}

function TrackCard({
  track,
  selected,
  locked,
  onSelect,
}: {
  track: (typeof TRACKS)[number];
  selected: boolean;
  locked?: boolean;
  onSelect?: () => void;
}) {
  const theme = useTheme();
  return (
    <Card
      onClick={onSelect}
      role={onSelect ? 'radio' : undefined}
      aria-checked={onSelect ? selected : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
      sx={{
        height: '100%',
        p: 2.5,
        cursor: onSelect ? 'pointer' : 'default',
        textAlign: 'center',
        position: 'relative',
        border: '2px solid',
        borderColor: selected ? 'primary.main' : 'transparent',
        bgcolor: selected ? 'primary.lighter' : 'background.paper',
        boxShadow: selected
          ? `0 0 0 4px ${alpha(theme.palette.primary.main, 0.12)}, 0 18px 36px -18px ${alpha(
              theme.palette.primary.main,
              0.7
            )}`
          : undefined,
        ...(onSelect ? hoverLift(theme.palette.primary.main) : null),
      }}
    >
      {selected && (
        <Box
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 24,
            height: 24,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'primary.main',
            color: 'common.white',
          }}
        >
          <CheckRoundedIcon sx={{ fontSize: 16 }} />
        </Box>
      )}
      <Stack alignItems="center" spacing={1.25}>
        <Art src={track.art} size={96} />
        <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.25 }}>
          {track.label}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ minHeight: { sm: 40 } }}>
          {track.blurb}
        </Typography>
        <Typography
          variant="caption"
          sx={{ display: 'block', color: 'primary.dark', fontWeight: 600 }}
        >
          {track.earn}
        </Typography>
        {locked && <Label color="primary">Assigned</Label>}
      </Stack>
    </Card>
  );
}

function OnboardingWizard({ me, onSaved }: { me: MeResponse; onSaved: (m: MeResponse) => void }) {
  const readOnly = useReadOnly();
  const router = useRouter();
  const profile = me.internProfile!;
  // The track is a one-way choice on the backend — once set, the team owns changes.
  const trackLocked = Boolean(profile.track);

  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState(profile.fullName || me.user?.name || '');
  const [track, setTrack] = useState<Track | ''>(profile.track ?? '');
  const [appLinkInBio, setAppLinkInBio] = useState(profile.appLinkInBio);
  const [handles, setHandles] = useState<SocialHandles>({ ...(profile.socialHandles || {}) });
  const [accepted, setAccepted] = useState(profile.onboardingAccepted);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const alreadyOnboarded = profile.onboardingAccepted;

  // Greeting is fixed at mount — it should not re-type itself while the field is edited.
  const firstName = useMemo(() => {
    const source = (profile.fullName || me.user?.name || '').trim();
    return source ? source.split(/\s+/)[0] : '';
  }, [profile.fullName, me.user?.name]);

  // programIds may arrive as ids or as populated batches; only name what we actually have.
  const batchName = useMemo(() => {
    const names = (profile.programIds || [])
      .map((p) => (isPopulated(p) ? p.name : null))
      .filter((n): n is string => Boolean(n));
    return names.length ? names.join(' · ') : null;
  }, [profile.programIds]);

  const lockedTrack = TRACKS.find((t) => t.value === profile.track);

  const setHandle = (key: keyof SocialHandles, value: string) =>
    setHandles((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    setSaving(true);
    setSaveError(null);
    const body: UpdateMyProfileBody = {
      fullName: fullName.trim() || undefined,
      appLinkInBio,
      socialHandles: handles,
      onboardingAccepted: true,
    };
    // Sending an unchanged track is rejected as a change attempt, so only send it
    // when the intern is the one choosing it.
    if (!trackLocked && track) body.track = track;

    try {
      const updated = await updateMyProfile(body);
      onSaved({ ...me, internProfile: updated });
      celebrate();
      router.push('/tasks');
    } catch (e) {
      setSaveError(errorMessage(e, 'Could not save your details.'));
    } finally {
      setSaving(false);
    }
  };

  // Never on someone else's behalf: this writes `track`, which is ONE-WAY once
  // set, and stamps onboardingAccepted — an acceptance record that would then
  // falsely read as theirs.
  const canSubmit = accepted && (trackLocked || Boolean(track)) && !saving && !readOnly;
  // Same gates as before, just checked at the step that owns them.
  const stepValid = [true, trackLocked || Boolean(track), accepted][step];

  const go = (next: number) => {
    haptic(10);
    setStep(next);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto' }}>
      <ReadOnlyNotice action="Onboarding changes" />
      <StepDots step={step} total={3} />
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          textAlign: 'center',
          color: 'text.disabled',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          mb: 2.5,
        }}
      >
        Step {step + 1} of 3 · {STEP_TITLES[step]}
      </Typography>

      {/* ── Step 1: welcome + who you are ─────────────────────────────── */}
      {step === 0 && (
        <Stack spacing={2.5}>
          <Reveal index={0}>
            <Stack alignItems="center" spacing={1.5} sx={{ textAlign: 'center' }}>
              <Art src={ART.scene.onboardingWelcome} size={{ xs: 150, sm: 180 }} />
              <Typography
                variant="h4"
                sx={{ fontFamily: FONT_DISPLAY, fontWeight: 600, lineHeight: 1.15 }}
              >
                {firstName ? `Welcome aboard, ${firstName}` : 'Welcome aboard'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
                Two minutes and you are in. We only ask for what we need to verify your work and
                pay out rewards.
              </Typography>
              {batchName && <Label color="secondary">{batchName}</Label>}
            </Stack>
          </Reveal>

          {alreadyOnboarded && (
            <Reveal index={1}>
              <Stack
                direction="row"
                spacing={1.5}
                alignItems="center"
                sx={{
                  px: 2,
                  py: 1.25,
                  borderRadius: 2,
                  bgcolor: 'success.lighter',
                  color: 'success.darker',
                }}
              >
                <Label color="success">Set up</Label>
                <Typography variant="body2" sx={{ flexGrow: 1, minWidth: 0 }}>
                  You are already set up — edit anything here and save again.
                </Typography>
                <Button component={Link} href="/tasks" size="small" color="success">
                  My tasks
                </Button>
              </Stack>
            </Reveal>
          )}

          <Reveal index={2}>
            <Card>
              <CardContent>
                <SectionHead
                  label="Your details"
                  caption="This is the name that goes on your certificate."
                />
                <Stack spacing={2}>
                  <TextField
                    label="Full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    inputProps={{ maxLength: 120 }}
                  />
                  <TextField
                    label="Email"
                    value={profile.email}
                    disabled
                    helperText="Set by the team."
                  />
                </Stack>
              </CardContent>
            </Card>
          </Reveal>
        </Stack>
      )}

      {/* ── Step 2: the track ─────────────────────────────────────────── */}
      {step === 1 && (
        <Stack spacing={2.5}>
          <SectionHead
            label="Pick your track"
            caption={
              trackLocked
                ? 'Set by the team. Message us if it looks wrong — switching it later would orphan your assigned tasks.'
                : 'This decides your tasks and rewards, and only the team can change it afterwards.'
            }
          />
          {trackLocked && lockedTrack ? (
            <Grid container spacing={2} justifyContent="center">
              <Grid size={{ xs: 12, sm: 6, md: 5 }}>
                <Reveal index={0} sx={{ height: '100%' }}>
                  <TrackCard track={lockedTrack} selected locked />
                </Reveal>
              </Grid>
            </Grid>
          ) : (
            <Grid container spacing={2} role="radiogroup" aria-label="Internship track">
              {TRACKS.map((t, i) => (
                <Grid key={t.value} size={{ xs: 12, sm: 4 }}>
                  <Reveal index={i} sx={{ height: '100%' }}>
                    <TrackCard
                      track={t}
                      selected={track === t.value}
                      onSelect={() => {
                        haptic(10);
                        setTrack(t.value);
                      }}
                    />
                  </Reveal>
                </Grid>
              ))}
            </Grid>
          )}
        </Stack>
      )}

      {/* ── Step 3: handles + ground rules ────────────────────────────── */}
      {step === 2 && (
        <Stack spacing={2.5}>
          <Reveal index={0}>
            <Card>
              <CardContent>
                <SectionHead
                  label="Where you post"
                  caption="Reviewers compare submitted proof against these handles, so keep them current."
                />
                <Stack spacing={2}>
                  {HANDLE_FIELDS.map((field) => (
                    <TextField
                      key={field.key}
                      label={field.label}
                      placeholder={field.placeholder}
                      value={handles[field.key] ?? ''}
                      onChange={(e) => setHandle(field.key, e.target.value)}
                      inputProps={{ maxLength: 200 }}
                    />
                  ))}
                </Stack>
                <FormControlLabel
                  sx={{ mt: 1.5, mr: 0 }}
                  control={
                    <Switch
                      checked={appLinkInBio}
                      onChange={(e) => setAppLinkInBio(e.target.checked)}
                    />
                  }
                  label={
                    <Typography variant="body2">
                      I have added my TalkDrill link in my bio
                    </Typography>
                  }
                />
              </CardContent>
            </Card>
          </Reveal>

          <Reveal index={1}>
            <Card>
              <CardContent>
                <SectionHead label="The ground rules" />
                <Stack component="ul" spacing={1.25} sx={{ m: 0, mb: 2, pl: 0, listStyle: 'none' }}>
                  {GUIDELINES.map((rule) => (
                    <Stack key={rule} component="li" direction="row" spacing={1.25} alignItems="center">
                      <Box
                        sx={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          flexShrink: 0,
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor: 'primary.lighter',
                          color: 'primary.main',
                        }}
                      >
                        <CheckRoundedIcon sx={{ fontSize: 14 }} />
                      </Box>
                      <Typography variant="body2">{rule}</Typography>
                    </Stack>
                  ))}
                </Stack>
                <FormControlLabel
                  control={
                    <Checkbox checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      I agree to the internship guidelines
                    </Typography>
                  }
                  sx={{ mr: 0 }}
                />
              </CardContent>
            </Card>
          </Reveal>

          {saveError && <Alert severity="error">{saveError}</Alert>}
        </Stack>
      )}

      {/* Wizard controls. Sticky on a phone so the next step is always a thumb away. */}
      <Box
        sx={{
          position: 'sticky',
          bottom: 0,
          zIndex: 2,
          mt: 3,
          pt: 2,
          pb: { xs: 'calc(8px + env(safe-area-inset-bottom))', sm: 2 },
          bgcolor: 'background.default',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button
            size="large"
            color="inherit"
            startIcon={<ArrowBackRoundedIcon />}
            disabled={step === 0 || saving}
            onClick={() => go(step - 1)}
            sx={{ color: 'text.secondary', visibility: step === 0 ? 'hidden' : 'visible' }}
          >
            Back
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          {step < 2 ? (
            <Button
              variant="contained"
              size="large"
              endIcon={<ArrowForwardRoundedIcon />}
              disabled={!stepValid}
              onClick={() => go(step + 1)}
              sx={{ minWidth: 148 }}
            >
              Continue
            </Button>
          ) : (
            <Button
              variant="contained"
              size="large"
              disabled={!canSubmit}
              onClick={submit}
              sx={{ minWidth: 190 }}
            >
              {saving ? 'Saving…' : alreadyOnboarded ? 'Save changes' : 'Start my internship'}
            </Button>
          )}
        </Stack>
        {!stepValid && !saving && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 0.75, textAlign: 'right' }}
          >
            {step === 1 ? 'Pick a track to continue.' : 'Accept the guidelines to continue.'}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

function OnboardingBody() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getMe()
      .then(setMe)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  if (loading) return <Loading label="Loading your profile…" />;
  if (error || !me) return <ErrorState error={error ?? 'No profile'} onRetry={load} />;

  if (!me.internProfile) {
    return (
      <Alert severity="info">
        This account is not enrolled in an internship yet. Sign in with the email you gave the
        TalkDrill team, or reply to your invite and we will sort it out.
      </Alert>
    );
  }

  return <OnboardingWizard me={me} onSaved={setMe} />;
}

export default function OnboardingPage() {
  return (
    <RequireAuth>
      {/* No nav: onboarding is a one-way corridor, not a tab. */}
      <AppShell hideNav>
        <OnboardingBody />
      </AppShell>
    </RequireAuth>
  );
}
