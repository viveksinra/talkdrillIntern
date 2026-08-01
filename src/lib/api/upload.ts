import { API_BASE_URL } from '@/config/env';
import { getAuth } from '@/lib/auth/tokens';
import type { Envelope } from './client';
import type { SubmissionFile } from './types';

/**
 * Proof file upload — the one call that bypasses the JSON api() helper, because
 * FormData must set its own multipart boundary (never set Content-Type manually).
 *
 * The backend hashes the file and returns sha256 with the S3 location; pass the
 * whole returned object straight into submitProof({ files: [uploaded] }) so the
 * fraud checker can spot the same screenshot reused across interns.
 */

/**
 * Guardrail matching the backend multer limit exactly (routes/api/v1/internship:
 * `limits: { fileSize: 8 * 1024 * 1024 }`) — a phone photo that would die on
 * LIMIT_FILE_SIZE must fail here, before it is pushed over mobile data. The
 * dropzone caption and the per-file "too large" message both derive from this.
 */
export const MAX_PROOF_FILE_BYTES = 8 * 1024 * 1024;

export async function uploadProofFile(file: File): Promise<SubmissionFile> {
  if (file.size > MAX_PROOF_FILE_BYTES) {
    throw new Error(
      `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is ${
        MAX_PROOF_FILE_BYTES / 1024 / 1024
      }MB.`
    );
  }

  const form = new FormData();
  form.append('file', file);

  const headers: Record<string, string> = {};
  const stored = getAuth();
  if (stored?.accessToken) headers['Authorization'] = `Bearer ${stored.accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/v1/internship/uploads`, {
      method: 'POST',
      headers,
      body: form,
    });
  } catch {
    throw new Error('Upload failed — check your connection and try again.');
  }

  const json = (await res.json().catch(() => ({}))) as Envelope<SubmissionFile>;
  if (!res.ok || json.variant === 'error' || !json.myData?.url) {
    throw new Error(json.message || `Upload failed (${res.status})`);
  }
  return json.myData;
}

/** Uploads sequentially so a 5-file batch does not stall a phone connection. */
export async function uploadProofFiles(files: File[]): Promise<SubmissionFile[]> {
  const uploaded: SubmissionFile[] = [];
  for (const file of files) {
    uploaded.push(await uploadProofFile(file));
  }
  return uploaded;
}
