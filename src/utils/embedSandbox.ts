// Web-only helper: decides the <iframe> `sandbox` value for an embed provider.
//
// Embed hosts split into two camps when framed:
//   • Tolerant (vidsrc family): play fine inside a sandboxed iframe, so we keep
//     a loosened sandbox that blocks the worst behaviour (silent top-nav hijack)
//     while permitting popups so their player scripts run.
//   • Sandbox-detecting (multiembed / streamingnow / 2embed / autoembed /
//     moviesapi …): run an anti-sandbox check and refuse with "Sandboxing is
//     not allowed!" the instant ANY sandbox attribute is present — no token
//     combination satisfies them (verified: allow-popups and full
//     allow-top-navigation both still fail; only removing the attribute works).
//     For these it's no-sandbox-or-no-playback, so we omit the attribute.
//
// Returning `undefined` tells the caller to render the iframe with no `sandbox`
// attribute at all.

const LOOSENED_SANDBOX =
  "allow-scripts allow-same-origin allow-presentation allow-forms " +
  "allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation";

// Host substrings of providers known to reject any sandboxed iframe.
const SANDBOX_DETECTING_HOSTS = [
  "multiembed",
  "streamingnow",
  "2embed",
  "autoembed",
  "moviesapi",
  "vidora",
  "cloudnestra",
];

export function sandboxForEmbed(url: string | null | undefined): string | undefined {
  if (!url) return LOOSENED_SANDBOX;
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    host = url.toLowerCase();
  }
  const intolerant = SANDBOX_DETECTING_HOSTS.some((h) => host.includes(h));
  return intolerant ? undefined : LOOSENED_SANDBOX;
}
