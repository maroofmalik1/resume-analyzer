/**
 * resumeRoutes.js
 * API route definitions for the AI Resume Analyzer.
 */

const express = require("express");
const multer = require("multer");
const { uploadResume, analyzeResume, generateCoverLetter } = require("./resumeController");

const router = express.Router();

// Multer config: memory storage (no disk writes), 5MB limit, PDF only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are accepted. Please convert your resume to PDF."), false);
    }
  },
});

// Multer error handler middleware
const handleMulterError = (err, req, res, next) => {
  if (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          error: "File too large. Maximum file size is 5MB.",
        });
      }
      return res.status(400).json({ success: false, error: err.message });
    }
    return res.status(400).json({ success: false, error: err.message });
  }
  next();
};

// ─── Routes ────────────────────────────────────────────────────────────────────

/**
 * POST /api/upload-resume
 * Upload PDF resume OR receive paste text
 * Accepts: multipart/form-data (file) OR application/json (resumeText)
 */
router.post(
  "/upload-resume",
  upload.single("resume"),
  handleMulterError,
  uploadResume
);

/**
 * POST /api/analyze
 * Run full AI analysis pipeline
 * Body: { resumeText: string, jobDescription: string }
 */
router.post("/analyze", analyzeResume);

/**
 * POST /api/generate-cover-letter
 * Generate personalized cover letter
 * Body: { resumeText: string, jobDescription: string, resumeData?: object, matchData?: object }
 */
router.post("/generate-cover-letter", generateCoverLetter);

module.exports = router;
