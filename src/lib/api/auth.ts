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

export async function sendEmailOtp(email: string): Promise<{ suggestion?: string | null }> {
  const res = await api<{ suggestion?: string | null }>('/auth/send-email-otp', {
    method: 'POST',
    body: { email },
    auth: false,
  });
  return res.myData ?? {};
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
}

export async function adminPasswordLogin(
  emu: string,
  password: string
): Promise<TwoFaChallenge> {
  const res = await api<TwoFaChallenge & { status: string }>('/admin/passwordAuth/forTeam', {
    method: 'POST',
    body: { emu, password },
    auth: false,
  });
  if (res.myData?.status !== 'twofa_required' || !res.myData?.challengeId) {
    throw new Error(res.message || 'Unexpected login response');
  }
  return res.myData;
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
