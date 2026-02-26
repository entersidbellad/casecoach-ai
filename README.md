# CaseCoach AI

**AI-powered executive decision coaching platform for business case analysis.**

CaseCoach AI simulates a corporate executive team — CEO, CFO, CMO, Chief Medical Officer, and a frontline Employee — that students interact with through a structured coaching pipeline. Built for business school pedagogy, it transforms passive case reading into active, Socratic decision-making practice.

---

## The Problem

Students read business cases and form opinions, but rarely get to pressure-test those opinions against realistic executive pushback. Traditional case discussion is instructor-bottlenecked and hard to scale.

## The Solution

CaseCoach AI provides each student with their own AI-powered executive boardroom. A coaching system evaluates the quality of their reasoning across four dimensions before they ever reach the C-suite, ensuring they've done the analytical work first.

---

## How It Works

### Three-Phase Coaching Pipeline

```
Student submits recommendation
         │
         ▼
┌─────────────────┐
│   1. CLARIFY    │  Intent classification — is this a real recommendation
│                 │  or just a question? Blocks vague/short inputs.
└────────┬────────┘
         ▼
┌─────────────────┐
│   2. CRITIQUE   │  4-dimension rubric scoring + Socratic follow-up:
│                 │  • Problem Framing   • Evidence Use
│                 │  • Tradeoff Quality  • Risk/Compliance
└────────┬────────┘
         ▼
┌─────────────────┐
│  3. DIRECTION   │  Full executive hierarchy unlocked.
│                 │  5 agents respond with Accept/Modify/Reject + reasoning.
│                 │  CEO synthesizes a final recommendation.
└─────────────────┘
```

### Agent Hierarchy

```
                    ┌────────┐
                    │  CEO   │  Final decision-maker
                    └───┬────┘
          ┌─────────────┼─────────────┐
     ┌────┴───┐    ┌────┴───┐    ┌────┴────┐
     │  CFO   │    │  CMO   │    │  CMedO  │  C-suite specialists
     └────────┘    └────────┘    └─────────┘
                    ┌────────┐
                    │Employee│  Frontline perspective
                    └────────┘
```

Each agent has a base persona prompt, augmented with case-specific context (KPIs, goals, red lines) and optional professor overrides.

### 3-Layer Prompt Composition

```
Layer 1: Base system prompt (agent personality + role)
Layer 2: Case context (PDF-extracted text + KPIs + goals + red lines)
Layer 3: Professor directives + per-agent overrides
```

---

## Features

### Student-Facing
- **Coaching chat** with real-time phase progression (Clarify → Critique → Direction)
- **Rubric feedback** with color-coded chips (Weak / Developing / Adequate / Strong)
- **Executive hierarchy** visualization — agents unlock as reasoning improves
- **Credit system** — limited turns force strategic conversation
- **Report generation** — LLM-generated 8-section executive brief
- **Export .md** — download reports as markdown for submission
- **Session reset** — restart coaching with a fresh slate

### Professor-Facing
- **Case management** — upload PDFs, edit KPIs/goals/red lines, set per-agent prompt overrides
- **Assignment creation** — create assignments linked to cases with auto-generated join codes
- **Conversation logs** — view every student message + full agent trace (who said what)
- **Live directives** — inject teaching moments mid-session (e.g., "push students on compliance risk")
- **Analytics dashboard** — average rubric scores, common weak areas, phase distribution, per-student stats

### Platform
- **Toast notifications** — global feedback system for all user actions
- **Responsive design** — works on desktop and tablet
- **No authentication required** — join code system for frictionless student access

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Next.js App Router                   │
├──────────────┬──────────────────────┬───────────────────┤
│  Landing     │  Student Chat       │  Professor        │
│  Page        │  /student/[id]      │  Dashboard        │
│  /           │                     │  /professor       │
│              │                     │  /professor/cases │
├──────────────┴──────────────────────┴───────────────────┤
│                      API Routes                         │
│  /api/chat    /api/report     /api/cases                │
│  /api/join    /api/analytics  /api/assignments          │
│  /api/seed    /api/directives /api/session-reset        │
├─────────────────────────────────────────────────────────┤
│                    Agent Engine                          │
│  ┌──────────┐  ┌────────────┐  ┌──────────────────┐    │
│  │ Intent   │  │ Coaching   │  │ Orchestrator     │    │
│  │Classifier│→ │ Pipeline   │→ │ (5 agents +      │    │
│  │          │  │ (Rubric)   │  │  CEO synthesis)  │    │
│  └──────────┘  └────────────┘  └──────────────────┘    │
├─────────────────────────────────────────────────────────┤
│  LLM Layer (OpenRouter / OpenAI / AI Gateway)           │
├─────────────────────────────────────────────────────────┤
│  SQLite Database (better-sqlite3)                       │
│  Tables: users, cases, assignments, sessions,           │
│          messages, directives, agent_overrides           │
└─────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Database | SQLite via `better-sqlite3` |
| LLM | OpenRouter / OpenAI / AI Gateway |
| Styling | Vanilla CSS (custom design system) |
| PDF Parsing | `pdf-parse` |
| Deployment | Vercel (requires hosted DB migration) |

---

## Project Structure

```
app/
├── api/
│   ├── analytics/       # Professor analytics endpoint
│   ├── assignments/     # CRUD for assignments
│   ├── cases/           # CRUD for cases + agent overrides
│   ├── chat/            # Main coaching pipeline endpoint
│   ├── dashboard/       # Professor dashboard data
│   ├── directives/      # Live teaching directives
│   ├── join/            # Student join via code
│   ├── logs/            # Conversation log viewer
│   ├── messages/        # Message history
│   ├── report/          # Executive brief generation
│   ├── seed/            # Database seeding
│   ├── session-reset/   # Reset student session
│   └── upload-pdf/      # PDF text extraction
├── components/
│   ├── Providers.js     # Client-side context providers
│   └── Toast.js         # Toast notification system
├── lib/
│   ├── agents/
│   │   ├── coaching.js      # 3-phase coaching pipeline
│   │   ├── intent-classifier.js  # LLM intent detection
│   │   ├── llm.js           # Multi-provider LLM caller
│   │   ├── orchestrator.js  # 5-agent parallel execution
│   │   └── prompts.js       # Base agent persona prompts
│   ├── db.js            # Database schema + queries
│   └── pdf-extractor.js # PDF text extraction
├── professor/
│   ├── cases/page.js    # Case management UI
│   └── page.js          # Professor dashboard
├── student/
│   └── [sessionId]/page.js  # Student chat interface
├── globals.css          # Design system
├── layout.js            # Root layout
└── page.js              # Landing page
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- An LLM API key (OpenRouter, OpenAI, or compatible)

### Setup

```bash
# Clone the repo
git clone https://github.com/entersidbellad/casecoach-ai.git
cd casecoach-ai

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local
# Edit .env.local with your API key:
#   LLM_API_KEY=your_api_key_here
#   LLM_BASE_URL=https://openrouter.ai/api/v1  (or your provider)
#   LLM_MODEL=google/gemini-2.0-flash-exp       (or your preferred model)

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The database auto-seeds with a demo case (Apex Health Plan) on first run.

### Quick Start
1. **Professor view** → Enter Dashboard → see pre-loaded assignment with join code `SLYFL2`
2. **Student view** → Enter name + join code → start coaching session
3. Present a recommendation and work through the coaching phases

---

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `LLM_API_KEY` | API key for your LLM provider | `sk-...` |
| `LLM_BASE_URL` | Base URL for the LLM API | `https://openrouter.ai/api/v1` |
| `LLM_MODEL` | Model to use for all agent calls | `google/gemini-2.0-flash-exp` |

---

## License

MIT
