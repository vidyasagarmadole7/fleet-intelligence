// Engine test for modules 3-6 using an in-memory TEST fixture (never shipped in the UI). Run: npx tsx scripts/test-modules.ts [optional real.csv]
import fs from 'fs';import Papa from 'papaparse';import assert from 'assert';
import {build} from '../src/engine/build';import {autoMap} from '../src/engine/fields';import {DEFAULT_CONFIG} from '../src/engine/types';
import {groupBy} from '../src/engine/groups';import {occupancy} from '../src/engine/occupancy';
const H=['Task_ID','Order_ID','Team_Name','Vehicle_Number','Agent_Username','Agent_ID','Vendor_Name','Distance(m)','Task_Status','Planned_Emp','Actual_Emp','In Cab Employees','Started Odometer Reading','Completed Odometer Reading','Start_Before','Time','Type','History_Description'];
const row=(o:Record<string,string>)=>Object.fromEntries(H.map(h=>[h,o[h]??'']));
const T='04 Nov 2026 09:00:00 am';
const rows=[
 // task 1 has TWO history rows: distance/employees must be counted once
 row({Task_ID:'1',Order_ID:'O1',Team_Name:'ACME',Vehicle_Number:'MH12AA1',Agent_Username:'d1',Agent_ID:'7',Vendor_Name:'V1','Distance(m)':'10000',Task_Status:'Completed',Planned_Emp:'4',Actual_Emp:'3',['In Cab Employees']:'3','Started Odometer Reading':'100','Completed Odometer Reading':'110',Start_Before:T,Time:T,History_Description:'Started at'}),
 row({Task_ID:'1',Order_ID:'O1',Team_Name:'ACME',Vehicle_Number:'MH12AA1',Agent_Username:'d1',Agent_ID:'7',Vendor_Name:'V1','Distance(m)':'10000',Task_Status:'Completed',Planned_Emp:'4',Actual_Emp:'3',['In Cab Employees']:'3','Started Odometer Reading':'100','Completed Odometer Reading':'110',Start_Before:T,Time:'04 Nov 2026 09:30:00 am',History_Description:'Successful at'}),
 row({Task_ID:'2',Order_ID:'O2',Team_Name:'ACME',Vehicle_Number:'MH12AA1',Agent_Username:'d2',Agent_ID:'8',Vendor_Name:'V1','Distance(m)':'5000',Task_Status:'Completed',Planned_Emp:'2',Actual_Emp:'2',['In Cab Employees']:'1','Started Odometer Reading':'110','Completed Odometer Reading':'',Start_Before:T,Time:T}),
 row({Task_ID:'3',Order_ID:'O3',Team_Name:'BETA',Vehicle_Number:'',Agent_Username:'',Task_Status:'Unassigned',Planned_Emp:'3',Start_Before:T,Time:T}),
 row({Task_ID:'4',Order_ID:'O4',Team_Name:'BETA',Vehicle_Number:'MH12BB2',Agent_Username:'d1',Agent_ID:'7',Vendor_Name:'V2','Distance(m)':'-',Task_Status:'Cancelled',Planned_Emp:'-',Start_Before:T,Time:T})];
const csv=Papa.unparse(rows,{columns:H});
const run=(text:string)=>{const p=Papa.parse<Record<string,string>>(text,{header:true,skipEmptyLines:true});const h=p.meta.fields!;return build(p.data,autoMap(h),DEFAULT_CONFIG,'t',h)};
const ds=run(csv);
assert.equal(ds.masters.length,4,'4 unique tasks, not 5 rows');
const v=groupBy(ds.masters,m=>m.vehicle);
assert.equal(v.groups.length,2);assert.equal(v.missing.length,1,'task 3 has no vehicle and is reported as missing, not dropped');
const a=v.groups.find(g=>g.key==='MH12AA1')!;
assert.equal(a.total,2);assert.equal(a.km,15,'10 km counted once (not twice) + 5 km');
assert.equal(a.odoDone,2);assert.equal(a.odoOkN,1);assert.equal(a.odoMissing,1);assert.equal(a.compliance,50);
assert.equal(a.emp,5,'actual employees 3+2, task 1 not double counted');
const d=groupBy(ds.masters,m=>m.driver);assert.equal(d.groups.find(g=>g.key==='d1')!.total,2,'driver d1 has tasks 1 and 4');
const b=groupBy(ds.masters,m=>m.vehicle).groups.find(g=>g.key==='MH12BB2')!;assert.equal(b.avgKm,undefined,'"-" distance is not 0');
const o=occupancy(ds.masters);const by=(id:string)=>o.find(r=>r.m.taskId===id)!;
assert.equal(by('1').status,'Planned differs from Actual');assert.equal(by('1').variance,-1);
assert.equal(by('2').status,'Actual differs from In-Cab');assert.equal(by('2').variance,0,'Actual 2 - Planned 2');
assert.equal(by('4').status,'Insufficient Data','blank planned+actual is not 0');
console.log('synthetic engine checks: OK');
if(process.argv[2]){const r=run(fs.readFileSync(process.argv[2],'utf8'));
 const sumV=groupBy(r.masters,m=>m.vehicle);
 const km=r.masters.filter(m=>m.status==='Completed'&&m.distanceKm!==undefined&&m.distanceKm>=0).reduce((s,m)=>s+m.distanceKm!,0);
 const vk=sumV.groups.reduce((s,g)=>s+g.km,0)+sumV.missing.filter(m=>m.status==='Completed'&&m.distanceKm!==undefined&&m.distanceKm>=0).reduce((s,m)=>s+m.distanceKm!,0);
 assert.ok(Math.abs(km-vk)<1e-6,'vehicle groups + missing-vehicle tasks must reconcile to overall KM');
 console.log('real file: tasks',r.masters.length,'vehicles',sumV.groups.length,'KM reconciles',km.toFixed(1))}
