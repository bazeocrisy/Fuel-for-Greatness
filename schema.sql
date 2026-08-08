-- schema.sql — Fuel for Greatness (Phase 2)
-- Apply once against the D1 database, then apply seed.sql.
--   npx wrangler d1 execute fuel-for-greatness --remote --file=./schema.sql
--   npx wrangler d1 execute fuel-for-greatness --remote --file=./seed.sql
--
-- Design note: child_food_preferences + child_category_responses ARE the active
-- approved profile. A pending retake lives only as snapshot_json on its
-- profile_sessions row until a parent approves it, at which point the snapshot is
-- projected into those two tables. One source of truth for "what is approved".

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS families (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS children (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id         INTEGER NOT NULL REFERENCES families(id),
  slug              TEXT NOT NULL UNIQUE,        -- 'gabriella' | 'christopher'
  full_name         TEXT NOT NULL,
  first_name        TEXT NOT NULL,
  grade             TEXT NOT NULL,
  accent            TEXT,
  active_session_id INTEGER,                     -- -> profile_sessions.id (approved)
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS food_categories (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT NOT NULL UNIQUE,             -- matches the wizard's category ids
  display_name TEXT NOT NULL,
  emoji        TEXT,
  sort_order   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS food_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES food_categories(id),
  name        TEXT NOT NULL,
  emoji       TEXT,
  active      INTEGER NOT NULL DEFAULT 1,
  UNIQUE (category_id, name)
);

-- Every completed submission, approved or not. Never deleted.
CREATE TABLE IF NOT EXISTS profile_sessions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id       INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  version        INTEGER NOT NULL,               -- 1, 2, 3… per child
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','superseded','declined')),
  completed_at   TEXT NOT NULL,                  -- when the child tapped save
  reviewed_at    TEXT,                           -- when a parent decided
  total_selected INTEGER NOT NULL,
  snapshot_json  TEXT NOT NULL,                  -- exact payload as submitted
  app_build      TEXT,
  UNIQUE (child_id, version)
);

-- The ACTIVE approved profile. One row per liked food; absence = not selected.
CREATE TABLE IF NOT EXISTS child_food_preferences (
  child_id     INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  food_item_id INTEGER NOT NULL REFERENCES food_items(id),
  liked        INTEGER NOT NULL DEFAULT 1,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (child_id, food_item_id)
);

-- Preserves the intentional "None of these for me" answer per category.
CREATE TABLE IF NOT EXISTS child_category_responses (
  child_id      INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  category_id   INTEGER NOT NULL REFERENCES food_categories(id),
  answered      INTEGER NOT NULL DEFAULT 0,
  none_selected INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (child_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_prefs_child          ON child_food_preferences(child_id);
CREATE INDEX IF NOT EXISTS idx_responses_child      ON child_category_responses(child_id);
CREATE INDEX IF NOT EXISTS idx_sessions_child       ON profile_sessions(child_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_child_status ON profile_sessions(child_id, status, version DESC);
