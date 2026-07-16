# NOVA CLASS — AI Education Platform
> **K.MATE**: Korean TOPIK II AI Tutor · Built by Thine Htike Aung + Victoria

---

## 🗺️ Project Overview

NOVA CLASS is a full-stack AI education platform. Its flagship feature is **K.MATE** — an AI-powered Korean language tutor that helps foreign students prepare for the TOPIK II exam using RAG (Retrieval-Augmented Generation) with official past papers.

### Architecture (3 services)

```
React.js (port 5173)
     │  Axios + JWT
     ▼
Node.js / Express (port 3000)  ←──→  MySQL (217.142.136.244:3307)
     │  HTTP / Axios
     ▼
Python FastAPI (port 8082)
     ├── Google Gemini 2.5 Flash Lite  (LLM answers)
     ├── ChromaDB (217.142.136.244:8001)  (RAG vector search)
     └── SentenceTransformer (multilingual MiniLM)  (embeddings)
```

---

## 📁 Repo Structure

```
nova-class-frontend/        ← THIS repo (React.js)
├── CLAUDE.md               ← You are here
├── src/
│   ├── App.jsx             ← Router + ProtectedRoute
│   ├── index.css           ← Global styles & CSS variables
│   ├── services/
│   │   └── api.js          ← Axios instance (auto-attaches JWT)
│   ├── components/
│   │   └── Sidebar.jsx     ← Fixed left nav (240px)
│   └── pages/
│       ├── Login.jsx       ← Split layout: blue left / white right
│       ├── Dashboard.jsx   ← Stats + Classes grid + Calendar
│       ├── KMate.jsx       ← Chat interface + Practice Quiz mode
│       ├── Exam.jsx        ← Timed exam: home→settings→exam→results
│       ├── Classroom.jsx   ← Course cards with progress bars
│       └── Settings.jsx    ← Profile / preferences / password

nova-api/                   ← Separate repo (Node.js backend)
├── src/
│   ├── config/db.js        ← MySQL connection pool (mysql2)
│   ├── middleware/auth.js  ← JWT protect middleware
│   ├── controllers/
│   │   ├── authController.js     ← register / login
│   │   ├── kmateController.js    ← ask / getHistory / generateQuiz / checkQuiz
│   │   ├── progressController.js ← dashboard stats
│   │   └── quizController.js     ← quiz history
│   └── routes/
│       ├── auth.js         ← POST /api/auth/register, /api/auth/login
│       ├── kmate.js        ← POST /api/kmate/ask, /quiz/generate, /quiz/check
│       ├── progress.js     ← GET  /api/progress/summary
│       └── quiz.js         ← GET  /api/quiz/history

nova_rag/                   ← Separate repo (Python AI service)
└── scripts/
    ├── ai_service.py       ← FastAPI: /ask, /quiz/generate, /quiz/check
    ├── embed_store.py      ← PDF → chunks → embeddings → ChromaDB
    ├── load_data.py        ← Load TOPIK PDF data
    ├── create_tables.py    ← MySQL table setup
    └── db.py               ← DB connection helper
```

---

## 🚀 How to Run Locally

### 1. Python AI Service
```bash
cd nova_rag
source .venv/bin/activate
python scripts/ai_service.py
# → Runs on http://localhost:8082
# Wait for "AI Service ready (XXXX chunks loaded)"
```

### 2. Node.js API
```bash
cd nova-api
npm install
node src/index.js
# → Runs on http://localhost:3000
```

### 3. React Frontend
```bash
cd nova-class-frontend
npm install
npm run dev
# → Runs on http://localhost:5173
```

> ⚠️ **Start order matters**: Python AI Service → Node.js → React

---

## 🌐 API Endpoints

### Python AI Service (`localhost:8082`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| POST | `/ask` | `{ question }` → `{ answer }` |
| POST | `/quiz/generate` | `{ topic, count }` → `{ questions[] }` |
| POST | `/quiz/check` | `{ questions[], answers[], language }` → `{ score, explanation }` |

### Node.js REST API (`localhost:3000/api`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | ❌ | Create account |
| POST | `/auth/login` | ❌ | Login → JWT token |
| POST | `/kmate/ask` | ✅ | Send question to K.MATE |
| GET | `/kmate/history` | ✅ | Chat history (last 20) |
| POST | `/kmate/quiz/generate` | ✅ | Generate quiz questions |
| POST | `/kmate/quiz/check` | ✅ | Check answers + explanations |
| GET | `/progress/summary` | ✅ | Dashboard stats |

**Auth header**: `Authorization: Bearer <token>`

---

## 🎨 Frontend Design Rules

### CSS Variables (defined in `index.css`)
```css
--primary:    #3B37CC   /* main brand blue-purple */
--purple:     #7C3AED   /* accent purple */
--success:    #10B981   /* green */
--warning:    #F59E0B   /* orange */
--danger:     #EF4444   /* red */
--gray-50:    #F9FAFB
--gray-100:   #F3F4F6
--text:       #1a1a2e
--text-light: #6b7280
```

### Fonts (loaded via Google Fonts)
- `Inter` — UI text
- `Noto Sans KR` — Korean text
- `Noto Sans Myanmar` — Burmese text

### Layout Pattern
```
┌─────────────┬─────────────────────────────┐
│             │                             │
│  Sidebar    │   Page Content              │
│  (240px)    │   (margin-left: 240px)      │
│  fixed      │                             │
└─────────────┴─────────────────────────────┘
```
Every page (except Login) includes `<Sidebar />` + a content div with `marginLeft: "240px"`.

### Authentication Flow
```
Login page → POST /api/auth/login
          → save token as "nova_token" in localStorage
          → save name  as "nova_name" in localStorage
          → navigate to "/"

ProtectedRoute → checks localStorage.getItem("nova_token")
              → if missing → redirect to /login

Logout → remove nova_token + nova_name → navigate to /login
```

---

## 🗄️ Database Schema (MySQL)

```sql
-- Users
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100),
  email         VARCHAR(100) UNIQUE,
  password_hash VARCHAR(255),
  topik_level   INT DEFAULT 0,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat history
CREATE TABLE chat_history (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT,
  question   TEXT,
  answer     TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Quiz results
CREATE TABLE quiz_results (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT,
  score           INT,
  total_questions INT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 🤖 K.MATE AI Logic

### RAG Flow
```
User question
    → SentenceTransformer.encode()   (multilingual embedding)
    → ChromaDB.query(n_results=5)    (semantic search in TOPIK data)
    → context (top 5 chunks)
    → Gemini prompt with context
    → answer
```

### TOPIK Data Loaded (ChromaDB `topik_collection`)
- 83rd TOPIK II exam
- 91st TOPIK II exam
- 96th TOPIK II exam
- 102nd TOPIK II exam

### Language Support
K.MATE auto-detects question language and replies in the **same language**:
- 🇬🇧 English
- 🇰🇷 한국어 (Korean)
- 🇲🇲 မြန်မာဘာသာ (Burmese)

---

## 📝 Quiz System

### Question Format (from AI)
```json
{
  "q": "책을 많이 ( ) 지식을 쌓을 수 있다",
  "opts": ["읽으면", "읽어서", "읽지만", "읽는데"],
  "ans": 1,
  "section": "grammar"
}
```
> ⚠️ `ans` is **1-based** (1=first option, not 0)

### Sections
- `grammar` — Korean grammar patterns
- `vocabulary` — Korean vocabulary
- `reading` — Reading comprehension

---

## 🔑 Environment Variables

### nova-api `.env`
```
PORT=3000
GEMINI_API_KEY=your_key_here
MYSQL_HOST=217.142.136.244
MYSQL_PORT=3307
MYSQL_USER=your_user
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=nova_class
CHROMA_HOST=217.142.136.244
CHROMA_PORT=8001
JWT_SECRET=your_jwt_secret
```

### nova_rag `.env`
```
GEMINI_API_KEY=your_key_here
CHROMA_HOST=217.142.136.244
CHROMA_PORT=8001
```

---

## ⚙️ Key Implementation Notes

### Text Rendering (KMate.jsx)
K.MATE responses use **markdown** (`**bold**`, `\n` newlines).
Use `formatText()` to convert before rendering with `innerHTML`:
```js
function formatText(text) {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");
}
// Usage: element.innerHTML = formatText(answer)
```

### JWT Token Usage
```js
// api.js already handles this automatically via interceptor
// Just call API.post("/kmate/ask", { question }) — token auto-attached
```

### Quiz Answer Submission
```js
// answers array is 1-based to match "ans" field
const answers = [1, 3, 2, 4, 1]; // user's choices (1=first option)
await API.post("/kmate/quiz/check", { questions, answers, language: "English" });
```

---

## 🚧 Planned Features (Not Yet Built)

| Feature | Status |
|---------|--------|
| Attendance Management | 🔲 Planned |
| AI Auto Summary (lecture notes) | 🔲 Planned |
| Mobile App | 🔲 Planned |
| Progress Analytics Charts | 🔲 Planned |
| Teacher Dashboard | 🔲 Planned |
| More TOPIK Papers (past 102nd) | 🔲 Planned |

---

## 👥 Team

| Role | Name |
|------|------|
| Lead Developer / Backend | Thine Htike Aung |
| Frontend Developer | Victoria |

**Institution**: 전주비전대학교 (Jeonju Vision University)  
**Project**: 혁신지원사업 2026 — D-MIX Contest submission

---

## 💬 Contact / Notes

- Ask Thine for `.env` credentials (never commit them)
- Python AI service takes ~30 seconds to load on first start (downloading model weights)
- ChromaDB and MySQL live on VPS `217.142.136.244` — must be connected to run
- Gemini API key has usage limits — use `gemini-2.5-flash-lite` (cheapest model)
