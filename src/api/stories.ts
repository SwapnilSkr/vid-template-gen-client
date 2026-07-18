const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api";

export type StorySource = "llm" | "hybrid" | "verbatim";

/** Server-owned Reddit genre catalog. The Create Reel dropdown reads this
 * rather than duplicating a stale subset in the client. */
export interface RedditGenreOption {
  id: string;
  label: string;
  subreddits: string[];
}

export interface RedditCandidate {
  seedUrl: string;
  seedTitle: string;
  title: string;
  excerpt: string;
  body: string;
  subreddit: string;
  author: string;
  upvotes: number;
  comments: number;
  ageHours: number;
  wordCount: number;
  estimatedParts?: number;
  unavailable?: boolean;
  unavailableReason?: string;
}

export interface StoryBankItem {
  id: string;
  title: string;
  excerpt: string;
  source: StorySource;
  genre?: string;
  subreddit?: string;
  upvotes?: number;
  comments?: number;
  seedUrl?: string;
  wordCount?: number;
  estimatedParts?: number;
  unavailable?: boolean;
  unavailableReason?: string;
  createdAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const headers = new Headers(init?.headers);
    if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
    });
    const json = (await res.json()) as ApiResponse<T>;
    if (!res.ok || !json.success) {
      throw new Error(json.error ?? `Request failed: ${res.status}`);
    }
    return json.data;
  } catch (error) {
    if (error instanceof Error && error.message !== "Failed to fetch") throw error;
    throw new Error(`API unavailable at ${API_BASE}. Start the server or set VITE_API_BASE_URL.`);
  }
}

function appendQuery(
  params: URLSearchParams,
  key: string,
  value: string | number | undefined
) {
  if (value === undefined || value === "") return;
  params.set(key, String(value));
}

export interface ListRedditCandidatesInput {
  genre: string;
  source: "hybrid" | "verbatim";
  limit?: number;
  excludeUrls?: string[];
  parts?: "off" | "auto" | number;
  tier?: string;
}

export interface ListRedditCandidatesResult {
  items: RedditCandidate[];
  hasMore: boolean;
}

function partsQueryValue(parts?: "off" | "auto" | number): string | undefined {
  if (parts === undefined || parts === "off") return undefined;
  return String(parts);
}

export async function listRedditCandidates(
  input: ListRedditCandidatesInput
): Promise<ListRedditCandidatesResult> {
  const params = new URLSearchParams();
  appendQuery(params, "genre", input.genre);
  appendQuery(params, "source", input.source);
  appendQuery(params, "limit", input.limit);
  appendQuery(params, "tier", input.tier);
  appendQuery(params, "parts", partsQueryValue(input.parts));
  if (input.excludeUrls?.length) {
    params.set("excludeUrls", JSON.stringify(input.excludeUrls));
  }
  const query = params.toString();
  return request<ListRedditCandidatesResult>(
    `/stories/candidates${query ? `?${query}` : ""}`
  );
}

export async function listStoryGenres(): Promise<RedditGenreOption[]> {
  return request<RedditGenreOption[]>("/stories/genres");
}

export interface ListStoryBankInput {
  genre?: string;
  source?: StorySource;
  limit?: number;
  offset?: number;
  sort?: "fifo" | "newest";
  parts?: "off" | "auto" | number;
  tier?: string;
}

export interface ListStoryBankResult {
  items: StoryBankItem[];
  total: number;
  hasMore: boolean;
}

export async function listStoryBank(
  input: ListStoryBankInput = {}
): Promise<ListStoryBankResult> {
  const params = new URLSearchParams();
  appendQuery(params, "genre", input.genre);
  appendQuery(params, "source", input.source);
  appendQuery(params, "limit", input.limit);
  appendQuery(params, "offset", input.offset);
  appendQuery(params, "sort", input.sort);
  appendQuery(params, "tier", input.tier);
  appendQuery(params, "parts", partsQueryValue(input.parts));
  const query = params.toString();
  return request<ListStoryBankResult>(`/stories/bank${query ? `?${query}` : ""}`);
}
