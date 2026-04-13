import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["server.js"]
});

const client = new Client({
  name: "test-client",
  version: "1.0.0"
}, {
  capabilities: { tools: {} }
});

async function main() {
  console.log("Connecting to MCP server...");
  await client.connect(transport);
  console.log("Connected to MCP Server!");
  
  console.log("Requesting tools list...");
  const toolsResponse = await client.listTools();
  console.log("Tools available:", toolsResponse.tools.map(t => t.name).join(", "));
  
  console.log("Everything is working correctly!");
  process.exit(0);
}

main().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
