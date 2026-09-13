# Privacy & session retention

NeatPlan stores the following operational data:

## Session tracking

When users sign in, the app records:

- Session token (random, not the JWT)
- Login time and last activity
- Optional IP address and User-Agent (when provided by middleware)

## Retention

Stale sessions are deleted automatically by the cron job (`/api/cron/check-schedules`) after **90 days** by default. Configure with `SESSION_RETENTION_DAYS` in `.env`.

## Completion photos

Cleaners can attach up to three optional photos to their own sign-off during the
first 24 hours. Photos should show cleaned surfaces or equipment, never residents,
staff, care records or other identifying details. A photo is supporting evidence;
the app does not automatically certify that the work was done correctly.

Uploads are re-encoded as WebP with location and device metadata removed. Files
live on the private data volume, and every image request checks the recorded
site. A room or equipment transfer does not move old evidence into the new site's
access scope. Images are not included in CSV exports or public static assets.

The evidence records the uploader and upload time separately from the sign-off.
It is retained with the completion record, with no automatic expiry or cleaner
overwrite/delete function. Apply the organisation's approved completion-record
retention process to both database records and their image files, including backups.

## Logs

Production logs redact email addresses and API keys. Avoid logging document contents or AI responses in production.

## User settings

Notification and privacy preferences are stored in the `users.settings` JSON column and can be exported or deleted with the user account.
