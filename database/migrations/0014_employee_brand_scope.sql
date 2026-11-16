ALTER TABLE employees
  MODIFY COLUMN company_id INT NULL,
  ADD COLUMN brand_id INT NULL AFTER company_id;

UPDATE employees e
INNER JOIN companies c ON c.id = e.company_id
SET e.brand_id = c.brand_id
WHERE e.brand_id IS NULL;

ALTER TABLE employees
  MODIFY COLUMN brand_id INT NOT NULL,
  ADD INDEX idx_emp_brand_active (brand_id, is_active),
  ADD CONSTRAINT fk_emp_brand
    FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE RESTRICT;
