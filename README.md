# dayswithoutclaudeincident

A static page that displays how many days have passed since the last incident on the Anthropic Claude status page, plus the longest streak ever observed.

## Architecture

A single Cloudflare Worker serves the site and keeps its state up to date:

- **`fetch` handler** — handles public traffic. Reads the latest incident record and longest-streak record from KV, computes the day count against the current time, fetches `public/index.html` from the Workers Static Assets binding, and uses `HTMLRewriter` to inject the live values (digit cards, captions, meta/OG tags, last-incident list) before responding. The response is edge-cacheable; the `s-maxage` is set so the cache expires at the next UTC midnight, when the day count would change.
- **`scheduled` handler** — fires hourly. Fetches the Claude status RSS feed at https://status.claude.com/history.rss, detects whether a new incident has appeared, and writes an updated state object to KV. It does **not** render or store HTML — the day count is recomputed live on each cache miss.

Static assets (`public/index.html` plus its inline CSS) are served from Cloudflare's edge cache for free on cache hits; the Worker only runs when the cache is cold or expired. The day-count, longest-streak, and last-incident regions are all marked with `data-dwci="…"` attributes that the fetch handler's HTMLRewriter targets.

The page shows:
- the headline figure of how many days since the last recorded incident
- the longest streak observed (the larger of the current active streak vs. the longest ended streak in history), including its date range
- the title, link, and date of the last recorded incident (or all incidents from that day, if multiple were reported)

## Setup

This project requires one Cloudflare resource to be created before the first deploy:

```bash
npx wrangler kv namespace create SITE_KV
```

Paste the returned namespace `id` into `wrangler.toml` in place of `REPLACE_WITH_KV_NAMESPACE_ID`.

Once the apex domain is on Cloudflare DNS, uncomment the `[[routes]]` block in `wrangler.toml` to attach the Worker to `dayswithoutaclaudeincident.com` via Workers Custom Domain (Cloudflare manages the cert and DNS automatically). Add a redirect rule for the `www` subdomain in the Cloudflare dashboard.

## Development

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run dev      # wrangler dev --test-scheduled, so the hourly cron is reachable locally
```

The CI workflow (`.github/workflows/deploy.yml`) runs typecheck, lint, and tests on every push to `main`, then deploys via `wrangler deploy` using the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets.

## Disclaimer

NOT AFFILIATED WITH ANTHROPIC.
