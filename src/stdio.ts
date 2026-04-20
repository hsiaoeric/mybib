/**
 * MyBib MCP Server — stdio transport entry point.
 *
 * This is the entry point for Claude Desktop and other MCP clients
 * that communicate via stdin/stdout.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { searchCitation } from "./mybib-client.js";
import { formatAma } from "./ama.js";

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "mybib",
  version: "1.0.0",
});

// Register the cite_urls tool
server.tool(
  "cite_urls",
  "Look up citation metadata for one or more URLs using MyBib",
  {
    urls: z
      .array(z.string().url())
      .min(1)
      .describe(
        "List of URLs to look up (e.g. PubMed, DOI, or arXiv links)"
      ),
  },
  async ({ urls }) => {
    const perUrlResults = await Promise.all(
      urls.map(async (url) => {
        try {
          const results = await searchCitation(url);

          if (results.length === 0) {
            return { url, error: "No citation found for the given URL" };
          }

          const citations = results.map((r) => ({
            sourceType: r.sourceId,
            title: r.metadata.title ?? null,
            authors: (r.metadata.author ?? []).map((a) => ({
              given: a.given ?? null,
              family: a.family ?? null,
            })),
            doi: r.metadata.doi ?? null,
            issued: r.metadata.issued
              ? {
                  year: r.metadata.issued.year ?? null,
                  month: r.metadata.issued.month ?? null,
                  day: r.metadata.issued.day ?? null,
                }
              : null,
            containerTitle: r.metadata.containerTitle ?? null,
            volume: r.metadata.volume ?? null,
            issue: r.metadata.issue ?? null,
            page: r.metadata.page ?? null,
            url: r.metadata.url ?? url,
            credibility: r.credibility ?? null,
            amaCitation: formatAma(r.metadata, r.sourceId),
          }));

          return { url, citations };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          return { url, error: message };
        }
      })
    );

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ results: perUrlResults }, null, 2),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Connect via stdio
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
