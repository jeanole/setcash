/**
 * Integration tests for POST /api/bug-reports (real DB for the rate limiter
 * context, mocked session, stubbed GitHub API).
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { auth } from '@/auth';
import { createTestContext, cleanupTestContext, makeSession, TestContext } from '../helpers';

jest.mock('@/auth');
const mockAuth = auth as jest.MockedFunction<typeof auth>;

// UPLOADS_DIR and GITHUB_TOKEN are read when the route module loads
const UPLOADS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'setcash-bugreports-'));
process.env.UPLOADS_DIR = UPLOADS_DIR;
process.env.GITHUB_TOKEN = 'test-token';
const bugReportsRoute = require('@/app/api/bug-reports/route') as typeof import('@/app/api/bug-reports/route');

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);

interface FilePart { field: string; filename: string; data?: Buffer }

async function bugReportRequest(files: FilePart[], fields: Record<string, string> = {}): Promise<Request> {
  const form = new FormData();
  form.append('title', fields.title ?? 'Broken button');
  form.append('description', fields.description ?? 'It does not work');
  for (const f of files) form.append(f.field, new Blob([f.data ?? PNG]), f.filename);
  const encoded = new Request('http://localhost/api/bug-reports', { method: 'POST', body: form });
  const body = Buffer.from(await encoded.arrayBuffer());
  return new Request('http://localhost/api/bug-reports', {
    method: 'POST',
    body,
    headers: {
      'content-type': encoded.headers.get('content-type')!,
      'content-length': String(body.byteLength),
    },
  });
}

/** Every file below UPLOADS_DIR (relative paths) */
function listUploads(dir = UPLOADS_DIR): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listUploads(full));
    else out.push(path.relative(UPLOADS_DIR, full));
  }
  return out.sort();
}

describe('bug reports API', () => {
  let ctx: TestContext;
  const realFetch = global.fetch;
  let githubStatus = 201;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  beforeEach(() => {
    githubStatus = 201;
    // A fresh user id per test: the route rate-limits bug reports per user
    const session = makeSession(ctx);
    session.user.id = `user-${Math.random().toString(36).slice(2, 10)}`;
    mockAuth.mockResolvedValue(session as never);
    // Only the GitHub call is stubbed
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ html_url: 'https://github.com/x/y/issues/1' }), { status: githubStatus })
    ) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = realFetch;
    // Every test starts from an empty uploads directory
    for (const entry of fs.readdirSync(UPLOADS_DIR)) {
      fs.rmSync(path.join(UPLOADS_DIR, entry), { recursive: true, force: true });
    }
  });

  afterAll(async () => {
    await cleanupTestContext(ctx);
    fs.rmSync(UPLOADS_DIR, { recursive: true, force: true });
  });

  it('should return 401 when the user is not authenticated', async () => {
    mockAuth.mockResolvedValue(null as never);

    const res = await bugReportsRoute.POST(await bugReportRequest([]));

    expect(res.status).toBe(401);
  });

  it('should store the screenshot and leave no temp file behind on success', async () => {
    const res = await bugReportsRoute.POST(await bugReportRequest([{ field: 'screenshot', filename: 'shot.png' }]));

    expect(res.status).toBe(201);
    const stored = listUploads();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatch(/^bug-reports[\\/][0-9a-f-]+\.png$/);
  });

  it('should not persist a file sent under an unexpected field name', async () => {
    const res = await bugReportsRoute.POST(
      await bugReportRequest([{ field: 'evil', filename: 'big.png', data: Buffer.alloc(300_000, 1) }])
    );

    expect(res.status).toBe(201);
    expect(listUploads()).toEqual([]);
  });

  it('should keep only the screenshot when an unexpected field is sent next to it', async () => {
    const res = await bugReportsRoute.POST(
      await bugReportRequest([
        { field: 'evil', filename: 'big.png', data: Buffer.alloc(300_000, 1) },
        { field: 'screenshot', filename: 'shot.png' },
      ])
    );

    expect(res.status).toBe(201);
    expect(listUploads()).toHaveLength(1);
  });

  it('should remove the temp file when the input is invalid', async () => {
    const res = await bugReportsRoute.POST(
      await bugReportRequest([{ field: 'screenshot', filename: 'shot.png' }], { title: '' })
    );

    expect(res.status).toBe(400);
    expect(listUploads()).toEqual([]);
  });

  it('should reject a screenshot whose content does not match its extension and keep no file', async () => {
    const res = await bugReportsRoute.POST(
      await bugReportRequest([{ field: 'screenshot', filename: 'shot.png', data: Buffer.from('not an image at all') }])
    );

    expect(res.status).toBe(400);
    expect(listUploads()).toEqual([]);
  });

  it('should answer 415 for a disallowed extension and keep no file', async () => {
    const res = await bugReportsRoute.POST(await bugReportRequest([{ field: 'screenshot', filename: 'shot.gif' }]));

    expect(res.status).toBe(415);
    expect(listUploads()).toEqual([]);
  });

  it('should remove the stored screenshot when GitHub rejects the report', async () => {
    githubStatus = 500;

    const res = await bugReportsRoute.POST(await bugReportRequest([{ field: 'screenshot', filename: 'shot.png' }]));

    expect(res.status).toBe(502);
    expect(listUploads()).toEqual([]);
  });
});
