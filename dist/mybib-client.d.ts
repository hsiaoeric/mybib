/**
 * MyBib API client.
 *
 * Calls the MyBib autocite search endpoint and returns typed results.
 */
import type { MyBibResult } from "./types.js";
/**
 * Search for citation data for a given URL.
 *
 * @param url - The URL to look up (e.g. a PubMed, DOI, or arXiv link).
 * @returns An array of MyBibResult objects.
 * @throws If the HTTP request fails or the API returns a non-"ok" status.
 */
export declare function searchCitation(url: string): Promise<MyBibResult[]>;
//# sourceMappingURL=mybib-client.d.ts.map