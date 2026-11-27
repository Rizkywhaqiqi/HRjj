import type { Connection } from "mysql2/promise";
// Call only while holding the employee row lock, in the same transaction as the change.
export async function recordPlacement(
  conn: Connection,
  id: number,
  userId: number | null,
  reason: string,
) {
  await conn.execute(
    `INSERT INTO employee_placements(employee_id,effective_date,company_id,brand_id,position_id,location_id,company_name,brand_name,position_name,location_name,reason,created_by)
 SELECT e.id,DATE(CONVERT_TZ(UTC_TIMESTAMP(),'+00:00','+07:00')),e.company_id,e.brand_id,e.position_id,e.location_id,c.name,b.name,p.name,l.name,?,? FROM employees e LEFT JOIN companies c ON c.id=e.company_id JOIN brands b ON b.id=e.brand_id JOIN positions p ON p.id=e.position_id JOIN locations l ON l.id=e.location_id WHERE e.id=?`,
    [reason, userId, id],
  );
}
