-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- Files Table (confidential removed)
CREATE TABLE IF NOT EXISTS files (
    id SERIAL PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    directory VARCHAR(255) NOT NULL,
    file_path VARCHAR(500),
    size BIGINT,
    content_type VARCHAR(255),
    uploader VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (directory, file_name)
);
CREATE INDEX IF NOT EXISTS idx_files_uploader ON files (uploader);

-- Directories Table
CREATE TABLE IF NOT EXISTS directories (
    id SERIAL PRIMARY KEY,
    directory_name VARCHAR(255) NOT NULL,
    parent_directory VARCHAR(255) NOT NULL,
    created_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (parent_directory, directory_name)
);
CREATE INDEX IF NOT EXISTS idx_directories_parent ON directories (parent_directory);

-- Activity Log Table
CREATE TABLE IF NOT EXISTS activity_log (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    event VARCHAR(255) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_log (timestamp);

-- Inventory Table
CREATE TABLE IF NOT EXISTS inventory (
    id SERIAL PRIMARY KEY,
    item_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_inventory_item_name ON inventory (item_name);

-- File Versions Table with ON DELETE CASCADE
CREATE TABLE IF NOT EXISTS file_versions (
    id SERIAL PRIMARY KEY,
    file_id INT NOT NULL,
    version_number INT NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- Audit Logs Table with ON DELETE SET NULL for file_id
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_username VARCHAR(50),            -- Foreign key to users.username
    username_at_action VARCHAR(50),       -- Snapshot column for permanent storage
    file_id INT,
    action VARCHAR(20) NOT NULL,
    details VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user FOREIGN KEY (user_username) REFERENCES users (username) ON DELETE SET NULL,
    CONSTRAINT fk_file FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_username);
CREATE INDEX IF NOT EXISTS idx_audit_file ON audit_logs(file_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
