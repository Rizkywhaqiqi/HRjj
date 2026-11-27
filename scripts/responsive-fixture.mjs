import fs from "node:fs";
import ts from "typescript";
// Test-only copies of the real page JSX; all reads use dummy fixtures and never a database.
const dir = "src/app/responsive-check";
fs.mkdirSync(dir + "/[screen]", { recursive: true });
const user = {
  id: 1,
  name: "Nama Pengguna Pengujian Dengan Nama Panjang",
  email: "dummy@example.test",
  roleId: 1,
  roleName: "Administrator HR",
  scopeAll: true,
  sessionVersion: 0,
  brandIds: [],
  permissions: [],
};
const employee = {
  id: 1,
  employee_id: 1,
  employee_code: "JOJO-TEST-0001",
  full_name: "NamaKaryawanPanjangTanpaSpasi".repeat(3),
  company_name: "CV Perusahaan Dengan Nama Panjang",
  brand_name: "JOJO",
  position_name: "Supervisor operasional",
  division_name: "Operasional",
  location_name: "LokasiKaryawan".repeat(5),
  is_active: 1,
};
const contract = {
  ...employee,
  contract_type_id: 1,
  contract_type_name: "PKWT 2 bulan",
  start_date: "2026-11-01",
  end_date: "2026-12-31",
  base_salary: "4000000",
  status: "RUNNING",
  letter_id: null,
  days_remaining: 7,
};
fs.writeFileSync(
  dir + "/data.ts",
  `import { PERMISSIONS } from '@/core/rbac/permissions'; export const user = {...${JSON.stringify(user)},permissions:Object.values(PERMISSIONS)}; export const employees=${JSON.stringify([employee])};export const contracts=${JSON.stringify([contract])};export const types=[{id:1,name:'PKWT',default_months:2,is_permanent:0,is_active:1}];`,
);
fs.writeFileSync(
  dir + "/actions.ts",
  '"use server"; export async function pendingAction() { await new Promise(resolve => setTimeout(resolve, 800)); }',
);
const calls = {
  requirePermission: "Promise.resolve(fixtureUser)",
  requireFeatureEnabled: "Promise.resolve()",
  isFeatureEnabled: "Promise.resolve(true)",
  countContracts: "Promise.resolve(60)",
  listContracts: "Promise.resolve(fixtureContracts)",
  listContractTypes: "Promise.resolve(fixtureTypes)",
  listExitReasons: "Promise.resolve([{id:1,name:'Habis kontrak'}])",
  getContractEmployeeContext: "Promise.resolve(fixtureEmployees[0])",
  listLetterEmployees: "Promise.resolve(fixtureEmployees)",
  employeeReportSummary: "Promise.resolve({total:150,active:140,inactive:10})",
  listEmployeeReport: "Promise.resolve(fixtureEmployees)",
  listBrandOptions: "Promise.resolve([{id:1,name:'JOJO'}])",
  listCompanyOptions: "Promise.resolve([{id:1,name:'CV Dummy'}])",
  listDivisionOptions: "Promise.resolve([{id:1,name:'Operasional'}])",
  listLocations: "Promise.resolve([{id:1,name:'Lokasi dummy'}])",
  listAuditEntityTypes: "Promise.resolve(['employee'])",
  listAuditLogs:
    "Promise.resolve({total:60,rows:[{id:1,user_name:fixtureUser.name,action:'employee.update',entity_type:'employee',entity_id:1,created_at:'2026-11-27T01:00:00Z',details:'DetailTanpaSpasi'.repeat(60)}]})",
  listLetters:
    "Promise.resolve([{id:1,letter_number:'JOJO/CV1/CONTRACT/2026/0001',type:'CONTRACT',full_name:fixtureEmployees[0].full_name,issued_date:'2026-11-27',metadata:null}])",
  getLetterContractDefaults: "Promise.resolve(null)",
};
for (const screen of [
  "contracts",
  "reports",
  "letters",
  "settings/audit-logs",
]) {
  const p = "src/app/(hr)/" + screen + "/page.tsx";
  let s = fs.readFileSync(p, "utf8");
  let source = ts.createSourceFile(
      p,
      s,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    ),
    edits = [];
  function walk(n) {
    if (
      ts.isJsxExpression(n) &&
      n.expression &&
      [
        "createContractAction",
        "decideContractAction",
        "createLetterAction",
      ].includes(n.expression.getText(source))
    ) {
      edits.push([
        n.expression.getStart(source),
        n.expression.end,
        "pendingAction",
      ]);
      return;
    }
    if (ts.isCallExpression(n) && calls[n.expression.getText(source)]) {
      edits.push([
        n.getStart(source),
        n.end,
        calls[n.expression.getText(source)],
      ]);
      return;
    }
    ts.forEachChild(n, walk);
  }
  walk(source);
  for (const [a, b, t] of edits.sort((a, b) => b[0] - a[0]))
    s = s.slice(0, a) + t + s.slice(b);
  s = s
    .replace(
      'from "./report-pagination"',
      'from "@/app/(hr)/reports/report-pagination"',
    )
    .replace(
      'from "./letter-composer"',
      'from "@/app/(hr)/letters/letter-composer"',
    );
  s =
    'import {pendingAction} from "./actions";\nimport {user as fixtureUser,employees as fixtureEmployees,contracts as fixtureContracts,types as fixtureTypes} from "./data";\n' +
    s;
  fs.writeFileSync(dir + "/" + screen.replaceAll("/", "-") + ".tsx", s);
}
fs.writeFileSync(
  dir + "/[screen]/page.tsx",
  `import { connection } from 'next/server'; import { AppShell } from '@/components/layout/app-shell'; import {user} from '../data'; import Contracts from '../contracts';import Reports from '../reports';import Letters from '../letters';import Audit from '../settings-audit-logs';import {NAV_SECTIONS} from '@/core/module-registry';
export const instant=false;
export default async function Page({params}:{params:Promise<{screen:string}>}){await connection();const {screen}=await params;const Page=({contracts:Contracts,reports:Reports,letters:Letters,audit:Audit} as const)[screen as 'contracts']??Contracts;return <AppShell user={user} sections={NAV_SECTIONS.map(s=>({...s,items:s.items.map(i=>({...i,href:'/responsive-check/'+(i.href.includes('report')?'reports':i.href.includes('letter')?'letters':i.href.includes('audit')?'audit':'contracts')+'?nav='+encodeURIComponent(i.label)}))}))}><Page searchParams={Promise.resolve({page:'3'})}/></AppShell>}`,
);
