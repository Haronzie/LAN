CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

CREATE TABLE IF NOT EXISTS files (
    id SERIAL PRIMARY KEY,
    file_name TEXT NOT NULL,
    directory TEXT NOT NULL,
    file_path TEXT,
    size BIGINT,
    content_type TEXT,
    uploader TEXT,
    confidential BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (directory, file_name)
);
CREATE INDEX IF NOT EXISTS idx_files_uploader ON files (uploader);

CREATE TABLE directories (
    id SERIAL PRIMARY KEY,
    directory_name TEXT NOT NULL,
    parent_directory TEXT NOT NULL,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (parent_directory, directory_name)
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
