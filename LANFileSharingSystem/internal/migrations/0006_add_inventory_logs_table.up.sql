CREATE TABLE IF NOT EXISTS inventory_logs (
    id SERIAL PRIMARY KEY,
    inventory_id INT NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- e.g., 'restock', 'withdrawal', 'adjustment'
    quantity_change INT NOT NULL,
    performed_by VARCHAR(50) REFERENCES users(username),
    details VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_logs_inventory_id ON inventory_logs(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_performed_by ON inventory_logs(performed_by);