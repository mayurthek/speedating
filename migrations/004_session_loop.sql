-- Phase 3: the 3-minute session loop.
--
-- Adds the shared question pool, per-round question history, per-user decisions,
-- and the round counter needed to run repeated 3-minute rounds until one of the
-- two people moves on.

CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Unique so the seed below is idempotent: migrations re-run on every cold start.
CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_text ON questions (text);

-- Which questions were shown in which round of which session.
CREATE TABLE IF NOT EXISTS session_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_session_questions_unique
  ON session_questions (session_id, round);
CREATE INDEX IF NOT EXISTS idx_session_questions_question
  ON session_questions (question_id);

-- One decision per person per round. Kept as rows rather than columns on
-- sessions so that "both voted KEEP" is a single query and rounds never clobber
-- each other.
CREATE TABLE IF NOT EXISTS session_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  decision TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT session_decisions_decision_check CHECK (decision IN ('KEEP', 'MOVE_ON'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_session_decisions_unique
  ON session_decisions (session_id, user_id, round);
CREATE INDEX IF NOT EXISTS idx_session_decisions_lookup
  ON session_decisions (session_id, round);

-- Round counter. Resets are unnecessary because a session ends on any MOVE_ON.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS round INTEGER NOT NULL DEFAULT 1;

-- Wall-clock deadline for both people to decide. A missing decision after this
-- is treated as MOVE_ON so one participant can never strand the other.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS decision_deadline TIMESTAMPTZ;

-- queue_entries.session_id was never constrained; add it now that sessions exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'queue_entries_session_id_fkey'
  ) THEN
    ALTER TABLE queue_entries
      ADD CONSTRAINT queue_entries_session_id_fkey
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL;
  END IF;
END $$;

INSERT INTO questions (text, category) VALUES
  ('What is something you recently started that you are really into?', 'Interest'),
  ('What is the most useless talent you have?', 'Light'),
  ('What is a small thing that instantly improves your day?', 'Values'),
  ('What is the last thing you watched that you would actually rewatch?', 'Taste'),
  ('What is a food you could happily eat every single day?', 'Light'),
  ('What is somewhere you would go right now if money were no object?', 'Dreams'),
  ('What is something most people like that you cannot stand?', 'Taste'),
  ('What is a compliment you have received that you still think about?', 'Values'),
  ('What is a book, film or song that changed your mind about something?', 'Taste'),
  ('What is your most useless interview question to ask a stranger?', 'Light'),
  ('What is something you have changed your mind about in the last year?', 'Values'),
  ('What is a skill you would like to be better at next year?', 'Dreams'),
  ('What is the most recent thing that made you laugh out loud?', 'Light'),
  ('What is a rule you live by that people find strange?', 'Values'),
  ('What is something you would never compromise on?', 'Values'),
  ('What is the best meal you have had in the last month?', 'Light'),
  ('What is a place you go to when you need to reset?', 'Values'),
  ('What is a habit you are proud of building?', 'Interest'),
  ('What is the worst gift you have ever received?', 'Light'),
  ('What is something you would want to be asked about instead?', 'Values'),
  ('What is your ideal Sunday with nobody to talk to?', 'Dreams'),
  ('What is a piece of advice you are glad you ignored?', 'Values'),
  ('What is something everyone overrates?', 'Taste'),
  ('What is something you would like to be known for?', 'Dreams'),
  ('What is the most interesting thing you learned this week?', 'Interest'),
  ('What is a small luxury you would happily give up a big one for?', 'Light'),
  ('What is something that makes you lose track of time?', 'Interest'),
  ('What is your most unreasonable strong opinion?', 'Light'),
  ('What is a goal you are working towards quietly?', 'Dreams'),
  ('What is the best compliment about your sense of humour?', 'Light')
ON CONFLICT (text) DO NOTHING;
