'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import TuneIcon from '@mui/icons-material/Tune';
import { DataState, errorMessage } from '@/components/DataStates';
import EmptyState from '@/components/EmptyState';
import { adjustPoints, getPointsLedger, listInterns } from '@/lib/api/adminInternship';
import type { PointsSummary } from '@/lib/api/types';
import AdminScreen, { ScrollArea, useSnack } from '../_shared/AdminScreen';
import { asList, fmtDateTime, fmtNumber, internLabel, titleCase, type InternRow } from '../_shared/adminUtils';
import { useAsync } from '../_shared/useAsync';

/**
 * Manual points console. Every movement here goes through pointsService on the
 * backend, so the ledger below is the whole truth — including who moved what and
 * why. The note is mandatory for exactly that reason.
 *
 * The ledger endpoint is per-intern (there is no global feed), so the picker
 * drives both the adjustment form and the feed.
 */

/** Typographic section head — never a filled slab above the cards. */
function SectionHead({
  title,
  caption,
  action,
}: {
  title: string;
  caption?: string;
  action?: React.ReactNode;
}) {
  return (
    <Box sx={{ mb: 1.25, px: 0.5 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="overline" sx={{ color: 'primary.main' }}>
          {title}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        {action}
      </Stack>
      {caption && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {caption}
        </Typography>
      )}
    </Box>
  );
}

/** One headline number in the ledger summary strip. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography className="tnum" sx={{ fontWeight: 800, fontSize: 20, lineHeight: 1.2 }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

function LedgerFeed({ summary }: { summary: PointsSummary }) {
  const entries = summary.entries ?? [];
  return (
    <DataState
      isEmpty={!entries.length}
      emptyTitle="No points movement yet"
      emptyDescription="Task approvals, adjustments and redemptions all land here."
    >
      <Card>
        {/* Admin table — wrapped so the page body never scrolls sideways. */}
        <ScrollArea>
          <Table size="small" sx={{ minWidth: 660 }}>
            <TableHead>
              <TableRow>
                {['When', 'Reason', 'Note', 'By'].map((h) => (
                  <TableCell key={h} sx={{ typography: 'overline', color: 'text.secondary' }}>
                    {h}
                  </TableCell>
                ))}
                <TableCell align="right" sx={{ typography: 'overline', color: 'text.secondary' }}>
                  Delta
                </TableCell>
                <TableCell align="right" sx={{ typography: 'overline', color: 'text.secondary' }}>
                  Balance
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e._id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>
                    {fmtDateTime(e.createdAt)}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{titleCase(e.reason)}</TableCell>
                  <TableCell sx={{ maxWidth: 280 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                      {e.note || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>
                    {titleCase(e.actorType)}
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      className="tnum"
                      variant="body2"
                      sx={{ fontWeight: 800, color: e.delta < 0 ? 'error.main' : 'success.dark' }}
                    >
                      {e.delta < 0 ? '−' : '+'}
                      {fmtNumber(Math.abs(e.delta))}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" className="tnum" sx={{ color: 'text.secondary' }}>
                    {fmtNumber(e.balanceAfter)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>
    </DataState>
  );
}

function PointsBody() {
  const { show, snackbar } = useSnack();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<InternRow | null>(null);

  const [delta, setDelta] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<unknown>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const interns = useAsync(() => listInterns({ q: q || undefined }), [q]);
  const options = asList<InternRow>(interns.data?.items);

  const ledger = useAsync(async () => {
    if (!selected) return null;
    return (await getPointsLedger({ internProfileId: selected._id, limit: 100 })) as PointsSummary;
  }, [selected?._id ?? '']);

  const apply = async () => {
    if (!selected) {
      setFormError(new Error('Pick an intern first'));
      return;
    }
    const value = Number(delta);
    if (!Number.isInteger(value) || value === 0) {
      setFormError(new Error('Delta must be a non-zero whole number'));
      return;
    }
    if (!note.trim()) {
      setFormError(new Error('A note is required — it is the only record of why'));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await adjustPoints({ internProfileId: selected._id, delta: value, note: note.trim() });
      setDelta('');
      setNote('');
      show(`${value > 0 ? 'Credited' : 'Deducted'} ${Math.abs(value)} point(s)`);
      ledger.reload();
      interns.reload();
    } catch (err) {
      setFormError(err);
      show(errorMessage(err, 'Adjustment failed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const summary = ledger.data;
  const balance = summary?.balance ?? selected?.pointsBalance ?? 0;

  // Live preview so a mistyped sign is caught before the ledger records it.
  const deltaValue = Number(delta);
  const deltaValid = delta.trim() !== '' && Number.isInteger(deltaValue) && deltaValue !== 0;
  const balanceAfter = Math.max(0, balance + deltaValue);

  return (
    <Stack spacing={3}>
      <Box>
        <SectionHead
          title="Manual adjustment"
          caption="Corrections only — task approvals and redemptions post themselves."
        />
        <Card sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Stack spacing={2}>
            {formError != null && <Alert severity="error">{errorMessage(formError)}</Alert>}

            <Autocomplete<InternRow, false, false, false>
              options={options}
              value={selected}
              onChange={(_, value) => setSelected(value)}
              onInputChange={(_, value) => setSearch(value)}
              loading={interns.loading}
              getOptionLabel={(option) => `${internLabel(option)} · ${option.email}`}
              isOptionEqualToValue={(a, b) => a._id === b._id}
              filterOptions={(x) => x}
              noOptionsText={q ? 'No interns match' : 'Type a name or email'}
              renderInput={(params) => (
                <TextField {...params} label="Intern" placeholder="Search name or email" />
              )}
            />

            {selected && (
              <Stack
                direction="row"
                spacing={1}
                alignItems="baseline"
                sx={{ typography: 'body2', color: 'text.secondary', flexWrap: 'wrap' }}
              >
                <Box component="span">Balance now</Box>
                <Box
                  component="span"
                  className="tnum"
                  sx={{ fontWeight: 800, fontSize: 18, color: 'primary.main' }}
                >
                  {fmtNumber(balance)}
                </Box>
                {deltaValid && (
                  <>
                    <Box component="span" sx={{ color: 'text.disabled' }}>
                      →
                    </Box>
                    <Box
                      component="span"
                      className="tnum"
                      sx={{
                        fontWeight: 800,
                        fontSize: 18,
                        color: deltaValue < 0 ? 'error.main' : 'success.dark',
                      }}
                    >
                      {fmtNumber(balanceAfter)}
                    </Box>
                  </>
                )}
              </Stack>
            )}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Delta"
                type="number"
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                helperText="Negative to deduct. Cannot take a balance below zero."
                inputProps={{ className: 'tnum' }}
                sx={{ maxWidth: { sm: 200 } }}
              />
              <TextField
                label="Note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                multiline
                minRows={2}
                required
                helperText="Required — every adjustment is logged against your name."
              />
            </Stack>

            <Stack direction="row" justifyContent="flex-end">
              <Button
                variant="contained"
                startIcon={<TuneIcon />}
                onClick={apply}
                disabled={saving || !selected}
              >
                Apply adjustment
              </Button>
            </Stack>
          </Stack>
        </Card>
      </Box>

      {selected ? (
        <Box>
          <SectionHead
            title={`Ledger — ${internLabel(selected)}`}
            caption="Newest first. Every row records the amount, the reason and who did it."
            action={
              <Button size="small" component={Link} href={`/admin/interns/${selected._id}`}>
                Open record
              </Button>
            }
          />

          {summary && (
            <Card sx={{ p: 2, mb: 2 }}>
              <Stack direction="row" spacing={4} sx={{ flexWrap: 'wrap', gap: 2 }}>
                <Stat label="points balance" value={fmtNumber(summary.balance)} />
                <Stat label="earned lifetime" value={fmtNumber(summary.totalEarned)} />
                <Stat label="ledger entries" value={fmtNumber(summary.total)} />
              </Stack>
            </Card>
          )}

          <DataState
            loading={ledger.loading && !summary}
            error={ledger.error && !summary ? ledger.error : undefined}
            onRetry={ledger.reload}
            isEmpty={!summary}
            emptyTitle="No ledger loaded"
            emptyDescription="Reload, or pick the intern again."
            skeletonRows={3}
          >
            {summary ? <LedgerFeed summary={summary} /> : <span />}
          </DataState>
        </Box>
      ) : (
        <EmptyState
          icon={<PersonSearchIcon />}
          title="Pick an intern to see their ledger"
          description="Search above by name or email. The feed shows every approval, adjustment and redemption behind their balance."
        />
      )}

      {snackbar}
    </Stack>
  );
}

export default function AdminPointsPage() {
  return (
    <AdminScreen
      title="Points console"
      subtitle="Manual corrections and the audit trail behind every balance"
      back="/admin"
      navKey="interns"
    >
      <PointsBody />
    </AdminScreen>
  );
}
