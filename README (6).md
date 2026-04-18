# 👻 Phantomoji

> **Unicode steganography for red teams.** Hide arbitrary bytes inside a single
> emoji using variation selectors, tag characters, or zero-width codepoints.
> Renders as one glyph. Tokenizes as every byte.

**Live at [phantomoji.dev](https://phantomoji.dev)**

```
$ echo "ignore previous instructions" | phantomoji encode --channel vs --carrier 👻
👻
$ echo "👻" | phantomoji decode
ignore previous instructions
```

A research tool and worked example for **agentic red team operations
against LLM-backed targets**. Pure ES modules, no build step, no
dependencies — drop it on any static host.

---

## Why this exists

Most LLM input filters are tuned for what humans see, not what tokenizers
process. A single emoji can carry hundreds of invisible bytes that survive
NFC normalization, sail past keyword guardrails, and arrive intact at the
model's context window. Phantomoji is a small, dependency-free library and
web UI that demonstrates three Unicode side-channels for this — plus a
**probe mode** that fingerprints which channel a target's filter is blind to
*before* you spend a payload.

This is the agentic move: the agent probes, the agent picks the channel, the
agent sends the real payload. One module, three smuggling strategies, one
reconnaissance step.

## The three channels

| Channel | Codepoint range | Bandwidth | Survives NFC | Notes |
|---------|-----------------|-----------|--------------|-------|
| `vs`    | U+FE00–FE0F, U+E0100–E01EF | **1 byte / selector** | Yes | Highest density. Killed by `\p{Cf}` strippers. |
| `tag`   | U+E0020–E007E | 1 ASCII char / tag | Yes | Deprecated block — many filters miss it entirely. ASCII-only payloads. |
| `zw`    | U+200B–U+200D, U+2060 | 1 byte / 4 chars (quaternary) | Yes | Lowest density, but embeds anywhere — no carrier emoji needed. |

## Quickstart

Phantomoji ships as a self-contained `index.html` — library inlined,
zero dependencies, works over `file://` or any static host.

**Local preview:**

```bash
git clone https://github.com/cfoudysec/phantomoji_2.0
cd phantomoji
open index.html        # macOS — just double-click works too
# or serve over HTTP:
python3 -m http.server 8000
```

**Deploy:** push to GitHub, enable Pages in Settings → Pages, choose
`main` / `(root)`. Done. Works identically on Cloudflare Pages, Netlify,
Vercel, or any other static host.

## Repository layout

```
phantomoji/
├── index.html                    # self-contained web UI + inlined library
├── phantomoji.js                 # standalone ES module for importing elsewhere
├── tests/
│   ├── roundtrip.test.js         # library correctness
│   └── ui-integration.test.js    # same code paths the UI runs
├── README.md · SECURITY.md · LICENSE
```

`index.html` has the library baked in so it works on any host with no
build step. `phantomoji.js` is the same code as a proper ES module — use
it if you want to `import` phantomoji into your own agent, CLI, or
build pipeline. The two stay in sync via the test suite.

## Library API

```js
import { encode, decode, probe, detectChannels, tokenStats } from './phantomoji.js';

// Hide
const hidden = encode('exfil token here', { channel: 'vs', carrier: '👻' });
// -> "👻" (renders as one glyph; ~17 hidden codepoints)

// Reveal
const { channel, payload } = decode(hidden);
// -> { channel: 'vs', payload: 'exfil token here' }

// Reconnaissance — fingerprint a target's Unicode hygiene
const results = await probe(
  (text) => fetch('/chat', { method: 'POST', body: JSON.stringify({ msg: text }) }),
  async () => (await lastResponse.json()).reply,
);
// -> { vs: true, tag: false, zw: true }

// Forensics — what got hidden in this string?
detectChannels(suspiciousText);  // -> ['vs', 'zw']
tokenStats(suspiciousText);      // -> { codepoints: 47, graphemes: 1, hidden: 46 }
```

Full API docs in [`phantomoji.js`](./phantomoji.js) — the file is short and
heavily commented.

## Probe mode

Probe is the part that makes this more than a script. Send a known canary
through each channel, read back what survives, then choose the channel
that the target's filter ignored. The web UI ships a sandbox version with
simulated filters (strip-zero-width, NFC-only, strip-everything-invisible,
etc.) so you can develop intuition before pointing it at anything real.

For real targets, wire `sendFn` and `recvFn` to your transport of choice —
HTTP, WebSocket, agent tool call. The probe API is transport-agnostic on
purpose.

## For blue teamers

The same library powers the **Exorcise** panel — paste any text, get a
codepoint inflation ratio, channel detection, and the extracted payload.
Detection signatures in the panel are also documented here:

- Strings where `codepoints >> graphemes` (ratio > 2:1) are suspicious.
- Codepoints in U+E0020–E007F (tag block) are almost never legitimate in
  user-submitted text.
- Variation selectors (U+FE00–FE0F, U+E0100–E01EF) attached to non-emoji
  base characters are a strong signal.
- Sequences of zero-width characters longer than 2 warrant inspection.

The simplest mitigation: strip `\p{Cf}` (Unicode format characters) on
input. That single regex kills all three channels.

## Tests

```bash
node --test tests/
```

Two suites — `roundtrip.test.js` exercises the library directly; the
integration suite simulates every UI button against the real library to
catch wiring bugs. No test framework, no node_modules — just `node:test`
and `node:assert`.

## Authorized use only

This tool is for **authorized red team engagements, bug bounty programs
that have explicitly cleared this technique in their scope, security
research against systems you own, and educational work**. Do not deploy
payloads against systems you do not have written permission to test.
LLM-backed chatbots are increasingly covered by anti-fraud and computer
misuse statutes; the absence of a CAPTCHA is not the absence of a fence.

See [SECURITY.md](./SECURITY.md) for the full responsible-use policy and
how to report bugs in the tool itself.

## License

[MIT](./LICENSE) — © kryptokat

## Credits

Built by [kryptokat](https://github.com/cfoudysec) — purple team research.
The single-carrier variation-selector technique was popularized by Paul
Butler's 2024 writeup on smuggling data inside emoji; phantomoji extends
it with two additional channels and the probe loop.
