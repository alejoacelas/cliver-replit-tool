import { createHash } from "crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import type { SSEEvent } from "@shared/schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, "cached-responses");

function contentHash(content: string): string {
  return createHash("sha256").update(content.trim()).digest("hex").slice(0, 16);
}

export function getCachedEvents(content: string): SSEEvent[] | null {
  const hash = contentHash(content);
  const filePath = path.join(CACHE_DIR, `${hash}.json`);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

export function cacheEvents(content: string, events: SSEEvent[]): void {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  const hash = contentHash(content);
  const filePath = path.join(CACHE_DIR, `${hash}.json`);
  writeFileSync(filePath, JSON.stringify(events, null, 2));
  console.log(`Cached response: ${hash} (${events.length} events)`);
}
