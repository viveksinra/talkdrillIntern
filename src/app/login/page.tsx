'use client';

import { useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Fade from '@mui/material/Fade';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import Logo from '@/components/Logo';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  adminPasswordLogin,
  adminVerifyTwoFa,
  getAuthMethod,
  sendEmailOtp,
  verifyEmailOtp,
  type TwoFaChallenge,
} from '@/lib/api/auth';

/**
 * One email field, then whichever credential that account actually uses.
 * Staff get password + 2FA, interns get an email OTP — the portal never
 * advertises an admin entrance.
 */
type Step = 'email' | 'otp' | 'password' | 'twofa';

const SELLING_POINTS = [
  { icon: TaskAltRoundedIcon, text: 'See every task and deadline in one place' },
  { icon: CheckCircleRoundedIcon, text: 'Submit proof from your phone in seconds' },
  { icon: EmojiEventsRoundedIcon, text: 'Track points, stipend and rewards live' },
];

export default function LoginPage() {
  const { ready, auth, login } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState<TwoFaChallenge | null>(null);

  useEffect(() => {
    if (!ready || !auth) return;
    router.replace(auth.principal === 'admin' ? '/admin' : '/tasks');
  }, [ready, auth, router]);

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const handleEmail = () =>
    run(async () => {
      const trimmed = email.trim();
      const method = await getAuthMethod(trimmed);
      if (method === 'password') {
        setStep('password');
        return;
      }
      await sendEmailOtp(trimmed);
      setStep('otp');
      setInfo(`Code sent to ${trimmed}`);
    });

  const handleOtp = () =>
    run(async () => {
      login(await verifyEmailOtp(email.trim(), otp.trim()));
      router.replace('/tasks');
    });

  const handlePassword = () =>
    run(async () => {
      const ch = await adminPasswordLogin(email.trim(), password);
      setChallenge(ch);
      setStep('twofa');
      setOtp('');
      setInfo(`Code sent to ${ch.maskedEmail}`);
    });

  const handleTwoFa = () =>
    run(async () => {
      if (!challenge) throw new Error('Please sign in again');
      login(await adminVerifyTwoFa(challenge.challengeId, otp.trim()));
      router.replace('/admin');
    });

  const restart = () => {
    setStep('email');
    setOtp('');
    setPassword('');
    setChallenge(null);
    setError(null);
    setInfo(null);
  };

  const heading = useMemo(() => {
    switch (step) {
      case 'otp':
      case 'twofa':
        return { title: 'Check your email', sub: 'Enter the code we just sent you.' };
      case 'password':
        return { title: 'Welcome back', sub: 'Enter your team password to continue.' };
      default:
        return { title: 'Sign in', sub: 'Use the email your internship is registered with.' };
    }
  }, [step]);

  const codeField = (
    <TextField
      label="Verification code"
      value={otp}
      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
      autoFocus
      slotProps={{
        htmlInput: {
          inputMode: 'numeric',
          autoComplete: 'one-time-code',
          style: { fontSize: 24, letterSpacing: '0.4em', fontWeight: 700, textAlign: 'center' },
        },
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' || otp.trim().length < 4) return;
        if (step === 'otp') handleOtp();
        else handleTwoFa();
      }}
    />
  );

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1.05fr 1fr' },
        bgcolor: 'background.paper',
      }}
    >
      {/* Brand panel — desktop only; the phone gets a compact header instead. */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: 6,
          position: 'relative',
          overflow: 'hidden',
          color: 'common.white',
          background: (t) =>
            `linear-gradient(150deg, ${t.palette.primary.darker} 0%, ${t.palette.primary.dark} 45%, ${t.palette.primary.main} 100%)`,
          '&::after': {
            // Soft light bloom, echoing the gradient in the logo mark.
            content: '""',
            position: 'absolute',
            width: 620,
            height: 620,
            right: -220,
            top: -180,
            borderRadius: '50%',
            background: (t) =>
              `radial-gradient(circle, ${alpha(t.palette.common.white, 0.16)} 0%, transparent 65%)`,
          },
        }}
      >
        {/* White lockup reads correctly on the deep violet panel. */}
        <Box
          component="img"
          src="/logo/Talk Drill-White-PNG.png"
          alt="TalkDrill"
          sx={{ height: 40, width: 'auto', alignSelf: 'flex-start', position: 'relative', zIndex: 1 }}
        />

        <Stack spacing={3} sx={{ position: 'relative', zIndex: 1, maxWidth: 460 }}>
          <Typography variant="h2" sx={{ color: 'inherit' }}>
            Do the work.
            <br />
            Earn the rewards.
          </Typography>
          <Typography sx={{ opacity: 0.85, fontSize: 17, lineHeight: 1.6 }}>
            The TalkDrill internship portal for Campus Ambassadors, Content Creators and the Growth
            team.
          </Typography>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            {SELLING_POINTS.map(({ icon: Icon, text }) => (
              <Stack key={text} direction="row" spacing={1.5} alignItems="center">
                <Icon sx={{ fontSize: 20, opacity: 0.9 }} />
                <Typography sx={{ opacity: 0.9, fontSize: 15 }}>{text}</Typography>
              </Stack>
            ))}
          </Stack>
        </Stack>

        <Typography variant="caption" sx={{ opacity: 0.6, position: 'relative', zIndex: 1 }}>
          © {new Date().getFullYear()} TalkDrill
        </Typography>
      </Box>

      {/* Form panel */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 3, sm: 5 },
          bgcolor: { xs: 'background.paper', md: 'background.default' },
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 400 }}>
          <Box sx={{ display: { md: 'none' }, mb: 4 }}>
            <Logo variant="full" height={30} />
          </Box>

          <Card sx={{ boxShadow: { xs: 'none', md: undefined }, border: { xs: 'none', md: undefined } }}>
            <CardContent sx={{ p: { xs: 0, md: 4 } }}>
              <Stack spacing={0.75} sx={{ mb: 3 }}>
                <Typography variant="h4">{heading.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {heading.sub}
                </Typography>
              </Stack>

              {error && (
                <Alert severity="error" sx={{ mb: 2.5 }}>
                  {error}
                </Alert>
              )}
              {info && !error && (
                <Alert severity="success" icon={false} sx={{ mb: 2.5 }}>
                  {info}
                </Alert>
              )}

              <Fade in key={step}>
                <Box>
                  {step === 'email' && (
                    <Stack spacing={2.5}>
                      <TextField
                        label="Email address"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoFocus
                        autoComplete="email"
                        onKeyDown={(e) => e.key === 'Enter' && email.trim() && handleEmail()}
                        slotProps={{
                          input: {
                            endAdornment: (
                              <InputAdornment position="end">
                                <ArrowForwardRoundedIcon
                                  fontSize="small"
                                  sx={{ color: 'text.disabled' }}
                                />
                              </InputAdornment>
                            ),
                          },
                        }}
                      />
                      <Button
                        variant="contained"
                        size="large"
                        disabled={busy || !email.trim()}
                        onClick={handleEmail}
                      >
                        {busy ? 'Just a moment…' : 'Continue'}
                      </Button>
                    </Stack>
                  )}

                  {step === 'otp' && (
                    <Stack spacing={2.5}>
                      {codeField}
                      <Button
                        variant="contained"
                        size="large"
                        disabled={busy || otp.trim().length < 4}
                        onClick={handleOtp}
                      >
                        {busy ? 'Verifying…' : 'Sign in'}
                      </Button>
                    </Stack>
                  )}

                  {step === 'password' && (
                    <Stack spacing={2.5}>
                      <TextField
                        label="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoFocus
                        autoComplete="current-password"
                        onKeyDown={(e) => e.key === 'Enter' && password && handlePassword()}
                      />
                      <Button
                        variant="contained"
                        size="large"
                        disabled={busy || !password}
                        onClick={handlePassword}
                      >
                        {busy ? 'Checking…' : 'Continue'}
                      </Button>
                    </Stack>
                  )}

                  {step === 'twofa' && (
                    <Stack spacing={2.5}>
                      {codeField}
                      <Button
                        variant="contained"
                        size="large"
                        disabled={busy || otp.trim().length < 4}
                        onClick={handleTwoFa}
                      >
                        {busy ? 'Verifying…' : 'Sign in'}
                      </Button>
                    </Stack>
                  )}
                </Box>
              </Fade>

              {step !== 'email' && (
                <Button
                  size="small"
                  startIcon={<ArrowBackRoundedIcon />}
                  disabled={busy}
                  onClick={restart}
                  sx={{ mt: 2, color: 'text.secondary' }}
                >
                  Use a different email
                </Button>
              )}
            </CardContent>
          </Card>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', textAlign: 'center', mt: 3 }}
          >
            Trouble signing in? Message the TalkDrill team.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
