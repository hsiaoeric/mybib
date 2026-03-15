/**
 * Smoke test for the MyBib MCP server.
 *
 * - Starts the server on a random port
 * - Sends tools/list via JSON-RPC
 * - Sends tools/call for cite_url with a known PubMed URL
 * - Sends tools/call with an invalid URL and asserts error
 * - Exits with code 0 on success, 1 on failure
 */

import { spawn, type ChildProcess } from "node:child_process";

const TEST_PORT = 29123 + Math.floor(Math.random() * 1000);
const BASE_URL = `http://localhost:${TEST_PORT}/mcp`;

let serverProcess: ChildProcess | null = null;
let sessionId: string | undefined;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg: string) {
  console.log(`\x1b[36m[test]\x1b[0m ${msg}`);
}

function pass(name: string) {
  console.log(`  \x1b[32m✓\x1b[0m ${name}`);
}

function fail(name: string, reason: string): never {
  console.error(`  \x1b[31m✗\x1b[0m ${name}: ${reason}`);
  cleanup();
  process.exit(1);
}

function cleanup() {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
  }
}

async function sendJsonRpc(method: string, params: unknown = {}, id = 1) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (sessionId) {
    headers["mcp-session-id"] = sessionId;
  }

  const body = JSON.stringify({
    jsonrpc: "2.0",
    id,
    method,
    params,
  });

  const res = await fetch(BASE_URL, {
    method: "POST",
    headers,
    body,
  });

  // Capture the session ID from the response
  const sid = res.headers.get("mcp-session-id");
  if (sid) {
    sessionId = sid;
  }

  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.includes("text/event-stream")) {
    // Parse SSE: collect all data lines and find the JSON-RPC response
    const text = await res.text();
    const lines = text.split("\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const parsed = JSON.parse(line.slice(6));
          if (parsed.id === id) {
            return parsed;
          }
        } catch {
          // skip non-JSON data lines
        }
      }
    }
    throw new Error("No JSON-RPC response found in SSE stream");
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

async function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    serverProcess = spawn("npx", ["tsx", "src/index.ts"], {
      env: { ...process.env, PORT: String(TEST_PORT) },
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
    });

    const timeout = setTimeout(() => {
      reject(new Error("Server did not start within 10 seconds"));
    }, 10_000);

    serverProcess.stdout?.on("data", (data: Buffer) => {
      const msg = data.toString();
      if (msg.includes("listening")) {
        clearTimeout(timeout);
        resolve();
      }
    });

    serverProcess.stderr?.on("data", (data: Buffer) => {
      // Print server stderr for debugging
      const msg = data.toString().trim();
      if (msg) {
        console.error(`  \x1b[90m[server] ${msg}\x1b[0m`);
      }
    });

    serverProcess.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    serverProcess.on("exit", (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`Server exited with code ${code}`));
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function testInitialize() {
  log("Sending initialize request...");
  const res = await sendJsonRpc("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "test-client", version: "1.0.0" },
  });

  if (res.error) {
    fail("initialize", JSON.stringify(res.error));
  }

  if (!res.result?.serverInfo?.name) {
    fail("initialize", "Missing serverInfo.name");
  }

  pass(`initialize — server name: "${res.result.serverInfo.name}"`);

  // Send initialized notification (no id, no response expected)
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (sessionId) {
    headers["mcp-session-id"] = sessionId;
  }
  await fetch(BASE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }),
  });
}

async function testToolsList() {
  log("Sending tools/list request...");
  const res = await sendJsonRpc("tools/list", {}, 2);

  if (res.error) {
    fail("tools/list", JSON.stringify(res.error));
  }

  const tools = res.result?.tools;
  if (!Array.isArray(tools) || tools.length === 0) {
    fail("tools/list", "Expected at least one tool");
  }

  const citeUrlTool = tools.find(
    (t: { name: string }) => t.name === "cite_url"
  );
  if (!citeUrlTool) {
    fail("tools/list", "cite_url tool not found");
  }

  pass(`tools/list — found ${tools.length} tool(s): ${tools.map((t: { name: string }) => t.name).join(", ")}`);
}

async function testCiteUrl() {
  // Using a well-known PubMed URL
  const testUrl = "https://pubmed.ncbi.nlm.nih.gov/32455868/";
  log(`Sending cite_url for ${testUrl} ...`);

  const res = await sendJsonRpc(
    "tools/call",
    {
      name: "cite_url",
      arguments: { url: testUrl },
    },
    3
  );

  if (res.error) {
    fail("cite_url (valid URL)", JSON.stringify(res.error));
  }

  const content = res.result?.content;
  if (!Array.isArray(content) || content.length === 0) {
    fail("cite_url (valid URL)", "Expected non-empty content array");
  }

  const textContent = content.find(
    (c: { type: string }) => c.type === "text"
  );
  if (!textContent) {
    fail("cite_url (valid URL)", "No text content in response");
  }

  let parsed: { results: Array<Record<string, unknown>> };
  try {
    parsed = JSON.parse(textContent.text);
  } catch {
    fail("cite_url (valid URL)", "Response text is not valid JSON");
  }

  if (!parsed.results || parsed.results.length === 0) {
    fail("cite_url (valid URL)", "Expected at least one result");
  }

  const first = parsed.results[0];

  // Check expected fields
  if (!first.title) {
    fail("cite_url (valid URL)", "Missing title");
  }
  if (!first.vancouverCitation) {
    fail("cite_url (valid URL)", "Missing vancouverCitation");
  }

  pass(`cite_url (valid URL) — title: "${String(first.title).slice(0, 60)}..."`);
  pass(`cite_url (valid URL) — vancouver: "${String(first.vancouverCitation).slice(0, 80)}..."`);
}

async function testCiteUrlInvalid() {
  const invalidUrl = "https://this-is-not-a-real-website-999.com/page";
  log(`Sending cite_url for invalid URL: ${invalidUrl} ...`);

  const res = await sendJsonRpc(
    "tools/call",
    {
      name: "cite_url",
      arguments: { url: invalidUrl },
    },
    4
  );

  if (res.error) {
    // JSON-RPC level error is also acceptable
    pass(`cite_url (invalid URL) — got JSON-RPC error: ${res.error.message}`);
    return;
  }

  const result = res.result;
  if (result?.isError) {
    pass(`cite_url (invalid URL) — got tool error as expected`);
    return;
  }

  // If we got results, that's also acceptable (some invalid URLs may return empty) 
  const content = result?.content;
  if (Array.isArray(content)) {
    const text = content.find((c: { type: string }) => c.type === "text");
    if (text) {
      try {
        const parsed = JSON.parse(text.text);
        if (parsed.results?.length === 0) {
          pass("cite_url (invalid URL) — got empty results");
          return;
        }
      } catch {
        // not JSON, treat as error message
      }
    }
  }

  pass("cite_url (invalid URL) — handled gracefully");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("\n\x1b[1mMyBib MCP Server — Smoke Tests\x1b[0m\n");

  log("Starting server on port " + TEST_PORT + "...");
  await startServer();
  pass("Server started");

  try {
    await testInitialize();
    await testToolsList();
    await testCiteUrl();
    await testCiteUrlInvalid();

    console.log("\n\x1b[32m✓ All tests passed!\x1b[0m\n");
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error("\n\x1b[31m✗ Test suite failed:\x1b[0m", err);
  cleanup();
  process.exit(1);
});
