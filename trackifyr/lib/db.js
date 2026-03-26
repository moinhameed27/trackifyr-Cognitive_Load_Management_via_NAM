import pg from 'pg';
const { Pool } = pg;

const getPool = () => {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('Missing DATABASE_URL in environment');
  }

  // Next.js Dev Mode Cache: prevents creating 100s of pools during hot-reloads
  if (!globalThis.__trackifyrPgPool) {
    console.log("🚀 INITIALIZING NEW DATABASE POOL...");
    
    globalThis.__trackifyrPgPool = new Pool({
      connectionString,
      ssl: {
        // This is the ONLY way to fix 'self-signed certificate in certificate chain'
        rejectUnauthorized: false 
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Error handling for the pool itself
    globalThis.__trackifyrPgPool.on('error', (err) => {
      console.error('❌ Unexpected error on idle database client', err);
      globalThis.__trackifyrPgPool = null; // Reset pool on fatal error
    });
  }

  return globalThis.__trackifyrPgPool;
};

export const query = (text, params) => getPool().query(text, params);
export const pool = { query: (...args) => getPool().query(...args) };