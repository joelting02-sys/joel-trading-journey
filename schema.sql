CREATE TABLE IF NOT EXISTS user_sync (
  profile_id TEXT PRIMARY KEY,
  trades_data TEXT,
  accounts_data TEXT,
  settings_data TEXT,
  sop_data TEXT,
  updated_at INTEGER
);
