/**
 * Vancouver citation formatter.
 *
 * Formats a single MyBib result's metadata into a Vancouver-style citation string.
 *
 * Rules:
 *   - Authors: "Family Initials" format, list up to 6 then "et al."
 *   - Title followed by a period
 *   - Container title (journal name) in italics (markdown)
 *   - Year, volume, issue, pages, DOI
 *
 * Example output:
 *   Papadopoulou OS, Iliopoulos V, Mallouchos A, Panagou EZ,
 *   Chorianopoulos N, Tassou CC, et al. Spoilage Potential of
 *   Pseudomonas... *Foods*. 2020;9(5):633. doi:10.3390/foods9050633
 */
import type { MyBibMetadata } from "./types.js";
/**
 * Format a Vancouver-style citation string from MyBib metadata.
 *
 * @param metadata - The citation metadata from a MyBib result.
 * @param sourceId - The source type identifier (e.g. "article_journal", "webpage").
 * @returns A formatted Vancouver citation string.
 */
export declare function formatVancouver(metadata: MyBibMetadata, sourceId: string): string;
//# sourceMappingURL=vancouver.d.ts.map