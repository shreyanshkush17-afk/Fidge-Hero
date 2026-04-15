const path = require("path");
const express = require("express");
const dotenv = require("dotenv");
const nodeFetch = require("node-fetch");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODELS = (process.env.GEMINI_MODELS || "gemini-2.0-flash,gemini-1.5-flash,gemini-1.5-flash-latest")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const fetchApi = globalThis.fetch || nodeFetch;
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

async function getSupportedModels() {
  const listUrl = `${GEMINI_BASE_URL}/models?key=${GEMINI_API_KEY}`;
  const response = await fetchApi(listUrl);
  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  const models = Array.isArray(data?.models) ? data.models : [];

  return models
    .filter((model) => Array.isArray(model.supportedGenerationMethods) && model.supportedGenerationMethods.includes("generateContent"))
    .map((model) => String(model.name || "").replace("models/", ""))
    .filter(Boolean);
}

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.post("/api/recipe", async (req, res) => {
  try {
    const ingredients = Array.isArray(req.body?.ingredients)
      ? req.body.ingredients.map((item) => String(item || "").trim()).filter(Boolean)
      : [];

    if (ingredients.length !== 3) {
      return res.status(400).json({ error: "Please send exactly 3 ingredients." });
    }

    if (!GEMINI_API_KEY) {
      return res
        .status(500)
        .json({ error: "Server is missing GEMINI_API_KEY. Add it in a .env file." });
    }

    const prompt = [
      "Create one simple home recipe using exactly these 3 ingredients:",
      ingredients.join(", "),
      "Return plain text only in this format:",
      "Recipe Name",
      "One short description sentence",
      "1. Step one",
      "2. Step two",
      "3. Step three",
      "4. Step four",
      "5. Step five",
    ].join("\n");

    let recipeText = "";
    let lastError = "Gemini request failed.";
    const discoveredModels = await getSupportedModels();
    const preferredDiscoveredModels = discoveredModels
      .filter((name) => name.includes("flash"))
      .concat(discoveredModels.filter((name) => !name.includes("flash")));
    const modelCandidates = [...new Set([...GEMINI_MODELS, ...preferredDiscoveredModels])];

    for (const model of modelCandidates) {
      const geminiUrl = `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const response = await fetchApi(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        lastError = `Model ${model} failed. ${errorBody}`;
        continue;
      }

      const data = await response.json();
      recipeText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (recipeText) {
        break;
      }
      lastError = `Model ${model} returned empty content.`;
    }

    if (!recipeText) {
      const modelHint =
        modelCandidates.length > 0
          ? `Tried models: ${modelCandidates.join(", ")}`
          : "No supported models were returned by ListModels.";
      return res.status(502).json({ error: `${lastError} ${modelHint}` });
    }

    return res.json({ recipeText });
  } catch (error) {
    return res.status(500).json({ error: `Unexpected server error: ${error.message}` });
  }
});

app.listen(PORT, () => {
  console.log(`Fridge Hero running at http://localhost:${PORT}`);
});
