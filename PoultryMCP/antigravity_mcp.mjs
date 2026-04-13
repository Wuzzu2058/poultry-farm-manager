import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const [,, command, ...argsJson] = process.argv;

if (!command) {
  console.error("Usage: node antigravity_mcp.mjs <command> <json_args>");
  process.exit(1);
}

const transport = new StdioClientTransport({
  command: "node",
  args: ["server.js"]
});

const client = new Client({
  name: "antigravity-adapter",
  version: "1.0.0"
}, {
  capabilities: { tools: {} }
});

async function main() {
  await client.connect(transport);

  try {
    if (command === "read_blueprint") {
      const result = await client.readResource({ uri: "poultry://blueprint" });
      console.log(JSON.stringify(result, null, 2));
    } else {
      let parsedArgs = {};
      try {
        if (argsJson.length > 0) {
          parsedArgs = JSON.parse(argsJson.join(" "));
        }
      } catch(e) {
        console.error("Invalid JSON args:", e);
        process.exit(1);
      }
      
      const result = await client.callTool({
        name: command,
        arguments: parsedArgs
      });
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error("Operation failed:", error.message);
  } finally {
    process.exit(0);
  }
}

main().catch(err => {
  console.error("Adapter error:", err);
  process.exit(1);
});
