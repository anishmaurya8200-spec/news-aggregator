require("dotenv").config();

const testGemini = async () => {
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  console.log("Testing Gemini API...");
  console.log("API Key:", apiKey ? "✓ Loaded" : "✗ Missing");
  console.log("URL:", url.substring(0, 80) + "...");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Is this news real or fake: Breaking news about AI" }] }]
      })
    });

    console.log("\nResponse Status:", response.status);
    console.log("Response Headers:", {
      "content-type": response.headers.get("content-type"),
      "retry-after": response.headers.get("retry-after")
    });

    const data = await response.json();
    console.log("\nResponse Data:");
    console.log(JSON.stringify(data, null, 2));

    if (response.status === 429) {
      console.log("\n❌ RATE LIMITED: Free tier limit might be exceeded");
    } else if (data.error) {
      console.log("\n❌ API ERROR:", data.error.message);
    } else if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.log("\n✅ SUCCESS: API is working");
      console.log("Response text:", data.candidates[0].content.parts[0].text.substring(0, 200) + "...");
    } else {
      console.log("\n⚠️  UNEXPECTED RESPONSE FORMAT");
    }
  } catch (error) {
    console.log("\n❌ ERROR:", error.message);
  }

  process.exit(0);
};

testGemini();
