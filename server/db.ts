// Referenced from javascript_database blueprint
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure WebSocket with SSL for Neon (accept self-signed certificates in development only)
if (process.env.NODE_ENV === 'development') {
  class CustomWebSocket extends ws {
    constructor(address: string, protocols?: string | string[]) {
      super(address, protocols, {
        rejectUnauthorized: false
      });
    }
  }
  neonConfig.webSocketConstructor = CustomWebSocket as any;
} else {
  // Production: use default WebSocket with full TLS verification
  neonConfig.webSocketConstructor = ws;
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure connection pool with proper settings to handle connection issues
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Add error handler for pool errors
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

export const db = drizzle({ client: pool, schema });
