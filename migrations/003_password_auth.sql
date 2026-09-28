-- Phase 3: credential-based authentication.
--
-- Replaces the previous model where any email could be logged in without a password.
-- Existing rows keep a NULL password_hash and simply cannot authenticate until
-- they register again; this is a pre-launch product with no real accounts to preserve.

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- A user without a password must never be treated as authenticated.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_password_hash_present_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_password_hash_present_check
      CHECK (password_hash IS NULL OR length(password_hash) > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_password_hash ON users (password_hash)
  WHERE password_hash IS NOT NULL;
