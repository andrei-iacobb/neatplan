## Production notes

- Do not bind the app to 0.0.0.0 directly in production. Prefer a reverse proxy (IIS/ARR, Nginx, Traefik).
- Store database credentials in environment variables or secret stores (Windows Credential Manager, Azure Key Vault, etc.).
- For Docker, use Docker secrets for the Postgres password and avoid hardcoding credentials.


