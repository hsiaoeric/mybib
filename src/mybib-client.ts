/**
 * MyBib API client.
 *
 * Calls the MyBib autocite search endpoint and returns typed results.
 */

import type { MyBibResponse, MyBibResult } from "./types.js";

const MYBIB_API_BASE = "https://www.mybib.com/api/autocite";

/**
 * Search for citation data for a given URL.
 *
 * @param url - The URL to look up (e.g. a PubMed, DOI, or arXiv link).
 * @returns An array of MyBibResult objects.
 * @throws If the HTTP request fails or the API returns a non-"ok" status.
 */
export async function searchCitation(url: string): Promise<MyBibResult[]> {
  const encodedUrl = encodeURIComponent(url);
  const endpoint = `${MYBIB_API_BASE}/search?q=${encodedUrl}&sourceId=webpage`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "mybib-mcp-server/1.0.0",
    },
  });

  if (!response.ok) {
    throw new Error(
      `MyBib API returned HTTP ${response.status}: ${response.statusText}`
    );
  }

  const data = (await response.json()) as MyBibResponse;

  if (data.status !== "ok") {
    throw new Error(
      `MyBib API returned unexpected status: "${data.status}"`
    );
  }

  return data.results ?? [];
}
