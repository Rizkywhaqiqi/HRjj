ALTER TABLE letter_templates
  ADD COLUMN company_id INT NULL AFTER type,
  ADD INDEX idx_letter_templates_company_type (company_id, type, is_active),
  ADD CONSTRAINT fk_letter_templates_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;
