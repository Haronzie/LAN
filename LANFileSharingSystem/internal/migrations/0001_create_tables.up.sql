CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    email TEXT,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

CREATE TABLE IF NOT EXISTS files (
    file_name TEXT PRIMARY KEY,
    size BIGINT,
    content_type TEXT,
    uploader TEXT
);
CREATE INDEX IF NOT EXISTS idx_files_uploader ON files (uploader);

CREATE TABLE IF NOT EXISTS directories (
    directory_name TEXT PRIMARY KEY,
    parent_directory TEXT,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_directories_parent ON directories (parent_directory);

CREATE TABLE IF NOT EXISTS activity_log (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    event TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_log (timestamp);
