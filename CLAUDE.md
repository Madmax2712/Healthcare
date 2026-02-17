# CLAUDE.md — HealthGuard Platform

AI assistant guide for the **HealthGuard** AI-Enhanced Emergency Healthcare Platform.

---

## Project Overview

HealthGuard is a HIPAA-aware emergency healthcare platform consisting of three applications:

| App | Technology | Purpose |
|-----|-----------|---------|
| `backend/` | Node.js 20 + Express 4 + TypeScript | REST API + WebSocket server |
| `portal/` | Next.js 14 + Tailwind CSS | Hospital admin web portal |
| `mobile/` | React Native 0.73 | Patient mobile app (iOS + Android) |
| `shared/` | TypeScript | Shared types, constants, utilities |

The platform ingests wearable health metrics, detects anomalies, triggers emergency alerts, notifies contacts, and provides AI-driven guidance via the Anthropic Claude API.

---

## Repository Structure

```
Healthcare/                        # Monorepo root
├── package.json                   # npm workspaces config + root scripts
├── backend/                       # Express API server
│   ├── src/
│   │   ├── config/
│   │   │   ├── index.ts           # All config (env vars, validated at startup)
│   │   │   └── database.ts        # Knex config (dev/prod/test environments)
│   │   ├── middleware/
│   │   │   ├── auth.ts            # JWT auth middleware + role guards
│   │   │   ├── audit.ts           # HIPAA audit logging middleware
│   │   │   └── validation.ts      # Generic + pre-built request validators
│   │   ├── services/
│   │   │   ├── aiService.ts       # Anthropic Claude API integration
│   │   │   ├── healthMonitorService.ts  # Metric ingestion + anomaly detection
│   │   │   ├── notificationService.ts  # Twilio SMS + FCM/APNS push
│   │   │   ├── authService.ts     # OTP auth + JWT generation
│   │   │   ├── hospitalService.ts # Hospital + specialist management
│   │   │   └── visitService.ts    # Visit tracking + feedback
│   │   └── utils/
│   │       └── logger.ts          # Winston logger (error/combined/audit logs)
│   ├── migrations/                # SQL migration files (Knex)
│   ├── seeds/                     # DB seed files
│   ├── .env.example               # Reference for all required env vars
│   └── tsconfig.json
├── portal/                        # Next.js hospital admin portal
│   └── src/
│       ├── types/index.ts         # Re-exports shared types + portal-specific types
│       ├── lib/api.ts             # Axios client + auth interceptors + API functions
│       ├── services/socketService.ts  # Socket.io client (real-time updates)
│       ├── hooks/                 # React hooks (useAuth, useSocket, useSpecialists)
│       └── components/
│           ├── layout/            # Header, Sidebar, PortalLayout
│           ├── ui/                # Modal, DataTable, StatsCard, StatusBadge
│           └── dashboard/         # OverviewCards, SpecialistStatusList, RecentFeedback
├── mobile/                        # React Native patient app
│   └── src/
│       ├── api/
│       │   ├── client.ts          # Axios client with token refresh logic
│       │   └── endpoints.ts       # All API endpoint functions (typed)
│       ├── store/                 # Zustand stores
│       │   ├── authStore.ts       # Auth state + OTP flow
│       │   ├── healthStore.ts     # Health metrics state
│       │   ├── hospitalStore.ts   # Hospital/specialist state
│       │   └── emergencyStore.ts  # Emergency alert state
│       ├── services/
│       │   ├── socketService.ts   # Socket.io singleton (real-time)
│       │   ├── emergencyService.ts
│       │   ├── locationService.ts
│       │   └── wearableService.ts
│       └── components/common/     # Button, Card, Header, LoadingSpinner, StarRating
├── shared/                        # Shared across all workspaces
│   ├── types/index.ts             # All TypeScript interfaces and type aliases
│   ├── constants/index.ts         # Health thresholds, WS events, API paths, specialties
│   └── utils/index.ts
└── infrastructure/
    ├── docker/
    │   ├── docker-compose.yml     # Local dev stack (postgres, redis, rabbitmq, backend, portal)
    │   ├── Dockerfile.backend
    │   └── Dockerfile.portal
    ├── k8s/                       # Kubernetes manifests (namespace, deployments, ingress)
    └── terraform/main.tf          # AWS infrastructure (EKS, RDS Multi-AZ, ElastiCache)
```

---

## Development Commands

All commands run from the **monorepo root** unless noted.

### Setup

```bash
# Install all workspace dependencies
npm install

# Copy and populate backend env file
cp backend/.env.example backend/.env

# Start local infrastructure (postgres, redis, rabbitmq)
docker compose -f infrastructure/docker/docker-compose.yml up -d postgres redis rabbitmq

# Run DB migrations and seeds
npm run db:migrate
npm run db:seed
```

### Running Applications

```bash
# Backend API (port 3000, hot-reload with nodemon + ts-node)
npm run backend:dev

# Hospital Portal (port 3001, Next.js dev server)
npm run portal:dev

# Mobile – Metro bundler
npm run mobile:start

# Mobile – iOS simulator
npm run mobile:ios

# Mobile – Android emulator
npm run mobile:android
```

### Building

```bash
npm run backend:build   # tsc → dist/
npm run portal:build    # next build
```

### Testing & Linting

```bash
npm run test            # jest (all workspaces)
npm run lint            # tsc --noEmit (backend/shared), next lint (portal), eslint (mobile)
```

### Database

```bash
npm run db:migrate          # Apply pending migrations (knex migrate:latest)
npm run db:seed             # Run seed files

# From backend/ workspace directly:
npm run migrate:rollback    # Roll back last migration batch
```

---

## Environment Variables

Reference file: `backend/.env.example`

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `development` / `production` / `test` |
| `PORT` | No | API server port (default: `3000`) |
| `DB_HOST` | Yes | PostgreSQL host |
| `DB_NAME` | Yes | Database name (default: `healthguard`) |
| `DB_USER` | Yes | Database user |
| `DB_PASSWORD` | Yes | Database password |
| `DB_SSL` | No | Enable SSL for DB connection (`true`/`false`) |
| `JWT_SECRET` | Yes | JWT signing secret (min 32 chars) |
| `JWT_EXPIRES_IN` | No | Access token TTL (default: `24h`) |
| `JWT_REFRESH_SECRET` | Yes | Refresh token signing secret |
| `JWT_REFRESH_EXPIRES_IN` | No | Refresh token TTL (default: `7d`) |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude |
| `ANTHROPIC_MODEL` | No | Model ID (default: `claude-sonnet-4-20250514`) |
| `TWILIO_ACCOUNT_SID` | For SMS | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | For SMS | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | For SMS | Outbound phone number |
| `FCM_SERVER_KEY` | For push | Firebase Cloud Messaging server key |
| `FCM_PROJECT_ID` | For push | Firebase project ID |
| `APNS_KEY_ID` | For iOS push | Apple Push Notification Service key ID |
| `APNS_TEAM_ID` | For iOS push | Apple developer team ID |
| `CORS_ORIGIN` | No | Allowed CORS origin (default: `http://localhost:3001`) |
| `AUDIT_LOG_ENABLED` | No | Enable HIPAA audit logging (default: `true`) |

**Portal env vars** (Next.js `NEXT_PUBLIC_` prefix required for client-side access):
- `NEXT_PUBLIC_API_URL` — Backend API base URL (default: `http://localhost:3000/api/v1`)
- `NEXT_PUBLIC_WS_URL` — WebSocket server URL (default: `ws://localhost:3000`)

---

## Authentication & Authorization

### Mobile (Patient App)

Phone-number OTP flow via Twilio SMS:
1. `POST /api/v1/auth/otp/request` → returns `session_id`
2. `POST /api/v1/auth/otp/verify` → returns `access_token` + `refresh_token` + `user`

Tokens stored in React Native `AsyncStorage` under `@healthguard_auth_token`.

### Portal (Hospital Admin)

Email + password:
- `POST /api/v1/auth/hospital/login` → returns `access_token` + `refresh_token` + `admin`

Tokens stored in `localStorage` under `hg_access_token` / `hg_refresh_token`.

### Middleware Stack (backend)

```typescript
authenticate          // Verify Bearer JWT; sets req.user
requireAdmin          // Require req.user.type === 'admin'
requireRole(...roles) // Require specific AdminRole ('super_admin' | 'admin' | 'staff')
requireOwnerOrAdmin() // Allow if admin OR resource owner (matched by req.params.userId)
optionalAuth          // Attach user if token present; do not reject
auditLog              // HIPAA audit log (after authenticate)
requireAuditReason    // Require X-Audit-Reason header (≥ 5 chars) for sensitive ops
```

Role hierarchy: `super_admin > admin > staff`

---

## API Conventions

### Base Path

All routes: `/api/v1/`

### Response Envelope

Every response uses `ApiResponse<T>` (defined in `shared/types/index.ts`):

```typescript
{
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: { page, limit, total, total_pages };
}
```

### HTTP Status Codes

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Validation error (returns `details: string[]`) |
| 401 | Missing or invalid/expired JWT |
| 403 | Insufficient role/ownership |
| 404 | Resource not found |
| 500 | Internal server error |

### Key Endpoint Groups

| Prefix | Description |
|--------|-------------|
| `/auth/otp/*` | Mobile OTP authentication |
| `/auth/hospital/login` | Portal admin login |
| `/auth/refresh` | Token refresh |
| `/health/metrics` | Wearable health metric submission + retrieval |
| `/hospitals/search` | Geo-search hospitals by lat/lng |
| `/hospitals/:id/specialists` | Specialist management (CRUD, status updates) |
| `/visits` | Patient visit tracking |
| `/visits/:id/feedback` | Post-visit ratings |
| `/emergency/alerts` | Emergency alert lifecycle |
| `/ai/conversations` | Start/continue Claude AI conversations |
| `/devices` | Wearable device registration |
| `/contacts` | Emergency contact management |

---

## Database

- **Engine**: PostgreSQL 16
- **ORM/Query Builder**: Knex 3
- **Migrations**: SQL files in `backend/migrations/` — run with `knex migrate:latest`
- **Seeds**: `backend/seeds/` — run with `knex seed:run`
- **Connection Pool**: min 2 / max 10 (dev), min 5 / max 20 (prod)

All primary keys are UUIDs (generated with `uuid` package, `uuidv4()`).

### Core Tables

| Table | Description |
|-------|-------------|
| `users` | Patient accounts |
| `emergency_contacts` | Per-user emergency contacts |
| `wearable_devices` | Registered wearable devices |
| `health_metrics` | Time-series health readings from wearables |
| `emergency_alerts` | Detected anomaly alerts |
| `hospitals` | Hospital registry with geo-coordinates |
| `specialties` | Medical specialty types |
| `hospital_specialists` | Doctors per hospital |
| `specialist_schedules` | Doctor weekly schedules |
| `user_visits` | Patient visits |
| `visit_feedback` | Post-visit ratings |
| `hospital_admins` | Portal admin accounts |
| `ai_conversations` | Claude conversation sessions |
| `ai_messages` | Individual messages per conversation |
| `audit_logs` | HIPAA audit trail |

---

## Shared Package

`shared/` is published as `@healthguard/shared` and consumed by backend, portal, and mobile.

### Types (`shared/types/index.ts`)

Key type aliases:

```typescript
type MetricType = 'heart_rate' | 'blood_pressure' | 'spo2' | 'temperature' | 'steps'
type AlertType = 'low_heart_rate' | 'high_heart_rate' | 'fall_detected' | 'irregular_rhythm' | 'low_spo2'
type AlertSeverity = 'critical' | 'high' | 'medium' | 'low'
type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'false_alarm'
type ConversationType = 'emergency_guidance' | 'triage' | 'general_health'
type AdminRole = 'super_admin' | 'admin' | 'staff'
type AvailabilityStatus = 'available' | 'busy' | 'off_duty'
type VisitType = 'emergency' | 'scheduled' | 'walk_in'
type VisitStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'
```

### Constants (`shared/constants/index.ts`)

```typescript
HEART_RATE_THRESHOLDS = { CRITICAL_LOW: 40, LOW: 50, NORMAL_LOW: 60, NORMAL_HIGH: 100, HIGH: 120, CRITICAL_HIGH: 150 }
SPO2_THRESHOLDS = { CRITICAL_LOW: 90, LOW: 94, NORMAL: 95 }
DATA_RETENTION_DAYS = 2555           // ~7 years per HIPAA
DEFAULT_SEARCH_RADIUS_MILES = 25
API_VERSION = 'v1'
API_BASE_PATH = '/api/v1'
```

### WebSocket Events

```typescript
// Client → Server
WS_EVENTS.JOIN_HOSPITAL_ROOM       // 'join:hospital'
WS_EVENTS.LEAVE_HOSPITAL_ROOM      // 'leave:hospital'
WS_EVENTS.JOIN_USER_ROOM           // 'join:user'
WS_EVENTS.HEALTH_METRIC_UPDATE     // 'health:metric:update'

// Server → Client
WS_EVENTS.SPECIALIST_STATUS_CHANGED  // 'specialist:status:changed'
WS_EVENTS.EMERGENCY_ALERT_CREATED    // 'emergency:alert:created'
WS_EVENTS.EMERGENCY_ALERT_RESOLVED   // 'emergency:alert:resolved'
WS_EVENTS.HEALTH_ANOMALY_DETECTED    // 'health:anomaly:detected'
WS_EVENTS.HOSPITAL_DATA_UPDATED      // 'hospital:data:updated'
```

---

## AI Integration (Anthropic Claude)

`backend/src/services/aiService.ts` wraps the Anthropic SDK.

### Conversation Types

| Type | System Prompt Focus |
|------|-------------------|
| `emergency_guidance` | Step-by-step emergency instructions; auto-triggered on critical alerts |
| `triage` | Structured symptom assessment; recommends urgency level |
| `general_health` | Evidence-based health education; encourages professional consultation |

### Context Injection

For `emergency_guidance` conversations, the AI automatically receives:
- Patient age, blood type, allergies, medical conditions
- Last 10 health metric readings
- The triggering emergency alert details

### Usage Pattern

```typescript
// Start a conversation
await aiService.startConversation(userId, 'triage', initialMessage)

// Continue conversation
await aiService.sendMessage(conversationId, userId, content)

// Auto-triggered on critical health anomaly
await aiService.handleEmergencyGuidance(userId, alertType, metricValue, alertId)
```

---

## Health Monitoring Pipeline

`backend/src/services/healthMonitorService.ts`

1. Wearable submits metric via `POST /api/v1/health/metrics`
2. `healthMonitorService.processMetric()` stores the reading
3. `detectAnomalies()` checks against thresholds:
   - Heart rate < 40 BPM → `critical`, type `low_heart_rate`
   - Heart rate > 150 BPM → `critical`, type `high_heart_rate`
   - SpO2 < 90% → `critical`, type `low_spo2`
   - Temperature < 95°F or > 104°F → `high`
4. If anomaly detected → `createEmergencyAlert()`
5. If severity is `critical` → `notifyEmergencyContacts()` via Twilio SMS
6. Real-time broadcast via WebSocket to the user's room

---

## HIPAA Compliance

This is a healthcare application. Follow these practices rigorously:

### Audit Logging

The `auditLog` middleware intercepts every response and persists an entry to `audit_logs` with:
- `user_id`, `user_type`, `action`, `resource_type`, `resource_id`
- `ip_address`, `user_agent`, `request_method`, `request_path`
- `request_body_summary` (sensitive fields like `password`, `otp`, `ssn` are **redacted**)
- `response_status`, `timestamp`

Audit entries write to DB (`audit_logs` table) and fall back to `logs/audit.log` on DB failure.

### Sensitive Operations

For operations that modify protected health information, add the `requireAuditReason` middleware. The API consumer must include:

```
X-Audit-Reason: <reason string, min 5 characters>
```

### Data Retention

PHI must be retained for **7 years** (`DATA_RETENTION_DAYS = 2555`). Do not add hard-delete logic without accounting for this requirement.

### Logging

Never log PHI directly. Use structured logging with `logger.info/warn/error({ key: value })`. The `sanitizeBody()` function in `audit.ts` lists fields that must always be redacted: `password`, `otp`, `token`, `refresh_token`, `secret`, `api_key`, `ssn`, `social_security`.

---

## Mobile App Conventions

- **State management**: Zustand stores in `mobile/src/store/`
- **Auth**: Token persisted in AsyncStorage (`@healthguard_auth_token`)
- **API**: Axios client in `mobile/src/api/client.ts` with automatic token refresh on 401
- **Real-time**: Singleton `socketService` in `mobile/src/services/socketService.ts`
- **WebSocket URL**: `http://localhost:3000` (dev) / `https://api.healthguard.com` (prod) — controlled by `__DEV__` flag

---

## Portal Conventions

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS 3 with `@headlessui/react` + `@heroicons/react`
- **State**: Zustand for auth state; React hooks for local component state
- **Forms**: `react-hook-form` + `zod` via `@hookform/resolvers`
- **Charts**: `recharts`
- **API client**: `portal/src/lib/api.ts` — axios instance with Bearer token injection and automatic 401 → token refresh → redirect to `/login`
- **Token storage**: `localStorage` under keys `hg_access_token` / `hg_refresh_token`
- **Types**: Import from `@/types` (aliases `portal/src/types/index.ts` which re-exports `shared/types`)

---

## Infrastructure

### Local Development (Docker Compose)

`infrastructure/docker/docker-compose.yml` starts:
- `postgres` — PostgreSQL 16 on port 5432
- `redis` — Redis 7 on port 6379
- `rabbitmq` — RabbitMQ 3 on ports 5672 (AMQP) / 15672 (management UI)
- `backend` — API server on port 3000
- `portal` — Next.js portal on port 3001

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

### Production (Kubernetes + AWS)

- **Container orchestration**: EKS (Kubernetes 1.29)
- **Backend**: 3–10 replicas with HPA (CPU 70% / memory 80% thresholds)
- **Database**: RDS PostgreSQL 16, Multi-AZ, encrypted, 30-day backups
- **Cache**: ElastiCache Redis 7 replication group, encrypted at rest and in transit
- **Secrets**: Stored in AWS SSM Parameter Store, injected via Kubernetes secrets
- **Terraform state**: S3 bucket `healthguard-terraform-state`, DynamoDB lock table
- **All AWS resources** tagged with `Compliance: HIPAA`

---

## Coding Conventions

### TypeScript

- Strict mode is on across all workspaces
- Prefer `interface` for object types; `type` for unions/aliases
- All database primary keys are UUIDs
- Services are singleton class instances (default export as `new ClassName()`)
- Avoid `any`; use `unknown` + type narrowing

### Backend Services

- Services live in `backend/src/services/` as singleton class instances
- Use `db(tableName).insert(...).returning('*')` pattern for inserts that need the created row
- Always destructure with `const [record] = await db(...).returning('*')`
- Use `logger` (not `console`) for all server-side logging
- Wrap Anthropic API calls in try/catch and throw human-readable errors

### Validation

Use the pre-built validators from `backend/src/middleware/validation.ts` or compose new ones with `validate(rules, source)`:

```typescript
validate([
  { field: 'email', required: true, type: 'string', pattern: /regex/ },
  { field: 'rating', required: true, type: 'number', min: 1, max: 5 },
])
```

Pre-built validators: `validateRegistration`, `validateLogin`, `validateAdminLogin`, `validateHospitalSearch`, `validateHealthMetric`, `validateVisitCreation`, `validateFeedback`, `validateAIMessage`, `validateAIConversation`, `validateEmergencyAlert`, `validateSpecialistStatus`.

### React/React Native

- Use functional components with hooks
- Zustand stores for global/shared state; local `useState` for component state
- Error states stored in Zustand (`error: string | null`); cleared with `clearError()`
- Always call `set({ isLoading: true })` at start of async actions; `finally` to reset

### Naming

- Database columns: `snake_case`
- TypeScript interfaces/types: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- API endpoint IDs in URLs: UUIDs

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `shared/types/index.ts` | Single source of truth for all domain types |
| `shared/constants/index.ts` | Health thresholds, WS events, search defaults |
| `backend/src/config/index.ts` | All env vars with validation at startup |
| `backend/src/middleware/auth.ts` | JWT middleware stack |
| `backend/src/middleware/audit.ts` | HIPAA audit logging |
| `backend/src/middleware/validation.ts` | Request validation middleware |
| `backend/src/services/aiService.ts` | Claude API integration |
| `backend/src/services/healthMonitorService.ts` | Anomaly detection pipeline |
| `backend/src/utils/logger.ts` | Winston logger configuration |
| `portal/src/lib/api.ts` | Portal API client + all API functions |
| `mobile/src/api/endpoints.ts` | Mobile API endpoint functions |
| `mobile/src/api/client.ts` | Mobile Axios client + token refresh |
| `infrastructure/docker/docker-compose.yml` | Local dev service stack |
| `infrastructure/terraform/main.tf` | AWS production infrastructure |
