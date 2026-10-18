/**
 * Integration test for BUG-32: the user PDF route must not decode the
 * (already decoded) email route param a second time.
 */

import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { GET } from '@/app/api/reports/user/[email]/pdf/route';

jest.mock('@/auth');
const mockAuth = auth as jest.MockedFunction<typeof auth>;

describe('GET /api/reports/user/[email]/pdf (BUG-32)', () => {
  const suffix = Date.now();
  const email = `s%x${suffix}@qa.test`; // `%` not followed by hex: decoding again throws
  let projectId: string;
  let userId: string;

  beforeAll(async () => {
    const project = await db.project.create({ data: { name: `PDF ${suffix}` } });
    projectId = project.id;
    const user = await db.user.create({ data: { email, passwordHash: '', emailVerified: new Date() } });
    userId = user.id;
    await db.projectMember.create({ data: { projectId, userEmail: email, role: 'user' } });
    await db.bill.create({
      data: { projectId, submittedByEmail: email, date: new Date('2026-05-01'), status: 'approved', vendor: 'Shop', brutto19: 11.9 },
    });
  });

  afterAll(async () => {
    await db.project.deleteMany({ where: { id: projectId } });
    await db.user.deleteMany({ where: { email } });
  });

  it('should render the own report for an address containing %', async () => {
    mockAuth.mockResolvedValue({
      user: {
        id: userId, email, role: 'user', currentProjectId: projectId, currentProjectRole: 'user',
        currentProjectName: 'PDF', isExampleProject: false, isDemoAccount: false,
      },
    } as never);

    const res = await GET(
      new NextRequest(`http://localhost/api/reports/user/${encodeURIComponent(email)}/pdf`),
      { params: Promise.resolve({ email }) }
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/pdf');
  });
});
