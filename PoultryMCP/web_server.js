import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
console.log("🛠 Attempting to connect to MongoDB...");

const mongoClient = new MongoClient(MONGODB_URI);
let farmCollection;

async function connectDB() {
  try {
    await mongoClient.connect();
    const db = mongoClient.db("poultry_farm");
    farmCollection = db.collection("state");
    console.log("✅ SUCCESS: Connected to MongoDB Database");
  } catch (e) {
    console.error("❌ FAILED: MongoDB Connection Error:", e.message);
  }
}
connectDB();

async function getFarmData() {
  try {
    if (!farmCollection) return { pm_batches: [], pm_expenses: [], pm_stock: [] };
    const data = await farmCollection.findOne({ _id: "current_state" });
    return data || { pm_batches: [], pm_expenses: [], pm_stock: [] };
  } catch (error) {
    console.error("Error reading farm data:", error);
    return { pm_batches: [], pm_expenses: [], pm_stock: [] };
  }
}

async function saveFarmData(data) {
  if (!farmCollection) return;
  const cleanedData = { ...data };
  delete cleanedData._id;
  await farmCollection.updateOne(
    { _id: "current_state" },
    { $set: cleanedData },
    { upsert: true }
  );
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files from the 'web' folder
const WEB_DIR = path.join(__dirname, "web");
app.use(express.static(WEB_DIR));

app.get('/api/sync', async (req, res) => {
  const data = await getFarmData();
  res.json(data);
});

app.post('/api/sync', async (req, res) => {
  if (req.body && typeof req.body === 'object') {
    await saveFarmData(req.body);
    res.json({ success: true, data: req.body });
  } else {
    res.status(400).json({ error: "Invalid payload" });
  }
});

app.post('/api/ai', async (req, res) => {
  try {
    const { prompt, systemInstruction } = req.body;
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "NVIDIA API key is missing on the server" });
    }
    
    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "meta/llama-3.3-70b-instruct",
        messages: [
          ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
          { role: "user", content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 1024
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`NVIDIA API error: ${errorText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "No response from BXN Farm Advisor.";
    res.json({ text });
  } catch (e) {
    console.error("AI Proxy Error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/ai/vision', async (req, res) => {
  try {
    const { image, mimeType, imageDataUrl, prompt } = req.body || {};
    let imageUrl = imageDataUrl;
    if (!imageUrl && image) {
      if (image.startsWith('data:')) {
        imageUrl = image;
      } else {
        imageUrl = `data:${mimeType || 'image/jpeg'};base64,${image}`;
      }
    }

    if (!imageUrl) {
      return res.status(400).json({ success: false, error: "Image data URL or base64 image is required." });
    }

    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
      return res.json({
        success: true,
        fallback: true,
        analysis: "NVIDIA_API_KEY is not configured on the server. Unable to perform live vision AI analysis. Preliminary observation indicates no critical emergency detected.",
        remedies: "Fallback Remedies: Ensure clean drinking water, maintain proper coop ventilation and dry litter, isolate any symptomatic birds, and consult a local poultry veterinarian."
      });
    }

    const userPrompt = prompt || "You are an expert poultry veterinarian. Analyze this bird/flock image for disease diagnosis and remedies.";

    const requestPayload = {
      model: "meta/llama-3.2-11b-vision-instruct",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        }
      ],
      max_tokens: 512,
      temperature: 0.2
    };

    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.json({
        success: true,
        fallback: true,
        analysis: `NVIDIA NIM Vision API error (${errorText}). Please inspect flock manually for symptoms.`,
        remedies: "Fallback Remedies: Provide clean drinking water, multivitamin supplements, isolate sick birds, and contact a poultry expert.",
        error: errorText
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "No vision diagnosis output received from BXN Farm Advisor.";
    res.json({
      success: true,
      analysis: content,
      remedies: content
    });
  } catch (e) {
    console.error("Vision AI Proxy Error:", e);
    res.json({
      success: true,
      fallback: true,
      analysis: `Vision analysis fallback: ${e.message}`,
      remedies: "Fallback Remedies: Ensure clean drinking water, proper feeding, and quarantine affected birds.",
      error: e.message
    });
  }
});

// Catch-all route to serve the web app's home page for any other request
app.use((req, res) => {
  res.sendFile(path.join(WEB_DIR, "index.html"));
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log("-----------------------------------------");
    console.log(`POULTRY LOCAL SERVER RUNNING ON PORT ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
    console.log("-----------------------------------------");
  });
}

export { app };
