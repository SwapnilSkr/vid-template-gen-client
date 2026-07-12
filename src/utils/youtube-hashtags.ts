const HASHTAG_PATTERN = /#[\p{L}\p{N}_]+/gu;
const HASHTAG_LINE_PATTERN = /^(?:\s*#[\p{L}\p{N}_]+\s*)+$/u;
const TRAILING_HASHTAGS_PATTERN = /(?:\s+#[\p{L}\p{N}_]+)+\s*$/u;

export function normalizeHashtag(value: string): string {
  const clean = value.trim().replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "");
  return clean ? `#${clean}` : "";
}

export function extractHashtags(value: string): string[] {
  return [...new Set((value.match(HASHTAG_PATTERN) ?? []).map(normalizeHashtag).filter(Boolean))];
}

export function stripHashtagsFromText(value: string): string {
  const withoutBlock = value
    .trimEnd()
    .split("\n")
    .filter((line, index, lines) => {
      if (index !== lines.length - 1) return true;
      return !HASHTAG_LINE_PATTERN.test(line);
    })
    .join("\n")
    .trimEnd();
  return withoutBlock.replace(TRAILING_HASHTAGS_PATTERN, "").trim();
}

export function withDescriptionHashtags(description: string, hashtags: string[]): string {
  const managed = hashtags.length ? hashtags.join(" ") : "";
  const body = stripHashtagsFromText(description);
  return managed ? `${body}${body ? "\n\n" : ""}${managed}` : body;
}

export function hashtagsForTitle(
  baseTitle: string,
  hashtags: string[],
  maxLength = 100,
): string[] {
  const base = stripHashtagsFromText(baseTitle).trim();
  const fitted: string[] = [];
  let result = base;
  for (const tag of hashtags) {
    const next = result ? `${result} ${tag}` : tag;
    if (next.length <= maxLength) {
      result = next;
      fitted.push(tag);
    } else {
      break;
    }
  }
  return fitted;
}

export function withTitleHashtags(
  baseTitle: string,
  hashtags: string[],
  maxLength = 100,
): string {
  const base = stripHashtagsFromText(baseTitle).trim();
  const fitted = hashtagsForTitle(base, hashtags, maxLength);
  if (!fitted.length) return base.slice(0, maxLength);
  return `${base} ${fitted.join(" ")}`.trim().slice(0, maxLength);
}

export function countHashtags(...values: string[]): number {
  return values.reduce((total, value) => total + extractHashtags(value).length, 0);
}

export function relevantHashtags(niche: string, genre?: string): string[] {
  const common = ["#Shorts", "#YouTubeShorts", "#Storytime"];
  const nicheTags =
    niche === "reddit"
      ? ["#RedditStories", "#RedditShorts", "#AITA"]
      : niche.startsWith("horror")
        ? ["#HorrorShorts", "#ScaryStories", "#HorrorStory"]
        : [];
  const genreTag = genre ? normalizeHashtag(genre.replace(/_/g, "")) : "";
  return [...new Set([...nicheTags, ...(genreTag ? [genreTag] : []), ...common])];
}
