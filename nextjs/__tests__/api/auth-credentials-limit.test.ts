/**
 * Per-email login rate limit on the credentials callback wrapper (BUG-1).
 * Auth.js accepts urlencoded AND JSON bodies, so the limiter must key on the
 * email in either, exactly as Auth.js reads it. The Auth.js handler is mocked
 * so no real sign-in runs.
 */

import { NextRequest } from 'next/server';

const mockPost = jest.fn();
jest.mock('@/auth', () => ({
  handlers: { GET: jest.fn(), POST: (req: unknown) => mockPost(req) },
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const route = require('@/app/api/auth/callback/credentials/route') as typeof import('@/app/api/auth/callback/credentials/route');
/* eslint-enable @typescript-eslint/no-require-imports */

let counter = 0;
function uniqueEmail(): string {
  counter += 1;
  return `Victim-${Date.now()}-${counter}@Example.com`;
}

function loginRequest(opts: {
  contentType: string | null;
  body: string;
  ip: string;
}): NextRequest {
  const headers: Record<string, string> = { 'cf-connecting-ip': opts.ip };
  if (opts.contentType) headers['content-type'] = opts.contentType;
  return new NextRequest('http://localhost/api/auth/callback/credentials', {
    method: 'POST',
    headers,
    body: opts.body,
  });
}

const jsonLogin = (email: unknown, ip: string) =>
  loginRequest({
    contentType: 'application/json',
    body: JSON.stringify({ email, password: 'wrong', csrfToken: 'x' }),
    ip,
  });

const formLogin = (query: string, ip: string) =>
  loginRequest({ contentType: 'application/x-www-form-urlencoded', body: query, ip });

describe('POST /api/auth/callback/credentials rate limiting', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockPost.mockResolvedValue(new Response(null, { status: 302 }));
  });

  it('should return 429 on the 11th JSON-body attempt for one email from rotating IPs', async () => {
    const email = uniqueEmail();
    const statuses: number[] = [];

    for (let i = 0; i < 11; i++) {
      const res = await route.POST(jsonLogin(email, `203.0.113.${i + 1}`));
      statuses.push(res.status);
    }

    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(302));
    expect(statuses[10]).toBe(429);
    expect(mockPost).toHaveBeenCalledTimes(10);
  });

  it('should share the per-email budget between JSON and form bodies', async () => {
    const email = uniqueEmail();

    for (let i = 0; i < 5; i++) {
      await route.POST(jsonLogin(email, `198.51.100.${i + 1}`));
    }
    for (let i = 0; i < 5; i++) {
      await route.POST(formLogin(`email=${encodeURIComponent(email)}&password=x`, `198.51.100.${i + 20}`));
    }
    const res = await route.POST(jsonLogin(email.toUpperCase(), '198.51.100.99'));

    expect(res.status).toBe(429);
  });

  it('should normalise case and surrounding whitespace in the email', async () => {
    const email = uniqueEmail();

    for (let i = 0; i < 5; i++) {
      await route.POST(jsonLogin(`  ${email.toUpperCase()}  `, `192.0.2.${i + 1}`));
    }
    for (let i = 0; i < 5; i++) {
      await route.POST(jsonLogin(email.toLowerCase(), `192.0.2.${i + 20}`));
    }
    const res = await route.POST(jsonLogin(email, '192.0.2.99'));

    expect(res.status).toBe(429);
  });

  it('should key on the last repeated email field, as Auth.js reads it', async () => {
    const victim = uniqueEmail();
    const decoy = uniqueEmail();

    // email=<decoy>&email=<victim>: Auth.js authenticates <victim>
    for (let i = 0; i < 10; i++) {
      await route.POST(
        formLogin(
          `email=${encodeURIComponent(decoy)}&email=${encodeURIComponent(victim)}&password=x`,
          `100.64.0.${i + 1}`
        )
      );
    }
    const res = await route.POST(jsonLogin(victim, '100.64.0.99'));

    expect(res.status).toBe(429);
  });

  it('should reject unsupported content types instead of skipping the email limit', async () => {
    const res = await route.POST(
      loginRequest({ contentType: 'text/plain', body: 'email=a@b.co', ip: '10.9.9.1' })
    );

    expect(res.status).toBe(415);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('should reject a request without a content type', async () => {
    const res = await route.POST(loginRequest({ contentType: null, body: 'x', ip: '10.9.9.2' }));

    expect(res.status).toBe(415);
  });

  it('should reject malformed JSON with 400', async () => {
    const res = await route.POST(
      loginRequest({ contentType: 'application/json', body: '{not json', ip: '10.9.9.3' })
    );

    expect(res.status).toBe(400);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('should reject a body without a string email with 400', async () => {
    const res = await route.POST(jsonLogin(['a@b.co'], '10.9.9.4'));

    expect(res.status).toBe(400);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('should still apply the per-IP limit', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await route.POST(jsonLogin(uniqueEmail(), '10.8.8.8'));
      statuses.push(res.status);
    }

    expect(statuses[5]).toBe(429);
  });
});
