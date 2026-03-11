# TB & Vercel Comparison Logger

Standalone service that compares device status, HR, and BR between ThingsBoard (TB) and Vercel (Sleepiz Monitor), stores results in Firebase Firestore, and provides a small dashboard.

## Architecture

```
TB Rule Chain → POST /compare → Logger API → Fetch Vercel state → Compare → Firestore
                                                      ↑
                                              GET /devices/latest
```

## Prerequisites

- Node.js 18+
- Firebase project with Firestore
- Vercel backend running (for Monitor state)

## Setup

### 1. Firebase

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. **Create a Firestore database** (Firestore Database → Create database) — choose a region (e.g. `us-central1`). The `5 NOT_FOUND` error means the database does not exist yet.
3. Create a service account (Project Settings → Service Accounts → Generate new private key)
4. For the dashboard, add a web app and copy the config (apiKey, authDomain, etc.)

### 2. API Server

```bash
cd comparison-logger
cp .env.example .env
# Edit .env with your values
npm install
npm run build
npm start
```

**Env vars:**

| Var | Description |
|-----|-------------|
| `PORT` | API port (default 3011) |
| `VERCEL_URL` | Vercel backend URL (e.g. `https://xxx.vercel.app`) |
| `VERCEL_AUTH_USER` | Basic auth user (required if Vercel has `DASHBOARD_BASIC_USER` set) |
| `VERCEL_AUTH_PASSWORD` | Basic auth password (same as `DASHBOARD_BASIC_PASSWORD` on Vercel) |
| `LOG_MODE` | `mismatch` = only mismatches; `all` = all comparisons |
| `LOG_PAYLOAD` | `true` = include rawData in Firestore |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Service account email |
| `FIREBASE_PRIVATE_KEY` | Service account private key (escape newlines as `\n`) |

### 3. Dashboard

```bash
cd comparison-logger/dashboard
cp .env.example .env.local
# Add VITE_FIREBASE_* from your Firebase web app config
npm install
npm run dev
```

Open http://localhost:5174

### 4. ThingsBoard Rule Chain

1. Set `COMPARISON_LOGGER_URL` when generating the rule chain:
   ```bash
   COMPARISON_LOGGER_URL=https://your-logger.vercel.app node generate_rulechain.js
   ```
2. Import `sleepiz_rulechain_1_2_3_new.json` into ThingsBoard
3. The rule chain includes "Build Compare Payload" and "POST to Comparison Logger" nodes after Save Device State

## Deploy

### API (e.g. Render, Railway, Vercel serverless)

- Deploy the `comparison-logger` folder as a Node app
- Set env vars in the platform
- Ensure the deployed URL is reachable from TB (and from your network if TB is on-prem)

### Dashboard (e.g. Vercel, Netlify)

```bash
cd dashboard
npm run build
# Deploy the dist/ folder
```

Set `VITE_FIREBASE_*` in the build env.

### Firestore Security

- Server: uses Admin SDK (service account) — no client rules needed for write
- Dashboard: the web app reads from Firestore. If you see no logs despite data in Firebase, **check Firestore rules**. Add:

  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /comparison_logs/{doc} {
        allow read: if true;   // or restrict: if request.auth != null
        allow write: if false;
      }
    }
  }
  ```

  (Firebase Console → Firestore Database → Rules)

## Firestore Collection

**comparison_logs**

| Field | Type |
|-------|------|
| timestamp | string (ISO) |
| deviceId | string |
| tbState | string \| null |
| monitorState | string \| null |
| tbHr | number \| null |
| monitorHr | number \| null |
| tbBr | number \| null |
| monitorBr | number \| null |
| result | "OK" \| "State Mismatch" \| "HR Mismatch" \| "BR Mismatch" |
| effectiveTsMs | number |
| payload | object (optional) |
| topic | string |
| createdAt | timestamp (server) |

## Dashboard

- **All logs** — Full table with Time, Device, TB State, Monitor State, HR, BR, Result
- **Errors** — Filtered to mismatches only
- **Counts** — Header shows "X OK | Y Mismatch"
- **Payload** — Expandable for mismatches when `LOG_PAYLOAD=true`
