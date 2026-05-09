import type { Incident } from "./types.js";

export interface RenderArgs {
  daysSince: number;
  longestStreakDays: number;
  latestIncidents: Incident[];
  generatedAt: Date;
}

export function renderHtml({ daysSince, longestStreakDays, latestIncidents, generatedAt }: RenderArgs): string {
  if (latestIncidents.length === 0) throw new Error("renderHtml requires at least one incident");
  const dayWord = daysSince === 1 ? "Day" : "Days";
  const longestWord = longestStreakDays === 1 ? "day" : "days";
  const incidentNoun = latestIncidents.length === 1 ? "Last incident" : "Last incidents";
  const incidentLabel = `${incidentNoun} (${formatUtcDate(latestIncidents[0]!.pubDate)})`;
  const incidentItems = latestIncidents
    .map(
      (i) =>
        `<li><a href="${escapeHtml(i.link)}" rel="noopener noreferrer">${escapeHtml(i.title)}</a></li>`,
    )
    .join("");
  const generated = formatUtcDateTime(generatedAt);
  const cards = String(daysSince)
    .split("")
    .map((d) => `<div class="card">${d}</div>`)
    .join("");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="index,follow">
<title>${daysSince} ${dayWord.toLowerCase()} without a Claude incident</title>
<meta name="description" content="An unofficial 'days without an incident' counter for the Anthropic Claude status page.">
<style>
  :root {
    --plaque: #FFC400;
    --frame: #0A0A0A;
    --card: #141312;
    --digit: #f4ecd0;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    min-height: 100vh;
    background: radial-gradient(ellipse at 50% 30%, #3a322a 0%, #14110d 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 5vh 4vw;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: var(--frame);
    -webkit-font-smoothing: antialiased;
  }
  .plaque {
    position: relative;
    width: min(560px, 100%);
    background: var(--plaque);
    border: 0.7rem solid var(--frame);
    border-radius: 0.4rem;
    box-shadow: 0 1.6rem 2.5rem rgba(0,0,0,0.65), inset 0 0 0 0.18rem #c79900;
  }
  .screw {
    position: absolute;
    width: 0.95rem;
    height: 0.95rem;
    border-radius: 50%;
    background: radial-gradient(circle at 32% 30%, #6a5e52 0%, #19140e 70%);
    box-shadow: inset 0 -1px 1px rgba(0,0,0,0.7);
  }
  .screw.tl { top: -1.55rem; left: -1.55rem; }
  .screw.tr { top: -1.55rem; right: -1.55rem; }
  .screw.bl { bottom: -1.55rem; left: -1.55rem; }
  .screw.br { bottom: -1.55rem; right: -1.55rem; }
  .title-bar {
    background: var(--frame);
    color: var(--plaque);
    text-align: center;
    padding: 0.9rem 1rem;
    font-weight: 800;
    letter-spacing: 0.01em;
    font-size: clamp(0.95rem, 2.6vw, 1.15rem);
    border-bottom: 0.18rem solid #5e4800;
  }
  .body { padding: 1.6rem 1.6rem 1.4rem; }
  .cards {
    display: flex;
    justify-content: center;
    gap: 0.7rem;
    margin: 0.4rem 0 1.4rem;
  }
  .card {
    position: relative;
    background: var(--card);
    color: var(--digit);
    font-weight: 900;
    font-variant-numeric: tabular-nums;
    font-size: clamp(5rem, 20vw, 9rem);
    line-height: 1;
    width: clamp(4.5rem, 16vw, 7rem);
    height: clamp(6.5rem, 22vw, 10rem);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.45rem;
    box-shadow: 0 0.45rem 0 0 #000, inset 0 0.1rem 0 rgba(255,255,255,0.05);
  }
  .card::after {
    content: "";
    position: absolute;
    left: 0.3rem;
    right: 0.3rem;
    top: 50%;
    height: 2px;
    background: #000;
    box-shadow: 0 1px 0 rgba(255,255,255,0.04);
    transform: translateY(-1px);
  }
  .caption {
    margin: 0 0 1.2rem;
    text-align: center;
    font-weight: 800;
    letter-spacing: -0.005em;
    font-size: clamp(1.2rem, 3.2vw, 1.6rem);
    line-height: 1.2;
  }
  .meta {
    border-top: 0.2rem solid var(--frame);
    padding-top: 1rem;
    font-size: clamp(0.85rem, 1.8vw, 0.95rem);
    line-height: 1.5;
  }
  .meta dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.3rem 0.9rem;
    margin: 0;
  }
  .meta dt {
    font-weight: 700;
    font-size: 0.95em;
    align-self: center;
    color: #2a2520;
  }
  .meta dd { margin: 0; }
  .meta a { color: var(--frame); text-underline-offset: 3px; }
  .incident-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.25rem; }
  .footer {
    text-align: center;
    margin-top: 1.2rem;
    font-size: 0.78rem;
    font-weight: 500;
    opacity: 0.72;
  }
  .footer a { color: var(--frame); }
</style>
</head>
<body>
  <div class="plaque">
    <span class="screw tl" aria-hidden="true"></span>
    <span class="screw tr" aria-hidden="true"></span>
    <span class="screw bl" aria-hidden="true"></span>
    <span class="screw br" aria-hidden="true"></span>
    <div class="title-bar">Days Since Last Claude Incident</div>
    <div class="body">
      <div class="cards" aria-label="${daysSince} ${dayWord.toLowerCase()}">${cards}</div>
      <h1 class="caption">${dayWord} without a Claude incident</h1>
      <div class="meta">
        <dl>
          <dt>Longest streak</dt><dd>${longestStreakDays} ${longestWord}</dd>
          <dt>${incidentLabel}</dt><dd><ul class="incident-list">${incidentItems}</ul></dd>
        </dl>
        <div class="footer">Generated ${generated} &middot; Not affiliated with Anthropic &middot; <a href="https://status.claude.com/history.rss">status.claude.com</a></div>
      </div>
    </div>
  </div>
</body>
</html>
`;

  return minifyHtml(html);
}

function minifyHtml(html: string): string {
  return html
    .replace(/<style>([\s\S]*?)<\/style>/g, (_, css) => `<style>${minifyCss(css)}</style>`)
    .replace(/>\s+</g, "><")
    .trim();
}

function minifyCss(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{};:,])\s*/g, "$1")
    .replace(/;}/g, "}")
    .trim();
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
