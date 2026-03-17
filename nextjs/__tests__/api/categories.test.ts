import { auth } from '@/auth';
import { GET } from '@/app/api/categories/route';
import { db } from '@/lib/db';
import { createTestContext, cleanupTestContext, makeSession, TestContext } from '../helpers';

jest.mock('@/auth');
const mockAuth = auth as jest.MockedFunction<typeof auth>;

describe('GET /api/categories', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await cleanupTestContext(ctx);
  });

  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null);
    const req = new Request('http://localhost/api/categories');
    const res = await GET(req as never);
    expect(res.status).toBe(401);
  });

  it('should return empty array when no categories exist', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(ctx) as never);
    const req = new Request('http://localhost/api/categories');
    const res = await GET(req as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);
  });

  it('should return categories for the current project', async () => {
    // Seed a category
    const cat = await db.category.create({
      data: { name: 'Travel', projectId: ctx.projectId, budget: 1000 },
    });

    mockAuth.mockResolvedValueOnce(makeSession(ctx) as never);
    const req = new Request('http://localhost/api/categories');
    const res = await GET(req as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.some((c: { id: string }) => c.id === cat.id)).toBe(true);

    // Cleanup
    await db.category.delete({ where: { id: cat.id } });
  });

  it('should return 400 when session has no project', async () => {
    mockAuth.mockResolvedValueOnce({
      user: { ...makeSession(ctx).user, currentProjectId: null },
    } as never);
    const req = new Request('http://localhost/api/categories');
    const res = await GET(req as never);
    expect(res.status).toBe(400);
  });
});
