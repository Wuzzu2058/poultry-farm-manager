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
app.use(express.json());

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
    const text = data.choices?.[0]?.message?.content || "No response from AI.";
    res.json({ text });
  } catch (e) {
    console.error("AI Proxy Error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Catch-all route to serve the web app's home page for any other request
app.use((req, res) => {
  res.sendFile(path.join(WEB_DIR, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log("-----------------------------------------");
  console.log(`POULTRY LOCAL SERVER RUNNING ON PORT ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
  console.log("-----------------------------------------");
});
