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
const MAX_AUTHORS = 6;
/**
 * Format a single author in "Family Initials" style.
 *
 * E.g. { given: "Olga S.", family: "Papadopoulou" } → "Papadopoulou OS"
 */
function formatAuthor(author) {
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
function formatAuthors(authors) {
    if (!authors || authors.length === 0) {
        return "";
    }
    const formatted = authors.slice(0, MAX_AUTHORS).map(formatAuthor);
    if (authors.length > MAX_AUTHORS) {
        return formatted.join(", ") + ", et al";
    }
    return formatted.join(", ");
}
/**
 * Format a Vancouver-style citation string from MyBib metadata.
 *
 * @param metadata - The citation metadata from a MyBib result.
 * @param sourceId - The source type identifier (e.g. "article_journal", "webpage").
 * @returns A formatted Vancouver citation string.
 */
export function formatVancouver(metadata, sourceId) {
    const parts = [];
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
    const sourceParts = [];
    // Container title (journal name) — italicized in markdown
    if (metadata.containerTitle) {
        sourceParts.push(`*${metadata.containerTitle}*`);
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
        }
        else {
            parts.push(sourceStr);
        }
    }
    else if (volBlock) {
        parts.push(volBlock);
    }
    // DOI
    if (metadata.doi) {
        parts.push(`doi:${metadata.doi}`);
    }
    // URL (for webpages without DOI)
    if (!metadata.doi && metadata.url && sourceId === "webpage") {
        parts.push(`Available from: ${metadata.url}`);
    }
    // Join with ". " and ensure trailing period
    let citation = parts.join(". ");
    if (citation && !citation.endsWith(".")) {
        citation += ".";
    }
    return citation;
}
//# sourceMappingURL=vancouver.js.map