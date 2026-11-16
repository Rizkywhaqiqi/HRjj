ALTER TABLE employee_import_staging
  MODIFY COLUMN status ENUM('PENDING', 'PROMOTED', 'DISCARDED') NOT NULL DEFAULT 'PENDING',
  ADD COLUMN employee_id INT NULL,
  ADD UNIQUE KEY uq_employee_staging_employee (employee_id),
  ADD CONSTRAINT fk_employee_staging_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT;
