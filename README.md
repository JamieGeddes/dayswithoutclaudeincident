# dayswithoutclaudeincident

A simple static webpage that displays information about Anthropic Claude status.

## Architecture

A static site generated and served from Cloudflare. A Cloudflare Worker (`src/worker.ts`) runs on an hourly cron trigger, fetches the Claude status RSS feed at https://status.claude.com/history.rss, and identifies when the last incident occurred (along with basic summary information). Streak state is persisted in an R2 bucket so the longest-streak figure survives across runs.

On each run the Worker renders a static HTML page and writes it (and the updated state JSON) back to the same R2 bucket, which serves the public site. The page shows:
- the headline figure of how many days since the last recorded incident
- the longest streak (days without an incident), including its date range

## Disclaimer

NOT AFFILIATED WITH ANTHROPIC.
