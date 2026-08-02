/**
 * "View as intern" state for the internship portal.
 *
 * A team member never swaps credentials — they keep their own admin token and
 * add an `X-View-As-Intern` header naming the profile they want to look through
 * (see client.ts). This module is only the client-side record of "who am I
 * currently looking at", kept in its own localStorage slot so it survives a page
 * reload and cannot corrupt the auth blob in tokens.ts.
 *
 * Two modes, and the difference matters:
 *  - a REAL intern  → read-only, enforced by the backend, not just hidden here
 *  - a SANDBOX persona → writable; nobody owns it, so it is the one place an
 *    admin can actually exercise submit / redeem / post-a-video
 */

export interface ViewAsTarget {
  internProfileId: string;
  /** Display name or email — what the status bar shows. */
  label: string;
  isSandbox: boolean;
}

const KEY = 'td_internship_view_as';

export function getViewAs(): ViewAsTarget | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ViewAsTarget;
    if (!parsed?.internProfileId) return null;
    return { ...parsed, isSandbox: parsed.isSandbox === true };
  } catch {
    return null;
  }
}

export function setViewAs(target: ViewAsTarget): void {
  window.localStorage.setItem(KEY, JSON.stringify(target));
}

export function clearViewAs(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(KEY);
}

/** The header name, shared by client.ts and the upload path that bypasses it. */
export const VIEW_AS_HEADER = 'X-View-As-Intern';
