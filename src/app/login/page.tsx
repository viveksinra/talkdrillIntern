'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Fade from '@mui/material/Fade';
import InputAdornment from '@mui/material/InputAdornment';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import { AMBER_HAIRLINE, EYEBROW, INK, NIGHT_SKY, STARFIELD } from '@/components/night';
import { ART } from '@/lib/art';
import { useAuth } from '@/lib/auth/AuthContext';
import { FONT_DISPLAY, gradientTokens, textGradient } from '@/theme';
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

/** Only a fallback — the real length comes from send-email-otp (4 for some accounts). */
const DEFAULT_OTP_LENGTH = 6;
const RESEND_SECONDS = 30;
const SUPPORT_EMAIL = 'support@talkdrill.com';

/**
 * `?next=` is attacker-controlled: a login page that redirects anywhere is a
 * phishing primitive ("sign in to TalkDrill" → someone else's clone). Only a
 * same-origin *path* is honoured, so it must start with exactly one slash —
 * `//evil.com` is protocol-relative and `https://evil.com` is absolute, and
 * both are dropped in favour of the normal role default.
 */
function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  // `/\evil.com` is normalised to a host by some browsers — treat it as absolute too.
  if (raw.startsWith('/\\')) return null;
  return raw;
}

/** Only the apply flow needs the extra "you can create an account" reassurance. */
function isApplyTarget(next: string | null): boolean {
  if (!next) return false;
  return /(^|\/)apply(\/|$|\?|#)/.test(next);
}

/**
 * One box per digit over a single `otp` string: paste fills them all, backspace
 * on an empty box walks left, and any digit advances right. `length` is driven
 * by the backend's `otpLength` — hardcoding it locks out 4-digit accounts.
 */
function CodeBoxes({
  value,
  onChange,
  onEnter,
  disabled,
  length,
}: {
  value: string;
  onChange: (next: string) => void;
  onEnter: () => void;
  disabled?: boolean;
  length: number;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  const focus = (i: number) => {
    const el = refs.current[Math.max(0, Math.min(length - 1, i))];
    el?.focus();
    el?.select();
  };

  const write = (i: number, raw: string) => {
    const clean = raw.replace(/\D/g, '');
    if (!clean) return;
    // Clamp to the end of what is typed so a click on a far box never leaves a hole.
    const at = Math.min(i, value.length);
    const next = digits.slice();
    // A paste (or an autofilled OTP) lands in one box but fills the rest.
    clean.split('').forEach((ch, k) => {
      if (at + k < length) next[at + k] = ch;
    });
    onChange(next.join('').slice(0, length));
    focus(at + clean.length);
  };

  return (
    <Stack direction="row" spacing={{ xs: 0.75, sm: 1 }} justifyContent="space-between">
      {digits.map((digit, i) => (
        <TextField
          key={i}
          value={digit}
          disabled={disabled}
          autoFocus={i === 0}
          inputRef={(el: HTMLInputElement | null) => {
            refs.current[i] = el;
          }}
          onChange={(e) => write(i, e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onEnter();
              return;
            }
            if (e.key === 'Backspace') {
              e.preventDefault();
              // Truncate from the caret — an OTP is one contiguous string, never gappy.
              const cut = digit ? i : Math.max(0, i - 1);
              onChange(value.slice(0, cut));
              focus(cut);
              return;
            }
            if (e.key === 'ArrowLeft') focus(i - 1);
            if (e.key === 'ArrowRight') focus(i + 1);
          }}
          onPaste={(e) => {
            e.preventDefault();
            write(0, e.clipboardData.getData('text'));
          }}
          slotProps={{
            htmlInput: {
              inputMode: 'numeric',
              autoComplete: i === 0 ? 'one-time-code' : 'off',
              'aria-label': `Digit ${i + 1}`,
              maxLength: length,
              style: {
                fontSize: 22,
                fontWeight: 700,
                textAlign: 'center',
                padding: '14px 0',
              },
            },
          }}
          sx={{
            flex: 1,
            minWidth: 0,
            // A 6-up row makes each box narrow; a softer radius keeps them
            // reading as boxes rather than pills.
            '& .MuiOutlinedInput-root': { borderRadius: 1.5 },
          }}
        />
      ))}
    </Stack>
  );
}

function LoginScreen() {
  const { ready, auth, login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNext(searchParams.get('next'));
  const applyIntent = isApplyTarget(nextPath);

  const [step, setStep] = useState<Step>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState<TwoFaChallenge | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [otpLength, setOtpLength] = useState(DEFAULT_OTP_LENGTH);

  useEffect(() => {
    if (!ready || !auth) return;
    router.replace(nextPath ?? (auth.principal === 'admin' ? '/admin' : '/tasks'));
  }, [ready, auth, router, nextPath]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

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
      const { otpLength: len } = await sendEmailOtp(trimmed);
      setOtpLength(len);
      setStep('otp');
      setResendIn(RESEND_SECONDS);
      setInfo(`Code sent to ${trimmed}`);
    });

  const handleOtp = () =>
    run(async () => {
      login(await verifyEmailOtp(email.trim(), otp.trim()));
      router.replace(nextPath ?? '/tasks');
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
      router.replace(nextPath ?? '/admin');
    });

  /** Same send endpoint as step one — nothing about the flow changes. */
  const handleResend = () =>
    run(async () => {
      const trimmed = email.trim();
      const { otpLength: len } = await sendEmailOtp(trimmed);
      setOtpLength(len);
      setOtp('');
      setResendIn(RESEND_SECONDS);
      setInfo(`Code sent to ${trimmed}`);
    });

  const restart = () => {
    setStep('email');
    setOtp('');
    setPassword('');
    setChallenge(null);
    setError(null);
    setInfo(null);
    setResendIn(0);
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

  const requiredCodeLength = step === 'twofa' ? DEFAULT_OTP_LENGTH : otpLength;

  const submitCode = useCallback(() => {
    if (otp.trim().length < requiredCodeLength) return;
    if (step === 'otp') handleOtp();
    else handleTwoFa();
    // handleOtp/handleTwoFa are stable enough for this callback's purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, step, requiredCodeLength]);

  // Admin 2FA codes are always 6; intern OTP length is whatever send-email-otp said.
  const codeLength = step === 'twofa' ? DEFAULT_OTP_LENGTH : otpLength;

  const codeField = (
    <CodeBoxes
      value={otp}
      onChange={setOtp}
      onEnter={submitCode}
      disabled={busy}
      length={codeLength}
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
      {/* Brand panel — desktop only; the phone gets a compact night band instead. */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: 6,
          position: 'relative',
          overflow: 'hidden',
          color: '#fff',
          background: NIGHT_SKY,
          '&::before': STARFIELD,
          '&::after': AMBER_HAIRLINE,
        }}
      >
        {/* White lockup reads correctly on the night panel. */}
        <Box
          component="img"
          src="/logo/Talk Drill-White-PNG.png"
          alt="TalkDrill"
          sx={{ height: 40, width: 'auto', alignSelf: 'flex-start', position: 'relative', zIndex: 1 }}
        />

        <Stack spacing={3} sx={{ position: 'relative', zIndex: 1, maxWidth: 460 }}>
          <Box>
            <Typography sx={{ ...EYEBROW, color: INK.amber, mb: 1.5 }}>
              TalkDrill Internships
            </Typography>
            <Typography
              component="h1"
              sx={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 600,
                fontSize: 'clamp(2.4rem, 3.4vw, 3.4rem)',
                lineHeight: 1.08,
                letterSpacing: '-0.02em',
              }}
            >
              Do the work.
              <br />
              <Box component="span" sx={textGradient(gradientTokens.secondary)}>
                Earn the rewards.
              </Box>
            </Typography>
          </Box>
          <Typography sx={{ color: INK.muted, fontSize: 17, lineHeight: 1.6 }}>
            The TalkDrill internship portal for Campus Ambassadors, Content Creators and the Growth
            team.
          </Typography>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            {SELLING_POINTS.map(({ icon: Icon, text }) => (
              <Stack key={text} direction="row" spacing={1.5} alignItems="center">
                <Icon sx={{ fontSize: 20, color: INK.amber }} />
                <Typography sx={{ color: INK.soft, fontSize: 15 }}>{text}</Typography>
              </Stack>
            ))}
          </Stack>
        </Stack>

        <Typography variant="caption" sx={{ color: INK.faint, position: 'relative', zIndex: 1 }}>
          © {new Date().getFullYear()} TalkDrill
        </Typography>

        <Box
          component="img"
          src={ART.mascot.rocket}
          alt=""
          aria-hidden
          sx={{
            position: 'absolute',
            right: 24,
            bottom: 8,
            width: 150,
            height: 150,
            objectFit: 'contain',
            pointerEvents: 'none',
            userSelect: 'none',
            zIndex: 1,
          }}
        />
      </Box>

      {/* Form panel */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          bgcolor: { xs: 'background.paper', md: 'background.default' },
        }}
      >
        {/* Phone brand band — the same night surface, compressed. */}
        <Box
          sx={{
            display: { xs: 'flex', md: 'none' },
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden',
            height: 96,
            flexShrink: 0,
            px: 3,
            borderRadius: '0 0 24px 24px',
            background: NIGHT_SKY,
            color: '#fff',
            '&::before': STARFIELD,
            '&::after': AMBER_HAIRLINE,
          }}
        >
          <Stack
            spacing={0.75}
            sx={{ position: 'relative', zIndex: 1, height: '100%', justifyContent: 'center' }}
          >
            <Box
              component="img"
              src="/logo/Talk Drill-White-PNG.png"
              alt="TalkDrill"
              sx={{ height: 26, width: 'auto', alignSelf: 'flex-start' }}
            />
            <Typography sx={{ color: INK.muted, fontSize: 13 }}>
              Do the work. Earn the rewards.
            </Typography>
          </Stack>
        </Box>

        <Box
          sx={{
            flexGrow: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: { xs: 3, sm: 5 },
          }}
        >
          <Box sx={{ width: '100%', maxWidth: 400 }}>
            <Card
              sx={{ boxShadow: { xs: 'none', md: undefined }, border: { xs: 'none', md: undefined } }}
            >
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

                {/* Floor tall enough to absorb the step-to-step jump without
                    leaving the (short) email step stranded in white space.
                    Phones have no room to spare, so they opt out. */}
                <Box sx={{ minHeight: { xs: 0, sm: 236 } }}>
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
                            disabled={busy || otp.trim().length < requiredCodeLength}
                            onClick={handleOtp}
                          >
                            {busy ? 'Verifying…' : 'Sign in'}
                          </Button>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ textAlign: 'center' }}
                          >
                            {resendIn > 0 ? (
                              <>Resend code in {resendIn}s</>
                            ) : (
                              <Link
                                component="button"
                                type="button"
                                onClick={handleResend}
                                disabled={busy}
                                sx={{ fontSize: 'inherit', fontWeight: 700 }}
                              >
                                Resend code
                              </Link>
                            )}
                          </Typography>
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
                            disabled={busy || otp.trim().length < requiredCodeLength}
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
                </Box>
              </CardContent>
            </Card>

            {/* Applicants arriving from an opening are usually brand new — say so,
                so the email field does not read as "members only". */}
            {applyIntent && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ display: 'block', textAlign: 'center', mt: 2.5 }}
              >
                Sign in or create your account to apply.
              </Typography>
            )}

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', textAlign: 'center', mt: 3 }}
            >
              Trouble signing in?{' '}
              <Link href={`mailto:${SUPPORT_EMAIL}`} sx={{ fontWeight: 700 }}>
                {SUPPORT_EMAIL}
              </Link>
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

/**
 * `useSearchParams` opts the subtree into client-side rendering, which Next
 * requires a Suspense boundary for. The fallback is the bare night/paper split
 * so the fold does not flash white before the form mounts.
 */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <Box
          sx={{
            minHeight: '100dvh',
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1.05fr 1fr' },
            bgcolor: 'background.paper',
          }}
        >
          <Box
            sx={{
              display: { xs: 'none', md: 'block' },
              background: NIGHT_SKY,
              '&::before': STARFIELD,
              '&::after': AMBER_HAIRLINE,
              position: 'relative',
              overflow: 'hidden',
            }}
          />
          <Box sx={{ bgcolor: { xs: 'background.paper', md: 'background.default' } }} />
        </Box>
      }
    >
      <LoginScreen />
    </Suspense>
  );
}
