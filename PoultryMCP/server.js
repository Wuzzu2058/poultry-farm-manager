import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FARM_DATA_PATH = path.join(__dirname, "farm_data.json");
const BLUEPRINT_PATH = path.join(__dirname, "../POULTRY BLUEPRINT .pdf");

const server = new Server(
  {
    name: "poultry-manager-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

// Helper to read data
async function getFarmData() {
  try {
    const data = await fs.readFile(FARM_DATA_PATH, "utf8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      const defaultData = { pm_batches: [], pm_expenses: [], pm_stock: [] };
      await fs.writeFile(FARM_DATA_PATH, JSON.stringify(defaultData, null, 2));
      return defaultData;
    }
    throw error;
  }
}

// Helper to write data
async function saveFarmData(data) {
  await fs.writeFile(FARM_DATA_PATH, JSON.stringify(data, null, 2));
}

// RESOURCES
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "poultry://blueprint",
        name: "Poultry Farm Blueprint",
        mimeType: "text/plain",
        description: "Official guide and rules for managing the poultry farm",
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri === "poultry://blueprint") {
    try {
      const dataBuffer = await fs.readFile(BLUEPRINT_PATH);
      const pdfData = await pdf(dataBuffer);
      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: "text/plain",
            text: pdfData.text,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to read blueprint PDF: ${error.message}`);
    }
  }
  throw new Error("Resource not found");
});

// TOOLS
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_farm_state",
        description: "Fetch the complete current farm state including batches, expenses, and stock events.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "add_batch",
        description: "Add a new poultry batch to the farm.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Unique batch ID, e.g., BATCH-001" },
            name: { type: "string", description: "Name/description of the batch" },
            date: { type: "string", description: "Creation date (YYYY-MM-DD)" },
            quantity: { type: "number", description: "Number of birds" },
          },
          required: ["id", "name", "date", "quantity"],
        },
      },
      {
        name: "record_mortality",
        description: "Record a mortality event for a batch.",
        inputSchema: {
          type: "object",
          properties: {
            batchId: { type: "string", description: "The ID of the batch" },
            date: { type: "string", description: "Date of death (YYYY-MM-DD)" },
            count: { type: "number", description: "Number of birds deceased" },
            cause: { type: "string", description: "Reason/cause of death" }
          },
          required: ["batchId", "date", "count"]
        }
      }
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const data = await getFarmData();
  
  if (request.params.name === "get_farm_state") {
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
  
  if (request.params.name === "add_batch") {
    const newBatch = request.params.arguments;
    // ensure structure matches roughly what the app does
    data.pm_batches = data.pm_batches || [];
    data.pm_batches.push({
      ...newBatch,
      mortality: [],
      stock: [],
      expenses: [],
      archived: false,
    });
    await saveFarmData(data);
    return {
      content: [{ type: "text", text: `Successfully added batch ${newBatch.id}.` }],
    };
  }

  if (request.params.name === "record_mortality") {
    const { batchId, date, count, cause } = request.params.arguments;
    data.pm_batches = data.pm_batches || [];
    const batch = data.pm_batches.find(b => b.id === batchId);
    if (!batch) {
      throw new Error(`Batch with ID ${batchId} not found`);
    }
    batch.mortality = batch.mortality || [];
    batch.mortality.push({ date, count, cause: cause || "Unknown" });
    await saveFarmData(data);
    return {
      content: [{ type: "text", text: `Successfully recorded ${count} mortalities for batch ${batchId}.` }],
    };
  }

  throw new Error(`Tool not found: ${request.params.name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Poultry MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
