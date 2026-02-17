export interface ToolOutput {
  items: Record<string, any>[];
  metadata: Record<string, any>;
}

export async function searchWeb(query: string): Promise<ToolOutput> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("TAVILY_API_KEY is required");

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "advanced",
        max_results: 10,
        chunks_per_source: 5,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { items: [], metadata: { error: `Tavily error ${res.status}: ${text}` } };
    }

    const data = await res.json();
    const items = (data.results || [])
      .filter((r: any) => r.url)
      .map((r: any) => ({
        url: r.url,
        title: r.title || "",
        content: r.content || "",
      }));

    return { items, metadata: {} };
  } catch (e: any) {
    return { items: [], metadata: { error: `Search failed: ${e.message}` } };
  }
}
