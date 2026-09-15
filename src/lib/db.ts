import fs from 'fs';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';

export interface UserRecord {
  id: string;
  email: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  created_at: string;
  updated_at: string;
}

export interface ProfileRecord {
  id: string;
  user_id: string;
  first_name: string;
  date_of_birth: string;
  gender: 'Man' | 'Woman' | 'Other' | string;
  avatar_type: 'Man' | 'Woman' | 'Other';
  bio: string | null;
  interests: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface PreferenceRecord {
  id: string;
  user_id: string;
  interested_in: 'Men' | 'Women' | 'Everyone';
  created_at: string;
  updated_at: string;
}

export interface QueueEntryRecord {
  id: string;
  user_id: string;
  status: 'WAITING' | 'MATCHED' | 'CANCELLED';
  session_id: string | null;
  joined_at: string;
  last_ping_at: string;
}

export interface SessionRecord {
  id: string;
  user_a: string;
  user_b: string;
  question_id: string | null;
  status: 'MATCHED' | 'CONNECTING' | 'ACTIVE' | 'ENDING' | 'COMPLETED' | 'CANCELLED';
  started_at: string;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlockRecord {
  id: string;
  user_id: string;
  blocked_user_id: string;
  created_at: string;
}

interface DatabaseAdapter {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
  exec?: (sql: string) => Promise<unknown>;
}

const globalForDb = globalThis as unknown as {
  dbClient: DatabaseAdapter | undefined;
  dbInitialized: boolean | undefined;
};

// Database client abstraction supporting both PostgreSQL (via pg) and embedded Postgres (via PGlite)
class DatabaseManager {
  public async getClient(): Promise<DatabaseAdapter> {
    if (globalForDb.dbClient) {
      return globalForDb.dbClient;
    }

    if (process.env.DATABASE_URL) {
      globalForDb.dbClient = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
      }) as unknown as DatabaseAdapter;
    } else {
      // In-memory PGlite instance for reliable zero-dependency local development on Windows
      globalForDb.dbClient = new PGlite() as unknown as DatabaseAdapter;
    }

    if (!globalForDb.dbInitialized) {
      await this.runMigrations();
      globalForDb.dbInitialized = true;
    }

    return globalForDb.dbClient;
  }

  public async runMigrations() {
    const migrationsDir = path.join(process.cwd(), 'migrations');
    if (!fs.existsSync(migrationsDir)) return;

    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      if (process.env.DATABASE_URL) {
        await globalForDb.dbClient?.query(sql);
      } else if (globalForDb.dbClient?.exec) {
        await globalForDb.dbClient.exec(sql);
      }
    }
  }

  public async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    const client = await this.getClient();
    const res = await client.query(sql, params);
    return res.rows as T[];
  }

  public async queryOne<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }
}

export const db = new DatabaseManager();
