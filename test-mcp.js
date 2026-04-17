const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { SSEClientTransport } = require("@modelcontextprotocol/sdk/client/sse.js");

async function main() {
  console.log("Testing MCP SDK import...");
  const transport = new SSEClientTransport(new URL("https://mcp.figma.com/mcp"));
  const client = new Client(
    { name: "vibesync-test", version: "1.0.0" },
    { capabilities: { prompts: {}, resources: {}, tools: {} } }
  );
  
  await client.connect(transport);
  console.log("Connected to Figma MCP!");
  const tools = await client.listTools();
  console.log("Tools:", tools);
}

main().catch(console.error);
