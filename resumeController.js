/**
 * resumeController.js
 * Handles request validation, file parsing, and orchestrates AI analysis.
 */

const { extractTextFromPDF, validateResumeContent } = require("./pdfParser");
const geminiService = require("./geminiService");

// ─── Upload & Parse Resume ─────────────────────────────────────────────────────
const uploadResume = async (req, res) => {
  try {
    let resumeText = "";

    // Case 1: PDF file uploaded via multer
    if (req.file) {
      console.log(`📄 Processing uploaded PDF: ${req.file.originalname}`);
      const parsed = await extractTextFromPDF(req.file.buffer);
      resumeText = parsed.text;
      validateResumeContent(resumeText);

      return res.json({
        success: true,
        message: "Resume parsed successfully",
        data: {
          resumeText,
          metadata: {
            fileName: req.file.originalname,
            fileSize: `${(req.file.size / 1024).toFixed(1)} KB`,
            pages: parsed.pages,
            wordCount: parsed.wordCount,
          },
        },
      });
    }

    // Case 2: Plain text pasted directly
    if (req.body.resumeText) {
      resumeText = req.body.resumeText.trim();
      validateResumeContent(resumeText);

      return res.json({
        success: true,
        message: "Resume text received successfully",
        data: {
          resumeText,
          metadata: {
            fileName: "Pasted text",
            wordCount: resumeText.split(/\s+/).length,
          },
        },
      });
    }

    return res.status(400).json({
      success: false,
      error: "No resume provided. Please upload a PDF or paste resume text.",
    });
  } catch (err) {
    console.error("❌ uploadResume error:", err.message);
    res.status(400).json({ success: false, error: err.message });
  }
};

// ─── Full Analysis Pipeline ────────────────────────────────────────────────────
const analyzeResume = async (req, res) => {
  try {
    const { resumeText, jobDescription } = req.body;

    // Validation
    if (!resumeText || resumeText.trim().length < 100) {
      return res.status(400).json({
        success: false,
        error: "Resume text is too short or missing. Please provide a complete resume.",
      });
    }

    if (!jobDescription || jobDescription.trim().length < 50) {
      return res.status(400).json({
        success: false,
        error:
          "Job description is too short. Please provide a complete job description for accurate analysis.",
      });
    }

    console.log("🚀 Starting AI analysis pipeline...");
    const startTime = Date.now();

    let analysis;
    try {
      analysis = await geminiService.runFullAnalysis(
        resumeText.trim(),
        jobDescription.trim()
      );
    } catch (analysisErr) {
      console.error("❌ Analysis error:", analysisErr);
      return res.status(500).json({
        success: false,
        error: `Analysis failed: ${analysisErr.message || 'Unknown error'}`,
      });
    }

    if (!analysis) {
      console.error("❌ Analysis returned null/undefined");
      return res.status(500).json({
        success: false,
        error: "Analysis returned empty data. Please try again.",
      });
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Analysis complete in ${duration}s`);

    res.json({
      success: true,
      message: "Analysis complete",
      data: analysis,
      meta: {
        processingTime: `${duration}s`,
        model: geminiService.getActiveModel(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("❌ analyzeResume error:", err);
    console.error("Stack:", err.stack);
    res.status(500).json({
      success: false,
      error: err.message.includes("API key")
        ? "Gemini API key is invalid or missing. Please check your .env file."
        : `Analysis failed: ${err.message}`,
    });
  }
};

// ─── Cover Letter Generation ───────────────────────────────────────────────────
const generateCoverLetter = async (req, res) => {
  try {
    const { resumeText, jobDescription, resumeData, matchData } = req.body;

    if (!resumeText || !jobDescription) {
      return res.status(400).json({
        success: false,
        error: "Both resume and job description are required.",
      });
    }

    console.log("✍️ Generating personalized cover letter...");
    const startTime = Date.now();

    // If resumeData/matchData not passed, extract them fresh
    let parsedResume = resumeData;
    let parsedMatch = matchData;

    if (!parsedResume) {
      parsedResume = await geminiService.extractResumeData(resumeText);
    }
    if (!parsedMatch) {
      parsedMatch = await geminiService.semanticMatch(resumeText, jobDescription);
    }

    const coverLetter = await geminiService.generateCoverLetter(
      parsedResume,
      jobDescription,
      parsedMatch
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Cover letter generated in ${duration}s`);

    res.json({
      success: true,
      message: "Cover letter generated successfully",
      data: coverLetter,
      meta: {
        processingTime: `${duration}s`,
        model: geminiService.getActiveModel(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("❌ generateCoverLetter error:", err.message);
    res.status(500).json({
      success: false,
      error: `Cover letter generation failed: ${err.message}`,
    });
  }
};

module.exports = { uploadResume, analyzeResume, generateCoverLetter };
