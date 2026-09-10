import { env } from 'cloudflare:workers';
export function labDB():D1Database {
  const db=(env as unknown as {DB?:D1Database}).DB;
  if(!db)throw new Error('Lab database is unavailable');
  return db;
}
