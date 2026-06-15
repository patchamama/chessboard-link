-- Position Trainer: spaced-repetition lines saved per user.

CREATE TABLE IF NOT EXISTS trainer_lines (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    book_id     INTEGER NULL,
    name        TEXT NOT NULL DEFAULT '',
    start_fen   TEXT NOT NULL,
    moves_uci   TEXT NOT NULL DEFAULT '[]',   -- JSON array of UCI moves
    orientation TEXT NOT NULL DEFAULT 'white',
    -- SM-2 spaced-repetition scheduling state
    ease        REAL NOT NULL DEFAULT 2.5,
    interval_days INTEGER NOT NULL DEFAULT 0,
    reps        INTEGER NOT NULL DEFAULT 0,
    lapses      INTEGER NOT NULL DEFAULT 0,
    due_at      TEXT NOT NULL,
    last_reviewed_at TEXT NULL,
    created_at  TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_trainer_lines_user ON trainer_lines(user_id);
CREATE INDEX IF NOT EXISTS idx_trainer_lines_due ON trainer_lines(user_id, due_at);
