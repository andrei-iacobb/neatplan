#!/bin/sh
set -eu

# Load platform-mounted secrets without placing their values in the image or command
# line. Direct environment variables remain supported for local Compose deployments.
load_secret() {
  variable="$1"
  eval "value=\${${variable}:-}"
  eval "secret_file=\${${variable}_FILE:-}"

  if [ -n "$value" ] && [ -n "$secret_file" ]; then
    echo "$variable and ${variable}_FILE cannot both be set" >&2
    exit 1
  fi

  if [ -n "$secret_file" ]; then
    if [ ! -r "$secret_file" ]; then
      echo "${variable}_FILE is not readable" >&2
      exit 1
    fi
    value="$(cat "$secret_file")"
    export "$variable=$value"
  fi
}

for variable in DATABASE_URL NEXTAUTH_SECRET CRON_SECRET OPENAI_API_KEY SMTP_PASS; do
  load_secret "$variable"
done

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL or DATABASE_URL_FILE must be set" >&2
  exit 1
fi

if [ "${NEATPLAN_APP_SERVER:-0}" = "1" ]; then
  if [ -z "${NEXTAUTH_URL:-}" ]; then
    echo "NEXTAUTH_URL must be set for the application server" >&2
    exit 1
  fi
  if [ -z "${NEXTAUTH_SECRET:-}" ]; then
    echo "NEXTAUTH_SECRET or NEXTAUTH_SECRET_FILE must be set" >&2
    exit 1
  fi
fi

exec "$@"
