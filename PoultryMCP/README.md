# Poultry MCP Server - Documentation

Welcome to the Poultry Farm Model Context Protocol (MCP) server! This server allows AI assistants (like Claude Desktop or Cursor) to read your **Poultry Blueprint PDFs** and manage your **Farm Data** locally on your machine.

## Prerequisites
- Node.js (v18 or higher recommended)
- Your `POULTRY BLUEPRINT .pdf` file correctly located one step above this directory (`../POULTRY BLUEPRINT .pdf`).

## 1. Installation

If you haven't already, install the necessary dependencies:

```bash
cd path/to/PoultryMCP
npm install
```

## 2. Configuration for Claude Desktop

To connect this MCP server to Claude Desktop, you need to update its local configuration file. 
You can typically find your configuration file by opening Claude Desktop settings and looking for "MCP Config" or editing the config file directly at:
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Mac**: `~/Library/Application Support/Claude/claude_desktop_config.json`

Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "poultry_manager": {
      "command": "node",
      "args": [
        "c:/Users/USER/Downloads/Poultry/PoultryMCP/server.js"
      ]
    }
  }
}
```

*Note: Replace `node` with the absolute path to your `node.exe` if Claude complains it can't find it.*

## 3. Configuration for Cursor (IDE)

To connect this to Cursor:
1. Open Cursor Settings -> Features -> MCP Servers.
2. Click **Add New MCP Server**.
3. Name it `poultry-mcp`.
4. Command: `node "c:/Users/USER/Downloads/Poultry/PoultryMCP/server.js"`.
5. Save and hit "Reload". 

## 4. How to Operate the AI

Once configured, restart your AI (Claude Desktop or Cursor). You can now type the following types of prompts:

- **"Can you read my `poultry://blueprint` resource and tell me how often I should vaccinate?"**
  *(The AI will load your PDF blueprint instantly and answer based on your exact rules).*
  
- **"What is my current farm state?"**
  *(The AI will call `get_farm_state` and show you your batches).*

- **"Create a new batch of 500 birds starting today called 'Spring B1'."**
  *(The AI will use `add_batch` to create the batch and store it in `farm_data.json`).*

- **"Record 5 mortalities today for batch BATCH-001 due to heat stress."**
  *(The AI will apply `record_mortality`).*

## Troubleshooting

- If the AI says it **cannot find the server**, ensure you provided the absolute path to `server.js` in your config.
- If the AI says it **failed to read the blueprint**, make sure that `POULTRY BLUEPRINT .pdf` exists in the parent directory (`c:/Users/USER/Downloads/Poultry/POULTRY BLUEPRINT .pdf`).
