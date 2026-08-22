# E and B

React/Vite frontend with a Node.js + Express API and Hostinger MySQL target.

## Local development

```bash
npm install
npm run dev
```

Run the API separately with `npm start`. The Vite development server proxies `/api` requests to port 3000.

Database setup is intentionally manual and offline from the server startup path. After configuring server-only variables, use `npm run db:migrate` against an approved non-production database.
