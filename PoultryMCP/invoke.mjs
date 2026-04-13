import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({ command: "node", args: ["server.js"] });
const client = new Client({ name: "invoke", version: "1.0.0" }, { capabilities: {} });

async function main() {
  await client.connect(transport);
  const result = await client.callTool({
    name: "add_batch",
    arguments: {"id":"BATCH-001","name":"Spring Batch 2026","date":"2026-04-13","quantity":500}
  });
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}
main();
