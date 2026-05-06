# dayswithoutclaudeincident

A simple static webpage that displays information about Anthropic Claude status.

## Deployment

A static S3 hosted website. Content is generated on a regular basis by an EventBridge scheduled AWS Lambda function that scrapes the Claude status RSS feed at https://status.claude.com/history.rss and identifies when the last incident occurred (along with basic summary information of the incident). Store basic summary information in S3 to track how long the streak without an incident is.

The Lambda function generates the static HTML page showing:
- the headline figure of how many days since the last recorded incident
- the longest streak (days without an incident)

## Disclaimer

NOT AFFILIATED WITH ANTHROPIC.