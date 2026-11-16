CREATE TABLE IF NOT EXISTS employee_import_staging (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  source_sha256 CHAR(64) NOT NULL,
  source_row_number INT UNSIGNED NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  payload_encrypted TEXT NOT NULL,
  review_flags JSON NOT NULL,
  status ENUM('PENDING', 'DISCARDED') NOT NULL DEFAULT 'PENDING',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_employee_staging_source_row (source_sha256, source_row_number),
  INDEX idx_employee_staging_status_name (status, full_name)
) ENGINE=InnoDB;
