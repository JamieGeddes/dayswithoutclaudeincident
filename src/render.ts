import type { Incident } from "./types.js";

export interface RenderArgs {
  daysSince: number;
  longestStreakDays: number;
  lastIncident: Incident;
  generatedAt: Date;
}

export function renderHtml({ daysSince, longestStreakDays, lastIncident, generatedAt }: RenderArgs): string {
  const dayWord = daysSince === 1 ? "DAY" : "DAYS";
  const longestWord = longestStreakDays === 1 ? "day" : "days";
  const incidentTitle = escapeHtml(lastIncident.title);
  const incidentLink = escapeHtml(lastIncident.link);
  const incidentDate = formatUtcDate(lastIncident.pubDate);
  const generated = formatUtcDateTime(generatedAt);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="index,follow">
<title>${daysSince} ${dayWord.toLowerCase()} without a Claude incident</title>
<meta name="description" content="An unofficial 'days without an incident' counter for the Anthropic Claude status page.">
<style>
  :root {
    --yellow: #FFC400;
    --black: #0A0A0A;
    --stripe: repeating-linear-gradient(135deg, #0A0A0A 0 28px, #FFC400 28px 56px);
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--yellow);
    color: var(--black);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    -webkit-font-smoothing: antialiased;
  }
  .stripe { height: 28px; background: var(--stripe); }
  main {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4vh 5vw;
    gap: 2.5rem;
    text-align: center;
  }
  .banner {
    font-weight: 900;
    letter-spacing: 0.08em;
    font-size: clamp(1.4rem, 3.2vw, 2.4rem);
    text-transform: uppercase;
    line-height: 1;
  }
  .card {
    background: var(--yellow);
    border: 0.6rem solid var(--black);
    border-radius: 0.5rem;
    padding: clamp(1.5rem, 4vw, 3rem) clamp(2rem, 6vw, 5rem);
    box-shadow: 0.6rem 0.6rem 0 0 var(--black);
    min-width: min(80vw, 28rem);
  }
  .number {
    font-weight: 900;
    font-size: clamp(7rem, 22vw, 16rem);
    line-height: 0.9;
    letter-spacing: -0.04em;
    font-variant-numeric: tabular-nums;
    margin: 0;
  }
  .caption {
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: clamp(1.4rem, 3.6vw, 2.6rem);
    line-height: 1.1;
    max-width: 24ch;
    margin: 0 auto;
  }
  .meta {
    display: grid;
    gap: 0.6rem;
    font-size: clamp(0.95rem, 1.6vw, 1.1rem);
    line-height: 1.45;
    border-top: 3px solid var(--black);
    padding-top: 1.5rem;
    width: min(40rem, 90vw);
  }
  .meta dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.25rem 1rem; margin: 0; text-align: left; }
  .meta dt { font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.85em; }
  .meta dd { margin: 0; }
  .meta a { color: var(--black); text-underline-offset: 3px; }
  footer {
    text-align: center;
    padding: 1.5rem 1rem 2rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.85rem;
  }
  footer .small { display: block; font-weight: 500; letter-spacing: 0.04em; opacity: 0.75; margin-top: 0.4rem; text-transform: none; }
  @media (prefers-reduced-motion: no-preference) {
    .card { transition: transform 200ms ease; }
    .card:hover { transform: translate(-0.15rem, -0.15rem); }
  }
</style>
</head>
<body>
  <div class="stripe" aria-hidden="true"></div>
  <main>
    <p class="banner">This facility has gone</p>
    <div class="card">
      <p class="number">${daysSince}</p>
    </div>
    <h1 class="caption">${dayWord} without a Claude incident</h1>
    <section class="meta" aria-label="Details">
      <dl>
        <dt>Longest streak</dt><dd>${longestStreakDays} ${longestWord}</dd>
        <dt>Last incident</dt><dd><a href="${incidentLink}" rel="noopener noreferrer">${incidentTitle}</a> &middot; ${incidentDate}</dd>
      </dl>
    </section>
  </main>
  <footer>
    Not affiliated with Anthropic
    <span class="small">Generated ${generated} from <a href="https://status.claude.com/history.rss">status.claude.com</a></span>
  </footer>
  <div class="stripe" aria-hidden="true"></div>
</body>
</html>
`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatUtcDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function formatUtcDateTime(d: Date): string {
  return `${formatUtcDate(d)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}
