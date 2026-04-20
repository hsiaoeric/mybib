/**
 * AMA citation formatter.
 *
 * Formats a single MyBib result's metadata into an AMA-style citation string.
 *
 * Rules (simplified):
 *   - Authors: "Family Initials" format, list up to 6 then "et al."
 *   - Title followed by a period
 *   - Journal/container title
 *   - Year;volume(issue):pages
 *   - DOI when present
 */

import type { MyBibAuthor, MyBibMetadata } from "./types.js";

const MAX_AUTHORS = 6;

/**
 * Format a single author in "Family Initials" style.
 *
 * E.g. { given: "Olga S.", family: "Papadopoulou" } → "Papadopoulou OS"
 */
function formatAuthor(author: MyBibAuthor): string {
  if (author.literal) {
    return author.literal;
  }

  const family = author.family ?? "";
  const given = author.given ?? "";

  // Extract initials from given name(s)
  const initials = given
    .split(/[\s.-]+/)
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase())
    .join("");

  return initials ? `${family} ${initials}` : family;
}

/**
 * Format the authors portion of the citation.
 *
 * Lists up to 6 authors separated by commas, appending "et al." if there
 * are more than 6.
 */
function formatAuthors(authors: MyBibAuthor[] | undefined): string {
  if (!authors || authors.length === 0) {
    return "";
  }

  const formatted = authors.slice(0, MAX_AUTHORS).map(formatAuthor);

  if (authors.length > MAX_AUTHORS) {
    return formatted.join(", ") + ", et al.";
  }

  return formatted.join(", ");
}

/**
 * Format an AMA-style citation string from MyBib metadata.
 *
 * @param metadata - The citation metadata from a MyBib result.
 * @param sourceId - The source type identifier (e.g. "article_journal", "webpage").
 * @returns A formatted AMA citation string.
 */
export function formatAma(
  metadata: MyBibMetadata,
  sourceId: string
): string {
  const parts: string[] = [];

  // Authors
  const authors = formatAuthors(metadata.author);
  if (authors) {
    parts.push(authors);
  }

  // Title
  if (metadata.title) {
    parts.push(metadata.title);
  }

  // Build the source portion (journal / publisher info)
  const sourceParts: string[] = [];

  // Container title (journal name)
  if (metadata.containerTitle) {
    sourceParts.push(metadata.containerTitle);
  }

  // Year
  const year = metadata.issued?.year;

  // Volume, issue, page block:  "2020;9(5):633"
  let volBlock = "";
  if (year) {
    volBlock += year;
  }
  if (metadata.volume) {
    volBlock += `;${metadata.volume}`;
  }
  if (metadata.issue) {
    volBlock += `(${metadata.issue})`;
  }
  if (metadata.page) {
    volBlock += `:${metadata.page}`;
  }

  if (sourceParts.length > 0) {
    // "Journal. 2020;9(5):633"
    const sourceStr = sourceParts.join(". ");
    if (volBlock) {
      parts.push(`${sourceStr}. ${volBlock}`);
    } else {
      parts.push(sourceStr);
    }
  } else if (volBlock) {
    parts.push(volBlock);
  }

  // DOI
  if (metadata.doi) {
    parts.push(`doi:${metadata.doi}`);
  }

  // URL (for webpages without DOI)
  if (!metadata.doi && metadata.url && sourceId === "webpage") {
    parts.push(`Available at: ${metadata.url}`);
  }

  // Join with ". " and ensure trailing period
  let citation = parts.join(". ");
  if (citation && !citation.endsWith(".")) {
    citation += ".";
  }

  return citation;
}