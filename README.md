# 🤖 ResumeIQ — AI Resume Analyzer & Cover Letter Generator

> **3rd-Year Computer Science Generative AI Project**  
> Built with LLM · Node.js + Express · Modern SaaS Frontend

---

| Concept | Where Used |
|---|---|
| **Prompt Engineering** | Role-based, structured prompts with JSON schema enforcement in `geminiService.js` |
| **Context-Aware Generation** | Resume + JD fed together; match data passed between stages to avoid recomputation |
| **Semantic Analysis** | Gemini understands "React.js" = "React" = "frontend component development" |
| **LLM-Based Reasoning** | Every score, suggestion, and improvement includes a chain-of-thought explanation |

---


```
ai-resume-analyzer/
├── backend/
│   ├── server.js                    # Express app entry point
│   ├── .env.example                 # Environment variable template
│   ├── package.json
│   ├── controllers/
│   │   └── resumeController.js      # Request handling & validation
│   ├── routes/
│   │   └── resumeRoutes.js          # API route definitions
│   ├── services/
│   │   └── geminiService.js         # ALL Gemini AI prompts & logic
│   └── utils/
│       └── pdfParser.js             # PDF text extraction
└── frontend/
    └── index.html                   # Complete SaaS UI (single file)
```

---

## ⚙️ Setup Instructions

### Prerequisites
- Node.js v18+ ([download](https://nodejs.org))
- Google Gemini API Key (free at [aistudio.google.com](https://aistudio.google.com/app/apikey))

### 1. Clone / Download the Project
```bash
cd ai-resume-analyzer
```

### 2. Install Backend Dependencies
```bash
cd backend
npm install
```

### 3. Configure Environment Variables
```bash
# In the /backend folder:
cp .env.example .env
```
Open `.env` and add your key:
```
GEMINI_API_KEY=your_actual_gemini_api_key_here
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5000
```

### 4. Start the Server
```bash
# Development (auto-restart on changes)
npm run dev

# Production
npm start
```

### 5. Open the App
Navigate to: **http://localhost:5000**

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Check server & API key status |
| `POST` | `/api/upload-resume` | Upload PDF or paste resume text |
| `POST` | `/api/analyze` | Run full AI analysis pipeline |
| `POST` | `/api/generate-cover-letter` | Generate personalized cover letter |

### Request Examples

**Upload PDF:**
```bash
curl -X POST http://localhost:5000/api/upload-resume \
  -F "resume=@/path/to/resume.pdf"
```

**Analyze:**
```bash
curl -X POST http://localhost:5000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"resumeText": "...", "jobDescription": "..."}'
```

---

## 🧠 Gemini Prompts Used (Examples)

### 1. Resume Extraction Prompt (Semantic Analysis)
```
You are an expert HR analyst and professional resume parser with 15+ years of experience...
Extract and return ONLY a valid JSON object with this exact structure: { personal, experience, skills, education, ... }
- Infer soft skills from responsibilities (e.g., 'led a team of 5' → Leadership)
- Calculate totalExperienceYears by summing all work experience durations
```

### 2. Semantic Matching Prompt
```
You are a senior technical recruiter and AI semantic analysis engine...
SEMANTIC RULES:
- "React.js" and "React" are the same
- Consider IMPLIED skills: someone with 3 years of Node.js likely knows npm, REST APIs
- A "Full Stack Developer" role implicitly requires problem-solving, version control
```

### 3. ATS Score Prompt
```
Evaluate using WEIGHTED RUBRIC:
1. KEYWORD COVERAGE (25 pts) - Semantic, not exact match
2. SEMANTIC RELEVANCE (25 pts) - Context match
3. RESUME STRUCTURE & ATS PARSABILITY (20 pts)
4. EXPERIENCE ALIGNMENT (15 pts)
5. CONTENT QUALITY (15 pts) - Quantification, impact
```

### 4. Resume Improvement Prompt
```
TRANSFORMATION RULES:
1. Apply the STAR method (Situation, Task, Action, Result) to bullet points
2. Add quantification: "Improved performance" → "Improved API response time by 40%"
3. Use strong action verbs: Built, Architected, Engineered, Spearheaded, Optimized
4. Make each bullet show IMPACT
```

### 5. Cover Letter Prompt
```
COVER LETTER WRITING RULES:
1. DO NOT start with "I am writing to apply for..." (overused)
2. Open with a compelling hook showing genuine enthusiasm and expertise
3. Be specific: reference ACTUAL projects and achievements from the resume
4. Sound like a REAL PERSON wrote this, not a template
```

---

## 🎯 How AI is Used in Each Feature

| Feature | AI Role | Gemini Capability |
|---|---|---|
| **Resume Parsing** | Extracts structured JSON from unstructured text | Entity extraction, inference |
| **Semantic Matching** | Understands conceptual equivalents across documents | Cross-document reasoning |
| **ATS Scoring** | Multi-factor weighted scoring with justification | Analytical reasoning |
| **Resume Improvement** | BEFORE→AFTER transformations with STAR method | Text transformation |
| **AI Suggestions** | Prioritized, reasoned recommendations | Chain-of-thought reasoning |
| **Cover Letter** | Personalized, human-like writing from profile | Creative generation |

---

## 🚀 Tech Stack

| Layer | Technology |
|---|---|
| AI Model | Google Gemini 1.5 Flash |
| Backend | Node.js 18+, Express 4 |
| File Parsing | multer (upload), pdf-parse (extraction) |
| Frontend | Vanilla HTML/CSS/JS (zero dependencies) |
| Fonts | Syne (display) + DM Sans (body) |

---



## 📦 Dependencies

```json
{
  "@google/generative-ai": "^0.21.0",
  "cors": "^2.8.5",
  "dotenv": "^16.4.5",
  "express": "^4.18.2",
  "multer": "^1.4.5-lts.1",
  "pdf-parse": "^1.1.1"
}
```

---

*Built for 3rd Year B.Tech CSE — Generative AI Lab Project*
