const express = require("express");
const router = express.Router();

// Input validation
const MAX_TEXT_LENGTH = 5000;
const validateInput = (text) => {
  if (!text || typeof text !== "string") {
    return { valid: false, error: "Text is required and must be a string" };
  }
  if (text.trim().length === 0) {
    return { valid: false, error: "Text cannot be empty" };
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return { valid: false, error: `Text exceeds maximum length of ${MAX_TEXT_LENGTH}` };
  }
  return { valid: true };
};

// Cache for credibility scores (in-memory, simple)
const credibilityCache = new Map();
const CACHE_TTL = 3600000; // 1 hour

const getCachedScore = (hash) => {
  const cached = credibilityCache.get(hash);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  credibilityCache.delete(hash);
  return null;
};

const setCachedScore = (hash, data) => {
  credibilityCache.set(hash, { data, timestamp: Date.now() });
};

// Simple hash function for caching
const hashText = (text) => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
};

// Enhanced Gemini API response parser with detailed breakdown
const parseAIResponse = (text) => {
  try {
    // Extract structured response
    const scoreMatch = text.match(/Score:\s*(\d+)/i);
    const statusMatch = text.match(/Status:\s*(Real|Fake|Unknown)/i);
    const reasonMatch = text.match(/Reason:\s*([^\n]+)/i);
    const detailedAnalysis = text.match(/Detailed Analysis:\s*([\s\S]+?)(?=Score:|$)/i);
    const keyFindingsMatch = text.match(/Key Findings:\s*([\s\S]+?)(?=Score:|$)/i);
    const redFlagsMatch = text.match(/Red Flags:\s*([\s\S]+?)(?=Score:|$)/i);
    const strengthsMatch = text.match(/Strengths:\s*([\s\S]+?)(?=Score:|$)/i);
    const recommendationMatch = text.match(/Recommendation:\s*([^\n]+)/i);

    const score = scoreMatch ? parseInt(scoreMatch[1]) : 50;
    const status = statusMatch ? statusMatch[1].toLowerCase() : "unknown";
    const reason = reasonMatch ? reasonMatch[1].trim() : "Analysis completed";
    
    // Parse key findings
    const keyFindings = keyFindingsMatch 
      ? keyFindingsMatch[1].split('\n').filter(line => line.trim().startsWith('-')).map(line => line.replace(/^-\s*/, '').trim())
      : [];
    
    // Parse red flags
    const redFlags = redFlagsMatch
      ? redFlagsMatch[1].split('\n').filter(line => line.trim().startsWith('-')).map(line => line.replace(/^-\s*/, '').trim())
      : [];
    
    // Parse strengths
    const strengths = strengthsMatch
      ? strengthsMatch[1].split('\n').filter(line => line.trim().startsWith('-')).map(line => line.replace(/^-\s*/, '').trim())
      : [];
    
    const recommendation = recommendationMatch ? recommendationMatch[1].trim() : "Use with caution and verify with primary sources";
    
    // Detailed analysis breakdown
    const breakdown = {
      sourceReliability: calculateMetric(text, "source", score),
      factualAccuracy: calculateMetric(text, "fact", score),
      biasLevel: calculateMetric(text, "bias", score),
      logicalConsistency: calculateMetric(text, "logic", score),
      evidenceQuality: calculateMetric(text, "evidence", score)
    };

    return {
      score: Math.min(100, Math.max(0, score)),
      status: ["real", "fake", "unknown"].includes(status) ? status : "unknown",
      summary: reason,
      detailedAnalysis: detailedAnalysis ? detailedAnalysis[1].trim().substring(0, 500) : reason,
      keyFindings: keyFindings.slice(0, 5),
      redFlags: redFlags.slice(0, 5),
      strengths: strengths.slice(0, 5),
      recommendation: recommendation,
      breakdown: breakdown
    };
  } catch (e) {
    return {
      score: 50,
      status: "unknown",
      summary: "Analysis completed",
      detailedAnalysis: "Analysis could not be fully parsed",
      keyFindings: [],
      redFlags: [],
      strengths: [],
      recommendation: "Please verify with primary sources",
      breakdown: {
        sourceReliability: 50,
        factualAccuracy: 50,
        biasLevel: 50,
        logicalConsistency: 50,
        evidenceQuality: 50
      }
    };
  }
};

// Helper function to calculate metrics from response
const calculateMetric = (text, keyword, baseScore) => {
  const mentions = (text.match(new RegExp(keyword, 'gi')) || []).length;
  if (mentions > 3) return Math.min(100, baseScore + 15);
  if (mentions > 1) return Math.min(100, baseScore + 5);
  return Math.max(0, baseScore - 10);
};

router.post("/analyze", async (req, res) => {
  try {
    const { text, mode = "deep" } = req.body;

    // Validate input
    const validation = validateInput(text);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: "AI service not configured" });
    }

    // Check cache
    const textHash = hashText(text);
    const cachedResult = getCachedScore(textHash);
    if (cachedResult) {
      return res.json({ result: cachedResult, cached: true });
    }

    // Build comprehensive analysis prompt
    const analysisPrompt = buildPrompt(text, mode);

    // Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
        body: JSON.stringify({
          contents: [{ parts: [{ text: analysisPrompt }] }]
        })
      }
    );

    // Handle different HTTP status codes
    if (response.status === 429) {
      return res.status(429).json({ 
        error: "Rate limit exceeded. Please try again later.",
        retryAfter: parseInt(response.headers.get("retry-after") || "60")
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({ error: `AI service error ${response.status}` });
    }

    const data = await response.json();

    // Extract response text
    let aiResponse = null;
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      aiResponse = data.candidates[0].content.parts[0].text;
    }

    if (!aiResponse) {
      return res.status(502).json({ error: "Invalid response from AI service" });
    }

    // Parse the response with detailed breakdown
    const result = parseAIResponse(aiResponse);

    // Cache the result
    setCachedScore(textHash, result);

    res.json({ result, mode });

  } catch (error) {
    if (error.name === "AbortError" || error.code === "ETIMEDOUT") {
      return res.status(504).json({ error: "Analysis timeout - please try again" });
    }
    res.status(500).json({ error: "Failed to analyze credibility" });
  }
});

// Build comprehensive analysis prompt based on mode
const buildPrompt = (text, mode = "deep") => {
  const basePrompt = `You are an expert fact-checker and credibility analyst. Analyze this headline/text for credibility and provide a comprehensive assessment.

TEXT TO ANALYZE:
"${text.substring(0, 2000)}"

Respond in EXACTLY this format with all sections:

Score: <0-100 number>
Status: <Real/Fake/Unknown>
Reason: <brief summary of your assessment>

Key Findings:
- <finding 1>
- <finding 2>
- <finding 3>

Red Flags:
- <concerning element 1>
- <concerning element 2>
- <concerning element 3>

Strengths:
- <credible aspect 1>
- <credible aspect 2>
- <credible aspect 3>

Recommendation: <actionable advice for reader>`;

  if (mode === "factcheck") {
    return basePrompt + `

DEEP FACT-CHECK ANALYSIS:
For each major claim in the headline:
1. Is it verifiable?
2. Are there misleading statistics?
3. Are quotes taken out of context?
4. What logical fallacies are present?`;
  } else if (mode === "comparison") {
    return basePrompt + `

PROVIDE COMPARATIVE ANALYSIS:
Compare this against known credible news standards and fact-checked sources.`;
  } else {
    // Deep mode
    return basePrompt + `

DEEP CREDIBILITY ANALYSIS:
Consider:
1. Source reliability indicators (institutional backing, author credentials)
2. Bias and framing (emotional language, perspective)
3. Logical consistency (contradictions, coherence)
4. Evidence quality (citations, data, expert opinions)
5. Overall coherence and plausibility`;
  }
};

// Quick analyze removed - all modes now use Gemini API
// Old quick-analyze endpoint removed

// Enhanced analyze with mode support
router.post("/analyze-with-mode", async (req, res) => {
  try {
    const { text, mode = "deep" } = req.body;

    // Validate input
    const validation = validateInput(text);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: "AI service not configured" });
    }

    // Check cache
    const textHash = hashText(text);
    const cachedResult = getCachedScore(textHash);
    if (cachedResult) {
      return res.json({ result: cachedResult, mode, cached: true });
    }

    const analysisPrompt = buildPrompt(text, mode);

    // Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
        body: JSON.stringify({
          contents: [{ parts: [{ text: analysisPrompt }] }]
        })
      }
    );

    if (response.status === 429) {
      return res.status(429).json({ 
        error: "Rate limit exceeded. Please try again later.",
        retryAfter: parseInt(response.headers.get("retry-after") || "60")
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({ error: `AI service error ${response.status}` });
    }

    const data = await response.json();
    let aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiResponse) {
      return res.status(502).json({ error: "Invalid AI response" });
    }

    const result = parseAIResponse(aiResponse);
    setCachedScore(textHash, result);
    
    res.json({ result, mode });

  } catch (error) {
    if (error.name === "AbortError" || error.code === "ETIMEDOUT") {
      return res.status(504).json({ error: "Analysis timeout" });
    }
    res.status(500).json({ error: "Analysis failed" });
  }
});

module.exports = router;