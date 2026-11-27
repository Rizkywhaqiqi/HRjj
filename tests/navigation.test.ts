import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchesNavigation} from '../src/core/navigation';
test('navigation matches child pages without matching similarly named routes',()=>{
 assert.equal(matchesNavigation('/finance','/finance/employees/1',''),true);
 assert.equal(matchesNavigation('/employees','/employees/new',''),true);
 assert.equal(matchesNavigation('/employees','/employees-other',''),false);
});
test('master menu selection requires its query section and tolerates flash messages',()=>{
 assert.equal(matchesNavigation('/master-data?section=organisation','/master-data','section=organisation&ok=Saved'),true);
 assert.equal(matchesNavigation('/master-data?section=positions','/master-data','section=organisation'),false);
 assert.equal(matchesNavigation('/master-data?section=positions','/master-data',''),false);
 assert.equal(matchesNavigation('/master-data','/master-data','section=positions'),true);
});
