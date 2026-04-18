// phantomoji.js
// Unicode steganography library for authorized red team testing.
//
// Three channels:
//   vs   - Variation Selectors (U+FE00-FE0F, U+E0100-E01EF). 1 byte per selector.
//          Best raw-byte channel. Survives NFC. Killed by \p{Cf} strippers.
//   tag  - Tag characters (U+E0020-E007E). 1:1 with printable ASCII.
//          Different detection profile; some filters miss this deprecated block.
//   zw   - Zero-width (ZWSP/ZWNJ/ZWJ/WJ). Quaternary encoding, 4 chars per byte.
//          Lower bandwidth but embeds anywhere — no carrier emoji needed.
//
// Public API:
//   encode(payload, { channel, carrier })  -> string
//   decode(text, { channel? })             -> { channel, payload }
//   detectChannels(text)                   -> string[]
//   probe(sendFn, recvFn, { canary? })     -> { vs, tag, zw }
//   tokenStats(text)                       -> { codepoints, graphemes, hidden }
//
// Usage:
//   import { encode, decode, probe } from './phantomoji.js';
//   const hidden = encode('secret', { channel: 'vs', carrier: '😀' });
//   const { payload } = decode(hidden);

// ---------------------------------------------------------------------------
// Channel: Variation Selectors
// ---------------------------------------------------------------------------

const VS_LOW_START  = 0xFE00;
const VS_LOW_END    = 0xFE0F;
const VS_HIGH_START = 0xE0100;
const VS_HIGH_END   = 0xE01EF;

function byteToVS(b) {
  if (b < 0 || b > 255) throw new RangeError(`byte out of range: ${b}`);
  return b < 16
    ? String.fromCodePoint(VS_LOW_START + b)
    : String.fromCodePoint(VS_HIGH_START + b - 16);
}

function vsToByte(cp) {
  if (cp >= VS_LOW_START  && cp <= VS_LOW_END)  return cp - VS_LOW_START;
  if (cp >= VS_HIGH_START && cp <= VS_HIGH_END) return cp - VS_HIGH_START + 16;
  return null;
}

function encodeVS(payload, carrier) {
  const bytes = new TextEncoder().encode(payload);
  let out = carrier;
  for (const b of bytes) out += byteToVS(b);
  return out;
}

function decodeVS(text) {
  const bytes = [];
  for (const ch of text) {
    const b = vsToByte(ch.codePointAt(0));
    if (b !== null) bytes.push(b);
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
}

// ---------------------------------------------------------------------------
// Channel: Tag Characters
// ---------------------------------------------------------------------------

const TAG_START   = 0xE0020;
const TAG_END     = 0xE007E;
const TAG_CANCEL  = 0xE007F;
const ASCII_SPACE = 0x20;
const ASCII_TILDE = 0x7E;

function charToTag(ch) {
  const cp = ch.codePointAt(0);
  if (cp < ASCII_SPACE || cp > ASCII_TILDE) {
    throw new RangeError(
      `tag channel only supports printable ASCII (U+0020-U+007E); got U+${cp.toString(16).toUpperCase()}`
    );
  }
  return String.fromCodePoint(TAG_START + (cp - ASCII_SPACE));
}

function tagToChar(cp) {
  if (cp >= TAG_START && cp <= TAG_END) {
    return String.fromCodePoint(ASCII_SPACE + (cp - TAG_START));
  }
  return null;
}

function encodeTag(payload, carrier) {
  let out = carrier;
  for (const ch of payload) out += charToTag(ch);
  return out;
}

function decodeTag(text) {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp === TAG_CANCEL) break;
    const decoded = tagToChar(cp);
    if (decoded !== null) out += decoded;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Channel: Zero-Width (quaternary)
// ZWSP=00, ZWNJ=01, ZWJ=10, WJ=11  -> 2 bits per char, 4 chars per byte
// ---------------------------------------------------------------------------

const ZW_CHARS = ['\u200B', '\u200C', '\u200D', '\u2060'];
const ZW_MAP   = new Map(ZW_CHARS.map((c, i) => [c.codePointAt(0), i]));

function byteToZW(b) {
  return ZW_CHARS[(b >> 6) & 3]
       + ZW_CHARS[(b >> 4) & 3]
       + ZW_CHARS[(b >> 2) & 3]
       + ZW_CHARS[ b       & 3];
}

function encodeZW(payload, carrier) {
  const bytes = new TextEncoder().encode(payload);
  let out = carrier;
  for (const b of bytes) out += byteToZW(b);
  return out;
}

function decodeZW(text) {
  const bits = [];
  for (const ch of text) {
    const v = ZW_MAP.get(ch.codePointAt(0));
    if (v !== undefined) bits.push(v);
  }
  const bytes = [];
  for (let i = 0; i + 4 <= bits.length; i += 4) {
    bytes.push(
      (bits[i] << 6) | (bits[i + 1] << 4) | (bits[i + 2] << 2) | bits[i + 3]
    );
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
}

// ---------------------------------------------------------------------------
// Channel registry
// ---------------------------------------------------------------------------

const CHANNELS = {
  vs: {
    encode: encodeVS,
    decode: decodeVS,
    detect: (cp) => vsToByte(cp) !== null,
    defaultCarrier: '😀',
  },
  tag: {
    encode: encodeTag,
    decode: decodeTag,
    detect: (cp) => cp >= TAG_START && cp <= TAG_CANCEL,
    defaultCarrier: '😀',
  },
  zw: {
    encode: encodeZW,
    decode: decodeZW,
    detect: (cp) => ZW_MAP.has(cp),
    defaultCarrier: '',
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function encode(payload, { channel = 'vs', carrier } = {}) {
  const ch = CHANNELS[channel];
  if (!ch) throw new Error(`unknown channel: ${channel}`);
  return ch.encode(payload, carrier ?? ch.defaultCarrier);
}

export function detectChannels(text) {
  const found = new Set();
  for (const c of text) {
    const cp = c.codePointAt(0);
    for (const [name, ch] of Object.entries(CHANNELS)) {
      if (ch.detect(cp)) found.add(name);
    }
  }
  return [...found];
}

export function decode(text, { channel } = {}) {
  if (channel) {
    const ch = CHANNELS[channel];
    if (!ch) throw new Error(`unknown channel: ${channel}`);
    return { channel, payload: ch.decode(text) };
  }

  const detected = detectChannels(text);
  if (detected.length === 0) return { channel: null, payload: '' };
  if (detected.length === 1) {
    return { channel: detected[0], payload: CHANNELS[detected[0]].decode(text) };
  }

  // Multiple channels present — decode each.
  const payload = {};
  for (const c of detected) payload[c] = CHANNELS[c].decode(text);
  return { channel: 'mixed', payload };
}

/**
 * Probe a target to see which channels its filter is blind to.
 * sendFn(text)   -> sends text to target (sync or async)
 * recvFn()       -> returns the target's response text (sync or async)
 * Returns { vs, tag, zw } where each value is true if the canary survived.
 */
export async function probe(sendFn, recvFn, { canary = 'CANARY' } = {}) {
  const results = {};
  for (const channel of Object.keys(CHANNELS)) {
    const marker  = `${canary}-${channel}`;
    const payload = encode(marker, { channel });
    try {
      await sendFn(payload);
      const response = await recvFn();
      const decoded  = CHANNELS[channel].decode(response);
      results[channel] = decoded.includes(marker);
    } catch (err) {
      results[channel] = { error: err.message };
    }
  }
  return results;
}

/**
 * Cost of a steganographic payload — how much does the hidden content
 * inflate the codepoint count vs. what the user sees?
 */
export function tokenStats(text) {
  let codepoints = 0;
  for (const _ of text) codepoints++;

  let graphemes = codepoints;
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    graphemes = 0;
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    for (const _ of seg.segment(text)) graphemes++;
  }

  return { codepoints, graphemes, hidden: codepoints - graphemes };
}

// Direct access to per-channel encoders/decoders, useful for tests and
// for the worked examples in the book.
export const channels = {
  vs:  { encode: (p, c = '😀') => encodeVS(p, c),  decode: decodeVS  },
  tag: { encode: (p, c = '😀') => encodeTag(p, c), decode: decodeTag },
  zw:  { encode: (p, c = '')   => encodeZW(p, c),  decode: decodeZW  },
};
