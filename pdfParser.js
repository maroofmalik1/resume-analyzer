

const pdfParse = require("pdf-parse");

/**
 * Extract text content from a PDF buffer.
 * @param {Buffer} buffer - The PDF file buffer
 * @returns {Promise<string>} - Extracted plain text
 */
async function extractTextFromPDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    const text = data.text
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n") // Collapse excess newlines
      .trim();

    if (!text || text.length < 50) {
      throw new Error(
        "PDF appears to be empty or image-based. Please upload a text-based PDF."
      );
    }

    return {
      text,
      pages: data.numpages,
      wordCount: text.split(/\s+/).length,
      charCount: text.length,
    };
  } catch (err) {
    if (err.message.includes("PDF appears to be")) throw err;
    throw new Error(`Failed to parse PDF: ${err.message}`);
  }
}

/**
 * Basic resume text validation.
 * Checks if the content looks like a real resume.
 */
function validateResumeContent(text) {
  const lowerText = text.toLowerCase();

  // Check for at least some resume-like content
  const resumeIndicators = [
    "experience",
    "education",
    "skills",
    "work",
    "university",
    "college",
    "project",
    "internship",
    "developer",
    "engineer",
    "manager",
    "analyst",
    "degree",
    "bachelor",
    "master",
    "gpa",
    "resume",
    "cv",
  ];

  const found = resumeIndicators.filter((indicator) =>
    lowerText.includes(indicator)
  );

  if (found.length < 2) {
    throw new Error(
      "The uploaded file does not appear to be a resume. Please upload a valid resume PDF or paste resume text."
    );
  }

  if (text.length < 200) {
    throw new Error(
      "Resume content is too short. Please provide a more complete resume."
    );
  }

  return true;
}

module.exports = { extractTextFromPDF, validateResumeContent };
