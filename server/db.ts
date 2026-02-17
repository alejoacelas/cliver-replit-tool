import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const isLocalDev = process.env.NODE_ENV === 'development' && !process.env.DATABASE_URL.includes('neon.tech');

let pool: any;
let db: any;

if (isLocalDev) {
  // Local dev: use standard pg driver (works with Fly proxy)
  const pg = await import('pg');
  const Pool = pg.default?.Pool ?? pg.Pool;
  const { drizzle } = await import('drizzle-orm/node-postgres');

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  pool.on('error', (err: Error) => {
    console.error('Unexpected database pool error:', err);
  });

  db = drizzle(pool, { schema });
} else {
  // Production / Neon: use Neon serverless driver with WebSockets
  const { Pool: NeonPool, neonConfig } = await import('@neondatabase/serverless');
  const { drizzle: neonDrizzle } = await import('drizzle-orm/neon-serverless');
  const ws = (await import('ws')).default;

  neonConfig.webSocketConstructor = ws;

  pool = new NeonPool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  pool.on('error', (err: Error) => {
    console.error('Unexpected database pool error:', err);
  });

  db = neonDrizzle({ client: pool, schema });
}

export { pool, db };
