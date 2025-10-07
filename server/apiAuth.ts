import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import { storage } from "./storage";

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const rateLimitStore: RateLimitStore = {};

export async function authenticateApiKey(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          code: "authentication_failed",
          message: "Missing or invalid Authorization header. Expected format: 'Authorization: Bearer clv_live_...'",
        }
      });
    }

    const apiKey = authHeader.substring(7);
    
    if (!apiKey.startsWith('clv_live_') && !apiKey.startsWith('clv_test_')) {
      return res.status(401).json({
        error: {
          code: "authentication_failed",
          message: "Invalid API key format. Key must start with 'clv_live_' or 'clv_test_'",
        }
      });
    }

    const keyPrefix = apiKey.substring(0, 12);
    
    const candidateKeys = await storage.getApiKeysByPrefix(keyPrefix);
    
    let dbApiKey = null;
    for (const key of candidateKeys) {
      if (key.revokedAt) continue;
      
      const isMatch = await bcrypt.compare(apiKey, key.keyHash);
      if (isMatch) {
        dbApiKey = key;
        break;
      }
    }

    if (!dbApiKey) {
      return res.status(401).json({
        error: {
          code: "authentication_failed",
          message: "Invalid or revoked API key",
        }
      });
    }

    if (dbApiKey.revokedAt) {
      return res.status(401).json({
        error: {
          code: "authentication_failed",
          message: "This API key has been revoked",
        }
      });
    }

    const rateLimitResult = checkRateLimit(dbApiKey.id, 100, 60000);
    
    if (!rateLimitResult.allowed) {
      res.setHeader('X-RateLimit-Limit', '100');
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', rateLimitResult.resetTime.toString());
      res.setHeader('Retry-After', Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString());
      
      return res.status(429).json({
        error: {
          code: "rate_limit_exceeded",
          message: "Rate limit exceeded",
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
        }
      });
    }

    res.setHeader('X-RateLimit-Limit', '100');
    res.setHeader('X-RateLimit-Remaining', (100 - rateLimitResult.count).toString());
    res.setHeader('X-RateLimit-Reset', rateLimitResult.resetTime.toString());

    await storage.updateApiKeyLastUsed(dbApiKey.id);

    (req as any).apiKey = dbApiKey;
    (req as any).userId = dbApiKey.userId;
    
    next();
  } catch (error) {
    console.error("API key authentication error:", error);
    res.status(500).json({
      error: {
        code: "server_error",
        message: "Internal server error during authentication",
      }
    });
  }
}

function checkRateLimit(keyId: string, limit: number, windowMs: number): { allowed: boolean; count: number; resetTime: number } {
  const now = Date.now();
  const record = rateLimitStore[keyId];

  if (!record || now > record.resetTime) {
    rateLimitStore[keyId] = {
      count: 1,
      resetTime: now + windowMs
    };
    return { allowed: true, count: 1, resetTime: now + windowMs };
  }

  record.count++;

  if (record.count > limit) {
    return { allowed: false, count: record.count, resetTime: record.resetTime };
  }

  return { allowed: true, count: record.count, resetTime: record.resetTime };
}

export function cleanupRateLimitStore() {
  const now = Date.now();
  for (const key in rateLimitStore) {
    if (rateLimitStore[key].resetTime < now) {
      delete rateLimitStore[key];
    }
  }
}

setInterval(cleanupRateLimitStore, 300000);
