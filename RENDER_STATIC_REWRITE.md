## Render Static Rewrite

Configure this rule in Render Static Site settings:

- **Source:** `/*`
- **Destination:** `/index.html`
- **Action:** `Rewrite`

This is required for React Router direct links to avoid `404` on refresh.
