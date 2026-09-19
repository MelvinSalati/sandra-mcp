import { z } from "zod";
import fs from "node:fs";
import path from "node:path";

import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ExpressHttpStreamableMcpServer } from "./server_runner.js";

const PORT = process.env.PORT || 3000;

console.log("Initializing Sandra MCP Streamable-HTTP Server");

// =========================================================
// LOAD MARIE STOPES LITTLE BLUE BOOK
// =========================================================

const bookPath = path.resolve(
  process.cwd(),
  "marie-stopes-little-blue-book.mcp.json"
);

console.log(`Loading Little Blue Book from: ${bookPath}`);

if (!fs.existsSync(bookPath)) {
  throw new Error(
    `Little Blue Book JSON not found: ${bookPath}`
  );
}

const littleBlueBook = JSON.parse(
  fs.readFileSync(bookPath, "utf-8")
);

const fullBookText: string =
  littleBlueBook.resources?.find(
    (resource: any) =>
      resource.uri === "msi://little-blue-book/full"
  )?.text || "";

if (!fullBookText) {
  throw new Error(
    "Little Blue Book resource text could not be loaded."
  );
}

console.log(
  `Little Blue Book loaded successfully: ${fullBookText.length} characters`
);

// =========================================================
// PREPARE BOOK CHUNKS
// =========================================================

const bookChunks = fullBookText
  .split(/\n(?=={3,})/)
  .map((chunk: string) => chunk.trim())
  .filter(Boolean);

console.log(
  `Little Blue Book indexed into ${bookChunks.length} chunks`
);

// =========================================================
// SEARCH LITTLE BLUE BOOK
// =========================================================

function searchLittleBlueBook(
  query: string,
  maxResults = 5
) {
  const normalizedQuery = query
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (normalizedQuery.length === 0) {
    return [];
  }

  const scoredResults = bookChunks.map((chunk: string) => {
    const normalizedChunk = chunk.toLowerCase();

    let score = 0;
    let matchedTerms = 0;

    for (const term of normalizedQuery) {
      if (normalizedChunk.includes(term)) {
        matchedTerms++;
        score++;
      }
    }

    return {
      score,
      matchedTerms,
      text: chunk,
    };
  });

  return scoredResults
    .filter((result) => result.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return b.matchedTerms - a.matchedTerms;
    })
    .slice(0, maxResults)
    .map((result, index) => ({
      rank: index + 1,
      relevance: result.score,
      content: result.text,
    }));
}

// =========================================================
// GET LITTLE BLUE BOOK SECTION
// =========================================================

function getLittleBlueBookSection(section: string) {
  const normalizedSection = section
    .toLowerCase()
    .trim();

  if (!normalizedSection) {
    return null;
  }

  const result = bookChunks.find((chunk) =>
    chunk.toLowerCase().includes(normalizedSection)
  );

  return result || null;
}

// =========================================================
// SANDRA MCP SERVER
// =========================================================

const servers = ExpressHttpStreamableMcpServer(
  {
    name: "sandra-mcp",
  },

  (server) => {

    // =====================================================
    // SEARCH LITTLE BLUE BOOK
    // =====================================================

    server.tool(
      "search_little_blue_book",

      "Searches the Marie Stopes International Little Blue Book for relevant family planning information.",

      {
        query: z
          .string()
          .describe(
            "The family planning question, topic, method, service, or concept to search for."
          ),
      },

      async ({
        query,
      }): Promise<CallToolResult> => {

        console.log(
          `Tool Called: search_little_blue_book (query=${query})`
        );

        const results = searchLittleBlueBook(
          query,
          5
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  source:
                    "Marie Stopes International Little Blue Book",
                  query,
                  result_count: results.length,
                  results,
                },
                null,
                2
              ),
            },
          ],
        };
      }
    );

    // =====================================================
    // GET SECTION
    // =====================================================

    server.tool(
      "get_section",

      "Retrieves a specific section or topic from the Marie Stopes International Little Blue Book.",

      {
        section: z
          .string()
          .describe(
            "The section or topic to retrieve, for example Contraception, Abortion, Quality, Outreach, or History."
          ),
      },

      async ({
        section,
      }): Promise<CallToolResult> => {

        console.log(
          `Tool Called: get_section (section=${section})`
        );

        const result =
          getLittleBlueBookSection(section);

        if (!result) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    found: false,
                    section,
                    message:
                      "No matching section was found in the Little Blue Book.",
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  found: true,
                  section,
                  content: result,
                },
                null,
                2
              ),
            },
          ],
        };
      }
    );

  }
);

console.log("Sandra MCP server initialized.");
