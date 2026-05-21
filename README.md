# Draft Loadable Calculator / Vercel + Neon

This version separates calculation data from `index.html` and loads vessel / scenario / Draft-DWT data from Neon PostgreSQL through Vercel API routes.

## Files

```text
public/index.html          Frontend UI
api/bootstrap.js           Loads vessels, scenarios, series defaults, DWT points, draft caps
api/calculate.js           Optional server-side calculation endpoint
api/health.js              DATABASE_URL / Neon connection test
db/schema.sql              Neon table schema
db/seed.sql                Initial seed data migrated from deploy v19
.env.example               Local environment variable template
```

## Neon setup

1. Create a Neon project.
2. Open the Neon SQL Editor.
3. Run `db/schema.sql`.
4. Run `db/seed.sql`.
5. Copy the connection string.

## Local setup

```bash
npm install
cp .env.example .env.local
# paste your Neon connection string into .env.local
npm run dev
```

Open:

```text
http://localhost:3000
```

Test API:

```text
http://localhost:3000/api/health
http://localhost:3000/api/bootstrap
```

## Vercel deployment

1. Import the GitHub repository in Vercel.
2. Add Environment Variable:
   - Name: `DATABASE_URL`
   - Value: Neon connection string
3. Deploy.

## Data update rule

- Update screen/layout/calculation logic in VSCode → GitHub → Vercel.
- Update vessel / scenario / Draft-DWT data in Neon DB.
