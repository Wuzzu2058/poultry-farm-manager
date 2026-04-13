import { Telegraf, session, Scenes, Markup } from "telegraf";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MongoDB Cloud Configuration
const mongoClient = new MongoClient(process.env.MONGODB_URI || "mongodb://localhost:27017");
let farmCollection;

async function connectDB() {
  try {
    await mongoClient.connect();
    const db = mongoClient.db("poultry_farm");
    farmCollection = db.collection("state");
    console.log("Connected to MongoDB Cloud");
  } catch (e) {
    console.error("DB Connection Failed", e);
  }
}
connectDB();


if (!process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN === "ENTER_YOUR_BOTFATHER_TOKEN_HERE") {
  console.error("Please add your Telegram bot token to the .env file.");
  process.exit(1);
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

async function getFarmData() {
  try {
    if (!farmCollection) return { pm_batches: [], pm_expenses: [], pm_stock: [] };
    const data = await farmCollection.findOne({ _id: "current_state" });
    return data || { pm_batches: [], pm_expenses: [], pm_stock: [] };
  } catch (error) {
    return { pm_batches: [], pm_expenses: [], pm_stock: [] };
  }
}

async function saveFarmData(data) {
  if (!farmCollection) return;
  const cleanedData = { ...data };
  delete cleanedData._id; // Ensure we don't try to overwrite _id if it exists
  await farmCollection.updateOne(
    { _id: "current_state" },
    { $set: cleanedData },
    { upsert: true }
  );
}


function generateId() {
  return "BATCH-" + Math.random().toString(36).substr(2, 4).toUpperCase();
}

function getActiveBatches(data) {
  return (data.pm_batches || []).filter(b => !b.archived);
}

// ----------------- MAIN MENU -----------------
function showMainMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📊 Dashboard', 'btn_state')],
    [
      Markup.button.callback('➕ New Batch', 'btn_add'),
      Markup.button.callback('🗄 Archive', 'btn_archive')
    ],
    [
      Markup.button.callback('💀 Mortality', 'btn_mortality'),
      Markup.button.callback('🌾 Feed Log', 'btn_feed')
    ],
    [Markup.button.callback('💸 Record Expense', 'btn_expense')],
    [Markup.button.callback('🧠 Ask Smart Advisor', 'btn_ai')],
    [Markup.button.callback('⚠️ Factory Reset', 'btn_reset')]
  ]);
}

function getProgressBar(current, total) {
  const size = 10;
  const progress = Math.max(0, Math.min(size, Math.round((current / total) * size)));
  return "█".repeat(progress) + "░".repeat(size - progress);
}


// ----------------- SCENES -----------------

// 1. Add Batch Wizard
const addBatchScene = new Scenes.WizardScene('ADD_BATCH_WIZARD',
  (ctx) => { ctx.reply("What is the name of this batch?"); return ctx.wizard.next(); },
  (ctx) => {
    if (!ctx.message || !ctx.message.text) return;
    ctx.wizard.state.bName = ctx.message.text;
    ctx.reply(`Got it. How many birds are in ${ctx.wizard.state.bName}? (Number only)`);
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message || !ctx.message.text) return;
    const qty = parseInt(ctx.message.text, 10);
    if (isNaN(qty)) return ctx.reply("Please type a valid number.");
    
    const data = await getFarmData();
    data.pm_batches = data.pm_batches || [];
    const id = generateId();
    data.pm_batches.push({ id, name: ctx.wizard.state.bName, date: new Date().toISOString().split("T")[0], quantity: qty, mortality: [], stock: [], expenses: [], archived: false });
    await saveFarmData(data);
    
    ctx.reply(`✅ Successfully added batch *${ctx.wizard.state.bName}* with *${qty}* birds!`, { parse_mode: 'Markdown', ...showMainMenu() });
    return ctx.scene.leave();
  }
);

// 2. Mortality Wizard
const mortalityScene = new Scenes.WizardScene('MORTALITY_WIZARD',
  async (ctx) => {
    const active = getActiveBatches(await getFarmData());
    if (active.length === 0) { ctx.reply("No active batches found.", showMainMenu()); return ctx.scene.leave(); }
    const btns = active.map(b => Markup.button.callback(`${b.name} (${b.id})`, `m_${b.id}`));
    ctx.reply("Which batch had the mortality?", Markup.inlineKeyboard(btns, { columns: 1 }));
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.callbackQuery) {
      ctx.wizard.state.sel = ctx.callbackQuery.data.replace('m_', '');
      await ctx.answerCbQuery();
      ctx.reply("How many birds died? (Number only)");
      return ctx.wizard.next();
    }
  },
  async (ctx) => {
    if (!ctx.message || !ctx.message.text) return;
    const count = parseInt(ctx.message.text, 10);
    if (isNaN(count)) return ctx.reply("Number only please!");
    
    const data = await getFarmData();
    const b = data.pm_batches.find(x => x.id === ctx.wizard.state.sel);
    if (!b) return ctx.scene.leave();
    
    b.mortality = b.mortality || [];
    b.mortality.push({ date: new Date().toISOString().split("T")[0], count, cause: "Unknown" });
    await saveFarmData(data);
    ctx.reply(`✅ Recorded *${count}* deaths for *${b.name}*.`, { parse_mode: 'Markdown', ...showMainMenu() });
    return ctx.scene.leave();
  }
);

// 3. Feed Wizard
const feedScene = new Scenes.WizardScene('FEED_WIZARD',
  async (ctx) => {
    const active = getActiveBatches(await getFarmData());
    if (active.length === 0) { ctx.reply("No active batches found.", showMainMenu()); return ctx.scene.leave(); }
    const btns = active.map(b => Markup.button.callback(`${b.name}`, `f_${b.id}`));
    ctx.reply("Which batch received feed today?", Markup.inlineKeyboard(btns, { columns: 1 }));
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.callbackQuery) {
      ctx.wizard.state.sel = ctx.callbackQuery.data.replace('f_', '');
      await ctx.answerCbQuery();
      ctx.reply("How many Bags/KG of feed did you give them? (Number only)");
      return ctx.wizard.next();
    }
  },
  async (ctx) => {
    if (!ctx.message || !ctx.message.text) return;
    const count = parseFloat(ctx.message.text);
    if (isNaN(count)) return ctx.reply("Number only please!");
    
    const data = await getFarmData();
    const b = data.pm_batches.find(x => x.id === ctx.wizard.state.sel);
    if (!b) return ctx.scene.leave();
    
    b.stock = b.stock || [];
    b.stock.push({ date: new Date().toISOString().split("T")[0], type: "Feed", qty: count });
    await saveFarmData(data);
    ctx.reply(`✅ Recorded *${count}* units of feed for *${b.name}*.`, { parse_mode: 'Markdown', ...showMainMenu() });
    return ctx.scene.leave();
  }
);

// 4. Expense Wizard
const expenseScene = new Scenes.WizardScene('EXPENSE_WIZARD',
  (ctx) => { ctx.reply("What did you buy? (e.g. Vaccines, Sawdust)"); return ctx.wizard.next(); },
  (ctx) => {
    if (!ctx.message || !ctx.message.text) return;
    ctx.wizard.state.item = ctx.message.text;
    ctx.reply("How much did it cost? (Number only)");
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message || !ctx.message.text) return;
    const cost = parseFloat(ctx.message.text);
    if (isNaN(cost)) return ctx.reply("Number only please!");
    
    const data = await getFarmData();
    data.pm_expenses = data.pm_expenses || [];
    data.pm_expenses.push({
      id: "EXP-" + Math.random().toString(36).substr(2,5),
      date: new Date().toISOString().split("T")[0],
      item: ctx.wizard.state.item,
      amount: cost
    });
    await saveFarmData(data);
    ctx.reply(`✅ Recorded expense: *${ctx.wizard.state.item}* for 💰*${cost}*.`, { parse_mode: 'Markdown', ...showMainMenu() });
    return ctx.scene.leave();
  }
);

// 5. Archive Wizard
const archiveScene = new Scenes.WizardScene('ARCHIVE_WIZARD',
  async (ctx) => {
    const active = getActiveBatches(await getFarmData());
    if (active.length === 0) { ctx.reply("No active batches found to archive.", showMainMenu()); return ctx.scene.leave(); }
    const btns = active.map(b => Markup.button.callback(`${b.name}`, `a_${b.id}`));
    ctx.reply("Which batch is completely sold out and ready to archive?", Markup.inlineKeyboard(btns, { columns: 1 }));
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.callbackQuery) {
      ctx.wizard.state.sel = ctx.callbackQuery.data.replace('a_', '');
      await ctx.answerCbQuery();
      ctx.reply("Are you sure you want to archive this batch? It will be hidden from the main menu.",
        Markup.inlineKeyboard([ Markup.button.callback('Yes, Archive', 'y'), Markup.button.callback('Cancel', 'n') ])
      );
      return ctx.wizard.next();
    }
  },
  async (ctx) => {
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
      if (ctx.callbackQuery.data === 'y') {
        const data = await getFarmData();
        const b = data.pm_batches.find(x => x.id === ctx.wizard.state.sel);
        if (b) {
          b.archived = true;
          await saveFarmData(data);
          ctx.reply(`🗄 Batch archived securely.`, { parse_mode: 'Markdown', ...showMainMenu() });
        }
      } else {
        ctx.reply("Archive canceled.", { parse_mode: 'Markdown', ...showMainMenu() });
      }
      return ctx.scene.leave();
    }
  }
);

// 6. AI Advisor Scene
const aiAdvisorScene = new Scenes.WizardScene('AI_ADVISOR_SCENE',
  async (ctx) => {
    ctx.reply("💡 I am your AI Farm Advisor. I have analyzed your current farm data. What would you like to know?\n\n(Examples: 'Summarize my farm health', 'How is mortality tracking?', 'Any advice on feed?')");
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message || !ctx.message.text) return;
    const userQuery = ctx.message.text;
    await ctx.reply("⌛ Analyzing your data and thinking...");
    
    try {
      const data = await getFarmData();
      const farmContext = JSON.stringify(data);
      
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://antigravity.coder",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "openrouter/free",
          messages: [
            { role: "system", content: "You are an expert poultry farm management consultant. Use the following JSON data to answer accurately. Be concise and practical. Data: " + farmContext },
            { role: "user", content: userQuery }
          ]
        })
      });
      
      const result = await response.json();
      
      if (result.error) {
        console.error("OpenRouter Error:", result.error);
        return ctx.reply(`❌ AI Error: ${result.error.message}`, showMainMenu());
      }

      let aiText = result.choices?.[0]?.message?.content || "I'm sorry, I couldn't process that right now.";
      
      // Basic markdown cleaning to prevent stars bug
      aiText = aiText.replace(/\*\*/g, '*'); 

      await ctx.reply(aiText, { parse_mode: 'Markdown', ...showMainMenu() });
    } catch (e) {
      console.error("AI Advisor Catch Block:", e);
      await ctx.reply("❌ Sorry, I had trouble connecting to the AI advisor.", showMainMenu());
    }
    return ctx.scene.leave();
  }
);


const stage = new Scenes.Stage([addBatchScene, mortalityScene, feedScene, expenseScene, archiveScene, aiAdvisorScene]);
bot.use(session());
bot.use(stage.middleware());

// ----------------- EVENT BINDINGS -----------------

bot.start((ctx) => ctx.reply("Welcome to Poultry Management Bot! 🐣", showMainMenu()));
bot.hears('hi', (ctx) => ctx.reply("Hello! How can I help your farm today?", showMainMenu()));

bot.action('btn_state', async (ctx) => {
  await ctx.answerCbQuery();
  const data = await getFarmData();
  const active = getActiveBatches(data);
  if (active.length === 0) return ctx.reply("No active batches recorded yet.", { parse_mode: 'Markdown', ...showMainMenu() });
  
  let msg = "✨ *LIVE FARM DASHBOARD*\n\n";
  active.forEach(b => {
    const deaths = (b.mortality || []).reduce((sum, m) => sum + m.qty, 0);
    const fed = (b.stock || []).reduce((sum, s) => sum + s.qty, 0);
    const currentCount = b.quantity - deaths;
    const bar = getProgressBar(currentCount, b.quantity);
    
    msg += `📦 *${b.name.toUpperCase()}*\n`;
    msg += ` Health: \`${bar}\` (${currentCount} birds remaining)\n`;
    msg += ` 📉 Mortalities: ${deaths}  |  🌾 Feed Log: ${fed} bags\n`;
    msg += ` 🗓 Started: ${b.date}\n\n`;
  });
  
  ctx.reply(msg, { parse_mode: 'Markdown', ...showMainMenu() });
});

bot.action('btn_ai', (ctx) => ctx.scene.enter('AI_ADVISOR_SCENE'));
bot.action('btn_add', (ctx) => ctx.scene.enter('ADD_BATCH_WIZARD'));
bot.action('btn_mortality', async (ctx) => { await ctx.answerCbQuery(); ctx.scene.enter('MORTALITY_WIZARD'); });
bot.action('btn_feed', async (ctx) => { await ctx.answerCbQuery(); ctx.scene.enter('FEED_WIZARD'); });
bot.action('btn_expense', async (ctx) => { await ctx.answerCbQuery(); ctx.scene.enter('EXPENSE_WIZARD'); });
bot.action('btn_archive', async (ctx) => { await ctx.answerCbQuery(); ctx.scene.enter('ARCHIVE_WIZARD'); });

bot.action('btn_reset', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.reply("⚠️ WARNING: Are you ABSOLUTELY SURE you want to delete everything? This cannot be undone.",
    Markup.inlineKeyboard([ Markup.button.callback('✅ Yes, Delete Everything', 'confirm_reset'), Markup.button.callback('❌ Cancel', 'cancel_reset') ])
  );
});
bot.action('confirm_reset', async (ctx) => {
  await ctx.answerCbQuery(); await saveFarmData({ pm_batches: [], pm_expenses: [], pm_stock: [] });
  ctx.reply("✅ Farm data completely erased.", { parse_mode: 'Markdown', ...showMainMenu() });
});
bot.action('cancel_reset', async (ctx) => {
  await ctx.answerCbQuery(); ctx.reply("Reset canceled. Farm is safe.", { parse_mode: 'Markdown', ...showMainMenu() });
});

bot.on('text', (ctx) => ctx.reply("Hi! Please use the buttons below to interact:", showMainMenu()));

// ----------------- EXPRESS SERVER & SYNC API -----------------
const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from the 'web' folder (Consolidated for Cloud)
const WEB_DIR = path.join(__dirname, "web");
app.use(express.static(WEB_DIR));

app.get('/api/sync', async (req, res) => {
  const data = await getFarmData();
  res.json(data);
});

app.post('/api/sync', async (req, res) => {
  if (req.body && typeof req.body === 'object') {
    const currentData = await getFarmData();
    const mergedData = { ...currentData, ...req.body };
    await saveFarmData(mergedData);
    res.json({ success: true });
  } else {
    res.status(400).json({ error: "Invalid payload" });
  }
});

// Catch-all route to serve the web app's home page for any other request
app.use((req, res) => {
  res.sendFile(path.join(WEB_DIR, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log("-----------------------------------------");
  console.log(`POULTRY CLOUD SERVER RUNNING ON PORT ${PORT}`);
  console.log("-----------------------------------------");
});

bot.launch().then(() => console.log("Smart Mom-Bot started on Cloud!"));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
