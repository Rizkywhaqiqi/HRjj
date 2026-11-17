ALTER TABLE employees
  ADD INDEX idx_emp_brand_active_name (brand_id, is_active, full_name),
  ADD INDEX idx_emp_full_name (full_name);
