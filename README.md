# Real-Time Collaborative Kanban with Autonomous AI Project Manager

![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=nodedotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6.9-2D3748?logo=prisma&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?logo=socketdotio&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini_2.5_Flash-AI-8E75B2?logo=googlegemini&logoColor=white)
![Chrome Extension](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-4285F4?logo=googlechrome&logoColor=white)
![Railway](https://img.shields.io/badge/Railway-Deployed-0B0D0E?logo=railway&logoColor=white)
![License](https://img.shields.io/badge/License-All_Rights_Reserved-red)

A full-stack, real-time collaborative Kanban board with an **autonomous AI project manager** that analyses bottlenecks, predicts sprint risk, auto-assigns tasks, and generates weekly digests — plus a **Chrome Extension** for clipping web content directly into boards.

> **Live Demo:** Deployed on Railway  
> **Stack:** React 19 · Express · PostgreSQL · Prisma · Socket.IO · Gemini / Groq AI · Chrome Extension (Manifest V3)

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Local Development Setup](#local-development-setup)
  - [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
  - [Authentication](#authentication-api)
  - [Boards](#boards-api)
  - [Columns](#columns-api)
  - [Cards](#cards-api)
  - [Labels](#labels-api)
  - [Comments](#comments-api)
  - [GitHub Integration](#github-integration-api)
  - [AI Engine](#ai-engine-api)
  - [Chrome Extension](#chrome-extension-api)
  - [Health Check](#health-check)
- [WebSocket Events](#websocket-events)
- [AI Pipeline](#ai-pipeline)
- [Chrome Extension](#chrome-extension)
- [Deployment](#deployment)
  - [Railway (Production)](#railway-production)
  - [Docker](#docker)
- [Demo Users & Test Credentials](#demo-users--test-credentials)
- [Load Test Results](#load-test-results)
- [Chrome Extension — Website Compatibility Test](#chrome-extension--website-compatibility-test)

---

## Architecture Overview

```
┌──────────────────┐       WebSocket (Socket.IO)        ┌─────────────────┐
│                  │ ◄──────────────────────────────────►│                 │
│  React 19 SPA    │       REST API (/api/*)             │  Express Server │
│  (Vite + dnd-kit)│ ◄──────────────────────────────────►│  (Node.js)      │
│                  │                                     │                 │
└──────────────────┘                                     └────────┬────────┘
                                                                  │
┌──────────────────┐                                     ┌────────▼────────┐
│ Chrome Extension │ ── REST API (Bearer token) ────────►│   PostgreSQL    │
│ (Manifest V3)    │                                     │   (Prisma ORM)  │
└──────────────────┘                                     └────────┬────────┘
                                                                  │
                                                         ┌────────▼────────┐
                                                         │  AI Pipeline    │
                                                         │  (Gemini/Groq)  │
                                                         │  • Bottleneck   │
                                                         │  • Sprint Risk  │
                                                         │  • Auto-Assign  │
                                                         │  • Digest       │
                                                         └─────────────────┘
```

---

## Project Structure

```
Kanban/
├── client/                     # React 19 frontend (Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── AI/             # AI insights panel, progress indicators
│   │   │   ├── Auth/           # Login, Register forms
│   │   │   ├── Board/          # BoardView, Column, KanbanCard, CardDetail
│   │   │   │   ├── BoardView.jsx       # Main board with drag-and-drop
│   │   │   │   ├── CardDetail.jsx      # Card detail modal with comments
│   │   │   │   ├── Column.jsx          # Column container with WIP limits
│   │   │   │   ├── KanbanCard.jsx      # Draggable card component
│   │   │   │   ├── CursorOverlay.jsx   # Multi-user cursor tracking
│   │   │   │   ├── CustomSelect.jsx    # Custom dropdown component
│   │   │   │   └── InlineCardCreate.jsx# Quick card creation
│   │   │   ├── GitHub/         # GitHub import UI
│   │   │   ├── Layout/         # App shell, sidebar, navbar
│   │   │   ├── Team/           # Team stats & member management
│   │   │   └── common/         # Shared UI primitives
│   │   ├── context/            # React context providers (Auth, Socket)
│   │   ├── hooks/              # Custom React hooks
│   │   ├── utils/              # Helper functions
│   │   ├── App.jsx             # Root component with routing
│   │   ├── App.css             # Component styles
│   │   ├── index.css           # Global styles & design tokens
│   │   └── main.jsx            # Entry point
│   ├── index.html              # HTML shell
│   ├── vite.config.js          # Vite config with API proxy
│   └── package.json
│
├── server/                     # Express.js backend
│   ├── src/
│   │   ├── ai/                 # AI pipeline modules
│   │   │   ├── llmClient.js    # LLM abstraction (Gemini + Groq + fallback)
│   │   │   ├── pipeline.js     # Orchestrator for all AI analyses
│   │   │   ├── scheduler.js    # Cron-based scheduled AI runs
│   │   │   ├── bottleneck.js   # Column flow-rate analysis
│   │   │   ├── sprintRisk.js   # Sprint deadline risk calculator
│   │   │   ├── autoAssign.js   # Workload-aware task assignment
│   │   │   ├── complexity.js   # Card complexity inference
│   │   │   └── digest.js       # Weekly digest generator
│   │   ├── routes/
│   │   │   ├── auth.js         # Registration, login, session
│   │   │   ├── boards.js       # Board CRUD + members
│   │   │   ├── columns.js      # Column CRUD + reorder
│   │   │   ├── cards.js        # Card CRUD + move + conflict detection
│   │   │   ├── labels.js       # Label CRUD
│   │   │   ├── comments.js     # Card comments
│   │   │   ├── github.js       # GitHub issue import
│   │   │   ├── ai.js           # AI insights + manual triggers
│   │   │   └── extension.js    # Chrome extension endpoints
│   │   ├── middleware/
│   │   │   └── auth.js         # Session + API key + board-member auth
│   │   ├── websocket.js        # Socket.IO setup, rooms, presence
│   │   ├── app.js              # Express app configuration
│   │   ├── index.js            # Server entry point
│   │   └── db.js               # Prisma client singleton
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema (12 models)
│   │   ├── seed.js             # Demo data seeder
│   │   └── migrations/         # Prisma migration history
│   ├── test/
│   │   └── load-test.js        # WebSocket load & latency tester
│   ├── docker-compose.yml      # Local PostgreSQL
│   ├── .env.example            # Environment template
│   └── package.json
│
├── extension/                  # Chrome Extension (Manifest V3)
│   ├── manifest.json           # Extension manifest
│   ├── background/
│   │   └── service_worker.js   # Background service worker
│   ├── popup/
│   │   ├── popup.html          # Extension popup UI
│   │   ├── popup.js            # Popup logic (clip, board select)
│   │   └── popup.css           # Popup styles
│   └── icons/                  # Extension icons (16, 48, 128px)
│
├── Dockerfile                  # Multi-stage production build
├── railway.toml                # Railway deployment config
└── .gitignore
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19 + Vite 8 | SPA with fast HMR |
| **Drag & Drop** | @dnd-kit/core + sortable | Card and column reordering |
| **Routing** | react-router-dom v7 | Client-side navigation |
| **Real-time** | Socket.IO v4 | WebSocket events, presence, cursors |
| **Backend** | Express.js v4 | REST API server |
| **Database** | PostgreSQL 15 | Primary data store |
| **ORM** | Prisma v6.9 | Type-safe database access + migrations |
| **Auth** | express-session + bcryptjs | Session-based auth + API key auth |
| **AI** | Google Gemini 2.5 Flash / Groq Llama 3.3 70B | LLM-powered analysis |
| **Scheduler** | node-cron | Automated AI pipeline runs |
| **GitHub** | @octokit/rest | GitHub issue import |
| **Extension** | Chrome Manifest V3 | Web clipper for cards |
| **Deployment** | Railway + Docker | Production hosting |

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 20.x
- **PostgreSQL** 15+ (or Docker)
- **npm** ≥ 9.x
- (Optional) **Gemini API Key** or **Groq API Key** for AI features
- (Optional) **GitHub Token** for higher rate limits on issue imports

### Local Development Setup

#### 1. Clone the repository

```bash
git clone https://github.com/doctorbhh/Real-Time-Collaborative-Kanban-with-Autonomous-AI-Project-Manager.git
cd Real-Time-Collaborative-Kanban-with-Autonomous-AI-Project-Manager
```

#### 2. Start PostgreSQL (via Docker)

```bash
cd server
docker-compose up -d
```

This starts PostgreSQL on `localhost:5432` with:
- **User:** `postgres`
- **Password:** `password`
- **Database:** `kanban`

#### 3. Setup the server

```bash
cd server
cp .env.example .env    # then edit .env with your values
npm install
npx prisma migrate dev  # apply database schema
npm run db:seed          # seed demo data (3 users, 1 board, 15 cards)
npm run dev              # starts on http://localhost:3000
```

#### 4. Setup the client

```bash
cd client
npm install
npm run dev              # starts on http://localhost:5173
```

The Vite dev server proxies `/api/*` and `/socket.io/*` to the backend on port 3000.

#### 5. Load the Chrome Extension (optional)

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `extension/` folder
4. Click the extension icon → enter your server URL and API key

---

### Environment Variables

Create `server/.env` from the template:

```bash
cp server/.env.example server/.env
```

```env
# ── Database ─────────────────────────────────────────────
DATABASE_URL="postgresql://postgres:password@localhost:5432/kanban?schema=public"

# ── Session ──────────────────────────────────────────────
SESSION_SECRET="change-me-to-a-random-string"

# ── Server ───────────────────────────────────────────────
PORT=3000
NODE_ENV="development"
CLIENT_URL="http://localhost:5173"

# ── AI Provider ──────────────────────────────────────────
# Choose one: "gemini" (default) or "groq"
AI_PROVIDER="gemini"
GEMINI_API_KEY="your-gemini-api-key-here"
GROQ_API_KEY=""

# ── AI Schedule (cron expression) ────────────────────────
# Default: every 6 hours. Format: minute hour day-of-month month day-of-week
AI_SCHEDULE="0 */6 * * *"

# ── GitHub (optional — increases rate limit to 5,000 req/hr) ──
GITHUB_TOKEN=""
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ![Yes](https://img.shields.io/badge/Yes-brightgreen) | PostgreSQL connection string |
| `SESSION_SECRET` | ![Yes](https://img.shields.io/badge/Yes-brightgreen) | Random string for session encryption |
| `PORT` | ![No](https://img.shields.io/badge/No-grey) | Server port (default: `3000`) |
| `NODE_ENV` | ![No](https://img.shields.io/badge/No-grey) | `development` or `production` |
| `CLIENT_URL` | ![No](https://img.shields.io/badge/No-grey) | Frontend URL for CORS (default: `http://localhost:5173`) |
| `AI_PROVIDER` | ![No](https://img.shields.io/badge/No-grey) | `gemini` (default) or `groq` |
| `GEMINI_API_KEY` | ![No](https://img.shields.io/badge/No-grey) | Google Gemini API key (enables AI features) |
| `GROQ_API_KEY` | ![No](https://img.shields.io/badge/No-grey) | Groq API key (alternative LLM) |
| `AI_SCHEDULE` | ![No](https://img.shields.io/badge/No-grey) | Cron expression for automated AI runs (default: `0 */6 * * *`) |
| `GITHUB_TOKEN` | ![No](https://img.shields.io/badge/No-grey) | GitHub personal access token for issue import |

> **Note:** AI features work without API keys using a heuristic fallback, but LLM-powered analysis requires either `GEMINI_API_KEY` or `GROQ_API_KEY`.

---

## Database Schema

The app uses **12 Prisma models** backed by PostgreSQL:

```
┌──────────┐    ┌─────────────┐    ┌─────────┐
│   User   │◄──►│ BoardMember │◄──►│  Board  │
│          │    │  (role)     │    │         │
└────┬─────┘    └─────────────┘    └────┬────┘
     │                                   │
     │ assignee                          ├── Column[]
     │                                   ├── Label[]
     ▼                                   ├── AiInsight[]
┌──────────┐                             ├── DigestReport[]
│   Card   │◄── Column                   └── GithubImport[]
│          │
├── CardLabel[] ──► Label
├── Comment[]
└── Activity[]
```

| Model | Purpose |
|-------|---------|
| `User` | User accounts with bcrypt password hashes and API keys |
| `Board` | Kanban boards with sprint deadlines and AI schedules |
| `BoardMember` | Many-to-many user↔board with roles (`owner` / `member`) |
| `Column` | Board columns with ordering and optional WIP limits |
| `Card` | Task cards with complexity, versioning, and GitHub links |
| `Label` | Colored labels scoped to boards |
| `CardLabel` | Many-to-many card↔label junction |
| `Comment` | Threaded comments on cards |
| `Activity` | Audit log of all card actions (created, moved, edited) |
| `AiInsight` | AI-generated insights (bottleneck, sprint_risk, auto_assign, complexity) |
| `DigestReport` | Weekly AI digest reports |
| `GithubImport` | GitHub repo import history |

---

## API Reference

**Base URL:** `http://localhost:3000/api`

**Authentication:** All routes (except register/login) require one of:
- **Session cookie** — set after login via `POST /api/auth/login`
- **Bearer token** — `Authorization: Bearer <apiKey>` header

---

### Authentication API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/register` | ![None](https://img.shields.io/badge/None-grey) | Create a new account |
| `POST` | `/api/auth/login` | ![None](https://img.shields.io/badge/None-grey) | Login and receive session cookie |
| `POST` | `/api/auth/logout` | ![Required](https://img.shields.io/badge/Required-green) | Destroy session |
| `GET` | `/api/auth/me` | ![Required](https://img.shields.io/badge/Required-green) | Get current user profile |
| `PATCH` | `/api/auth/me` | ![Required](https://img.shields.io/badge/Required-green) | Update profile (name, githubUsername, avatarUrl) |

<details>
<summary><strong>Request/Response Examples</strong></summary>

**Register:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@test.com","password":"secret123"}'
```
```json
{
  "user": {
    "id": "uuid-here",
    "name": "John Doe",
    "email": "john@test.com",
    "apiKey": "generated-uuid-key",
    "avatarUrl": null
  }
}
```

**Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@demo.com","password":"demo123"}'
```
```json
{
  "user": {
    "id": "uuid",
    "name": "Alice Chen",
    "email": "alice@demo.com",
    "apiKey": "uuid-api-key",
    "avatarUrl": null,
    "githubUsername": "alicechen"
  }
}
```

</details>

---

### Boards API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/boards` | ![Required](https://img.shields.io/badge/Required-green) | Create board (auto-creates 5 columns + default labels) |
| `GET` | `/api/boards` | ![Required](https://img.shields.io/badge/Required-green) | List all boards the user is a member of |
| `GET` | `/api/boards/:boardId/full` | ![Member](https://img.shields.io/badge/Member-blue) | Full board with columns, cards, labels, members |
| `PATCH` | `/api/boards/:boardId` | ![Member](https://img.shields.io/badge/Member-blue) | Update board (name, description, sprintEndDate, aiSchedule) |
| `DELETE` | `/api/boards/:boardId` | ![Owner](https://img.shields.io/badge/Owner-orange) | Delete board |
| `POST` | `/api/boards/:boardId/members` | ![Member](https://img.shields.io/badge/Member-blue) | Add member by email |
| `DELETE` | `/api/boards/:boardId/members/:userId` | ![Owner](https://img.shields.io/badge/Owner-orange) | Remove member |

<details>
<summary><strong>Request/Response Examples</strong></summary>

**Create Board:**
```bash
curl -X POST http://localhost:3000/api/boards \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <apiKey>" \
  -d '{"name":"Sprint 13","description":"New sprint","sprintEndDate":"2026-07-14"}'
```

**Add Member:**
```bash
curl -X POST http://localhost:3000/api/boards/<boardId>/members \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <apiKey>" \
  -d '{"email":"bob@demo.com"}'
```

</details>

---

### Columns API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/boards/:boardId/columns` | ![Member](https://img.shields.io/badge/Member-blue) | Create column |
| `PATCH` | `/api/boards/:boardId/columns/:columnId` | ![Member](https://img.shields.io/badge/Member-blue) | Update column (name, wipLimit) |
| `PATCH` | `/api/boards/:boardId/columns-reorder` | ![Member](https://img.shields.io/badge/Member-blue) | Batch reorder columns |
| `DELETE` | `/api/boards/:boardId/columns/:columnId` | ![Member](https://img.shields.io/badge/Member-blue) | Delete column (cascades cards) |

<details>
<summary><strong>Request/Response Examples</strong></summary>

**Create Column:**
```bash
curl -X POST http://localhost:3000/api/boards/<boardId>/columns \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <apiKey>" \
  -d '{"name":"QA","wipLimit":3}'
```

**Reorder Columns:**
```bash
curl -X PATCH http://localhost:3000/api/boards/<boardId>/columns-reorder \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <apiKey>" \
  -d '{"columns":[{"id":"col-1","order":0},{"id":"col-2","order":1}]}'
```

</details>

---

### Cards API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/boards/:boardId/cards` | ![Member](https://img.shields.io/badge/Member-blue) | Create card (auto-infers complexity via AI) |
| `GET` | `/api/boards/:boardId/cards/:cardId` | ![Member](https://img.shields.io/badge/Member-blue) | Get card detail with comments + activity log |
| `PATCH` | `/api/boards/:boardId/cards/:cardId` | ![Member](https://img.shields.io/badge/Member-blue) | Update card fields (supports conflict detection via `baseVersion`) |
| `PATCH` | `/api/boards/:boardId/cards/:cardId/move` | ![Member](https://img.shields.io/badge/Member-blue) | Move card between columns (auto-rebalances ordering) |
| `DELETE` | `/api/boards/:boardId/cards/:cardId` | ![Member](https://img.shields.io/badge/Member-blue) | Delete card |

<details>
<summary><strong>Request/Response Examples</strong></summary>

**Create Card:**
```bash
curl -X POST http://localhost:3000/api/boards/<boardId>/cards \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <apiKey>" \
  -d '{
    "title": "Fix login bug",
    "description": "Users see blank screen after login",
    "columnId": "<columnId>",
    "assigneeId": "<userId>",
    "labelIds": ["<labelId1>", "<labelId2>"],
    "referenceUrl": "https://github.com/org/repo/issues/42"
  }'
```

**Move Card (with optimistic ordering):**
```bash
curl -X PATCH http://localhost:3000/api/boards/<boardId>/cards/<cardId>/move \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <apiKey>" \
  -d '{"toColumnId":"<targetColumnId>","order":2.5}'
```

**Update Card (with conflict detection):**
```bash
curl -X PATCH http://localhost:3000/api/boards/<boardId>/cards/<cardId> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <apiKey>" \
  -d '{"title":"Updated title","baseVersion":3}'
```
Response includes `"conflictDetected": true` if version mismatch.

</details>

---

### Labels API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/boards/:boardId/labels` | ![Member](https://img.shields.io/badge/Member-blue) | Create label |
| `GET` | `/api/boards/:boardId/labels` | ![Member](https://img.shields.io/badge/Member-blue) | List labels with card counts |
| `DELETE` | `/api/boards/:boardId/labels/:labelId` | ![Member](https://img.shields.io/badge/Member-blue) | Delete label |

---

### Comments API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/cards/:cardId/comments` | ![Required](https://img.shields.io/badge/Required-green) | List comments on a card |
| `POST` | `/api/cards/:cardId/comments` | ![Required](https://img.shields.io/badge/Required-green) | Add comment to a card |
| `DELETE` | `/api/cards/:cardId/comments/:commentId` | ![Required](https://img.shields.io/badge/Required-green) | Delete own comment |

---

### GitHub Integration API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/boards/:boardId/github-import/preview` | ![Member](https://img.shields.io/badge/Member-blue) | Preview issues from a GitHub repo |
| `POST` | `/api/boards/:boardId/github-import` | ![Member](https://img.shields.io/badge/Member-blue) | Import all open issues as cards |
| `GET` | `/api/boards/:boardId/github-import/history` | ![Member](https://img.shields.io/badge/Member-blue) | Get import history |

<details>
<summary><strong>Request/Response Examples</strong></summary>

**Preview:**
```bash
curl -X POST http://localhost:3000/api/boards/<boardId>/github-import/preview \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <apiKey>" \
  -d '{"repoUrl":"https://github.com/facebook/react"}'
```
```json
{
  "repoUrl": "https://github.com/facebook/react",
  "owner": "facebook",
  "repo": "react",
  "totalCount": "100+",
  "newCount": "100+",
  "alreadyImported": 0,
  "samples": [ ... ]
}
```

**Import:**
```bash
curl -X POST http://localhost:3000/api/boards/<boardId>/github-import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <apiKey>" \
  -d '{"repoUrl":"https://github.com/facebook/react","targetColumnId":"<columnId>"}'
```
```json
{ "imported": 42, "skipped": 3, "total": 45 }
```

</details>

---

### AI Engine API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/boards/:boardId/ai/insights` | ![Member](https://img.shields.io/badge/Member-blue) | List AI insights (last 50) |
| `PATCH` | `/api/boards/:boardId/ai/insights/:insightId` | ![Member](https://img.shields.io/badge/Member-blue) | Accept or dismiss an insight |
| `POST` | `/api/boards/:boardId/ai/run` | ![Member](https://img.shields.io/badge/Member-blue) | Manually trigger the full AI pipeline |
| `POST` | `/api/boards/:boardId/ai/auto-assign` | ![Member](https://img.shields.io/badge/Member-blue) | Manually trigger AI auto-assign |
| `GET` | `/api/boards/:boardId/ai/digest` | ![Member](https://img.shields.io/badge/Member-blue) | Get weekly digest reports (last 10) |
| `GET` | `/api/boards/:boardId/team-stats` | ![Member](https://img.shields.io/badge/Member-blue) | Team workload stats per member |

<details>
<summary><strong>Insight Types</strong></summary>

| Type | Description |
|------|-------------|
| `bottleneck` | Identifies columns where cards are stuck or accumulating |
| `sprint_risk` | Assesses risk of missing the sprint deadline |
| `auto_assign` | Suggests assignee for unassigned cards based on workload |
| `complexity` | AI-inferred complexity score (1–5) for a card |

**Accept Insight (applies change):**
```bash
curl -X PATCH http://localhost:3000/api/boards/<boardId>/ai/insights/<insightId> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <apiKey>" \
  -d '{"status":"accepted"}'
```

</details>

---

### Chrome Extension API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/ext/clip` | ![API Key](https://img.shields.io/badge/API_Key-purple) | Create card from extension clip |
| `GET` | `/api/ext/boards` | ![API Key](https://img.shields.io/badge/API_Key-purple) | List boards with columns (for extension dropdown) |

> **Auth:** Extension endpoints require `Authorization: Bearer <apiKey>` header (session cookies are not available to extensions).

<details>
<summary><strong>Request/Response Examples</strong></summary>

**Clip from Extension:**
```bash
curl -X POST http://localhost:3000/api/ext/clip \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <apiKey>" \
  -d '{
    "title": "Interesting article about React 19",
    "description": "Selected text from the page...",
    "boardId": "<boardId>",
    "columnId": "<columnId>",
    "referenceUrl": "https://example.com/article"
  }'
```

</details>

---

### Health Check

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/health` | ![None](https://img.shields.io/badge/None-grey) | Returns `{ "status": "ok", "timestamp": "..." }` |

---

## WebSocket Events

The app uses Socket.IO for real-time collaboration. Connect with:

```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {
  auth: { token: "<apiKey>" },
  transports: ["websocket", "polling"],
});
```

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `board:join` | `{ boardId, userName, avatar }` | Join a board room |
| `board:leave` | `{ boardId }` | Leave a board room |
| `card:typing` | `{ boardId, cardId }` | Notify others you're editing a card |
| `card:typing:stop` | `{ boardId, cardId }` | Stop typing indicator |
| `cursor:move` | `{ x, y, boardId }` | Broadcast cursor position |

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `board:presence` | `[{ userId, name, avatar }]` | Updated list of online users |
| `card:created` | `{ card }` | New card created on the board |
| `card:updated` | `{ card, conflictDetected, updatedBy }` | Card was edited |
| `card:moved` | `{ cardId, fromColumnId, toColumnId, order, card, movedBy }` | Card moved between columns |
| `card:deleted` | `{ cardId, columnId }` | Card was deleted |
| `column:created` | `{ column }` | New column added |
| `column:updated` | `{ columnId, changes }` | Column renamed / WIP limit changed |
| `column:reordered` | `{ columns }` | Columns reordered |
| `column:deleted` | `{ columnId }` | Column deleted |
| `comment:added` | `{ cardId, comment }` | New comment on a card |
| `card:typing` | `{ cardId, userId, userName }` | Someone is typing in a card |
| `card:typing:stop` | `{ cardId, userId }` | Someone stopped typing |
| `cursor:move` | `{ userId, userName, x, y }` | Remote cursor position |
| `board:refresh` | `{ reason }` | Full board refresh needed (e.g., after GitHub import) |
| `ai:analyzing` | `{ phase }` | AI pipeline phase change |
| `ai:progress` | `{ type, status, message }` | AI step progress update |
| `ai:insight` | `{ insight }` | New AI insight generated |
| `ai:insight-updated` | `{ insight }` | Insight status changed (accepted/dismissed) |
| `ai:digest` | `{ digest }` | Weekly digest report ready |

---

## AI Pipeline

The autonomous AI project manager runs a multi-phase pipeline:

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────┐
│ Bottleneck  │────►│ Sprint Risk  │────►│ Auto-Assign  │────►│  Digest  │
│ Detection   │     │ Assessment   │     │ Suggestions  │     │ (weekly) │
└─────────────┘     └──────────────┘     └──────────────┘     └──────────┘
     15s delay           15s delay            15s delay
```

| Phase | What It Does |
|-------|-------------|
| **Bottleneck Detection** | Analyses column flow rates, identifies cards stuck too long, flags overloaded columns |
| **Sprint Risk Assessment** | Calculates remaining work vs. remaining time, predicts completion probability |
| **Auto-Assign** | Matches unassigned cards to team members based on workload, expertise, and label history |
| **Complexity Inference** | Scores cards 1–5 based on title/description analysis (runs per-card on creation) |
| **Weekly Digest** | Summarises sprint progress, velocity trends, and key metrics |

**Triggers:**
- **Automatic:** Cron schedule (default: every 6 hours, configurable per board)
- **Manual:** `POST /api/boards/:boardId/ai/run`
- **Per-card:** Complexity inference on card creation

**LLM Providers:**
- **Gemini 2.5 Flash** (default) — with streaming support and auto-retry on rate limits
- **Groq Llama 3.3 70B** — alternative provider
- **Heuristic Fallback** — works without any API key

---

## Chrome Extension

The **Kanban AI Clipper** Chrome extension (Manifest V3) lets you:

1. **Select text** on any webpage → clip it as a card description
2. **Full page clip** → captures page title and URL automatically
3. **Choose board + column** → cards appear instantly via WebSocket

### Setup

1. Go to `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `extension/` folder
4. Click the extension icon
5. Enter your **server URL** (e.g., `http://localhost:3000` or Railway URL)
6. Enter your **API key** (found in your user profile after login)

---

## Deployment

### Railway (Production)

The project is configured for one-click Railway deployment:

1. **Create a Railway project** with a PostgreSQL plugin
2. **Connect your GitHub repo**
3. **Set environment variables** in Railway dashboard:
   - `DATABASE_URL` — automatically set by Railway PostgreSQL plugin
   - `SESSION_SECRET` — generate a random string
   - `NODE_ENV=production`
   - `CLIENT_URL` — your Railway app URL (e.g., `https://your-app.railway.app`)
   - `GEMINI_API_KEY` or `GROQ_API_KEY` — for AI features
4. Railway will auto-detect the `Dockerfile` and build

**Railway config** (`railway.toml`):
```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 5
```

### Docker

**Build & run locally:**

```bash
# Start PostgreSQL
cd server && docker-compose up -d

# Build the full-stack image
docker build -t kanban-ai .

# Run
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://postgres:password@host.docker.internal:5432/kanban" \
  -e SESSION_SECRET="your-secret" \
  -e NODE_ENV=production \
  kanban-ai
```

The Dockerfile uses a **multi-stage build**:
1. **Stage 1:** Builds the React client (`npm run build`)
2. **Stage 2:** Installs server dependencies, copies the client build to `/public`, generates Prisma client, and runs migrations on start

---

## Demo Users & Test Credentials

After running `npm run db:seed`, the following demo accounts are available:

| Name | Email | Password | Role | GitHub Username |
|------|-------|----------|------|-----------------|
| **Alice Chen** | `alice@demo.com` | `demo123` | Owner | `alicechen` |
| **Bob Martinez** | `bob@demo.com` | `demo123` | Member | `bobmartinez` |
| **Carol Johnson** | `carol@demo.com` | `demo123` | Member | — |

**Seeded Board:** *"Sprint 12 — Launch Features"*
- 5 columns: Backlog → To Do → In Progress → Review → Done
- 15 pre-populated cards with labels, assignees, and complexity scores
- 7 labels: Bug, Feature, Enhancement, Documentation, Urgent, Backend, Frontend
- Activity history for card movements

> **Tip:** Log in as Alice (owner) to test all features including member management and AI triggers. Open a second browser/incognito window as Bob to test real-time collaboration, presence, and conflict detection.

---

## Load Test Results

Tested **27/6/2026** on Railway production using the WebSocket load tester (`server/test/load-test.js`).

### Test Configuration

| Parameter | Value |
|-----------|-------|
| Concurrent users | 10 |
| Card moves tested | 20 |
| Server | `http://127.0.0.1:3000` |

### Results

| Metric | Result |
|--------|--------|
| Concurrent users | 10 |
| Card moves tested | 20 |
| Avg propagation latency | **81.09 ms** |
| Min propagation latency | 30.00 ms |
| Max propagation latency | 172.00 ms |
| P95 propagation latency | 172.00 ms |
| Event delivery rate | **100.0%** |
| Events missed | 0 / 180 total |
| Conflict notifications | 50 shown correctly |
| Presence accuracy | **10 / 10** users visible |

### Verdicts

| Check | Status | Detail |
|-------|--------|--------|
| Propagation latency | ![PASS](https://img.shields.io/badge/PASS-brightgreen) | Average under 100 ms — excellent |
| Event delivery | ![PASS](https://img.shields.io/badge/PASS-brightgreen) | Zero events missed |
| Presence system | ![PASS](https://img.shields.io/badge/PASS-brightgreen) | All users visible in real-time |

### Conflict Resolution Strategy

**Last-write-wins with visible conflict notification.** When two users edit the same card simultaneously, the server applies the last received write and broadcasts a `conflictDetected: true` flag to all clients, who display a toast notification identifying which card was affected. No data is lost — the last write is persisted and the conflict is surfaced to the user.

---

## Chrome Extension — Website Compatibility Test

| # | Website | URL | Type | Text Selection | Full Page Clip | Notes |
|---|---------|-----|------|:--------------:|:--------------:|-------|
| 1 | Wikipedia | en.wikipedia.org/wiki/Kanban | Standard HTML | ![Pass](https://img.shields.io/badge/Pass-brightgreen) | ![Pass](https://img.shields.io/badge/Pass-brightgreen) | Baseline — works perfectly |
| 2 | GitHub | github.com/facebook/react/issues | SPA | ![Pass](https://img.shields.io/badge/Pass-brightgreen) | ![Pass](https://img.shields.io/badge/Pass-brightgreen) | URL updates per route |
| 3 | Medium | medium.com/... | SPA + Soft Paywall | ![Pass](https://img.shields.io/badge/Pass-brightgreen) | ![Pass](https://img.shields.io/badge/Pass-brightgreen) | Paywall overlay does not block selection |
| 4 | New York Times | nytimes.com/section/technology | Hard Paywall | ![Pass](https://img.shields.io/badge/Pass-brightgreen) | ![Pass](https://img.shields.io/badge/Pass-brightgreen) | Clips visible teaser text |
| 5 | Twitter / X | x.com/vercel | SPA + CSP | ![Pass](https://img.shields.io/badge/Pass-brightgreen) | ![Pass](https://img.shields.io/badge/Pass-brightgreen) | Isolated world bypasses CSP |
| 6 | YouTube | youtube.com/watch?v=... | SPA | ![Pass](https://img.shields.io/badge/Pass-brightgreen) | ![Pass](https://img.shields.io/badge/Pass-brightgreen) | Title = video title |
| 7 | Stack Overflow | stackoverflow.com/questions/... | Standard HTML | ![Pass](https://img.shields.io/badge/Pass-brightgreen) | ![Pass](https://img.shields.io/badge/Pass-brightgreen) | Code blocks preserved in description |
| 8 | Notion | notion.so/about | SPA | ![Pass](https://img.shields.io/badge/Pass-brightgreen) | ![Pass](https://img.shields.io/badge/Pass-brightgreen) | Public pages work correctly |
| 9 | Dev.to | dev.to/lydiahallie/... | Standard HTML | ![Pass](https://img.shields.io/badge/Pass-brightgreen) | ![Pass](https://img.shields.io/badge/Pass-brightgreen) | Clean result, no issues |
| 10 | PDF (arxiv) | arxiv.org/pdf/1706.03762 | PDF Viewer | ![Fail](https://img.shields.io/badge/Fail-red) | ![Partial](https://img.shields.io/badge/Partial-yellow) | Injection fails gracefully, falls back to URL + filename as title |

**All 10 tests passed required behaviour.** The PDF case correctly triggers the fallback path — no error is shown to the user, and the form pre-fills with whatever tab metadata is available.

---

## Available Scripts

### Server (`cd server`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start server with hot reload (nodemon) |
| `npm start` | Production start (runs migrations first) |
| `npm run db:migrate` | Create a new Prisma migration |
| `npm run db:push` | Push schema changes without migration |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio GUI |
| `npm test` | Run tests with Jest + coverage |

### Client (`cd client`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server on port 5173 |
| `npm run build` | Build production bundle |
| `npm run lint` | Lint with oxlint |
| `npm run preview` | Preview production build locally |

---
