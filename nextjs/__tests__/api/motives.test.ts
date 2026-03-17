import { auth } from '@/auth';
import { GET } from '@/app/api/motives/route';
import { db } from '@/lib/db';
import { createTestContext, cleanupTestContext, makeSession, TestContext } from '../helpers';

jest.mock('@/auth');
const mockAuth = auth as jest.MockedFunction<typeof auth>;

describe('GET /api/motives', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await cleanupTestContext(ctx);
  });

  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null);
    const req = new Request('http://localhost/api/motives');
    const res = await GET(req as never);
    expect(res.status).toBe(401);
  });

  it('should return empty array when no motives exist', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(ctx) as never);
    const req = new Request('http://localhost/api/motives');
    const res = await GET(req as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);
  });

  it('should return motives for the current project', async () => {
    const motive = await db.motive.create({
      data: { name: 'Marketing', projectId: ctx.projectId, budget: 5000 },
    });

    mockAuth.mockResolvedValueOnce(makeSession(ctx) as never);
    const req = new Request('http://localhost/api/motives');
    const res = await GET(req as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.some((m: { id: string }) => m.id === motive.id)).toBe(true);

    await db.motive.delete({ where: { id: motive.id } });
  });

  it('should not return motives from another project', async () => {
    const otherProject = await db.project.create({ data: { name: 'Other' } });
    const motive = await db.motive.create({
      data: { name: 'Hidden', projectId: otherProject.id, budget: 0 },
    });

    mockAuth.mockResolvedValueOnce(makeSession(ctx) as never);
    const req = new Request('http://localhost/api/motives');
    const res = await GET(req as never);
    const body = await res.json();
    expect(body.some((m: { id: string }) => m.id === motive.id)).toBe(false);

    await db.project.delete({ where: { id: otherProject.id } });
  });
});
