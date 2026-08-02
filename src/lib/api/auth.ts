import { api } from './client';
import type { StoredAuth } from '@/lib/auth/tokens';

/** Auth API — wraps the existing TalkDrill backend auth endpoints (no new auth system). */

// ── Step 1: one email field decides which credential to ask for ──────────

/**
 * Staff (myTeam) sign in with a password + email 2FA; everyone else gets an
 * email OTP. The backend decides, so the login screen never has to show an
 * "admin" entrance.
 */
export async function getAuthMethod(email: string): Promise<'otp' | 'password'> {
  const res = await api<{ method: 'otp' | 'password' }>('/internship/auth/method', {
    method: 'POST',
    body: { email },
    auth: false,
  });
  return res.myData?.method === 'password' ? 'password' : 'otp';
}

// ── Intern login: email OTP ──────────────────────────────────────────────

/**
 * `otpLength` matters: the backend issues 4-digit codes for some accounts and
 * 6 for others, so the code UI must be built from this and never hardcoded.
 */
export async function sendEmailOtp(
  email: string
): Promise<{ suggestion?: string | null; otpLength: number }> {
  const res = await api<{ suggestion?: string | null; otpLength?: number }>(
    '/auth/send-email-otp',
    { method: 'POST', body: { email }, auth: false }
  );
  const len = Number(res.myData?.otpLength);
  return {
    suggestion: res.myData?.suggestion ?? null,
    otpLength: Number.isFinite(len) && len >= 4 && len <= 8 ? len : 6,
  };
}

interface VerifyEmailOtpData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  isNewUser: boolean;
  user: {
    id: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    profileImage?: string;
  };
}

export async function verifyEmailOtp(email: string, otp: string): Promise<StoredAuth> {
  const res = await api<VerifyEmailOtpData>('/auth/verify-email-otp', {
    method: 'POST',
    body: { email, otp },
    auth: false,
  });
  const d = res.myData!;
  return {
    principal: 'intern',
    accessToken: d.accessToken,
    refreshToken: d.refreshToken,
    user: {
      id: d.user.id,
      name:
        d.user.name ||
        `${d.user.firstName || ''} ${d.user.lastName || ''}`.trim() ||
        d.user.email,
      email: d.user.email,
      profileImage: d.user.profileImage,
    },
  };
}

// ── Admin login: team password + email 2FA ───────────────────────────────

export interface TwoFaChallenge {
  challengeId: string;
  maskedEmail: string;
  expiresInSeconds: number;
  retryAfterSeconds: number;
  /** Digits in the emailed code. Same rule as the intern OTP — never hardcode it. */
  otpLength: number;
}

export async function adminPasswordLogin(
  emu: string,
  password: string
): Promise<TwoFaChallenge> {
  const res = await api<Omit<TwoFaChallenge, 'otpLength'> & { status: string; otpLength?: number }>(
    '/admin/passwordAuth/forTeam',
    { method: 'POST', body: { emu, password }, auth: false }
  );
  if (res.myData?.status !== 'twofa_required' || !res.myData?.challengeId) {
    throw new Error(res.message || 'Unexpected login response');
  }
  const len = Number(res.myData.otpLength);
  return {
    ...res.myData,
    // Backends that predate the `otpLength` field still send 4-digit 2FA codes.
    otpLength: Number.isFinite(len) && len >= 4 && len <= 8 ? len : 4,
  };
}

interface TwoFaVerifyResponse {
  accessToken?: string;
  user?: { _id?: string; firstName?: string; lastName?: string; email?: string };
  firstName?: string;
  lastName?: string;
  email?: string;
  id?: string;
}

export async function adminVerifyTwoFa(challengeId: string, otp: string): Promise<StoredAuth> {
  // NOTE: this endpoint returns its fields at the TOP level, not inside myData.
  const res = (await api<unknown>('/admin/passwordAuth/twofa/verify', {
    method: 'POST',
    body: { challengeId, otp },
    auth: false,
  })) as unknown as TwoFaVerifyResponse & { variant: string; message: string };

  if (!res.accessToken) {
    throw new Error(res.message || 'Verification failed');
  }
  return {
    principal: 'admin',
    accessToken: res.accessToken,
    user: {
      id: String(res.id || res.user?._id || ''),
      name: `${res.firstName || ''} ${res.lastName || ''}`.trim() || res.email,
      email: res.email,
    },
  };
}
