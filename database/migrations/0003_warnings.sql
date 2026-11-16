CREATE TABLE IF NOT EXISTS employee_warnings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  warning_type ENUM('SP1', 'SP2', 'SP3') NOT NULL,
  issue_date DATE NOT NULL,
  expiry_date DATE NULL,
  status ENUM('ACTIVE', 'EXPIRED', 'RESOLVED') NOT NULL DEFAULT 'ACTIVE',
  notes VARCHAR(500) NULL,
  created_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_warning_employee_status (employee_id, status),
  INDEX idx_warning_expiry (expiry_date, status),
  CONSTRAINT fk_warning_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
  CONSTRAINT fk_warning_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
