require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const DEFAULT_MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL,
  "gemini-3.1-flash-lite-preview", 
  "gemini-2.5-flash", 
  "gemini-1.5-flash", 
].filter(Boolean);

let resolvedModelName = process.env.GEMINI_MODEL || null;
let modelResolutionPromise = null;

async function resolveModelName() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "Gemini API key is not configured. Please set GEMINI_API_KEY in your .env file."
    );
  }

  if (resolvedModelName) {
    return resolvedModelName;
  }

  if (!modelResolutionPromise) {
    modelResolutionPromise = fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `Unable to list Gemini models (${response.status} ${response.statusText})`
          );
        }

        const payload = await response.json();
        const supportedModels = (payload.models || [])
          .filter((model) =>
            Array.isArray(model.supportedGenerationMethods) &&
            model.supportedGenerationMethods.includes("generateContent")
          )
          .map((model) => model.name.replace(/^models\//, ""));

        const selectedModel = DEFAULT_MODEL_CANDIDATES.find((candidate) =>
          supportedModels.includes(candidate)
        );

        if (!selectedModel) {
          throw new Error(
            `No supported Gemini generateContent model found. Available models: ${supportedModels.join(", ")}`
          );
        }

        resolvedModelName = selectedModel;
        console.log(`🤖 Using Gemini model: ${resolvedModelName}`);
        return resolvedModelName;
      })
      .catch((error) => {
        modelResolutionPromise = null;
        throw error;
      });
  }

  return modelResolutionPromise;
}

async function getModel() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const modelName = await resolveModelName();

  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.1, 
      topP: 0.95,
      maxOutputTokens: 8192, 
      responseMimeType: "application/json", 
    },
  });
}


async function callGemini(prompt, expectJson = true) {
  const model = await getModel();

  try {
    console.log("🔄 Calling Gemini API...");
    const result = await model.generateContent(prompt);
    
    if (!result || !result.response) {
      throw new Error("Invalid response from Gemini API - no response object");
    }

    let text = result.response.text();
    console.log("✅ Gemini responded successfully");
    
    if (!text || text.trim() === "") {
      throw new Error("Gemini returned empty response text");
    }

    if (!expectJson) return text;

    let cleanText = text.replace(/```json/gi, "").replace(/```/g, "").trim();

    try {
      
      const parsed = JSON.parse(cleanText);
      console.log("✅ JSON parsed successfully");
      return parsed;
    } catch (initialError) {
  
      const jsonStart = cleanText.indexOf("{");
      const jsonEnd = cleanText.lastIndexOf("}");

      if (jsonStart !== -1 && jsonEnd !== -1) {
        const potentialJson = cleanText.substring(jsonStart, jsonEnd + 1);
        try {
          const parsedFallback = JSON.parse(potentialJson);
          console.log("✅ JSON extracted and parsed successfully via fallback");
          return parsedFallback;
        } catch (secondaryError) {
          
          console.error("❌ JSON PARSE FAILED. Snippet:", potentialJson.substring(0, 300));
          throw new Error("Gemini returned malformed JSON: " + secondaryError.message);
        }
      }
      
      console.error("❌ RAW GEMINI OUTPUT (No JSON found):", cleanText);
      throw new Error("No valid JSON structure found in Gemini response");
    }

  } catch (err) {
    console.error("❌ Gemini Error:", err.message);
    throw new Error(`Gemini API error: ${err.message}`);
  }
}

async function extractResumeData(resumeText) {
  
  const prompt = `
You are an expert HR analyst and professional resume parser with 15+ years of experience in talent acquisition across the tech industry.

Your task is to perform a DEEP SEMANTIC ANALYSIS of the resume below — not just keyword extraction, but understanding the candidate's full professional profile.

RESUME TEXT:
"""
${resumeText}
"""

Extract and return ONLY a valid JSON object (no markdown, no extra text) with this exact structure:
{
  "personal": {
    "name": "Full name or 'Not specified'",
    "email": "Email or 'Not specified'",
    "phone": "Phone or 'Not specified'",
    "location": "Location or 'Not specified'",
    "linkedin": "LinkedIn URL or null",
    "github": "GitHub URL or null",
    "portfolio": "Portfolio URL or null"
  },
  "summary": "The candidate's professional summary/objective. If not present, generate a concise 2-sentence inferred summary based on their experience.",
  "experience": [
    {
      "company": "Company name",
      "title": "Job title",
      "duration": "Time period",
      "highlights": ["Key achievement or responsibility 1", "..."],
      "impact": "One sentence describing the business impact of this role"
    }
  ],
  "education": [
    {
      "institution": "University/College name",
      "degree": "Degree name",
      "field": "Field of study",
      "year": "Graduation year or expected year",
      "gpa": "GPA if mentioned, else null"
    }
  ],
  "skills": {
    "technical": ["List of technical skills, tools, technologies"],
    "soft": ["List of soft skills inferred from experience and context"],
    "languages": ["Programming languages only"],
    "frameworks": ["Frameworks and libraries"],
    "tools": ["Development tools, platforms, cloud services"]
  },
  "projects": [
    {
      "name": "Project name",
      "description": "What the project does and its significance",
      "technologies": ["Tech used"],
      "impact": "Quantified outcome or learning outcome"
    }
  ],
  "certifications": ["List of certifications or empty array"],
  "totalExperienceYears": 0,
  "seniorityLevel": "Entry/Mid/Senior/Lead/Executive",
  "industryDomain": "Primary domain (e.g., Web Dev, Data Science, DevOps, ML/AI, etc.)",
  "contentQualityScore": {
    "score": 0,
    "comment": "Brief note on resume writing quality, clarity, and completeness"
  }
}

IMPORTANT INSTRUCTIONS:
- Infer soft skills from responsibilities (e.g., 'led a team of 5' → Leadership, Team Management)
- Calculate totalExperienceYears by summing all work experience durations
- Assess seniorityLevel based on years of experience and role titles
- contentQualityScore should be 0–100 based on clarity, quantification, and completeness
- Return ONLY the JSON object, nothing else
- Ensure all double quotes inside string values are properly escaped with a backslash.
`;

  return await callGemini(prompt, true);
}

async function semanticMatch(resumeText, jobDescription) {
  const prompt = `
You are a senior technical recruiter and AI semantic analysis engine specializing in tech hiring.

Your goal is to perform a DEEP SEMANTIC COMPARISON between a candidate's resume and a job description. This is NOT simple keyword matching — you must understand the MEANING and CONTEXT of skills, experiences, and requirements.

SEMANTIC RULES:
- "React.js" and "React" are the same. "Express" and "Express.js" are the same.
- "Team leadership" and "managed a team of 5 engineers" are semantically equivalent.
- Consider implied skills: someone with 3 years of Node.js likely knows npm, REST APIs, async programming.
- A "Full Stack Developer" role implicitly requires problem-solving, debugging, version control.

RESUME:
"""
${resumeText}
"""

JOB DESCRIPTION:
"""
${jobDescription}
"""

Return ONLY a valid JSON object with this exact structure:
{
  "jobTitle": "The role being applied for",
  "jobDomain": "Industry/Domain of the job",
  "matchingSkills": [
    {
      "skill": "Skill name",
      "resumeEvidence": "Where/how this appears in the resume",
      "jobRequirement": "How it appears in the JD",
      "semanticConfidence": "High/Medium/Low",
      "note": "Any nuance about this match"
    }
  ],
  "missingSkills": [
    {
      "skill": "Missing skill name",
      "importance": "Critical/Important/Nice-to-have",
      "jobContext": "Why this matters for the role",
      "learnabilityScore": "1–10 (how easy is this to learn quickly)",
      "recommendation": "How the candidate can address this gap"
    }
  ],
  "partialMatches": [
    {
      "skill": "Skill name",
      "candidateHas": "What the candidate has",
      "jobRequires": "What the JD requires",
      "gap": "What is missing to fully match"
    }
  ],
  "alignmentReasoning": "A 3–4 sentence paragraph explaining the overall semantic fit between this candidate and the role. Be specific about strengths and weaknesses.",
  "cultureFitIndicators": ["List of signals that suggest culture/role fit"],
  "redFlags": ["Any concerns a recruiter might have (or empty array if none)"],
  "overallMatchPercentage": 0
}

NOTE: overallMatchPercentage should be calculated considering skill overlap (60%), experience relevance (25%), and domain alignment (15%).
Return ONLY the JSON, no markdown, no extra text.
`;

  return await callGemini(prompt, true);
}

async function generateATSScore(resumeText, jobDescription, matchData) {
  const prompt = `
You are an ATS (Applicant Tracking System) expert and a senior hiring consultant. You have deep knowledge of how enterprise ATS systems like Workday, Greenhouse, Lever, and Taleo evaluate resumes.

Evaluate the following resume against the job description using a MULTI-DIMENSIONAL AI scoring framework.

RESUME:
"""
${resumeText}
"""

JOB DESCRIPTION:
"""
${jobDescription}
"""

SEMANTIC MATCH DATA (already computed):
${JSON.stringify(matchData, null, 2)}

Calculate an ATS score (0–100) using this WEIGHTED RUBRIC:

1. KEYWORD COVERAGE (25 pts): How many required skills/terms from JD appear in resume (semantically)?
2. SEMANTIC RELEVANCE (25 pts): How contextually relevant is the candidate's experience to this role?
3. RESUME STRUCTURE & ATS PARSABILITY (20 pts): Is the resume well-structured for ATS parsing? (sections, formatting, length)
4. EXPERIENCE ALIGNMENT (15 pts): Does the candidate's background match the role level and requirements?
5. CONTENT QUALITY (15 pts): Are achievements quantified? Is language strong and impact-driven?

Return ONLY a valid JSON object:
{
  "totalScore": 0,
  "grade": "A+/A/B+/B/C+/C/D/F",
  "verdict": "Strong Match / Good Match / Average / Below Average / Poor Match",
  "componentScores": {
    "keywordCoverage": { "score": 0, "max": 25, "reasoning": "..." },
    "semanticRelevance": { "score": 0, "max": 25, "reasoning": "..." },
    "resumeStructure": { "score": 0, "max": 20, "reasoning": "..." },
    "experienceAlignment": { "score": 0, "max": 15, "reasoning": "..." },
    "contentQuality": { "score": 0, "max": 15, "reasoning": "..." }
  },
  "scoreExplanation": "A detailed 4–5 sentence explanation of why this specific score was assigned. Reference specific resume content and JD requirements.",
  "atsPassProbability": "High (>70%) / Medium (40–70%) / Low (<40%)",
  "improvementPotential": "How many points could realistically be gained with improvements?",
  "topImprovementActions": [
    "Action 1 that would add the most points",
    "Action 2",
    "Action 3"
  ]
}
Return ONLY JSON, no markdown fences, no extra text.
`;

  return await callGemini(prompt, true);
}

async function improveResume(resumeData, jobDescription) {
  
  const prompt = `
You are a world-class professional resume writer, career coach, and ex-FAANG recruiter with expertise in crafting resumes that beat ATS systems and impress human reviewers.

Your task is to TRANSFORM the candidate's resume content to be more impactful, quantified, and tailored to the target job.

CURRENT RESUME DATA:
${JSON.stringify(resumeData, null, 2)}

TARGET JOB DESCRIPTION:
"""
${jobDescription}
"""

TRANSFORMATION RULES:
1. Apply the STAR method (Situation, Task, Action, Result) to bullet points
2. Add quantification: "Improved performance" → "Improved API response time by 40%"
3. Use strong action verbs: Built, Architected, Engineered, Spearheaded, Optimized
4. Make each bullet show IMPACT: what changed because of this person?
5. Align language with the JD keywords (for ATS) without being dishonest
6. Improve the professional summary to be compelling and role-targeted

Return ONLY a valid JSON object:
{
  "improvedSummary": {
    "before": "Original summary text",
    "after": "Improved, compelling summary targeting this specific role",
    "changeReason": "Why this change makes it stronger"
  },
  "improvedBulletPoints": [
    {
      "context": "Company/Role where this bullet appears",
      "before": "Original bullet point text",
      "after": "Improved bullet point with quantification and impact",
      "improvement": "Specific improvement made (e.g., Added metric, Stronger verb, Added outcome)",
      "starMethod": {
        "action": "What the candidate did",
        "result": "The quantified outcome"
      }
    }
  ],
  "improvedSkillsSection": {
    "before": "Original skills listing",
    "after": "Reorganized, prioritized skills section aligned with JD",
    "changeReason": "Why this ordering/grouping is better"
  },
  "suggestedNewSections": [
    {
      "section": "Section name to add (e.g., 'Key Achievements', 'Technical Projects')",
      "reason": "Why this section would strengthen the resume for this role",
      "content": "Suggested content for this section"
    }
  ],
  "overallImprovementSummary": "3-4 sentence overview of the key transformations made and their expected impact on ATS score and recruiter impression"
}
Return ONLY JSON, no markdown, no extra text.
`;

  return await callGemini(prompt, true);
}

async function generateSuggestions(resumeData, matchData, atsScore) {
  
  const prompt = `
You are a senior career consultant and AI resume strategist. You specialize in helping candidates dramatically improve their job application success rates using data-driven, actionable advice.

Based on the analysis data below, generate HIGHLY SPECIFIC, ACTIONABLE suggestions — not generic advice.

RESUME DATA:
${JSON.stringify(resumeData, null, 2)}

MATCH ANALYSIS:
${JSON.stringify(matchData, null, 2)}

ATS SCORE DATA:
${JSON.stringify(atsScore, null, 2)}

Generate 8–12 specific, prioritized suggestions. Each suggestion must have:
- A clear action title
- Detailed reasoning (WHY this matters)
- HOW to implement it
- Expected impact (how many ATS points or impressions this improves)
- Category tag

Return ONLY a valid JSON object:
{
  "suggestions": [
    {
      "id": 1,
      "title": "Short, specific action title",
      "category": "Skills Gap / Content Quality / Formatting / Missing Metrics / Weak Phrasing / Irrelevant Content / Missing Section / Keyword Optimization",
      "priority": "Critical / High / Medium / Low",
      "currentIssue": "What specifically is wrong or missing right now",
      "reasoning": "WHY this is a problem — what a recruiter or ATS thinks when they see this",
      "howToFix": "Specific, step-by-step instruction on how to fix this",
      "exampleBefore": "Optional: an example of current bad content",
      "exampleAfter": "Optional: how it should look after the fix",
      "expectedImpact": "How this change will improve ATS score or recruiter impression",
      "estimatedAtsPointGain": 0
    }
  ],
  "quickWins": ["3 things the candidate can fix in under 10 minutes for maximum impact"],
  "longTermGoals": ["2–3 skills/experiences to develop over the next 3–6 months"],
  "overallPriorityAdvice": "One paragraph of strategic advice: given limited time, what should this candidate focus on FIRST and WHY?"
}
Return ONLY JSON, no markdown, no extra text.
`;

  return await callGemini(prompt, true);
}

async function generateCoverLetter(resumeData, jobDescription, matchData) {

  const prompt = `
You are a professional cover letter writer and personal branding expert. You write cover letters that feel AUTHENTIC, HUMAN, and COMPELLING — not generic AI-generated text.

Write a personalized cover letter using the candidate's real experience and the specific job requirements.

CANDIDATE PROFILE:
${JSON.stringify(resumeData, null, 2)}

JOB DESCRIPTION:
"""
${jobDescription}
"""

SEMANTIC MATCH DATA (use this to know what to highlight):
${JSON.stringify(matchData, null, 2)}

COVER LETTER WRITING RULES:
1. DO NOT start with "I am writing to apply for..." (overused, boring)
2. Open with a compelling hook that shows genuine enthusiasm and relevant expertise
3. Be specific: reference actual projects, skills, and achievements from the resume
4. Address 2–3 key requirements from the JD with concrete evidence from the resume
5. Show company research: infer what the company values from the JD and align with it
6. Keep it to 3–4 paragraphs, ~350 words
7. End with a confident, specific call-to-action
8. Sound like a REAL PERSON wrote this, not a template

Return ONLY a valid JSON object:
{
  "coverLetter": {
    "subject": "Email subject line for sending the cover letter",
    "salutation": "Dear [Hiring Manager / specific name if inferable]",
    "body": "The complete cover letter body text with paragraph breaks (use \\n\\n between paragraphs)",
    "closing": "Professional closing line",
    "signature": "Candidate's name"
  },
  "writingStrategy": "2–3 sentence explanation of the writing choices made (tone, hooks, structure)",
  "keyPointsHighlighted": ["3–5 specific points from the resume that were woven into the letter"],
  "personalizationScore": "High / Medium / Low — with reason"
}
Return ONLY JSON, no markdown, no extra text.
`;

  return await callGemini(prompt, true);
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runFullAnalysis(resumeText, jobDescription) {
  console.log("🤖 [Gemini] Starting full analysis pipeline...");

  try {
    // Stage 1: Extract structured data from resume
    console.log("🤖 [Gemini] Stage 1: Extracting resume data...");
    const resumeData = await extractResumeData(resumeText);
    await sleep(2000); // 2-second cooldown

    // Stage 2: Semantic matching
    console.log("🤖 [Gemini] Stage 2: Semantic matching...");
    const matchData = await semanticMatch(resumeText, jobDescription);
    await sleep(2000);

    // Stage 3: ATS Score (uses match data as context)
    console.log("🤖 [Gemini] Stage 3: Generating ATS score...");
    const atsScore = await generateATSScore(resumeText, jobDescription, matchData);
    await sleep(2000);

    // Stage 4: Resume improvements
    console.log("🤖 [Gemini] Stage 4: Generating resume improvements...");
    const improvements = await improveResume(resumeData, jobDescription);
    await sleep(2000);

    // Stage 5: Actionable suggestions
    console.log("🤖 [Gemini] Stage 5: Generating AI suggestions...");
    const suggestions = await generateSuggestions(resumeData, matchData, atsScore);

    console.log("✅ [Gemini] Full analysis complete!");

    return {
      resumeData,
      matchData,
      atsScore,
      improvements,
      suggestions,
    };
  } catch (error) {
    console.error("❌ [Gemini] Pipeline Failed:", error.message);
    // Re-throw so the controller can catch it and send a 500 error to the frontend
    throw error; 
  }
}

module.exports = {
  DEFAULT_MODEL_CANDIDATES,
  getActiveModel: () => resolvedModelName,
  extractResumeData,
  semanticMatch,
  generateATSScore,
  improveResume,
  generateSuggestions,
  generateCoverLetter,
  runFullAnalysis,
};
