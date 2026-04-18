

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const resumeRoutes = require("./resumeRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true;

  if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
    return true;
  }

  if (process.env.NODE_ENV !== "production") {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  }

  return false;
}

// ─── Validate Required Environment Variables ──────────────────────────────────
if (!process.env.GEMINI_API_KEY) {
  console.error("❌ FATAL ERROR: GEMINI_API_KEY is not set in .env file");
  console.error("Please create a .env file with: GEMINI_API_KEY=your_key_here");
  process.exit(1);
}

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error(`CORS blocked for origin: ${origin || "unknown origin"}`)
      );
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve frontend static files (index.html is in the same directory)
app.use(express.static(__dirname));

// ─── API Routes ────────────────────────────────────────────────────────────────
app.use("/api", resumeRoutes);

// ─── Health Check ──────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    message: "AI Resume Analyzer API is running",
    version: "1.0.0",
    gemini: process.env.GEMINI_API_KEY ? "configured" : "⚠️ API key missing",
    timestamp: new Date().toISOString(),
  });
});

// Serve frontend for all non-API routes (SPA support) - MUST be before error handler
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ─── Global Error Handler (MUST be last middleware) ────────────────────────────
app.use((err, req, res, next) => {
  console.error("❌ Unhandled Error:", err.message);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal Server Error",
    details: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

// ─── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server running on: http://localhost:${PORT} `);
  console.log(
    `🤖 Gemini API: ${
      process.env.GEMINI_API_KEY ? "✅ Configured" : "❌ Missing key"
    }              `
  );
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}                      `);
});

module.exports = app;
