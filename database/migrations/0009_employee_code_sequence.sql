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
