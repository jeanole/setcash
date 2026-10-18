// ============================================================================
// SSRF-safe fetch
// ============================================================================
// Outbound requests to admin-configurable URLs (e.g. the OCR provider base URL)
// must not be able to reach internal addresses. A pre-flight DNS check alone is
// not enough: fetch() resolves the name again, so a DNS-rebinding host can
// answer with a public IP for the check and a private IP for the connection.
//
// This module therefore enforces the check on the connection itself: the undici
// Agent below resolves hostnames through `safeLookup`, which rejects the
// connection if ANY resolved address is private/reserved and otherwise hands the
// validated address(es) straight to the socket (no second resolution).
//
// NOTE: this file is part of the custom server's CommonJS build
// (tsconfig.server.json) — use RELATIVE imports for project files, never `@/`.
// ============================================================================

import dns from 'dns';
import net from 'net';
import { fetch as undiciFetch, Agent } from 'undici';

// ── SSRF protection: address range checks ────────────────────────────────────
// IPv4 ranges that must never be reachable from a user-supplied provider URL:
// [network, prefix length]
const BLOCKED_IPV4_RANGES: [string, number][] = [
  ['0.0.0.0', 8],        // "this" network
  ['10.0.0.0', 8],       // private
  ['100.64.0.0', 10],    // carrier-grade NAT
  ['127.0.0.0', 8],      // loopback
  ['169.254.0.0', 16],   // link-local (cloud metadata)
  ['172.16.0.0', 12],    // private
  ['192.0.0.0', 24],     // IETF protocol assignments
  ['192.0.2.0', 24],     // TEST-NET-1
  ['192.168.0.0', 16],   // private
  ['198.18.0.0', 15],    // benchmarking
  ['198.51.100.0', 24],  // TEST-NET-2
  ['203.0.113.0', 24],   // TEST-NET-3
  ['224.0.0.0', 4],      // multicast
  ['240.0.0.0', 4],      // reserved + broadcast
];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    n = n * 256 + octet;
  }
  return n;
}

function isPrivateIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true; // unparseable → fail closed
  return BLOCKED_IPV4_RANGES.some(([network, prefix]) => {
    const base = ipv4ToInt(network) as number;
    const size = 2 ** (32 - prefix);
    return Math.floor(n / size) === Math.floor(base / size);
  });
}

// Expand an IPv6 literal into eight 16-bit groups (null if malformed)
function parseIpv6(addr: string): number[] | null {
  let text = addr;
  // Embedded dotted IPv4 tail (e.g. ::ffff:127.0.0.1) → two hex groups
  const lastColon = text.lastIndexOf(':');
  const tail = text.slice(lastColon + 1);
  if (tail.includes('.')) {
    const v4 = ipv4ToInt(tail);
    if (v4 === null) return null;
    text = `${text.slice(0, lastColon + 1)}${Math.floor(v4 / 65536).toString(16)}:${(v4 % 65536).toString(16)}`;
  }
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...rest];
  if (groups.length !== 8) return null;
  const out: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    out.push(parseInt(g, 16));
  }
  return out;
}

function isPrivateIpv6(addr: string): boolean {
  const g = parseIpv6(addr);
  if (!g) return true; // unparseable → fail closed
  const embeddedV4 = (hi: number, lo: number) =>
    isPrivateIpv4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);

  // :: and ::1
  if (g.slice(0, 7).every((x) => x === 0) && (g[7] === 0 || g[7] === 1)) return true;
  // IPv4-mapped (::ffff:a.b.c.d) and deprecated IPv4-compatible (::a.b.c.d)
  if (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0xffff || g[5] === 0)) {
    return embeddedV4(g[6], g[7]);
  }
  // NAT64 well-known prefix 64:ff9b::/96
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) {
    return embeddedV4(g[6], g[7]);
  }
  // 6to4 (2002::/16) embeds an IPv4 address in groups 1-2
  if (g[0] === 0x2002) return embeddedV4(g[1], g[2]);
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local (deprecated)
  if ((g[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // documentation
  return false;
}

export function isPrivateIp(ip: string): boolean {
  const addr = ip.toLowerCase().replace(/^\[|\]$/g, '').split('%')[0];
  if (addr === 'localhost') return true;
  const family = net.isIP(addr);
  if (family === 4) return isPrivateIpv4(addr);
  if (family === 6) return isPrivateIpv6(addr);
  return false; // not an IP literal — caller resolves hostnames
}

/** Error raised when a connection is refused because it targets a private address. */
export class SsrfBlockedError extends Error {
  code = 'ESSRF';
  constructor(message: string) {
    super(message);
    this.name = 'SSRFError';
  }
}

/**
 * Pre-flight check: true when the URL is malformed, uses a reserved hostname, is
 * an IP literal in a blocked range, or resolves (any address) to a blocked range.
 * This is advisory/early-failure only — the connection itself is re-validated by
 * `safeFetch` at connect time, which is what closes the DNS-rebinding window.
 */
export async function isPrivateUrl(urlString: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return true;
  }
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true;
  if (hostname.endsWith('.local') || hostname.endsWith('.internal')) return true;
  if (net.isIP(hostname)) return isPrivateIp(hostname);
  // Check EVERY returned address — a name can resolve to a public and a private IP.
  try {
    const addresses = await new Promise<dns.LookupAddress[]>((resolve, reject) => {
      dns.lookup(hostname, { all: true, verbatim: true }, (err, result) =>
        err ? reject(err) : resolve(result)
      );
    });
    if (addresses.length === 0) return true;
    if (addresses.some(({ address }) => isPrivateIp(address))) return true;
  } catch {
    // DNS resolution failed — block the request
    return true;
  }
  return false;
}

// ── Connect-time enforcement ─────────────────────────────────────────────────
type LookupOptions = dns.LookupOptions;
type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address?: string | dns.LookupAddress[],
  family?: number
) => void;

/**
 * `lookup` implementation for net/tls sockets. Resolves with dns.lookup(all) and
 * refuses (ESSRF) if any resolved address is private/reserved. The addresses it
 * returns are the ones the socket connects to, so there is no re-resolution.
 * Handles both calling conventions of Node's net (all: true / single address).
 */
export function safeLookup(
  hostname: string,
  options: LookupOptions | number | undefined,
  callback: LookupCallback
): void {
  const opts: LookupOptions =
    typeof options === 'number' ? { family: options } : { ...(options ?? {}) };
  const wantAll = opts.all === true;

  dns.lookup(hostname, { ...opts, all: true, verbatim: true }, (err, addresses) => {
    if (err) return callback(err);
    if (!addresses || addresses.length === 0) {
      return callback(new SsrfBlockedError(`No addresses resolved for ${hostname}`));
    }
    const blocked = addresses.find(({ address }) => isPrivateIp(address));
    if (blocked) {
      return callback(
        new SsrfBlockedError(`Refusing to connect to ${hostname}: resolves to a private or reserved address`)
      );
    }
    if (wantAll) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
}

/** Create an undici Agent whose sockets only ever connect to validated addresses. */
export function createSafeAgent(): Agent {
  return new Agent({ connect: { lookup: safeLookup as never } });
}

let sharedAgent: Agent | null = null;
function getSafeAgent(): Agent {
  if (!sharedAgent) sharedAgent = createSafeAgent();
  return sharedAgent;
}

function findSsrfCause(e: unknown): SsrfBlockedError | null {
  let cur: unknown = e;
  for (let i = 0; i < 5 && cur; i++) {
    if (cur instanceof SsrfBlockedError) return cur;
    cur = (cur as { cause?: unknown }).cause;
  }
  return null;
}

/**
 * fetch() that refuses to connect to private/reserved addresses, enforced at
 * connect time (DNS-rebinding safe). IP-literal hosts skip DNS entirely, so they
 * are checked here before dispatch. Callers keep passing `redirect: 'manual'`
 * etc. exactly as with the global fetch.
 */
export async function safeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SsrfBlockedError('Invalid URL');
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && isPrivateIp(host)) {
    throw new SsrfBlockedError(`Refusing to connect to ${host}: private or reserved address`);
  }
  try {
    return (await undiciFetch(url, { ...init, dispatcher: getSafeAgent() } as never)) as unknown as Response;
  } catch (e) {
    const ssrf = findSsrfCause(e);
    if (ssrf) throw ssrf;
    throw e;
  }
}
