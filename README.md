# HealthGuard - AI-Enhanced Emergency Healthcare Platform

A comprehensive, end-to-end healthcare platform combining an intelligent mobile app for users with a web portal for hospitals, powered by AI/LLM for emergency guidance and triage support.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Features](#features)
- [Database Schema](#database-schema)
- [API Documentation](#api-documentation)
- [Real-Time Sync](#real-time-sync)
- [AI/LLM Integration](#aillm-integration)
- [Wearable Integration](#wearable-integration)
- [Privacy & Compliance](#privacy--compliance)
- [Setup & Installation](#setup--installation)
- [Deployment](#deployment)
- [Implementation Plan](#implementation-plan)

---

## Overview

HealthGuard is a dual-component healthcare platform:

1. **Mobile App** (React Native) - For patients/users to find hospitals by specialist availability, monitor health via wearables, receive emergency AI guidance, and track visit history
2. **Hospital Web Portal** (Next.js) - For hospital administrators to manage specialist availability, schedules, and view patient feedback in real-time

Both components share a centralized PostgreSQL database with real-time synchronization via WebSockets.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
├──────────────────┬──────────────────┬──────────────────────────┤
│  Mobile App      │  Hospital Web    │  Wearable Devices        │
│  (React Native)  │  (Next.js)       │  (HealthKit/Fit API)     │
└────────┬─────────┴────────┬─────────┴──────────┬───────────────┘
         │                  │                    │
         ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY (Kong/AWS)                      │
│  Rate Limiting  │  JWT Auth  │  Request Routing                  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┬─────────────────┬─────────────────────────────┐
│  REST API       │  WebSocket      │  AI Service                 │
│  (Express.js)   │  (Socket.io)    │  (Claude API)               │
└────────┬────────┴────────┬────────┴─────────┬───────────────────┘
         │                 │                  │
         ▼                 ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                  │
│  PostgreSQL  │  Redis  │  RabbitMQ  │  Elasticsearch            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Mobile App** | React Native + TypeScript | Cross-platform iOS/Android |
| **State Management** | Zustand | Lightweight, hook-based state |
| **Maps** | react-native-maps (Google Maps) | Hospital location & navigation |
| **Wearables** | react-native-health (HealthKit) | Heart rate monitoring |
| **Hospital Portal** | Next.js 14 (App Router) + Tailwind | Server-rendered admin dashboard |
| **Backend API** | Express.js + TypeScript | REST API server |
| **Real-Time** | Socket.io | WebSocket connections |
| **Database** | PostgreSQL 16 | Primary data store |
| **Cache** | Redis 7 | Session cache, real-time data |
| **Message Queue** | RabbitMQ | Async job processing |
| **AI/LLM** | Anthropic Claude API | Emergency guidance, triage |
| **Notifications** | FCM/APNS + Twilio | Push notifications & SMS |
| **Infrastructure** | Docker, Kubernetes, AWS (EKS) | Container orchestration |
| **IaC** | Terraform | Infrastructure provisioning |

---

## Project Structure

```
Healthcare/
├── backend/                    # Express.js API Server
│   ├── src/
│   │   ├── config/             # Database & app configuration
│   │   ├── controllers/        # Route handlers
│   │   ├── middleware/         # Auth, validation, audit logging
│   │   ├── models/            # Data models
│   │   ├── routes/            # API route definitions
│   │   ├── services/          # Business logic
│   │   │   ├── aiService.ts           # Claude AI integration
│   │   │   ├── authService.ts         # Authentication
│   │   │   ├── healthMonitorService.ts # Wearable data processing
│   │   │   ├── hospitalService.ts     # Hospital search & filtering
│   │   │   ├── notificationService.ts # Push/SMS notifications
│   │   │   └── visitService.ts        # Visit & feedback management
│   │   ├── websocket/         # Socket.io handlers
│   │   ├── workers/           # Background job processors
│   │   └── utils/             # Helpers
│   ├── migrations/            # Database schema migrations
│   ├── seeds/                 # Sample data
│   └── tests/                 # API tests
│
├── mobile/                    # React Native Mobile App
│   ├── src/
│   │   ├── api/               # API client & endpoints
│   │   ├── components/        # Reusable UI components
│   │   │   ├── common/        # Buttons, cards, headers
│   │   │   ├── emergency/     # SOS button, alert banners
│   │   │   ├── health/        # Heart rate cards, charts
│   │   │   ├── hospital/      # Hospital cards, map, filters
│   │   │   ├── ai/            # Chat interface
│   │   │   └── profile/       # Visit history items
│   │   ├── hooks/             # Custom React hooks
│   │   ├── navigation/        # React Navigation setup
│   │   ├── screens/           # App screens
│   │   ├── services/          # Wearable, location, socket
│   │   ├── store/             # Zustand state stores
│   │   └── theme/             # Elderly-friendly design system
│   └── assets/                # Images, fonts
│
├── portal/                    # Next.js Hospital Web Portal
│   ├── src/
│   │   ├── app/               # Next.js App Router pages
│   │   │   ├── dashboard/     # Admin dashboard
│   │   │   ├── specialists/   # Specialist management
│   │   │   ├── schedule/      # Schedule management
│   │   │   ├── analytics/     # Analytics & charts
│   │   │   └── settings/      # Admin settings
│   │   ├── components/        # UI components
│   │   ├── hooks/             # Custom hooks
│   │   ├── lib/               # API client
│   │   └── services/          # Socket.io client
│   └── public/                # Static assets
│
├── shared/                    # Shared TypeScript Types & Utils
│   ├── types/                 # Type definitions
│   ├── constants/             # Shared constants
│   └── utils/                 # Shared utilities
│
├── infrastructure/            # DevOps & Infrastructure
│   ├── docker/                # Docker Compose & Dockerfiles
│   ├── k8s/                   # Kubernetes manifests
│   └── terraform/             # AWS infrastructure as code
│
└── docs/                      # Documentation
```

---

## Features

### Mobile App

| Feature | Description |
|---------|-------------|
| **Hospital Finder** | Google Maps integration filtering by specialist availability |
| **Specialty Filter** | Filter hospitals by specialty with real-time availability |
| **Wearable Monitoring** | Apple Watch / smart ring heart rate tracking |
| **Emergency Alerts** | Auto-detect dangerous heart rate, notify contacts with location |
| **One-Tap 911** | SOS button for immediate emergency services |
| **AI Guidance** | LLM-powered conversational emergency steps and triage |
| **Visit History** | Track visits with dates, hospitals, and specialists |
| **Post-Visit Feedback** | Star ratings and comments after visits |
| **Elderly-Friendly UX** | Large fonts (18pt+), high contrast, 56dp touch targets |

### Hospital Web Portal

| Feature | Description |
|---------|-------------|
| **Dashboard** | Real-time overview of specialist availability |
| **Specialist Management** | Add, edit, remove specialists with credentials |
| **Availability Control** | Toggle availability status (available/busy/off duty) |
| **Schedule Management** | Weekly schedule configuration per specialist |
| **Patient Feedback** | View ratings, comments, and trends |
| **Analytics** | Visit trends, ratings, utilization charts |
| **Real-Time Sync** | Changes instantly reflected in mobile app |

---

## Database Schema

The platform uses **17 tables** across these domains:

- **Users & Auth**: `users`, `emergency_contacts`, `hospital_admins`
- **Wearable & Health**: `wearable_devices`, `health_metrics`
- **Hospitals**: `hospitals`, `specialties`, `hospital_specialists`, `specialist_schedules`
- **Visits**: `user_visits`, `visit_feedback`
- **Emergency**: `emergency_alerts`
- **AI**: `ai_conversations`, `ai_messages`
- **Compliance**: `audit_logs`, `analytics_events`

Key design decisions:
- UUIDs for all primary keys (security through non-enumerable IDs)
- Time-series indexing on `health_metrics` for efficient wearable data queries
- Partial indexes on anomaly flags for fast emergency detection
- GiST spatial index on hospital coordinates for proximity searches
- JSONB for flexible audit log details and analytics properties

---

## API Documentation

### Authentication
```
POST /api/v1/auth/register          # Register with phone + OTP
POST /api/v1/auth/login             # Login with phone + OTP
POST /api/v1/auth/admin/login       # Hospital admin login (email + password)
POST /api/v1/auth/refresh-token     # Refresh JWT token
```

### Hospitals
```
GET  /api/v1/hospitals/search       # Search nearby hospitals
     ?lat=40.7128&lng=-74.006
     &radius=25&specialty_id=...
     &available_now=true
GET  /api/v1/hospitals/:id          # Hospital details
GET  /api/v1/hospitals/:id/specialists  # Hospital's specialists
PUT  /api/v1/hospitals/:id          # Update hospital (admin)
POST /api/v1/hospitals/:id/specialists  # Add specialist (admin)
PUT  /api/v1/specialists/:id/status # Update availability (admin)
```

### Health Monitoring
```
POST /api/v1/health/metrics         # Submit wearable metric
GET  /api/v1/health/metrics/:userId # Get health history
GET  /api/v1/health/alerts/:userId  # Get alerts history
```

### Visits
```
POST /api/v1/visits                 # Create a visit
GET  /api/v1/visits/history         # User's visit history
GET  /api/v1/visits/:id             # Visit details
PUT  /api/v1/visits/:id             # Update visit
POST /api/v1/visits/:id/feedback    # Submit feedback
GET  /api/v1/visits/pending-feedback # Visits awaiting feedback
```

### Emergency
```
POST /api/v1/emergency/alert        # Trigger emergency alert
PUT  /api/v1/emergency/alert/:id/status  # Update alert status
GET  /api/v1/emergency/alerts       # Get user's alerts
POST /api/v1/emergency/call-911     # Log 911 call attempt
```

### AI Assistant
```
POST /api/v1/ai/conversation        # Start AI conversation
POST /api/v1/ai/conversation/:id/message  # Send message
GET  /api/v1/ai/conversations       # Conversation history
POST /api/v1/ai/emergency-guidance  # Auto-triggered guidance
```

---

## Real-Time Sync

WebSocket events enable instant synchronization between the hospital portal and mobile app:

| Event | Direction | Description |
|-------|-----------|-------------|
| `specialist:status:changed` | Server → All Clients | Specialist availability updated |
| `emergency:alert:created` | Server → User's Contacts | New emergency alert triggered |
| `emergency:alert:resolved` | Server → Contacts | Alert resolved/dismissed |
| `health:anomaly:detected` | Server → User | Dangerous health metric detected |
| `hospital:data:updated` | Server → All Clients | Hospital info changed |
| `health:metric:update` | Client → Server | New wearable data received |

### Sync Flow
```
Hospital Admin updates specialist status
  → Portal sends PUT /specialists/:id/status
  → Backend updates DB
  → Backend emits 'specialist:status:changed' via Socket.io
  → All connected mobile apps receive update
  → Map pins and availability indicators update in real-time
```

---

## AI/LLM Integration

The platform uses **Anthropic Claude** for three key capabilities:

### 1. Emergency Guidance
When a health anomaly is detected (e.g., heart rate drops below 40 BPM):
- AI provides calm, step-by-step instructions
- Contextual advice based on the type of emergency
- Suggests nearest appropriate emergency facility
- Maintains conversation while help arrives

### 2. Triage Assessment
Users can describe symptoms conversationally:
- AI asks clarifying questions
- Provides urgency assessment (not diagnosis)
- Recommends appropriate specialist type
- Suggests whether ER visit is warranted

### 3. General Health Q&A
Non-emergency health questions:
- Medication information
- Post-visit care instructions
- General wellness advice

**Safety**: All AI responses include disclaimers that they are not medical diagnoses and users should consult healthcare professionals.

---

## Wearable Integration

### Supported Devices
- Apple Watch (via HealthKit)
- Fitbit (via Fitbit Web API)
- Oura Ring (via Oura API)
- Samsung Galaxy Watch (via Samsung Health SDK)
- Garmin (via Garmin Connect API)

### Monitoring Flow
```
Wearable records heart rate
  → HealthKit/SDK delivers data to app
  → App processes metric locally
  → If anomaly detected (HR < 40 or HR > 150):
      → Create emergency alert
      → Notify emergency contacts with live location
      → Launch AI emergency guidance
      → Suggest nearest ER
  → Metric sent to backend for storage
  → Historical data available in health dashboard
```

---

## Privacy & Compliance

### HIPAA Compliance
- All data encrypted at rest (AES-256) and in transit (TLS 1.3)
- Audit logging on every data access (`audit_logs` table)
- Role-based access control for hospital admins
- Session timeout and token expiration
- PHI data separation and access tracking

### Data Anonymization
- Analytics use one-way hashed user IDs
- Aggregate feedback data only shared with hospitals
- Individual health data accessible only by the user
- Data retention policy: 7 years per HIPAA requirements
- Salt rotation every 90 days for anonymization

### Security Features
- JWT with short-lived tokens + refresh tokens
- Rate limiting on all API endpoints
- Input validation and SQL injection prevention
- CORS configuration
- Helmet.js security headers
- Password hashing with bcrypt (cost factor 12)

---

## Setup & Installation

### Prerequisites
- Node.js >= 20.0.0
- PostgreSQL 16
- Redis 7
- Docker & Docker Compose (for local development)

### Quick Start with Docker

```bash
# Clone the repository
git clone https://github.com/your-org/healthguard.git
cd healthguard

# Copy environment variables
cp infrastructure/docker/.env.example infrastructure/docker/.env
# Edit .env with your API keys

# Start all services
cd infrastructure/docker
docker-compose up -d

# Run migrations
docker-compose exec backend npm run db:migrate

# Seed sample data
docker-compose exec backend npm run db:seed
```

### Manual Setup

```bash
# Install dependencies (all workspaces)
npm install

# Backend
cd backend
cp .env.example .env
# Edit .env with your configuration
npm run dev

# Portal (new terminal)
cd portal
npm run dev

# Mobile (new terminal)
cd mobile
npm run start
# Then press 'i' for iOS or 'a' for Android
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DB_HOST` | Yes | PostgreSQL host |
| `DB_PASSWORD` | Yes | Database password |
| `JWT_SECRET` | Yes | JWT signing secret (32+ chars) |
| `ANTHROPIC_API_KEY` | Yes | Claude API key for AI features |
| `GOOGLE_MAPS_API_KEY` | Yes | Google Maps SDK key |
| `TWILIO_ACCOUNT_SID` | No | Twilio SID for SMS |
| `TWILIO_AUTH_TOKEN` | No | Twilio auth token |
| `REDIS_URL` | Yes | Redis connection URL |

---

## Deployment

### Production Architecture (AWS)

```
Internet → CloudFront CDN → ALB → EKS Cluster
                                    ├── Backend Pods (3-10, auto-scaled)
                                    └── Portal Pods (2-5, auto-scaled)

EKS → RDS PostgreSQL (Multi-AZ)
    → ElastiCache Redis (2-node cluster)
    → RabbitMQ (Amazon MQ)
```

### Deploy to AWS

```bash
# Initialize Terraform
cd infrastructure/terraform
terraform init

# Plan and apply
terraform plan
terraform apply

# Deploy to Kubernetes
kubectl apply -f infrastructure/k8s/namespace.yaml
kubectl apply -f infrastructure/k8s/
```

### Mobile App Distribution
- **iOS**: TestFlight → App Store (requires Apple Developer Account)
- **Android**: Internal Testing → Google Play Store

---

## Implementation Plan

### Phase 1: Foundation (Weeks 1-3)
- [x] Database schema design and migrations
- [x] Backend API scaffolding with Express.js
- [x] Authentication system (JWT + OTP)
- [x] Hospital CRUD operations
- [x] Specialist management endpoints

### Phase 2: Core Features (Weeks 4-6)
- [x] React Native mobile app scaffolding
- [x] Hospital search with Google Maps integration
- [x] Specialty filtering with real-time availability
- [x] Next.js hospital portal with dashboard
- [x] WebSocket real-time sync

### Phase 3: Health & Emergency (Weeks 7-9)
- [x] Wearable device integration (HealthKit)
- [x] Heart rate monitoring and anomaly detection
- [x] Emergency alert system with contact notification
- [x] One-tap 911 calling
- [x] Live location sharing during emergencies

### Phase 4: AI Integration (Weeks 10-11)
- [x] Claude AI emergency guidance
- [x] Triage conversation system
- [x] General health Q&A
- [x] Conversation history and feedback

### Phase 5: Polish & Deploy (Weeks 12-14)
- [x] Visit history and feedback system
- [x] Analytics dashboard for hospitals
- [x] Elderly-friendly UX refinement
- [x] HIPAA compliance audit
- [x] Infrastructure provisioning (Terraform)
- [x] Kubernetes deployment
- [ ] App Store / Play Store submission
- [ ] Production monitoring setup

---

## License

Proprietary - All rights reserved.

## Support

For technical support or questions, contact the development team.
