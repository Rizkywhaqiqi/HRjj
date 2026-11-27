-- Additive only: never infer historical salaries or dates from current profiles.
CREATE TABLE IF NOT EXISTS employee_placements (
 id INT AUTO_INCREMENT PRIMARY KEY,
 employee_id INT NOT NULL,
 effective_date DATE NOT NULL,
 company_id INT NULL,
 brand_id INT NOT NULL,
 position_id INT NOT NULL,
 location_id INT NOT NULL,
 company_name VARCHAR(160) NULL,
 brand_name VARCHAR(160) NOT NULL,
 position_name VARCHAR(160) NOT NULL,
 location_name VARCHAR(160) NOT NULL,
 reason VARCHAR(500) NOT NULL,
 created_by INT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_placement_date (employee_id,effective_date),
 INDEX idx_placement_brand (brand_id,employee_id,effective_date),
 FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
INSERT INTO employee_placements (employee_id,effective_date,company_id,brand_id,position_id,location_id,company_name,brand_name,position_name,location_name,reason)
SELECT e.id,DATE(CONVERT_TZ(UTC_TIMESTAMP(),'+00:00','+07:00')),e.company_id,e.brand_id,e.position_id,e.location_id,c.name,b.name,p.name,l.name,'Baseline saat modul diaktifkan; bukan riwayat sebelum tanggal ini'
FROM employees e LEFT JOIN companies c ON c.id=e.company_id JOIN brands b ON b.id=e.brand_id JOIN positions p ON p.id=e.position_id JOIN locations l ON l.id=e.location_id
WHERE NOT EXISTS (SELECT 1 FROM employee_placements h WHERE h.employee_id=e.id);
CREATE TABLE IF NOT EXISTS salary_changes (
 id INT AUTO_INCREMENT PRIMARY KEY,
 employee_id INT NOT NULL,
 amount DECIMAL(15,2) NOT NULL,
 effective_date DATE NOT NULL,
 reason VARCHAR(1000) NOT NULL,
 status ENUM('PENDING','APPROVED','REJECTED','CANCELLED') NOT NULL DEFAULT 'PENDING',
 requested_by INT NOT NULL,
 requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 decided_by INT NULL,
 decided_at DATETIME NULL,
 decision_note VARCHAR(1000) NULL,
 approved_date DATE GENERATED ALWAYS AS (CASE WHEN status='APPROVED' THEN effective_date ELSE NULL END) STORED,
 UNIQUE KEY uq_salary_approved_date (employee_id,approved_date),
 INDEX idx_salary_employee_date (employee_id,status,effective_date),
 INDEX idx_salary_status (status,requested_at),
 CONSTRAINT chk_salary_amount CHECK (amount>=0 AND amount<=1000000000000),
 FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
 FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE RESTRICT,
 FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS employee_verifications (
 employee_id INT PRIMARY KEY,
 verified_by INT NOT NULL,
 verified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 note VARCHAR(500) NOT NULL,
 FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
 FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
INSERT IGNORE INTO permissions (code,module,description) VALUES
('finance.view','finance','Melihat data gaji dan riwayat keuangan'),
('finance.manage','finance','Mengajukan perubahan gaji'),
('finance.approve','finance','Memeriksa dan memutuskan perubahan gaji'),
('employee.verify','employees','Memverifikasi kelengkapan data karyawan');
INSERT IGNORE INTO role_permissions (role_id,permission_id)
SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.name='Super Admin' AND p.code IN ('finance.view','finance.manage','finance.approve','employee.verify');
INSERT IGNORE INTO roles (name,description,is_system) VALUES
('Keuangan','Persiapan data keuangan dan pengajuan perubahan gaji',TRUE),
('Pemeriksa Keuangan','Pemeriksaan perubahan gaji oleh pengguna selain pengaju',TRUE);
INSERT IGNORE INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE
(r.name='Keuangan' AND p.code IN ('dashboard.view','employee.view','report.view','finance.view','finance.manage')) OR
(r.name='Pemeriksa Keuangan' AND p.code IN ('dashboard.view','employee.view','report.view','finance.view','finance.approve'));
