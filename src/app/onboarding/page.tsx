'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import AppShell from '@/components/AppShell';
import { ErrorState, Loading, errorMessage } from '@/components/DataStates';
import PageHeader from '@/components/PageHeader';
import { RequireAuth } from '@/lib/auth/guards';
import { getMe, updateMyProfile, type MeResponse } from '@/lib/api/internship';
import type { SocialHandles, Track, UpdateMyProfileBody } from '@/lib/api/types';

const TRACKS: { value: Track; label: string; blurb: string }[] = [
  {
    value: 'campus',
    label: 'Campus Ambassador',
    blurb: 'Run demos, put up posters and bring your campus onto TalkDrill.',
  },
  {
    value: 'content',
    label: 'Content Creator',
    blurb: 'Post reels and shorts about speaking English. Rewards scale with 30-day views.',
  },
  {
    value: 'marketing',
    label: 'Digital Marketing',
    blurb: 'Community outreach, groups and growth experiments with the team.',
  },
];

const HANDLE_FIELDS: { key: keyof SocialHandles; label: string; placeholder: string }[] = [
  { key: 'instagram', label: 'Instagram username', placeholder: 'yourhandle' },
  { key: 'youtube', label: 'YouTube channel', placeholder: '@yourchannel' },
  { key: 'linkedin', label: 'LinkedIn profile', placeholder: 'linkedin.com/in/you' },
  { key: 'other', label: 'Anything else', placeholder: 'X, Threads, blog…' },
];

/** Card sub-head: typographic, never a filled slab. */
function SectionHead({
  title,
  caption,
  tone = 'primary',
}: {
  title: string;
  caption?: string;
  tone?: 'primary' | 'muted';
}) {
  return (
    <Box sx={{ mb: caption ? 2 : 1.5 }}>
      <Typography
        variant="overline"
        sx={{ display: 'block', color: tone === 'primary' ? 'primary.main' : 'text.secondary' }}
      >
        {title}
      </Typography>
      {caption && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {caption}
        </Typography>
      )}
    </Box>
  );
}

function TrackPicker({ value, onChange }: { value: Track | ''; onChange: (t: Track) => void }) {
  return (
    <Stack spacing={1.25} role="radiogroup" aria-label="Internship track">
      {TRACKS.map((track) => {
        const selected = value === track.value;
        return (
          <Box
            key={track.value}
            onClick={() => onChange(track.value)}
            role="radio"
            aria-checked={selected}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onChange(track.value);
              }
            }}
            sx={{
              p: 1.75,
              borderRadius: 2.5,
              cursor: 'pointer',
              minHeight: 44,
              border: '1px solid',
              // Selection is exactly the state a coloured border is reserved for.
              borderColor: selected ? 'primary.main' : 'divider',
              bgcolor: selected ? 'primary.lighter' : 'background.paper',
              transition: (t) =>
                t.transitions.create(['border-color', 'background-color'], { duration: 160 }),
              '&:hover': { borderColor: selected ? 'primary.main' : 'primary.light' },
            }}
          >
            <Stack direction="row" spacing={1.25} alignItems="flex-start">
              <Box
                sx={{
                  mt: '2px',
                  display: 'flex',
                  color: selected ? 'primary.main' : 'text.disabled',
                  '& svg': { fontSize: 20 },
                }}
              >
                {selected ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 700, color: selected ? 'primary.darker' : 'text.primary' }}
                >
                  {track.label}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {track.blurb}
                </Typography>
              </Box>
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}

function OnboardingForm({ me, onSaved }: { me: MeResponse; onSaved: (m: MeResponse) => void }) {
  const router = useRouter();
  const profile = me.internProfile!;
  // The track is a one-way choice on the backend — once set, the team owns changes.
  const trackLocked = Boolean(profile.track);

  const [fullName, setFullName] = useState(profile.fullName || me.user?.name || '');
  const [track, setTrack] = useState<Track | ''>(profile.track ?? '');
  const [appLinkInBio, setAppLinkInBio] = useState(profile.appLinkInBio);
  const [handles, setHandles] = useState<SocialHandles>({ ...(profile.socialHandles || {}) });
  const [accepted, setAccepted] = useState(profile.onboardingAccepted);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const alreadyOnboarded = profile.onboardingAccepted;

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
      router.push('/tasks');
    } catch (e) {
      setSaveError(errorMessage(e, 'Could not save your details.'));
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = accepted && (trackLocked || Boolean(track)) && !saving;

  return (
    <Stack spacing={2.5}>
      {alreadyOnboarded ? (
        <Alert
          severity="success"
          action={
            <Button component={Link} href="/tasks" color="inherit" size="small">
              My tasks
            </Button>
          }
        >
          You are set up. Keep this page handy — your handles are what reviewers check your proof
          against.
        </Alert>
      ) : (
        <Alert severity="info">
          Two minutes and you are in. We only ask for what we need to verify your work and pay out
          rewards.
        </Alert>
      )}

      <Card>
        <CardContent>
          <SectionHead title="Your details" caption="This is the name that goes on your certificate." />
          <Stack spacing={2}>
            <TextField
              label="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              inputProps={{ maxLength: 120 }}
            />
            <TextField label="Email" value={profile.email} disabled helperText="Set by the team." />
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <SectionHead
            title="Your track"
            caption={
              trackLocked
                ? 'Set by the team. Message us if it looks wrong — switching it later would orphan your assigned tasks.'
                : 'This decides your tasks and rewards, and only the team can change it afterwards.'
            }
          />
          {trackLocked ? (
            <Chip
              color="primary"
              sx={{ fontWeight: 700 }}
              label={TRACKS.find((t) => t.value === profile.track)?.label ?? profile.track}
            />
          ) : (
            <TrackPicker value={track} onChange={setTrack} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <SectionHead
            title="Where you post"
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
              <Switch checked={appLinkInBio} onChange={(e) => setAppLinkInBio(e.target.checked)} />
            }
            label={
              <Typography variant="body2">I have added my TalkDrill link in my bio</Typography>
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <SectionHead title="The ground rules" tone="muted" />
          <FormControlLabel
            control={<Checkbox checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />}
            label={
              <Typography variant="body2">
                I accept the internship guidelines: my own work only, honest proof, and no fake
                metrics. Rewards follow the reward table for my track.
              </Typography>
            }
            sx={{ alignItems: 'flex-start', mr: 0 }}
          />
        </CardContent>
      </Card>

      {saveError && <Alert severity="error">{saveError}</Alert>}

      {/* The one primary action on the page — the only full-width button that belongs. */}
      <Box>
        <Button
          fullWidth
          variant="contained"
          size="large"
          disabled={!canSubmit}
          onClick={submit}
        >
          {saving ? 'Saving…' : alreadyOnboarded ? 'Save changes' : 'Start my internship'}
        </Button>
        {!canSubmit && !saving && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 0.75, textAlign: 'center' }}
          >
            {!trackLocked && !track
              ? 'Pick a track to continue.'
              : 'Accept the guidelines to continue.'}
          </Typography>
        )}
      </Box>
    </Stack>
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

  return <OnboardingForm me={me} onSaved={setMe} />;
}

export default function OnboardingPage() {
  return (
    <RequireAuth>
      <AppShell>
        <PageHeader
          title="Welcome aboard"
          subtitle="Confirm a few details and your tasks unlock."
        />
        <OnboardingBody />
      </AppShell>
    </RequireAuth>
  );
}
