/**
 * Unit tests for getClientIp — rate-limit keys must not come from
 * client-controlled headers.
 */

import { getClientIp, PEER_IP_HEADER } from '@/lib/client-ip';

function req(headers: Record<string, string>) {
  return { headers: new Headers(headers) };
}

describe('getClientIp', () => {
  const original = process.env.TRUSTED_IP_HEADER;

  afterEach(() => {
    if (original === undefined) delete process.env.TRUSTED_IP_HEADER;
    else process.env.TRUSTED_IP_HEADER = original;
  });

  it('should use cf-connecting-ip by default', () => {
    delete process.env.TRUSTED_IP_HEADER;
    expect(getClientIp(req({ 'cf-connecting-ip': '1.2.3.4', [PEER_IP_HEADER]: '10.0.0.1' }))).toBe('1.2.3.4');
  });

  it('should ignore X-Forwarded-For and fall back to the peer address', () => {
    delete process.env.TRUSTED_IP_HEADER;
    expect(getClientIp(req({ 'x-forwarded-for': '6.6.6.6', [PEER_IP_HEADER]: '10.0.0.1' }))).toBe('10.0.0.1');
  });

  it('should use the configured trusted header', () => {
    process.env.TRUSTED_IP_HEADER = 'X-Real-IP';
    expect(getClientIp(req({ 'x-real-ip': '5.5.5.5', 'cf-connecting-ip': '1.2.3.4' }))).toBe('5.5.5.5');
  });

  it('should only use the peer address when TRUSTED_IP_HEADER is none', () => {
    process.env.TRUSTED_IP_HEADER = 'none';
    expect(getClientIp(req({ 'cf-connecting-ip': '1.2.3.4', [PEER_IP_HEADER]: '10.0.0.1' }))).toBe('10.0.0.1');
  });

  it('should return unknown when no address is available', () => {
    process.env.TRUSTED_IP_HEADER = 'none';
    expect(getClientIp(req({}))).toBe('unknown');
  });
});
