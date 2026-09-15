-- Phase 2 Migration: Queue Entries, Sessions, and Blocks
-- Adheres to PRD Sections 17, 19, 20, 39, 45, 50, 54, 56

CREATE TABLE IF NOT EXISTS queue_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'MATCHED', 'CANCELLED')),
  session_id UUID,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_ping_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id UUID,
  status VARCHAR(32) NOT NULL DEFAULT 'MATCHED' CHECK (status IN ('MATCHED', 'CONNECTING', 'ACTIVE', 'ENDING', 'COMPLETED', 'CANCELLED')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, blocked_user_id)
);

CREATE INDEX IF NOT EXISTS idx_queue_status_joined ON queue_entries(status, joined_at);
CREATE INDEX IF NOT EXISTS idx_sessions_users ON sessions(user_a, user_b);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_blocks_pair ON blocks(user_id, blocked_user_id);
