ALTER TABLE applications
  ADD COLUMN acceptance_reason VARCHAR(255) NULL AFTER rejection_reason;

ALTER TABLE employee_import_staging
  ADD COLUMN application_id INT NULL AFTER source_row_number,
  ADD COLUMN brand_id INT NULL AFTER application_id,
  ADD UNIQUE KEY uq_employee_staging_application (application_id),
  ADD INDEX idx_employee_staging_brand_status (brand_id, status),
  ADD CONSTRAINT fk_employee_staging_application
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_employee_staging_brand
    FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE RESTRICT;
