const express = require("express");
const axios = require("axios");

const router = express.Router();

// Category keywords for classification
const CATEGORY_KEYWORDS = {
  technology: ["ai", "tech", "software", "app", "digital", "cyber", "data", "cloud", "gadget", "phone", "computer"],
  health: ["health", "medical", "disease", "hospital", "doctor", "vaccine", "covid", "mental", "fitness", "nutrition"],
  politics: ["election", "parliament", "minister", "government", "bill", "policy", "political", "vote", "congress", "senate"],
  science: ["science", "research", "study", "scientist", "discovery", "physics", "space", "astronaut", "nasa", "quantum"],
  economy: ["economy", "stock", "market", "business", "finance", "trade", "gdp", "inflation", "corporate", "investment"],
  world: ["world", "international", "global", "foreign", "diplomacy", "united nations", "embassy", "country"]
};

// Classify article into category based on keywords
function classifyArticle(title = "", description = "") {
  const text = `${title} ${description}`.toLowerCase();
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return category;
      }
    }
  }
  
  return "general";
}

// Known reputable news sources
const REPUTABLE_SOURCES = [
  "BBC", "Reuters", "AP", "Guardian", "NPR", "Times",
  "Hindu", "Indian Express", "Telegraph", "Hindustan Times",
  "NDTV", "CNN", "Bloomberg", "Financial Times", "Washington Post",
  "New York Times", "TechCrunch", "Verge", "Nature", "Science Daily",
  "Dawn", "Tribune", "Deccan Herald", "Business Today", "Mint",
  "DNA", "Mid Day", "Yahoo", "Google News", "Fox News"
];

// Random credibility assignment with weighted probability (60% verified, 20% caution, 20% fake)
function assignRandomCredibility() {
  const random = Math.random() * 100;
  
  if (random < 60) {
    // 60% - Verified
    return { status: "real", score: 75 };
  } else if (random < 80) {
    // 20% - Caution
    return { status: "unknown", score: 50 };
  } else {
    // 20% - Likely False
    return { status: "fake", score: 25 };
  }
}

router.get("/", async (req, res) => {
  try {
    if (!process.env.NEWS_API_KEY) {
      return res.status(500).json({ error: "NEWS_API_KEY not configured" });
    }

    const query = String(req.query.q || "india").trim() || "india";
    const encodedQuery = encodeURIComponent(query);
    const response = await axios.get(
      `https://newsapi.org/v2/everything?q=${encodedQuery}&language=en&sortBy=publishedAt&apiKey=${process.env.NEWS_API_KEY}`,
      { timeout: 10000 }
    );

    if (!response.data || !response.data.articles) {
      return res.status(500).json({ error: "Invalid response from news API" });
    }

    const formatted = response.data.articles.map((a) => {
      const credibility = assignRandomCredibility();  // Random: Verified, Caution, or Likely False
      return {
        title: String(a.title || "").trim(),
        desc: String(a.description || "").trim(),
        source: String(a.source?.name || "Unknown Source").trim(),
        image: String(a.urlToImage || "").trim(),
        url: String(a.url || "").trim(),
        time: "just now",
        cat: classifyArticle(a.title, a.description),
        cred: credibility.score,
        credStatus: credibility.status
      };
    }).filter(a => a.title && a.desc).slice(0, 30);  // Limit to 30 articles

    res.json(formatted);

  } catch (error) {
    const statusCode = error.response?.status || 500;
    const errorMsg = error.response?.data?.message || error.message || "Error fetching news";
    res.status(statusCode).json({ error: errorMsg });
  }
});

module.exports = router;