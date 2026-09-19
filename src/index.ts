import { z } from 'zod';
import { isInitializeRequest, CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { ExpressHttpStreamableMcpServer } from "./server_runner.js";

const PORT = process.env.PORT || 3000;

console.log("Initializing MCP Streamable-HTTP Server with Express")


const servers = ExpressHttpStreamableMcpServer(
  {
    name: "streamable-mcp-server",
  },
  server => {

    // ... set up server resources, tools, and prompts ...
    server.tool(
      'greet',
      'A simple greeting tool',
      {
        name: z.string().describe('Name to greet'),
      },
      async ({ name }): Promise<CallToolResult> => {
        console.log(`Tool Called: greet (name=${name})`);
        return {
          content: [
            {
              type: 'text',
              text: `Hello, ${name}!`,
            },
          ],
        };
      }
    ); 

    server.tool(
  'search_little_blue_book',
  'Search the Marie Stopes International Little Blue Book for family planning information',
  {
    query: z.string().describe(
      'The family planning question or topic to search for'
    ),
  },
  async ({ query }): Promise<CallToolResult> => {
    console.log(`Tool Called: search_little_blue_book (query=${query})`);

    // Search your Little Blue Book content here
    const results = searchLittleBlueBook(query);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(results),
        },
      ],
    };
  }
);


    server.tool(
      'get_session',
      'gets the session id and context',
      {},
      async ({}): Promise<CallToolResult> => {
        return {
          content: [
            {
              type: 'text',
              text: `session`,
            },
          ],
        };
      }
    );

    // Register a tool that sends multiple greetings with notifications
    server.tool(
      'multi-greet',
      'A tool that sends different greetings with delays between them',
      {
        name: z.string().describe('Name to greet'),
      },
      async ({ name }, { sendNotification }): Promise<CallToolResult> => {
        console.log(`Tool Called: multi-greet (name=${name})`);
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        await sendNotification({
          method: "notifications/message",
          params: { level: "debug", data: `Starting multi-greet for ${name}` }
        });

        await sleep(1000); // Wait 1 second before first greeting

        await sendNotification({
          method: "notifications/message",
          params: { level: "info", data: `Sending first greeting to ${name}` }
        });

        await sleep(1000); // Wait another second before second greeting

        await sendNotification({
          method: "notifications/message",
          params: { level: "info", data: `Sending second greeting to ${name}` }
        });

        return {
          content: [
            {
              type: 'text',
              text: `Good morning, ${name}!`,
            }
          ],
        };
      }
    );
})
