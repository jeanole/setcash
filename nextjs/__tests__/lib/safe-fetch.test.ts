/**
 * Unit tests for safe-fetch — SSRF protection must be enforced on the
 * connection itself (DNS-rebinding safe), not just by a pre-flight check.
 * No real network calls are made: dns.lookup is mocked and the only socket
 * target is a local HTTP server used to prove that NO connection is attempted.
 */

import dns from 'dns';
import http from 'http';
import type { AddressInfo } from 'net';
import { safeLookup, safeFetch, isPrivateUrl, SsrfBlockedError } from '@/lib/safe-fetch';

type Answer = { address: string; family: 4 | 6 };

const PUBLIC_V4: Answer = { address: '93.184.216.34', family: 4 };

/** Replace dns.lookup so each call pops the next answer set (last one repeats). */
function mockDns(...answerSets: Answer[][]) {
  let call = 0;
  return jest.spyOn(dns, 'lookup').mockImplementation(((
    _host: string,
    _opts: unknown,
    cb: (err: Error | null, addrs: Answer[]) => void
  ) => {
    const answers = answerSets[Math.min(call, answerSets.length - 1)];
    call++;
    process.nextTick(() => cb(null, answers));
  }) as never);
}

function lookupResult(host: string, opts: dns.LookupOptions = { all: true }) {
  return new Promise<{ err: NodeJS.ErrnoException | null; address?: unknown; family?: number }>(
    (resolve) => {
      safeLookup(host, opts, (err, address, family) => resolve({ err, address, family }));
    }
  );
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('safeLookup (connect-time check)', () => {
  const privateCases: [string, Answer][] = [
    ['127.0.0.1', { address: '127.0.0.1', family: 4 }],
    ['10.x', { address: '10.1.2.3', family: 4 }],
    ['169.254.169.254', { address: '169.254.169.254', family: 4 }],
    ['::1', { address: '::1', family: 6 }],
    ['::ffff:127.0.0.1', { address: '::ffff:127.0.0.1', family: 6 }],
  ];

  it.each(privateCases)('should refuse a hostname resolving to %s', async (_label, answer) => {
    mockDns([answer]);
    const { err, address } = await lookupResult('evil.example.com');
    expect(err).toBeInstanceOf(SsrfBlockedError);
    expect(err?.code).toBe('ESSRF');
    expect(address).toBeUndefined();
  });

  it('should refuse when only ONE of several resolved addresses is private', async () => {
    mockDns([PUBLIC_V4, { address: '10.0.0.5', family: 4 }]);
    const { err } = await lookupResult('mixed.example.com');
    expect(err).toBeInstanceOf(SsrfBlockedError);
  });

  it('should refuse in single-address mode (all: false) too', async () => {
    mockDns([{ address: '127.0.0.1', family: 4 }]);
    const { err } = await lookupResult('evil.example.com', {});
    expect(err).toBeInstanceOf(SsrfBlockedError);
  });

  it('should refuse when nothing resolves', async () => {
    mockDns([]);
    const { err } = await lookupResult('empty.example.com');
    expect(err).toBeInstanceOf(SsrfBlockedError);
  });

  it('should propagate DNS errors unchanged', async () => {
    jest.spyOn(dns, 'lookup').mockImplementation(((_h: string, _o: unknown, cb: (e: Error) => void) => {
      process.nextTick(() => cb(Object.assign(new Error('nope'), { code: 'ENOTFOUND' })));
    }) as never);
    const { err } = await lookupResult('missing.example.com');
    expect(err?.code).toBe('ENOTFOUND');
  });

  it('should allow a public address and return it to the socket (all: true)', async () => {
    mockDns([PUBLIC_V4]);
    const { err, address } = await lookupResult('api.example.com');
    expect(err).toBeNull();
    expect(address).toEqual([PUBLIC_V4]);
  });

  it('should allow a public address and return it to the socket (single)', async () => {
    mockDns([PUBLIC_V4]);
    const { err, address, family } = await lookupResult('api.example.com', {});
    expect(err).toBeNull();
    expect(address).toBe('93.184.216.34');
    expect(family).toBe(4);
  });

  it('should allow a public IPv6 address', async () => {
    mockDns([{ address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 }]);
    const { err } = await lookupResult('api6.example.com');
    expect(err).toBeNull();
  });
});

describe('safeFetch (DNS rebinding)', () => {
  let server: http.Server;
  let port: number;
  let connections: number;

  beforeAll(async () => {
    connections = 0;
    server = http.createServer((_req, res) => res.end('internal secret'));
    server.on('connection', () => {
      connections++;
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('should refuse at connect time after a pre-check that saw a public IP (rebinding)', async () => {
    // 1st resolution (pre-check) → public; 2nd (connection) → loopback
    mockDns([PUBLIC_V4], [{ address: '127.0.0.1', family: 4 }]);
    const url = `http://rebind.example.com:${port}/`;

    expect(await isPrivateUrl(url)).toBe(false); // pre-check is fooled

    connections = 0;
    await expect(safeFetch(url, { redirect: 'manual' })).rejects.toBeInstanceOf(SsrfBlockedError);
    expect(connections).toBe(0); // the internal server was never contacted
  });

  it.each(['10.0.0.7', '169.254.169.254', '::1', '::ffff:127.0.0.1'])(
    'should refuse a rebinding host that flips to %s',
    async (privateAddr) => {
      mockDns([PUBLIC_V4], [{ address: privateAddr, family: privateAddr.includes(':') ? 6 : 4 }]);
      const url = `http://rebind.example.com:${port}/`;
      expect(await isPrivateUrl(url)).toBe(false);
      await expect(safeFetch(url)).rejects.toThrow(/private or reserved/);
    }
  );

  it('should refuse IP-literal URLs that skip DNS entirely', async () => {
    const spy = mockDns([PUBLIC_V4]);
    connections = 0;
    await expect(safeFetch(`http://127.0.0.1:${port}/`)).rejects.toBeInstanceOf(SsrfBlockedError);
    await expect(safeFetch('http://[::1]:1/')).rejects.toBeInstanceOf(SsrfBlockedError);
    await expect(safeFetch('http://169.254.169.254/latest/meta-data/')).rejects.toBeInstanceOf(
      SsrfBlockedError
    );
    expect(connections).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it('should reject malformed URLs', async () => {
    await expect(safeFetch('not a url')).rejects.toBeInstanceOf(SsrfBlockedError);
  });
});

describe('isPrivateUrl', () => {
  it('should flag a host that resolves to a private address', async () => {
    mockDns([{ address: '10.0.0.1', family: 4 }]);
    expect(await isPrivateUrl('https://internal.example.com/v1')).toBe(true);
  });

  it('should flag a host when any resolved address is private', async () => {
    mockDns([PUBLIC_V4, { address: '::1', family: 6 }]);
    expect(await isPrivateUrl('https://mixed.example.com/v1')).toBe(true);
  });

  it('should allow a host that resolves only to public addresses', async () => {
    mockDns([PUBLIC_V4]);
    expect(await isPrivateUrl('https://api.example.com/v1')).toBe(false);
  });

  it('should flag reserved hostnames without resolving', async () => {
    const spy = mockDns([PUBLIC_V4]);
    expect(await isPrivateUrl('https://foo.localhost/')).toBe(true);
    expect(await isPrivateUrl('https://db.internal/')).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it('should fail closed when DNS resolution fails', async () => {
    jest.spyOn(dns, 'lookup').mockImplementation(((_h: string, _o: unknown, cb: (e: Error) => void) => {
      process.nextTick(() => cb(new Error('ENOTFOUND')));
    }) as never);
    expect(await isPrivateUrl('https://nx.example.com/')).toBe(true);
  });
});
