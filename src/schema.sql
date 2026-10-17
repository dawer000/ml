CREATE TABLE IF NOT EXISTS mailboxes (
  address TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY,
  to_address TEXT NOT NULL,
  from_address TEXT NOT NULL,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (to_address) REFERENCES mailboxes(address)
);

CREATE INDEX IF NOT EXISTS idx_to_address ON emails(to_address);