'use client';

import { useCallback, useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SectionHead from '@/components/SectionHead';
import ViewAsButton from '@/components/ViewAsButton';
import Label from '@/components/Label';
import {
  listViewAsTargets,
  resetSandbox,
  type AdminInternRow,
} from '@/lib/api/adminInternship';

/**
 * Sandbox personas on the admin dashboard.
 *
 * Renders NOTHING until the backend confirms the view-as flag is on, so the
 * dashboard is unchanged while the feature ships dark — the flag is the single
 * source of truth rather than a second client-side copy of it.
 */
export default function SandboxPanel() {
  const [personas, setPersonas] = useState<AdminInternRow[] | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => {
    listViewAsTargets()
      .then((r) => setPersonas(r.enabled ? r.sandbox : []))
      // A failure here must never break the dashboard — the panel is optional.
      .catch(() => setPersonas([]));
  }, []);

  useEffect(load, [load]);

  const doReset = async (track: string) => {
    setResetting(track);
    setNote(null);
    try {
      await resetSandbox(track);
      setNote(`${track} sandbox reset to a clean state.`);
      load();
    } catch {
      setNote('Could not reset that persona — try again.');
    } finally {
      setResetting(null);
    }
  };

  if (!personas?.length) return null;

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
        <SectionHead
          label="Sandbox personas"
          count={personas.length}
          caption="Fake interns you can actually use — submit proof, redeem, post a video. Nothing here touches a real account."
        />

        <Stack spacing={1.25}>
          {personas.map((p) => (
            <Stack
              key={p._id}
              direction="row"
              spacing={1.5}
              alignItems="center"
              sx={{ flexWrap: 'wrap', rowGap: 1 }}
            >
              <Label color="info">{p.track ?? 'no track'}</Label>
              <Typography variant="body2" sx={{ fontWeight: 600, flexGrow: 1, minWidth: 0 }} noWrap>
                {p.fullName || p.email}
              </Typography>
              <Typography variant="caption" color="text.secondary" className="tnum">
                {p.pointsBalance ?? 0} pts
              </Typography>
              <ViewAsButton intern={{ ...p, isSandbox: true }} />
              <Button
                size="small"
                color="inherit"
                startIcon={<RestartAltIcon />}
                disabled={resetting === p.track}
                onClick={() => p.track && doReset(p.track)}
              >
                {resetting === p.track ? 'Resetting…' : 'Reset'}
              </Button>
            </Stack>
          ))}
        </Stack>

        {note && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            {note}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
