-- File Messages Table
CREATE TABLE IF NOT EXISTS file_messages (
    id SERIAL PRIMARY KEY,
    file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
    sender VARCHAR(50) NOT NULL,
    receiver VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    is_done BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_file_messages_file_id ON file_messages(file_id);
CREATE INDEX IF NOT EXISTS idx_file_messages_receiver ON file_messages(receiver);
