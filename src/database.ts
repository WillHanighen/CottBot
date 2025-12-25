import { Database } from 'bun:sqlite';
import { join } from 'path';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';

const DATA_DIR = join(process.cwd(), 'data');
const DB_PATH = join(DATA_DIR, 'bot.db');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  await mkdir(DATA_DIR, { recursive: true });
}

export const db = new Database(DB_PATH);

// Initialize database schema
export function initDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY,
      system_prompt TEXT,
      system_prompt_type TEXT,
      model TEXT DEFAULT 'moonshotai/kimi-k2',
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS banned_users (
      user_id TEXT PRIMARY KEY,
      banned_at INTEGER DEFAULT (strftime('%s', 'now')),
      banned_by TEXT,
      reason TEXT
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS approved_admins (
      user_id TEXT PRIMARY KEY,
      added_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);
  
  // Migration: Add system_prompt_type column if it doesn't exist
  try {
    db.run(`ALTER TABLE user_preferences ADD COLUMN system_prompt_type TEXT`);
  } catch (error: any) {
    // Column already exists, ignore error
    if (!error.message?.includes('duplicate column')) {
      console.warn('Migration warning:', error);
    }
  }
  
  // Migration: Update old model IDs to new format
  try {
    const updateStmt1 = db.prepare(`
      UPDATE user_preferences 
      SET model = 'moonshotai/kimi-k2' 
      WHERE model = 'moonshot-v1-8k' OR model = 'moonshot/moonshot-v1-8k'
    `);
    const result1 = updateStmt1.run();
    if (result1.changes > 0) {
      console.log(`Migrated ${result1.changes} user(s) to new model ID format`);
    }
  } catch (error: any) {
    console.warn('Migration warning (model IDs):', error);
  }
  
  // Add default approved admin
  try {
    const adminStmt = db.prepare(`
      INSERT OR IGNORE INTO approved_admins (user_id, added_at)
      VALUES (?, strftime('%s', 'now'))
    `);
    adminStmt.run('964334519995994113');
    console.log('Added default approved admin: 964334519995994113');
  } catch (error: any) {
    console.warn('Migration warning (approved admins):', error);
  }
  
  console.log('Database initialized successfully');
}

// Get user preferences
export interface UserPreferences {
  userId: string;
  systemPrompt: string | null;
  systemPromptType: string | null;
  model: string;
}

export function getUserPreferences(userId: string): UserPreferences | null {
  const stmt = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?');
  const result = stmt.get(userId) as any;
  
  if (!result) {
    return null;
  }
  
  return {
    userId: result.user_id,
    systemPrompt: result.system_prompt,
    systemPromptType: result.system_prompt_type,
    model: result.model || 'moonshotai/kimi-k2',
  };
}

// Set user system prompt (only stores the type, content is loaded from file)
export function setUserSystemPrompt(userId: string, systemPrompt: string, promptType?: string): void {
  const stmt = db.prepare(`
    INSERT INTO user_preferences (user_id, system_prompt_type, updated_at)
    VALUES (?, ?, strftime('%s', 'now'))
    ON CONFLICT(user_id) DO UPDATE SET
      system_prompt_type = excluded.system_prompt_type,
      updated_at = strftime('%s', 'now')
  `);
  stmt.run(userId, promptType || null);
}

// Set user model
export function setUserModel(userId: string, model: string): void {
  const stmt = db.prepare(`
    INSERT INTO user_preferences (user_id, model, updated_at)
    VALUES (?, ?, strftime('%s', 'now'))
    ON CONFLICT(user_id) DO UPDATE SET
      model = excluded.model,
      updated_at = strftime('%s', 'now')
  `);
  stmt.run(userId, model);
}

// Get or create user preferences with defaults
export function getOrCreateUserPreferences(userId: string): UserPreferences {
  let prefs = getUserPreferences(userId);
  
  if (!prefs) {
    // Create default preferences
    setUserModel(userId, 'moonshotai/kimi-k2');
    prefs = getUserPreferences(userId)!;
  }
  
  return prefs;
}

// Ban management
export function isUserBanned(userId: string): boolean {
  const stmt = db.prepare('SELECT user_id FROM banned_users WHERE user_id = ?');
  const result = stmt.get(userId);
  return !!result;
}

export function banUser(userId: string, bannedBy: string, reason?: string): void {
  const stmt = db.prepare(`
    INSERT INTO banned_users (user_id, banned_by, reason, banned_at)
    VALUES (?, ?, ?, strftime('%s', 'now'))
    ON CONFLICT(user_id) DO UPDATE SET
      banned_by = excluded.banned_by,
      reason = excluded.reason,
      banned_at = strftime('%s', 'now')
  `);
  stmt.run(userId, bannedBy, reason || null);
}

export function unbanUser(userId: string): boolean {
  const stmt = db.prepare('DELETE FROM banned_users WHERE user_id = ?');
  const result = stmt.run(userId);
  return result.changes > 0;
}

// Admin management
export function isApprovedAdmin(userId: string): boolean {
  const stmt = db.prepare('SELECT user_id FROM approved_admins WHERE user_id = ?');
  const result = stmt.get(userId);
  return !!result;
}

export function addApprovedAdmin(userId: string): void {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO approved_admins (user_id, added_at)
    VALUES (?, strftime('%s', 'now'))
  `);
  stmt.run(userId);
}

// Initialize on module load
initDatabase();
