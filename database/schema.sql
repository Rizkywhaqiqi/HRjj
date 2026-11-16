SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS brands (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  brand_id INT NOT NULL,
  name VARCHAR(150) NOT NULL UNIQUE,
  address TEXT NULL,
  phone VARCHAR(50) NULL,
  email VARCHAR(100) NULL,
  npwp VARCHAR(50) NULL,
  nib VARCHAR(50) NULL,
  letterhead_logo_path VARCHAR(255) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_companies_brand FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS divisions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS positions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  division_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_division_position (division_id, name),
  CONSTRAINT fk_positions_division FOREIGN KEY (division_id) REFERENCES divisions(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS locations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  brand_id INT NULL,
  name VARCHAR(150) NOT NULL UNIQUE,
  city VARCHAR(100) NULL,
  address TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_locations_brand FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS exit_reasons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  severity ENUM('GREEN', 'YELLOW', 'RED') NOT NULL DEFAULT 'GREEN',
  rehirable BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  module VARCHAR(50) NOT NULL,
  description VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  session_version INT UNSIGNED NOT NULL DEFAULT 0,
  scope_all BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_brand_access (
  user_id INT NOT NULL,
  brand_id INT NOT NULL,
  PRIMARY KEY (user_id, brand_id),
  CONSTRAINT fk_uba_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_uba_brand FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS feature_flags (
  feature_key VARCHAR(60) PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(60) NOT NULL,
  entity_id VARCHAR(60) NULL,
  details JSON NULL,
  ip_address VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_created (created_at),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS candidate_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  phone VARCHAR(30) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  session_version INT UNSIGNED NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS candidates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  nik_encrypted TEXT NULL,
  nik_hash VARCHAR(64) NULL,
  birth_place VARCHAR(100) NULL,
  birth_date DATE NULL,
  address_current TEXT NULL,
  last_education VARCHAR(100) NULL,
  cv_file_path VARCHAR(255) NULL,
  portfolio_url VARCHAR(255) NULL,
  is_talent_pool BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_candidate_nik_hash (nik_hash),
  CONSTRAINT fk_candidates_account FOREIGN KEY (account_id) REFERENCES candidate_accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vacancies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  position_id INT NOT NULL,
  location_id INT NOT NULL,
  title VARCHAR(150) NOT NULL,
  slug VARCHAR(180) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  requirements TEXT NOT NULL,
  quota INT NOT NULL DEFAULT 1,
  status ENUM('DRAFT', 'OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
  published_at DATETIME NULL,
  closed_at DATE NULL,
  created_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_vacancies_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
  CONSTRAINT fk_vacancies_position FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE RESTRICT,
  CONSTRAINT fk_vacancies_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT,
  CONSTRAINT fk_vacancies_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vacancy_id INT NOT NULL,
  candidate_id INT NOT NULL,
  cv_snapshot_path VARCHAR(255) NULL,
  expected_salary DECIMAL(15, 2) NULL,
  offered_salary DECIMAL(15, 2) NULL,
  agreed_join_date DATE NULL,
  stage ENUM(
    'APPLIED',
    'SCREENING',
    'INTERVIEW_HR',
    'INTERVIEW_USER',
    'TEST',
    'OFFERING',
    'ACCEPTED',
    'REJECTED',
    'HIRED'
  ) NOT NULL DEFAULT 'APPLIED',
  rejection_reason VARCHAR(255) NULL,
  consent_given BOOLEAN NOT NULL,
  consent_at DATETIME NULL,
  consent_policy_version VARCHAR(40) NULL,
  consent_withdrawn_at DATETIME NULL,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_vacancy_candidate (vacancy_id, candidate_id),
  INDEX idx_app_stage (stage),
  CONSTRAINT chk_application_consent CHECK (
    consent_given = TRUE AND consent_at IS NOT NULL AND consent_policy_version IS NOT NULL
  ),
  CONSTRAINT fk_app_vacancy FOREIGN KEY (vacancy_id) REFERENCES vacancies(id) ON DELETE RESTRICT,
  CONSTRAINT fk_app_candidate FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_code VARCHAR(40) NOT NULL UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  nik_encrypted TEXT NOT NULL,
  nik_hash VARCHAR(64) NOT NULL UNIQUE,
  birth_place VARCHAR(100) NOT NULL,
  birth_date DATE NOT NULL,
  blood_type VARCHAR(5) NULL,
  mother_name VARCHAR(150) NULL,
  religion VARCHAR(30) NULL,
  marital_status ENUM('SINGLE', 'MARRIED', 'DIVORCED') NOT NULL DEFAULT 'SINGLE',
  children_count INT NOT NULL DEFAULT 0,
  address_current TEXT NOT NULL,
  address_ktp TEXT NOT NULL,
  email VARCHAR(150) NULL,
  phone VARCHAR(30) NOT NULL,
  npwp_encrypted TEXT NULL,
  bank_name VARCHAR(60) NULL,
  bank_account_encrypted TEXT NULL,
  ktp_photo_path VARCHAR(255) NULL,
  cv_file_path VARCHAR(255) NULL,
  company_id INT NOT NULL,
  position_id INT NOT NULL,
  location_id INT NOT NULL,
  join_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  exit_date DATE NULL,
  exit_reason_id INT NULL,
  application_id INT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_emp_company_active (company_id, is_active),
  INDEX idx_emp_position (position_id),
  INDEX idx_emp_location (location_id),
  INDEX idx_emp_email (email),
  INDEX idx_emp_phone (phone),
  CONSTRAINT fk_emp_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
  CONSTRAINT fk_emp_position FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE RESTRICT,
  CONSTRAINT fk_emp_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT,
  CONSTRAINT fk_emp_exit_reason FOREIGN KEY (exit_reason_id) REFERENCES exit_reasons(id) ON DELETE RESTRICT,
  CONSTRAINT fk_emp_application FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE RESTRICT,
  CONSTRAINT chk_employee_children CHECK (children_count >= 0),
  CONSTRAINT chk_employee_exit_state CHECK (
    (is_active = TRUE AND exit_date IS NULL AND exit_reason_id IS NULL) OR
    (is_active = FALSE AND exit_date IS NOT NULL AND exit_reason_id IS NOT NULL)
  )
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS employee_code_sequences (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  next_number INT UNSIGNED NOT NULL
) ENGINE=InnoDB;

INSERT INTO employee_code_sequences (id, next_number)
SELECT
  1,
  GREATEST(
    COALESCE(
      (
        SELECT MAX(CAST(SUBSTRING(employee_code, 5) AS UNSIGNED))
        FROM employees
        WHERE employee_code REGEXP '^EMP-[0-9]+$'
      ),
      0
    ),
    COALESCE(
      (
        SELECT MAX(
          CAST(
            SUBSTRING(
              JSON_UNQUOTE(JSON_EXTRACT(details, '$.employeeCode')),
              5
            ) AS UNSIGNED
          )
        )
        FROM audit_logs
        WHERE action IN ('employee.create', 'employee.staging.promote')
          AND JSON_UNQUOTE(JSON_EXTRACT(details, '$.employeeCode'))
              REGEXP '^EMP-[0-9]+$'
      ),
      0
    )
  ) + 1
ON DUPLICATE KEY UPDATE next_number = GREATEST(next_number, VALUES(next_number));

CREATE TABLE IF NOT EXISTS employee_import_staging (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  source_sha256 CHAR(64) NOT NULL,
  source_row_number INT UNSIGNED NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  payload_encrypted TEXT NOT NULL,
  review_flags JSON NOT NULL,
  status ENUM('PENDING', 'PROMOTED', 'DISCARDED') NOT NULL DEFAULT 'PENDING',
  employee_id INT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_employee_staging_source_row (source_sha256, source_row_number),
  INDEX idx_employee_staging_status_name (status, full_name),
  CONSTRAINT fk_employee_staging_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS contract_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  default_months INT NULL,
  reminder_days INT NOT NULL DEFAULT 14,
  is_permanent BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS letter_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('SP', 'SKK', 'CONTRACT', 'NDA', 'STILL_WORKING') NOT NULL,
  company_id INT NULL,
  name VARCHAR(120) NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_letter_templates_company_type (company_id, type, is_active),
  CONSTRAINT fk_letter_templates_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS contracts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  contract_type_id INT NOT NULL,
  contract_number VARCHAR(80) NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  base_salary DECIMAL(15, 2) NULL,
  status ENUM('RUNNING', 'EXTENDED', 'MADE_PERMANENT', 'NOT_EXTENDED', 'ENDED') NOT NULL DEFAULT 'RUNNING',
  previous_contract_id INT NULL UNIQUE,
  letter_id INT NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_contract_end_status (end_date, status),
  CONSTRAINT chk_contract_date_range CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT fk_contract_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
  CONSTRAINT fk_contract_type FOREIGN KEY (contract_type_id) REFERENCES contract_types(id) ON DELETE RESTRICT,
  CONSTRAINT fk_contract_prev FOREIGN KEY (previous_contract_id) REFERENCES contracts(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS letters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  letter_number VARCHAR(100) NOT NULL UNIQUE,
  type ENUM('SP', 'SKK', 'CONTRACT', 'NDA', 'STILL_WORKING') NOT NULL,
  employee_id INT NOT NULL,
  company_id INT NOT NULL,
  template_id INT NULL,
  file_path VARCHAR(255) NOT NULL,
  status ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ISSUED') NOT NULL DEFAULT 'ISSUED',
  issued_date DATE NOT NULL,
  metadata JSON NULL,
  created_by INT NULL,
  approved_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_letters_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
  CONSTRAINT fk_letters_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
  CONSTRAINT fk_letters_template FOREIGN KEY (template_id) REFERENCES letter_templates(id) ON DELETE SET NULL,
  CONSTRAINT fk_letters_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_letters_approver FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS letter_sequences (
  company_id INT NOT NULL,
  letter_year SMALLINT UNSIGNED NOT NULL,
  next_number INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (company_id, letter_year),
  CONSTRAINT fk_letter_sequence_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- The FK lives here because `letters` is created after `contracts`. Guard the
-- ALTER so the snapshot can be re-applied safely (MySQL/MariaDB compatible).
SET @fk_contract_letter_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'contracts'
    AND CONSTRAINT_NAME = 'fk_contract_letter'
);
SET @fk_contract_letter_sql = IF(
  @fk_contract_letter_exists = 0,
  'ALTER TABLE contracts ADD CONSTRAINT fk_contract_letter FOREIGN KEY (letter_id) REFERENCES letters(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE fk_contract_letter_stmt FROM @fk_contract_letter_sql;
EXECUTE fk_contract_letter_stmt;
DEALLOCATE PREPARE fk_contract_letter_stmt;

CREATE TABLE IF NOT EXISTS notification_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  contract_id INT NOT NULL,
  stage ENUM('INITIAL', 'H7', 'OVERDUE') NOT NULL,
  channel ENUM('EMAIL', 'IN_APP') NOT NULL DEFAULT 'EMAIL',
  status ENUM('PENDING', 'PROCESSING', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING',
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  claimed_at DATETIME NULL,
  claim_token CHAR(36) NULL,
  last_error VARCHAR(500) NULL,
  sent_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_contract_stage_channel (contract_id, stage, channel),
  CONSTRAINT fk_notif_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS checklist_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  category ENUM('ONBOARDING', 'OFFBOARDING') NOT NULL,
  title VARCHAR(180) NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_by INT NULL,
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_checklist_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
  CONSTRAINT fk_checklist_user FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

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

CREATE TABLE IF NOT EXISTS leave_types (
  id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE,
  annual_days INT NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_leave_days CHECK (annual_days >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS leave_requests (
  id INT AUTO_INCREMENT PRIMARY KEY, employee_id INT NOT NULL, leave_type_id INT NOT NULL,
  start_date DATE NOT NULL, end_date DATE NOT NULL, reason VARCHAR(500) NULL,
  status ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  decided_by INT NULL, decided_at DATETIME NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_leave_employee_dates (employee_id, start_date, end_date), INDEX idx_leave_status (status),
  CONSTRAINT fk_leave_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
  CONSTRAINT fk_leave_type FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE RESTRICT,
  CONSTRAINT fk_leave_decider FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_leave_date_range CHECK (end_date >= start_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payroll_records (
  id INT AUTO_INCREMENT PRIMARY KEY, employee_id INT NOT NULL, period_month DATE NOT NULL,
  base_salary DECIMAL(15, 2) NOT NULL DEFAULT 0, bpjs_health DECIMAL(15, 2) NOT NULL DEFAULT 0,
  bpjs_employment DECIMAL(15, 2) NOT NULL DEFAULT 0, other_deductions DECIMAL(15, 2) NOT NULL DEFAULT 0,
  net_amount DECIMAL(15, 2) NOT NULL DEFAULT 0, status ENUM('DRAFT', 'FINAL') NOT NULL DEFAULT 'DRAFT',
  notes VARCHAR(500) NULL, created_by INT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payroll_employee_period (employee_id, period_month),
  CONSTRAINT fk_payroll_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
  CONSTRAINT fk_payroll_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS assets (
  id INT AUTO_INCREMENT PRIMARY KEY, asset_code VARCHAR(60) NOT NULL UNIQUE, name VARCHAR(150) NOT NULL,
  category ENUM('SERAGAM', 'PERALATAN', 'ELEKTRONIK', 'LAINNYA') NOT NULL DEFAULT 'LAINNYA',
  serial_number VARCHAR(120) NULL, status ENUM('AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'RETIRED') NOT NULL DEFAULT 'AVAILABLE',
  company_id INT NULL, assigned_employee_id INT NULL, assigned_at DATE NULL, notes VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_assets_employee (assigned_employee_id),
  CONSTRAINT fk_assets_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
  CONSTRAINT fk_assets_employee FOREIGN KEY (assigned_employee_id) REFERENCES employees(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS employee_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL UNIQUE,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  session_version INT UNSIGNED NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_employee_account_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key VARCHAR(191) NOT NULL PRIMARY KEY,
  counter INT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  INDEX idx_rate_limit_expires (expires_at)
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;
