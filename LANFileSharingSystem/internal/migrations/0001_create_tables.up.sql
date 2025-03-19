CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

CREATE TABLE IF NOT EXISTS files (
    file_name TEXT PRIMARY KEY,
    file_path TEXT,
    size BIGINT,
    content_type TEXT,
    uploader TEXT,
    confidential BOOLEAN NOT NULL DEFAULT false
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

CREATE TABLE IF NOT EXISTS inventory (
    id SERIAL PRIMARY KEY,
    item_name TEXT NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_inventory_item_name ON inventory (item_name);
