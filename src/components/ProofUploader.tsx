'use client';

import React, { useCallback, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DescriptionIcon from '@mui/icons-material/Description';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import ReplayIcon from '@mui/icons-material/Replay';
import { MAX_PROOF_FILE_BYTES, uploadProofFile } from '@/lib/api/upload';
import type { ProofType, SubmissionFile, SubmitProofBody } from '@/lib/api/types';

/**
 * The one proof-submission widget. Interns are on phones, often on a bad
 * connection, so files upload the moment they are picked (not on submit) and each
 * one reports its own outcome — a failed screenshot must never silently swallow a
 * whole submission.
 */

export type ProofValue = SubmitProofBody;

const MAX_FILES = 5;

/** Copy shown above the input, per proof type. */
const HINTS: Record<ProofType, string> = {
  screenshot: 'Attach a screenshot as proof. You can use your camera or pick from your gallery.',
  file: 'Attach the file you were asked to produce.',
  link: 'Paste the public link to your post so we can open it.',
  text: 'Write your answer here.',
  username: 'Enter the username exactly as it appears on your profile.',
  'video-metric': 'Paste the link to your video, and attach an analytics screenshot if you have one.',
};

/**
 * Exactly what internTaskController.ALLOWED_PROOF_MIME accepts. Deliberately NOT
 * `image/*`: that offers GIF, BMP and iPhone HEIC in the picker, all of which
 * multer's fileFilter rejects with a 400 after the upload has already run.
 */
const FILE_ACCEPT: Record<string, string> = {
  screenshot: 'image/jpeg,image/png,image/webp',
  file: 'image/jpeg,image/png,image/webp,application/pdf',
  'video-metric': 'image/jpeg,image/png,image/webp',
};

function humanSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Phones autocorrect URLs into things like "Instagram.com/x" — repair before validating. */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, '')}`;
}

export function isValidUrl(raw: string): boolean {
  try {
    const url = new URL(normalizeUrl(raw));
    return !!url.hostname && url.hostname.includes('.');
  } catch {
    return false;
  }
}

/** True when the value satisfies what this proof type demands — gate the submit button on it. */
export function isProofComplete(proofType: ProofType, value: ProofValue): boolean {
  switch (proofType) {
    case 'screenshot':
    case 'file':
      return (value.files?.length ?? 0) > 0;
    case 'link':
      return isValidUrl(value.linkUrl ?? '');
    case 'video-metric':
      return isValidUrl(value.linkUrl ?? '');
    case 'text':
      return (value.textValue ?? '').trim().length > 0;
    case 'username':
      return (value.usernameValue ?? '').trim().length > 0;
    default:
      return false;
  }
}

interface PendingFile {
  id: string;
  name: string;
  size: number;
  error?: string;
  /** Kept so a failed upload can be retried without re-picking the file. */
  file: File;
}

export interface ProofUploaderProps {
  proofType: ProofType;
  value: ProofValue;
  onChange: (next: ProofValue) => void;
  disabled?: boolean;
  /** Hide the free-text note box (shown by default). */
  showNote?: boolean;
  noteLabel?: string;
  /** Extra guidance from the task template, rendered under the built-in hint. */
  hint?: string;
}

export default function ProofUploader({
  proofType,
  value,
  onChange,
  disabled = false,
  showNote = true,
  noteLabel = 'Note (optional)',
  hint,
}: ProofUploaderProps) {
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [linkTouched, setLinkTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const idRef = useRef(0);
  /** Files the user removed while still in flight — their results are thrown away. */
  const discardedRef = useRef<Set<string>>(new Set());

  // onChange callers hand us a fresh `value` prop each render; uploads finish out
  // of band, so read the latest value through a ref instead of a stale closure.
  const valueRef = useRef(value);
  valueRef.current = value;

  const patch = useCallback(
    (fields: Partial<ProofValue>) => onChange({ ...valueRef.current, ...fields }),
    [onChange]
  );

  const files = value.files ?? [];
  const wantsFiles = proofType === 'screenshot' || proofType === 'file' || proofType === 'video-metric';
  const filesRequired = proofType === 'screenshot' || proofType === 'file';
  const slotsLeft = MAX_FILES - files.length - pending.length;

  const uploadOne = useCallback(
    async (entry: PendingFile) => {
      try {
        const uploaded = await uploadProofFile(entry.file);
        // Dropped while in flight — discard the result rather than resurrect it.
        if (discardedRef.current.has(entry.id)) {
          discardedRef.current.delete(entry.id);
          return;
        }
        setPending((prev) => prev.filter((p) => p.id !== entry.id));
        onChange({
          ...valueRef.current,
          files: [...(valueRef.current.files ?? []), uploaded],
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Upload failed';
        setPending((prev) => prev.map((p) => (p.id === entry.id ? { ...p, error: message } : p)));
      }
    },
    [onChange]
  );

  const addFiles = useCallback(
    (picked: FileList | File[] | null) => {
      if (!picked || disabled) return;
      const list = Array.from(picked).slice(0, Math.max(0, slotsLeft));
      const entries: PendingFile[] = list.map((file) => ({
        id: `f${++idRef.current}`,
        name: file.name,
        size: file.size,
        file,
        error: file.size > MAX_PROOF_FILE_BYTES ? `Too large — max ${humanSize(MAX_PROOF_FILE_BYTES)}` : undefined,
      }));
      if (!entries.length) return;
      setPending((prev) => [...prev, ...entries]);
      // Sequential: parallel uploads from a phone are slower and hide which one failed.
      void (async () => {
        for (const entry of entries) {
          if (entry.error) continue;
          await uploadOne(entry);
        }
      })();
    },
    [disabled, slotsLeft, uploadOne]
  );

  const retry = (entry: PendingFile) => {
    if (entry.file.size > MAX_PROOF_FILE_BYTES) return;
    setPending((prev) => prev.map((p) => (p.id === entry.id ? { ...p, error: undefined } : p)));
    void uploadOne(entry);
  };

  const removeUploaded = (index: number) =>
    patch({ files: files.filter((_, i) => i !== index) });

  const linkError = linkTouched && !!value.linkUrl && !isValidUrl(value.linkUrl);

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="body2" color="text.secondary">
          {HINTS[proofType]}
        </Typography>
        {hint && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
            {hint}
          </Typography>
        )}
      </Box>

      {(proofType === 'link' || proofType === 'video-metric') && (
        <TextField
          label={proofType === 'video-metric' ? 'Video URL' : 'Link'}
          placeholder="https://instagram.com/p/…"
          type="url"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={disabled}
          value={value.linkUrl ?? ''}
          onChange={(e) => patch({ linkUrl: e.target.value })}
          onBlur={() => {
            setLinkTouched(true);
            const raw = (value.linkUrl ?? '').trim();
            if (raw) patch({ linkUrl: normalizeUrl(raw) });
          }}
          error={linkError}
          helperText={linkError ? 'That does not look like a full link.' : ' '}
        />
      )}

      {proofType === 'text' && (
        <TextField
          label="Your answer"
          multiline
          minRows={4}
          disabled={disabled}
          value={value.textValue ?? ''}
          onChange={(e) => patch({ textValue: e.target.value })}
        />
      )}

      {proofType === 'username' && (
        <TextField
          label="Username"
          placeholder="yourhandle"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={disabled}
          value={value.usernameValue ?? ''}
          // Interns type the @ out of habit; store the bare handle so fraud checks match.
          onChange={(e) => patch({ usernameValue: e.target.value.replace(/^@+/, '') })}
          slotProps={{
            input: { startAdornment: <InputAdornment position="start">@</InputAdornment> },
          }}
        />
      )}

      {wantsFiles && (
        <Box>
          <input
            ref={inputRef}
            type="file"
            hidden
            multiple
            accept={FILE_ACCEPT[proofType] ?? undefined}
            onChange={(e) => {
              addFiles(e.target.files);
              // Reset so picking the same file twice still fires onChange.
              e.target.value = '';
            }}
          />
          <Paper
            variant="outlined"
            onClick={() => !disabled && slotsLeft > 0 && inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              if (!disabled) setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              addFiles(e.dataTransfer.files);
            }}
            role="button"
            tabIndex={disabled ? -1 : 0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (!disabled && slotsLeft > 0) inputRef.current?.click();
              }
            }}
            aria-disabled={disabled || slotsLeft <= 0}
            sx={{
              p: 2.5,
              minHeight: 132,
              display: 'grid',
              placeItems: 'center',
              textAlign: 'center',
              borderStyle: 'dashed',
              borderWidth: 2,
              borderColor: dragActive ? 'primary.main' : 'divider',
              bgcolor: dragActive ? 'action.hover' : 'background.paper',
              cursor: disabled || slotsLeft <= 0 ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.6 : 1,
              transition: 'border-color 120ms, background-color 120ms',
            }}
          >
            <Stack spacing={0.75} alignItems="center">
              <Box sx={{ color: 'primary.main', display: 'flex', gap: 1 }}>
                <PhotoCameraIcon />
                <CloudUploadIcon />
              </Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {slotsLeft <= 0 ? `Maximum ${MAX_FILES} files` : 'Tap to add a screenshot'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Camera or gallery · up to {humanSize(MAX_PROOF_FILE_BYTES)} each
                {proofType === 'video-metric' ? ' · optional' : ''}
              </Typography>
            </Stack>
          </Paper>

          {(files.length > 0 || pending.length > 0) && (
            <Stack spacing={1} sx={{ mt: 1.5 }}>
              {files.map((file, i) => (
                <UploadedRow
                  key={file.url || i}
                  file={file}
                  disabled={disabled}
                  onRemove={() => removeUploaded(i)}
                />
              ))}
              {pending.map((entry) => (
                <Paper key={entry.id} variant="outlined" sx={{ p: 1.25 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <DescriptionIcon color="action" />
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                        {entry.name}
                      </Typography>
                      {entry.error ? (
                        <Typography variant="caption" color="error">
                          {entry.error}
                        </Typography>
                      ) : (
                        <LinearProgress sx={{ mt: 0.75, height: 5, borderRadius: 3 }} />
                      )}
                    </Box>
                    {entry.error && entry.size <= MAX_PROOF_FILE_BYTES && (
                      <IconButton
                        onClick={() => retry(entry)}
                        aria-label={`Retry ${entry.name}`}
                        sx={{ width: 44, height: 44 }}
                      >
                        <ReplayIcon />
                      </IconButton>
                    )}
                    <IconButton
                      onClick={() => {
                        discardedRef.current.add(entry.id);
                        setPending((prev) => prev.filter((p) => p.id !== entry.id));
                      }}
                      aria-label={`Remove ${entry.name}`}
                      sx={{ width: 44, height: 44 }}
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}

          {filesRequired && files.length === 0 && pending.length === 0 && (
            <Alert severity="info" sx={{ mt: 1.5 }}>
              A screenshot is required for this task.
            </Alert>
          )}
        </Box>
      )}

      {showNote && (
        <TextField
          label={noteLabel}
          placeholder="Anything the reviewer should know"
          multiline
          minRows={2}
          disabled={disabled}
          value={value.note ?? ''}
          onChange={(e) => patch({ note: e.target.value })}
        />
      )}
    </Stack>
  );
}

function UploadedRow({
  file,
  disabled,
  onRemove,
}: {
  file: SubmissionFile;
  disabled: boolean;
  onRemove: () => void;
}) {
  const isImage = file.mime ? file.mime.startsWith('image/') : /\.(png|jpe?g|gif|webp|heic|avif)(\?|$)/i.test(file.url);
  const name = (file.key || file.url).split('?')[0].split('/').pop() || 'attachment';
  return (
    <Paper variant="outlined" sx={{ p: 1.25 }}>
      <Stack direction="row" spacing={1.25} alignItems="center">
        {isImage ? (
          <Box
            component="img"
            src={file.url}
            alt={name}
            sx={{ width: 48, height: 48, borderRadius: 1, objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <DescriptionIcon color="action" />
        )}
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Link
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            variant="body2"
            noWrap
            sx={{ fontWeight: 600, display: 'block' }}
          >
            {name}
          </Link>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
            <Typography variant="caption" color="text.secondary">
              Uploaded{file.size ? ` · ${humanSize(file.size)}` : ''}
            </Typography>
          </Stack>
        </Box>
        <IconButton
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Remove ${name}`}
          sx={{ width: 44, height: 44 }}
        >
          <DeleteOutlineIcon />
        </IconButton>
      </Stack>
    </Paper>
  );
}

export { ProofUploader };
export { MAX_FILES as MAX_PROOF_FILES };

/** Bare-bones "add another file" button for surfaces that need the picker alone. */
export function ProofFileButton({
  onPick,
  accept = 'image/*',
  disabled,
  label = 'Add screenshot',
}: {
  onPick: (files: FileList | null) => void;
  accept?: string;
  disabled?: boolean;
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        hidden
        accept={accept}
        onChange={(e) => {
          onPick(e.target.files);
          e.target.value = '';
        }}
      />
      <Button
        variant="outlined"
        startIcon={<PhotoCameraIcon />}
        disabled={disabled}
        onClick={() => ref.current?.click()}
      >
        {label}
      </Button>
    </>
  );
}
