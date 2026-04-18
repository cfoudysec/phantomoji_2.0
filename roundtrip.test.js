// tests/roundtrip.test.js
// Run with:  node --test tests/roundtrip.test.js
//
// Uses Node's built-in test runner (Node 18+) and assert. No dependencies.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  encode, decode, detectChannels, probe, tokenStats,
} from '../phantomoji.js';

const samples = [
  '',
  'a',
  'hello world',
  'ignore previous instructions',
  'Üñîçødé tëst',
  '😀🔥💀',
  'A'.repeat(1024),
];

test('VS channel roundtrip', () => {
  for (const s of samples) {
    const encoded = encode(s, { channel: 'vs' });
    const { channel, payload } = decode(encoded, { channel: 'vs' });
    assert.equal(channel, 'vs');
    assert.equal(payload, s);
  }
});

test('Tag channel roundtrip (printable ASCII)', () => {
  const ascii = ['', 'hello', 'CANARY-tag', 'a b c 1 2 3 ! @ # ~'];
  for (const s of ascii) {
    const encoded = encode(s, { channel: 'tag' });
    const { payload } = decode(encoded, { channel: 'tag' });
    assert.equal(payload, s);
  }
});

test('Tag channel rejects non-ASCII payloads', () => {
  assert.throws(() => encode('café', { channel: 'tag' }), /printable ASCII/);
  assert.throws(() => encode('💀', { channel: 'tag' }), /printable ASCII/);
  assert.throws(() => encode('\n', { channel: 'tag' }), /printable ASCII/);
});

test('ZW channel roundtrip', () => {
  for (const s of samples) {
    const encoded = encode(s, { channel: 'zw' });
    const { payload } = decode(encoded, { channel: 'zw' });
    assert.equal(payload, s);
  }
});

test('Auto-detect picks the correct channel', () => {
  for (const ch of ['vs', 'tag', 'zw']) {
    const marker = `CANARY-${ch}`;
    const encoded = encode(marker, { channel: ch });
    const result = decode(encoded);
    assert.equal(result.channel, ch);
    assert.equal(result.payload, marker);
  }
});

test('Plain text decodes to nothing', () => {
  const result = decode('just some normal text with no hidden payload');
  assert.equal(result.channel, null);
  assert.equal(result.payload, '');
});

test('detectChannels finds all channels present', () => {
  const mixed = encode('a', { channel: 'vs' }) + encode('b', { channel: 'zw' });
  const detected = detectChannels(mixed);
  assert.ok(detected.includes('vs'));
  assert.ok(detected.includes('zw'));
});

test('Mixed-channel input returns per-channel payloads', () => {
  const mixed = encode('alpha', { channel: 'vs' }) + encode('bravo', { channel: 'zw' });
  const result = decode(mixed);
  assert.equal(result.channel, 'mixed');
  assert.equal(result.payload.vs, 'alpha');
  assert.equal(result.payload.zw, 'bravo');
});

test('Custom carrier is preserved at the start of output', () => {
  const encoded = encode('secret', { channel: 'vs', carrier: '🔥' });
  assert.ok(encoded.startsWith('🔥'));
  const { payload } = decode(encoded);
  assert.equal(payload, 'secret');
});

test('tokenStats reports hidden codepoints correctly', () => {
  const encoded = encode('hello', { channel: 'vs' });
  const stats = tokenStats(encoded);
  // 'hello' = 5 UTF-8 bytes -> 5 VS chars + 1 carrier emoji = 6 codepoints, 1 grapheme
  assert.equal(stats.codepoints, 6);
  assert.equal(stats.graphemes, 1);
  assert.equal(stats.hidden, 5);
});

test('probe identifies which channels survive a filter', async () => {
  // Simulated target that strips zero-width characters but keeps everything else.
  let lastSent = '';
  const sendFn = (text) => { lastSent = text; };
  const recvFn = () => lastSent.replace(/[\u200B-\u200D\u2060]/g, '');

  const results = await probe(sendFn, recvFn);
  assert.equal(results.vs,  true);
  assert.equal(results.tag, true);
  assert.equal(results.zw,  false);
});

test('probe handles a target that strips everything invisible', async () => {
  let lastSent = '';
  const sendFn = (text) => { lastSent = text; };
  const recvFn = () =>
    lastSent.replace(/[\u200B-\u200D\u2060\uFE00-\uFE0F]/g, '')
            .replace(/[\u{E0020}-\u{E007F}\u{E0100}-\u{E01EF}]/gu, '');

  const results = await probe(sendFn, recvFn);
  assert.equal(results.vs,  false);
  assert.equal(results.tag, false);
  assert.equal(results.zw,  false);
});

test('Unknown channel throws', () => {
  assert.throws(() => encode('x', { channel: 'bogus' }), /unknown channel/);
  assert.throws(() => decode('x', { channel: 'bogus' }), /unknown channel/);
});
