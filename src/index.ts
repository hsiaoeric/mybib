/**
 * MyBib MCP Server entry point.
 *
 * Creates an MCP server with a `cite_url` tool and exposes it via
 * Streamable HTTP transport on an Express server.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { z } from "zod";
import { searchCitation } from "./mybib-client.js";
import { formatVancouver } from "./vancouver.js";

import type { Request, Response } from "express";

// ---------------------------------------------------------------------------
// MCP Server factory
// ---------------------------------------------------------------------------

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "mybib",
    version: "1.0.0",
  });

  // Register the cite_url tool
  server.tool(
    "cite_url",
    "Look up citation metadata for a URL using MyBib",
    {
      url: z
        .string()
        .url()
        .describe(
          "The URL to look up (e.g. a PubMed, DOI, or arXiv link)"
        ),
    },
    async ({ url }) => {
      try {
        const results = await searchCitation(url);

        if (results.length === 0) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
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
              type: "text" as const,
              text: JSON.stringify({ results: output }, null, 2),
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Error: ${message}` }],
        };
      }
    }
  );

  return server;
}

// ---------------------------------------------------------------------------
// Express + Streamable HTTP Transport
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env["PORT"] ?? "2999", 10);

// Use the SDK helper – includes express.json() and DNS rebinding protection
const app = createMcpExpressApp({ host: "0.0.0.0" });

// Store transports by session ID for session management
const transports: Record<string, StreamableHTTPServerTransport> = {};

app.post("/mcp", async (req: Request, res: Response) => {
  try {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && transports[sessionId]) {
      // Reuse existing transport for this session
      await transports[sessionId].handleRequest(req, res, req.body);
      return;
    }

    if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request — create transport + server
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        onsessioninitialized: (sid) => {
          transports[sid] = transport;
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          delete transports[sid];
        }
      };

      const server = createMcpServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    // Invalid request
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Bad Request: No valid session ID provided" },
      id: null,
    });
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

app.get("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId && transports[sessionId]) {
    await transports[sessionId].handleRequest(req, res);
  } else {
    res.status(400).json({ error: "No active session. Send a POST first." });
  }
});

app.delete("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId && transports[sessionId]) {
    await transports[sessionId].handleRequest(req, res);
  } else {
    res.status(400).json({ error: "No active session." });
  }
});

app.listen(PORT, () => {
  console.log(`MyBib MCP server listening on http://localhost:${PORT}/mcp`);
});
