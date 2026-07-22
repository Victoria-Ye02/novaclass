# NovaClass Backend

Express + MySQL API for the NovaClass classroom app, including the PDF Smart
Highlighting feature (OCR-assisted material analysis via Google Cloud Vision
and Groq).

## Prerequisites

- Node.js (LTS) and npm
- A running MySQL server
- A Groq API key (for AI text features)
- A Google Cloud project with the Vision API enabled (for OCR on scanned/
  image-based PDFs)

## 1. Install dependencies

```bash
cd nova-class-backend
npm install
```

## 2. Configure environment variables

Copy the example file and fill in your own values. **Never commit `.env`** —
it is already covered by the root `.gitignore`.

```bash
cp .env.example .env
```

`.env.example` contains:

```dotenv
GROQ_API_KEY=
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/google-vision-service-account.json
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=
DB_NAME=nova_class
PORT=5001
```

| Variable | Purpose |
| --- | --- |
| `GROQ_API_KEY` | Used by `services/ai/groqText.js` for AI-generated explanations/summaries. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Absolute path to a Google Cloud service account JSON key file, used by `@google-cloud/vision` (see `services/ai/googleVision.js`) to OCR scanned/image-based PDF pages for highlight extraction. |
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection settings used by `mysql2` and `scripts/setup_db.js`. |
| `PORT` | Port the Express server listens on (defaults to `5001` if unset). |

### Enabling Google Cloud Vision (for OCR on scanned PDFs)

The highlight extraction pipeline falls back to Google Cloud Vision's
Document Text Detection when a PDF page has no extractable text layer (i.e.
it's a scanned image). To enable it:

1. In the [Google Cloud Console](https://console.cloud.google.com/), create
   or select a project.
2. Enable the **Cloud Vision API** for that project (APIs & Services →
   Library → search "Cloud Vision API" → Enable).
3. Create a **least-privilege service account** dedicated to this feature:
   - IAM & Admin → Service Accounts → Create Service Account.
   - Grant it only the `Cloud Vision AI User` (or equivalent minimal Vision)
     role — avoid broad roles like `Editor` or `Owner`.
   - Do not grant it access to other project resources it doesn't need.
4. Create a JSON key for that service account (Service Accounts → your
   account → Keys → Add Key → Create new key → JSON) and download it.
5. Store the downloaded key file **outside the Git repository** (e.g. in a
   local secrets directory, or wherever your deployment's secret storage
   places it) — never inside `nova-class-backend/` where it could be
   committed.
6. Set `GOOGLE_APPLICATION_CREDENTIALS` in your `.env` to the **absolute
   path** of that key file, for example:

   ```dotenv
   GOOGLE_APPLICATION_CREDENTIALS=/Users/you/secrets/nova-class-vision-sa.json
   ```

If this variable is unset or points to an invalid file, requests that need
OCR fallback will fail when the Vision client is invoked; text extracted
directly from a PDF's text layer does not require Vision at all.

## 3. Set up the database

With MySQL running and `DB_HOST`/`DB_USER`/`DB_PASSWORD`/`DB_NAME` configured
in `.env`, create the required tables:

```bash
node scripts/setup_db.js
```

This creates (if they don't already exist) the `users`, `classes`,
`class_members`, `materials`, and related tables the API depends on.

## 4. Run the backend

From the `nova-class-backend/` directory:

```bash
npm run dev
```

This starts the server with `nodemon server.js`, listening on `PORT` (default
`5001`).

## 5. Run the frontend

The frontend lives in its own directory and must be installed and started
separately, from `nova-class-frontend/`:

```bash
cd ../nova-class-frontend
npm install
npm run dev
```

This starts the Vite dev server. See `nova-class-frontend/package.json` for
other available scripts (`npm run build`, `npm run lint`, `npm test`, etc.).

## Running tests

```bash
cd nova-class-backend
npm test
```

This runs the backend's Node test suite (`node --test test/**/*.test.js`).
