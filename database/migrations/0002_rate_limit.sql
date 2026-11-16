-- Cross-instance rate limiting storage.
-- Fixed windows are implemented by embedding the window start in bucket_key so
-- the increment stays a single atomic statement on MySQL and MariaDB alike.
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key VARCHAR(191) NOT NULL PRIMARY KEY,
  counter INT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  INDEX idx_rate_limit_expires (expires_at)
) ENGINE=InnoDB;
