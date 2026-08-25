require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Restrict CORS to frontend only
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:5500",
      "http://127.0.0.1:5500"
    ];
    if (NODE_ENV === "development" || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST"],
  credentials: true
};

app.use(cors(corsOptions));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

const newsRoute = require("./routes/news");
const aiRoute = require("./routes/ai");

app.use("/api/news", newsRoute);
app.use("/api/ai", aiRoute);

// Global error handler
app.use((err, req, res, next) => {
  if (NODE_ENV !== "production") {
    console.error("Error:", err.message);
  }
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  if (NODE_ENV !== "production") {
    console.log(`Server running on http://localhost:${PORT}`);
  }
});