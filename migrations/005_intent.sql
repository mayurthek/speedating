-- Phase 3: what people are actually looking for.
--
-- interested_in only describes gender. intent separates romance from
-- friendship so the two are not thrown together by accident.
-- 'Either' is a deliberate wildcard, and the default for existing rows.

ALTER TABLE preferences ADD COLUMN IF NOT EXISTS intent TEXT NOT NULL DEFAULT 'Either';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'preferences_intent_check'
  ) THEN
    ALTER TABLE preferences
      ADD CONSTRAINT preferences_intent_check
      CHECK (intent IN ('Love', 'Friendship', 'Either'));
  END IF;
END $$;
