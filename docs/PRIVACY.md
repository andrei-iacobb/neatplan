# Privacy & session retention

NeatPlan stores the following operational data:

## Session tracking

When users sign in, the app records:

- Session token (random, not the JWT)
- Login time and last activity
- Optional IP address and User-Agent (when provided by middleware)

## Retention

Stale sessions are deleted automatically by the cron job (`/api/cron/check-schedules`) after **90 days** by default. Configure with `SESSION_RETENTION_DAYS` in `.env`.

## Logs

Production logs redact email addresses and API keys. Avoid logging document contents or AI responses in production.

## User settings

Notification and privacy preferences are stored in the `users.settings` JSON column and can be exported or deleted with the user account.
