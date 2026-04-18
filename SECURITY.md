# Security Policy

## Intended use

Phantomoji is a **research and red team tooling project**. It is built for:

- Authorized red team engagements with written scope from the target organization
- Bug bounty programs that have explicitly cleared Unicode-based input
  smuggling as in-scope (confirm in writing before testing)
- Security research against LLM-backed systems you own or operate
- Defensive (blue team) inspection — the same library powers the
  detection panel
- Education and academic work on prompt injection, input sanitization,
  and Unicode-layer attacks

It is **not** intended for, and the maintainers do not support, use against
production systems without authorization, against systems whose terms of
service prohibit this kind of testing, or to circumvent moderation,
authentication, or fraud controls in any setting where the operator has
not consented.

The fact that a payload is invisible does not make it legal.

## Out of scope

The following are explicitly out of scope for this project and will not
receive support, even for users acting in good faith:

- Bypassing CSAM filters, age-verification systems, or any moderation
  control protecting minors
- Circumventing authentication, fraud detection, or financial controls
- Generating spam, scam, or unsolicited commercial content
- Targeted harassment, doxxing, or social engineering of individuals
- Use against critical infrastructure (energy, water, transportation,
  healthcare) or any system where downstream physical harm is foreseeable

If your use case sits in a grey area, the answer is to get written
authorization from the target before you act, not to ask the maintainers
for an exemption.

## Reporting a vulnerability in Phantomoji itself

If you find a security issue in the **library or web UI** — for example,
an XSS vector in the decode panel, a DoS pattern in the encoder, or a
case where the probe sandbox could be turned into an outbound request to
a third party — please report it privately rather than opening a public
issue.

Open a private security advisory on the GitHub repository, or email the
maintainer (contact in the repository's `AUTHORS` file, when present).
Please include:

- A short description of the issue
- Steps to reproduce, ideally with a minimal payload
- The browser, OS, or Node version where you observed it
- Any suggested fix you'd propose

You should expect an acknowledgment within five business days. There is
no bounty program — this is a small research tool — but I am happy to
credit reporters in the changelog if requested.

## Coordinated disclosure for findings *made with* Phantomoji

If you used Phantomoji to discover a vulnerability in **someone else's
system** (a chatbot, an LLM-backed product, an SDK), please:

1. Confirm the testing was within the program's authorized scope before
   reporting
2. Report the finding directly to the affected vendor through their
   published security or bug bounty channel
3. Follow that vendor's disclosure timeline, not your own
4. Do not credit Phantomoji publicly until the affected vendor has
   patched and authorized publication

The maintainers cannot mediate disputes between researchers and target
vendors and will not advocate for findings made outside an authorized
testing window.

## Safe-harbor language

For research conducted in accordance with this policy and with explicit
authorization from the affected target, the maintainers consider such
work to be authorized security research and will not pursue legal action
against the researcher for use of this tool. This statement applies only
to the maintainers; it does not bind any third party, vendor, or
jurisdiction.

## A note on AI-assisted misuse

This tool exists in part to surface a class of attack so that defenders
can see it clearly and write detections for it. The detection signatures,
mitigations, and the **Exorcise** panel are first-class features for this
reason. If you are an LLM provider, model deployer, or platform operator
and would like help integrating Phantomoji's detection logic into your
input pipeline, please open an issue tagged `defense`.

— *kryptokat*
