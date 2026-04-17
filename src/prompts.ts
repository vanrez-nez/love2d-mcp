import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerPrompts(server: McpServer) {
  server.registerPrompt(
    "explain_api",
    {
      title: "Explain Love2D API",
      description: "Asks the LLM to explain a specific Love2D API call with examples and context.",
      argsSchema: {
        api_name: z.string().describe("The name of the Love2D API to explain (e.g. 'love.graphics.draw')")
      }
    },
    (args) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please explain the Love2D API "${args.api_name}". 
Provide a detailed explanation of what it does, its parameters, return values, and a practical code example. 
If there are any common pitfalls or tips, please include them as well.`
          }
        }
      ]
    })
  );
}
