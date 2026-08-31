import { NextResponse } from 'next/server';
import { state } from '@/lib/state';

/**
 * GET /api/testing/uploads
 *
 * Test-only endpoint listing every file the fake UploadFile endpoint has
 * accepted since the last reset. Integration tests assert against this to
 * prove an attachment was actually uploaded (with its byte size intact)
 * rather than silently dropped before a send.
 */
export async function GET() {
  return NextResponse.json(state.uploads);
}
