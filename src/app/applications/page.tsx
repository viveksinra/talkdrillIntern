'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import Art from '@/components/Art';
import ConfirmDialog from '@/components/ConfirmDialog';
import { ErrorState } from '@/components/DataStates';
import EmptyState from '@/components/EmptyState';
import Label from '@/components/Label';
import MetaLine from '@/components/MetaLine';
import PublicShell from '@/components/PublicShell';
import SectionHead from '@/components/SectionHead';
import { ART } from '@/lib/art';
import { celebrateOnce } from '@/lib/juice';
import { useAuth } from '@/lib/auth/AuthContext';
import { FONT_DISPLAY } from '@/theme';
import {
  formatListingDate,
  formatStipend,
  getMyApplications,
  LOCATION_LABEL,
  SUBMISSION_STATUS_LABEL,
  withdrawApplication,
  type ApplicationStatus,
  type MyApplication,
} from '@/lib/api/openings';

/**
 * "My applications" — the one page an applicant returns to.
 *
 * Deliberately in PublicShell, not AppShell: the visitor here has applied but
 * may not be an intern yet, so portal furniture (task tabs, points) would
 * promise something they do not have. Accepted is the exception — that row
 * hands them the portal door.
 *
 * Two kinds of row live here. A live `application` is being reviewed. An
 * `interest` row is a waitlist seat on a role whose deadline had already
 * passed — nothing is being judged, so it is drawn quietly and never wears
 * the language of a verdict.
 *
 * Auth is enforced inline rather than with RequireAuth so the bounce can carry
 * `?next=` and bring them straight back after signing in.
 */

/* --------------------------------------------------------------- GROUPING */

/**
 * A row belongs on the waitlist side if the server marked it `interest` OR the
 * status is `waitlisted` — either signal alone is enough, since an admin can
 * park someone on the list and promotion flips `kind` back to `application`.
 */
function isWaitlistRow(app: MyApplication): boolean {
  return app.status === 'waitlisted' || app.kind === 'interest';
}

/** Only a live application can be pulled back — a decided one is history. */
const WITHDRAWABLE: ApplicationStatus[] = ['submitted', 'shortlisted', 'interviewing'];

/* ------------------------------------------------------------ SHARED BITS */

function RoleTitle({ opening }: { opening: MyApplication['opening'] }) {
  if (!opening) {
    // The role was unpublished after they applied; the submission still stands.
    return <>Internship</>;
  }
  return (
    <Box
      component={Link}
      href={`/internships/${opening.slug}`}
      sx={{
        color: 'inherit',
        textDecoration: 'none',
        '&:hover': { color: 'primary.main', textDecoration: 'underline' },
      }}
    >
      {opening.title}
    </Box>
  );
}

/* --------------------------------------------------- ONE LIVE APPLICATION */

function ApplicationCard({
  app,
  onWithdraw,
}: {
  app: MyApplication;
  onWithdraw: (app: MyApplication) => void;
}) {
  const status = SUBMISSION_STATUS_LABEL[app.status] ?? SUBMISSION_STATUS_LABEL.submitted;
  const accepted = app.status === 'accepted';
  const opening = app.opening;
  const canWithdraw = WITHDRAWABLE.includes(app.status);

  return (
    <Card
      sx={{
        p: { xs: 2.25, sm: 2.75 },
        ...(accepted && {
          borderColor: 'success.main',
          bgcolor: (t) => alpha(t.palette.success.main, 0.06),
        }),
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start" justifyContent="space-between">
          <Box sx={{ minWidth: 0 }}>
            {opening?.category && (
              <Typography variant="overline" color="primary.main" sx={{ display: 'block' }}>
                {opening.category}
              </Typography>
            )}
            <Typography variant="h6" sx={{ lineHeight: 1.3 }}>
              <RoleTitle opening={opening} />
            </Typography>
          </Box>
          <Label color={status.color} sx={{ flexShrink: 0 }}>
            {status.label}
          </Label>
        </Stack>

        <MetaLine
          parts={[
            `Applied ${formatListingDate(app.appliedAt)}`,
            opening && LOCATION_LABEL[opening.locationType],
            opening?.duration,
            opening && formatStipend(opening.stipend),
          ]}
        />

        {app.decisionNote && (
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: (t) =>
                accepted ? alpha(t.palette.success.main, 0.12) : t.palette.action.hover,
            }}
          >
            <Typography variant="overline" color="text.disabled" sx={{ display: 'block' }}>
              Note from the team
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {app.decisionNote}
            </Typography>
          </Box>
        )}

        {accepted && (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            sx={{ pt: 0.5 }}
          >
            <Art src={ART.mascot.trophy} size={64} sx={{ flexShrink: 0 }} />
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                You are in.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Your task board is live — submit proof of the work and points land in your account.
              </Typography>
            </Box>
            <Button
              component={Link}
              href="/tasks"
              variant="contained"
              color="success"
              endIcon={<ArrowForwardRoundedIcon />}
              sx={{ flexShrink: 0, alignSelf: { xs: 'stretch', sm: 'center' } }}
            >
              Open your intern portal
            </Button>
          </Stack>
        )}

        {canWithdraw && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              size="small"
              color="inherit"
              onClick={() => onWithdraw(app)}
              sx={{ color: 'text.secondary', fontWeight: 600 }}
            >
              Withdraw
            </Button>
          </Box>
        )}
      </Stack>
    </Card>
  );
}

/* ------------------------------------------------------- ONE WAITLIST SEAT */

/**
 * Nothing is being decided here, so this card carries no verdict furniture:
 * a dozing mascot, the promise we can actually keep, and a way out. The status
 * pill only appears once the row is no longer simply `waitlisted` (they left
 * the list, say) — otherwise "On the waitlist" would just repeat the heading.
 */
function WaitlistCard({
  app,
  onLeave,
}: {
  app: MyApplication;
  onLeave: (app: MyApplication) => void;
}) {
  const opening = app.opening;
  const onList = app.status === 'waitlisted';
  const status = SUBMISSION_STATUS_LABEL[app.status] ?? SUBMISSION_STATUS_LABEL.waitlisted;

  return (
    <Card sx={{ p: { xs: 2.25, sm: 2.75 } }}>
      <Stack direction="row" spacing={{ xs: 1.75, sm: 2.25 }} alignItems="flex-start">
        <Art src={ART.mascot.sleeping} size={48} sx={{ flexShrink: 0, mt: 0.25, opacity: 0.9 }} />

        <Stack spacing={1.25} sx={{ flexGrow: 1, minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="flex-start"
            justifyContent="space-between"
          >
            <Box sx={{ minWidth: 0 }}>
              {opening?.category && (
                <Typography variant="overline" color="primary.main" sx={{ display: 'block' }}>
                  {opening.category}
                </Typography>
              )}
              <Typography variant="h6" sx={{ lineHeight: 1.3 }}>
                <RoleTitle opening={opening} />
              </Typography>
            </Box>
            {!onList && (
              <Label color={status.color} sx={{ flexShrink: 0 }}>
                {status.label}
              </Label>
            )}
          </Stack>

          <Typography variant="body2" color="text.secondary">
            {onList
              ? 'We’ll email you when this role opens again.'
              : 'You are no longer on the list for this role.'}
          </Typography>

          <MetaLine
            parts={[
              `Joined the list ${formatListingDate(app.appliedAt)}`,
              opening && LOCATION_LABEL[opening.locationType],
              opening?.duration,
              opening && formatStipend(opening.stipend),
            ]}
          />

          {app.decisionNote && (
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: (t) => t.palette.action.hover }}>
              <Typography variant="overline" color="text.disabled" sx={{ display: 'block' }}>
                Note from the team
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {app.decisionNote}
              </Typography>
            </Box>
          )}

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            justifyContent="flex-end"
            flexWrap="wrap"
            useFlexGap
          >
            {opening && (
              <Button
                component={Link}
                href={`/internships/${opening.slug}`}
                size="small"
                color="inherit"
                sx={{ color: 'text.secondary', fontWeight: 600 }}
              >
                View the role
              </Button>
            )}
            {onList && (
              <Button
                size="small"
                color="inherit"
                onClick={() => onLeave(app)}
                sx={{ color: 'text.secondary', fontWeight: 600 }}
              >
                Remove me from the list
              </Button>
            )}
          </Stack>
        </Stack>
      </Stack>
    </Card>
  );
}

/* ------------------------------------------------------------------- LIST */

function ApplicationsBody() {
  const [apps, setApps] = useState<MyApplication[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState<MyApplication | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      setApps(await getMyApplications());
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /* An acceptance that landed while they were away still deserves its moment —
     once, ever, per application. */
  useEffect(() => {
    if (!apps) return;
    const accepted = apps.find((a) => a.status === 'accepted');
    if (accepted) celebrateOnce(`application-accepted-${accepted._id}`);
  }, [apps]);

  const { live, waiting } = useMemo(() => {
    const rows = apps ?? [];
    return {
      live: rows.filter((a) => !isWaitlistRow(a)),
      waiting: rows.filter(isWaitlistRow),
    };
  }, [apps]);

  if (loading) {
    return (
      <Stack spacing={2} aria-busy="true" aria-live="polite">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="rounded" height={160} sx={{ borderRadius: '20px' }} />
        ))}
      </Stack>
    );
  }

  if (error) {
    return (
      <ErrorState
        error={error}
        title="Could not load your applications"
        onRetry={() => void load()}
      />
    );
  }

  if (!apps?.length) {
    return (
      <EmptyState
        art={ART.empty.search}
        title="No applications yet"
        description="Apply to an open role, or register interest in one that has closed — we’ll email you the moment it runs again."
        action={
          <Button component={Link} href="/internships" variant="contained">
            Browse open roles
          </Button>
        }
      />
    );
  }

  /* Headings only earn their space when there is something to tell apart. */
  const split = live.length > 0 && waiting.length > 0;
  const leavingList = pending !== null && isWaitlistRow(pending);
  const roleName = pending?.opening?.title;

  return (
    <>
      <Stack spacing={split ? 4 : 2}>
        {live.length > 0 && (
          <Box>
            {split && <SectionHead label="Applications" count={live.length} />}
            <Stack spacing={2}>
              {live.map((app) => (
                <ApplicationCard key={app._id} app={app} onWithdraw={setPending} />
              ))}
            </Stack>
          </Box>
        )}

        {waiting.length > 0 && (
          <Box>
            {split && (
              <SectionHead
                label="Waiting for the next round"
                count={waiting.length}
                caption="These roles had closed when you registered. We come back to this list first."
              />
            )}
            <Stack spacing={2}>
              {waiting.map((app) => (
                <WaitlistCard key={app._id} app={app} onLeave={setPending} />
              ))}
            </Stack>
          </Box>
        )}
      </Stack>

      <ConfirmDialog
        open={pending !== null}
        title={leavingList ? 'Remove you from this list?' : 'Withdraw this application?'}
        message={
          leavingList
            ? roleName
              ? `We will stop holding your details for ${roleName}, so you will not get the email when it runs again. You can join the list again any time.`
              : 'We will stop holding your details for this role, so you will not get the email when it runs again. You can join the list again any time.'
            : roleName
              ? `We will stop reviewing your application for ${roleName}. You can apply again later while the role is open.`
              : 'We will stop reviewing this application. You can apply again later while the role is open.'
        }
        confirmLabel={leavingList ? 'Remove me' : 'Withdraw'}
        destructive
        onClose={() => setPending(null)}
        onConfirm={async () => {
          if (!pending) return;
          await withdrawApplication(pending._id);
          await load(true);
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------- PAGE */

export default function ApplicationsPage() {
  const { ready, auth } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !auth) router.replace('/login?next=/applications');
  }, [ready, auth, router]);

  return (
    <PublicShell>
      <Container maxWidth="md" sx={{ py: { xs: 5, md: 8 } }}>
        <Box sx={{ mb: { xs: 3, md: 4 } }}>
          <Typography variant="overline" color="primary.main" sx={{ display: 'block' }}>
            Your applications
          </Typography>
          <Typography
            component="h1"
            sx={{
              fontFamily: FONT_DISPLAY,
              fontSize: { xs: 34, sm: 44 },
              fontWeight: 700,
              lineHeight: 1.05,
            }}
          >
            Where you stand
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 520 }}>
            Every role you have applied to — plus the ones you are waiting on — with the team&apos;s
            latest word on each. We read each application ourselves, so a status can sit for a few
            days before it moves.
          </Typography>
        </Box>

        {!ready || !auth ? (
          <Stack alignItems="center" sx={{ minHeight: '30vh', justifyContent: 'center' }}>
            <CircularProgress />
          </Stack>
        ) : (
          <ApplicationsBody />
        )}
      </Container>
    </PublicShell>
  );
}
