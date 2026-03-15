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
import { formatVancouver } from "./vancouver.js";
// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------
const server = new McpServer({
    name: "mybib",
    version: "1.0.0",
});
// Register the cite_url tool
server.tool("cite_url", "Look up citation metadata for a URL using MyBib", {
    url: z
        .string()
        .url()
        .describe("The URL to look up (e.g. a PubMed, DOI, or arXiv link)"),
}, async ({ url }) => {
    try {
        const results = await searchCitation(url);
        if (results.length === 0) {
            return {
                isError: true,
                content: [
                    {
                        type: "text",
                        text: "No citation found for the given URL",
                    },
                ],
            };
        }
        const output = results.map((r) => ({
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
            vancouverCitation: formatVancouver(r.metadata, r.sourceId),
        }));
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({ results: output }, null, 2),
                },
            ],
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            isError: true,
            content: [{ type: "text", text: `Error: ${message}` }],
        };
    }
});
// ---------------------------------------------------------------------------
// Connect via stdio
// ---------------------------------------------------------------------------
const transport = new StdioServerTransport();
await server.connect(transport);
//# sourceMappingURL=stdio.js.map