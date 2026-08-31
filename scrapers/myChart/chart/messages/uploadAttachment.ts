/**
 * Upload a file attachment to MyChart and return its document id.
 *
 * Epic's compose UI uploads the raw file first (POST UploadFile, multipart
 * form-data) and then includes the returned document id in the Send call's
 * documentIds[] array. Captured live on Kaiser's instance (OpenKP HAR
 * 2026-05-03): response is a bare JSON string — the document id.
 *
 * Endpoint: POST /api/medicaladvicerequests/UploadFile
 */

import { makeAuthenticatedRequest } from '../../core/makeAuthenticatedRequest';
import type { MyChartRequest } from '../../core/myChartRequest';
import { getRequestVerificationTokenFromBody } from '../../core/util';
import { logger } from '../../../../shared/logger';

export type UploadAttachmentParams = {
  /** The raw file bytes to upload */
  data: Uint8Array;
  /** Filename presented to the portal, e.g. "signed-form.pdf" */
  filename: string;
  /** MIME type, e.g. "application/pdf" */
  mimeType: string;
  /** Organization ID (usually empty string for default org) */
  organizationId?: string;
};

export type UploadAttachmentResult = {
  success: boolean;
  /** Document id (WP-...) to include in the send call's documentIds[] */
  documentId?: string;
  error?: string;
};

/** Get the request verification token needed for all API calls */
async function getCsrfToken(mychartRequest: MyChartRequest): Promise<string | undefined> {
  const res = await makeAuthenticatedRequest(mychartRequest, { path: '/app/communication-center' });
  const html = await res.text();
  return getRequestVerificationTokenFromBody(html);
}

/**
 * Pull the document id out of an UploadFile response. Kaiser answers with a
 * bare JSON string; other Epic instances are allowed a wrapper object.
 */
function extractDocumentId(json: unknown): string | null {
  if (typeof json === 'string' && json.length > 0) return json;
  if (typeof json !== 'object' || json === null) return null;
  const rec = json as Record<string, unknown>;
  for (const key of ['documentId', 'documentID', 'dcsId', 'id', 'value']) {
    if (typeof rec[key] === 'string' && (rec[key] as string).length > 0) return rec[key] as string;
  }
  return null;
}

/**
 * Upload a file and return the document id the send flow expects.
 */
export async function uploadAttachment(
  mychartRequest: MyChartRequest,
  params: UploadAttachmentParams,
): Promise<UploadAttachmentResult> {
  if (params.data.length === 0) {
    return { success: false, error: 'Empty attachment data' };
  }

  // Step 1: CSRF token
  const token = await getCsrfToken(mychartRequest);
  if (!token) {
    return { success: false, error: 'Could not get verification token' };
  }

  // Step 2: Build the multipart body mimicking the browser's compose upload.
  // Mixed text + binary, so the frame is assembled as bytes by hand.
  const boundary = '----MyChartBridgeFormBoundary' + Math.random().toString(36).slice(2);
  const encoder = new TextEncoder();
  const filePart = encoder.encode(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${params.filename.replace(/"/g, '')}"\r\n` +
    `Content-Type: ${params.mimeType}\r\n\r\n`,
  );
  const tailPart = encoder.encode(
    `\r\n--${boundary}\r\n` +
    `Content-Disposition: form-data; name="__RequestVerificationToken"\r\n\r\n${token}\r\n` +
    `--${boundary}--\r\n`,
  );
  const body = new Uint8Array(filePart.length + params.data.length + tailPart.length);
  body.set(filePart, 0);
  body.set(params.data, filePart.length);
  body.set(tailPart, filePart.length + params.data.length);

  // Step 3: POST UploadFile
  const res = await makeAuthenticatedRequest(mychartRequest, {
    path: '/api/medicaladvicerequests/UploadFile',
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      __RequestVerificationToken: token,
    },
    body,
  });

  const text = await res.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }

  if (res.status === 200) {
    const documentId = extractDocumentId(json);
    if (documentId) return { success: true, documentId };
    logger.error('[uploadAttachment] unexpected 200 shape: ' + text.slice(0, 500));
    return { success: false, error: `Unexpected UploadFile response shape: ${text.slice(0, 300)}` };
  }
  return {
    success: false,
    error: `UploadFile failed with status ${res.status}: ${text.slice(0, 300)}`,
  };
}
