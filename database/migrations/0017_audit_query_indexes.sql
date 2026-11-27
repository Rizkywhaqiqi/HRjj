ALTER TABLE contracts
  ADD INDEX idx_contract_employee_status_dates (employee_id, status, start_date, end_date),
  ADD INDEX idx_contract_status_end (status, end_date);
