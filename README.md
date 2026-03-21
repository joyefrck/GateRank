<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/8c347b28-e6ce-4f3e-ae2b-1a177a00cfc5

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Backend (MVP Scoring System)

### 1. Setup

1. Install deps: `npm install`
2. Create backend env: `cp backend/.env.example .env`
3. Apply MySQL schema from [backend/sql/schema.sql](backend/sql/schema.sql)

### 2. Run backend

- Dev mode: `npm run server:dev`
- One-shot start: `npm run server:start`

### 3. API overview

- Public:
  - `GET /api/v1/rankings?type=today|stable|value|new|risk&date=YYYY-MM-DD`
  - `GET /api/v1/airports/:id/score-trend?days=30`
  - `GET /api/v1/airports/:id/report?date=YYYY-MM-DD`
- Admin (require `x-api-key`):
  - `POST /api/v1/admin/airports`
  - `PATCH /api/v1/admin/airports/:id`
  - `POST /api/v1/admin/metrics/daily`
  - `POST /api/v1/admin/scores/recompute?date=YYYY-MM-DD`
  - `POST /api/v1/admin/complaints`
  - `POST /api/v1/admin/incidents`

### 4. Checks

- Typecheck backend: `npm run server:typecheck`
- Run backend tests: `npm run test:backend`
