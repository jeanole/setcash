import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  it('should return 200 with status ok', async () => {
    const req = new Request('http://localhost/api/health');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ status: 'ok' });
  });
});
