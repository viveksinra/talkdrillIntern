'use client';

import React, { useState } from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import DescriptionIcon from '@mui/icons-material/Description';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import type { FlagSeverity, ProofType, SubmissionFile, SubmissionFlag } from '@/lib/api/types';

/**
 * Renders whatever proof an intern sent, inline in the admin verification queue.
 * Reviewers approve dozens of these in a sitting, so nothing may require a click
 * to become legible — thumbnails, the actual URL text, and the fraud flags are all
 * visible without opening anything.
 */

function isImage(file: SubmissionFile): boolean {
  if (file.mime) return file.mime.startsWith('image/');
  return /\.(png|jpe?g|gif|webp|heic|avif)(\?|$)/i.test(file.url);
}

function fileName(file: SubmissionFile): string {
  const source = file.key || file.url;
  const last = source.split('?')[0].split('/').pop();
  return last || 'attachment';
}

function humanSize(bytes?: number): string | null {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// The strip only renders when something IS flagged, so its floor is 'warning':
// an "automated checks flagged this" headline in calm info-blue reads as
// reassurance and is exactly the thing a reviewer skims past.
const FLAG_SEVERITY: Record<FlagSeverity, 'warning' | 'error'> = {
  info: 'warning',
  warn: 'warning',
  high: 'error',
};

function FlagStrip({
  flags,
  needsStricterReview,
}: {
  flags: SubmissionFlag[];
  needsStricterReview?: boolean;
}) {
  if (!flags.length && !needsStricterReview) return null;
  // The strip takes the worst severity present so a `high` flag can't hide under an `info`.
  const worst: FlagSeverity = flags.some((f) => f.severity === 'high')
    ? 'high'
    : flags.some((f) => f.severity === 'warn')
      ? 'warn'
      : 'info';
  const severity = FLAG_SEVERITY[worst];

  return (
    <Alert severity={severity} icon={<ReportProblemIcon />} sx={{ borderRadius: 1.5 }}>
      <AlertTitle sx={{ mb: flags.length ? 0.5 : 0 }}>
        {needsStricterReview ? 'Check this one carefully' : 'Automated checks flagged this'}
      </AlertTitle>
      {flags.length > 0 && (
        <Stack component="ul" spacing={0.25} sx={{ m: 0, pl: 2.5 }}>
          {flags.map((flag, i) => (
            <Typography component="li" variant="body2" key={`${flag.type}-${i}`}>
              {flag.message || flag.type}
            </Typography>
          ))}
        </Stack>
      )}
    </Alert>
  );
}

function LabelledBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
        {label}
      </Typography>
      <Box sx={{ mt: 0.25 }}>{children}</Box>
    </Box>
  );
}

export interface ProofPreviewProps {
  proofType?: ProofType;
  files?: SubmissionFile[];
  textValue?: string;
  linkUrl?: string;
  usernameValue?: string;
  note?: string;
  flags?: SubmissionFlag[];
  needsStricterReview?: boolean;
  /** Video submissions carry a separate analytics screenshot. */
  dashboardProofUrl?: string;
  /** Smaller thumbnails for dense queue rows. */
  compact?: boolean;
}

export default function ProofPreview({
  proofType,
  files = [],
  textValue,
  linkUrl,
  usernameValue,
  note,
  flags = [],
  needsStricterReview = false,
  dashboardProofUrl,
  compact = false,
}: ProofPreviewProps) {
  const [zoomed, setZoomed] = useState<SubmissionFile | null>(null);
  const thumb = compact ? 72 : 104;

  const hasProof =
    files.length > 0 || !!textValue || !!linkUrl || !!usernameValue || !!dashboardProofUrl;

  return (
    <Stack spacing={1.5}>
      <FlagStrip flags={flags} needsStricterReview={needsStricterReview} />

      {files.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          {files.map((file, i) => {
            const name = fileName(file);
            const size = humanSize(file.size);
            if (isImage(file)) {
              return (
                <Box
                  key={file.url || i}
                  component="button"
                  type="button"
                  onClick={() => setZoomed(file)}
                  aria-label={`Open ${name} full size`}
                  sx={{
                    p: 0,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1.5,
                    overflow: 'hidden',
                    cursor: 'zoom-in',
                    bgcolor: 'action.hover',
                    width: thumb,
                    height: thumb,
                    display: 'block',
                  }}
                >
                  {/* Plain <img>: proof lives on S3, outside next/image's configured domains. */}
                  <Box
                    component="img"
                    src={file.url}
                    alt={name}
                    loading="lazy"
                    sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </Box>
              );
            }
            return (
              <Paper
                key={file.url || i}
                variant="outlined"
                sx={{ px: 1.25, py: 1, display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <DescriptionIcon color="action" />
                <Box sx={{ minWidth: 0 }}>
                  <Link
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="body2"
                    sx={{ fontWeight: 600, wordBreak: 'break-all' }}
                  >
                    {name}
                  </Link>
                  {size && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {size}
                    </Typography>
                  )}
                </Box>
              </Paper>
            );
          })}
        </Stack>
      )}

      {linkUrl && (
        <LabelledBlock label="Link">
          <Link
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              wordBreak: 'break-all',
              fontWeight: 600,
              minHeight: 32,
            }}
          >
            {linkUrl}
            <OpenInNewIcon sx={{ fontSize: 16, flexShrink: 0 }} />
          </Link>
        </LabelledBlock>
      )}

      {usernameValue && (
        <LabelledBlock label="Username">
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            @{usernameValue.replace(/^@/, '')}
          </Typography>
        </LabelledBlock>
      )}

      {textValue && (
        <LabelledBlock label="Answer">
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {textValue}
          </Typography>
        </LabelledBlock>
      )}

      {dashboardProofUrl && (
        <LabelledBlock label="Analytics screenshot">
          <Button
            size="small"
            variant="outlined"
            endIcon={<OpenInNewIcon />}
            href={dashboardProofUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open dashboard proof
          </Button>
        </LabelledBlock>
      )}

      {note && (
        <LabelledBlock label="Intern's note">
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
            {note}
          </Typography>
        </LabelledBlock>
      )}

      {!hasProof && (
        <Typography variant="body2" color="text.secondary">
          No proof attached{proofType ? ` (expected: ${proofType})` : ''}.
        </Typography>
      )}

      <Dialog open={!!zoomed} onClose={() => setZoomed(null)} maxWidth="lg" fullWidth>
        <DialogContent sx={{ p: 0, position: 'relative', bgcolor: 'common.black' }}>
          <IconButton
            onClick={() => setZoomed(null)}
            aria-label="Close preview"
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              color: 'common.white',
              bgcolor: 'rgba(0,0,0,0.45)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.65)' },
            }}
          >
            <CloseIcon />
          </IconButton>
          {zoomed && (
            <Box
              component="img"
              src={zoomed.url}
              alt={fileName(zoomed)}
              sx={{ width: '100%', maxHeight: '85vh', objectFit: 'contain', display: 'block' }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}

export { ProofPreview };
