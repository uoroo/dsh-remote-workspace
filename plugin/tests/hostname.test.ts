import { describe, expect, it } from 'vitest'
import { isLoopbackHostname } from '../src/client/PickerFlow.tsx'

describe('isLoopbackHostname', () => {
  it('accepts localhost', () => {
    expect(isLoopbackHostname('localhost')).toBe(true)
  })

  it('accepts localhost case-insensitively', () => {
    expect(isLoopbackHostname('LOCALHOST')).toBe(true)
  })

  it('accepts every 127.* address', () => {
    expect(isLoopbackHostname('127.0.0.1')).toBe(true)
    expect(isLoopbackHostname('127.0.0.2')).toBe(true)
    expect(isLoopbackHostname('127.anything.local')).toBe(true)
  })

  it('rejects a bare 127 without a dot', () => {
    expect(isLoopbackHostname('127')).toBe(false)
  })

  it('accepts the bracketed and bare IPv6 loopback forms', () => {
    expect(isLoopbackHostname('[::1]')).toBe(true)
    expect(isLoopbackHostname('::1')).toBe(true)
  })

  it('rejects remote LAN hostnames and domains', () => {
    expect(isLoopbackHostname('192.168.1.8')).toBe(false)
    expect(isLoopbackHostname('10.0.0.5')).toBe(false)
    expect(isLoopbackHostname('example.com')).toBe(false)
    expect(isLoopbackHostname('localhost.localdomain')).toBe(false)
  })

  it('rejects the empty hostname', () => {
    expect(isLoopbackHostname('')).toBe(false)
  })
})
