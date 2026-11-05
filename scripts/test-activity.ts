// Engine test: Team Upload, Location Performance, Exceptions. Synthetic in-memory fixture (never shipped). Run: npx tsx scripts/test-activity.ts [real.csv]
import fs from 'fs';import Papa from 'papaparse';import assert from 'assert';
import {build} from '../src/engine/build';import {autoMap} from '../src/engine/fields';import {DEFAULT_CONFIG} from '../src/engine/types';
import {parseActivities} from '../src/engine/activity';import {creators,teamUpload,employeeLocation} from '../src/engine/teamupload';
import {lpEvents,locPerf} from '../src/engine/locperf';import {findExceptions} from '../src/engine/exceptions';import {DEFAULT_ODO} from '../src/engine/odometer';
const H=['Task_ID','Order_ID','Team_Name','Vehicle_Number','Agent_Username','Distance(m)','Task_Status','PICKUPDROP','Pickup_Address','Customer_Address','Started Odometer Image','Completed Odometer Image','Time','Type','History_Description'];
const row=(o:Record<string,string>)=>Object.fromEntries(H.map(h=>[h,o[h]??'']));
const t=(m:number)=>`04 Nov 2026 09:${String(m).padStart(2,'0')}:00 am`;
const base=(id:string,x:Record<string,string>)=>({Task_ID:id,Team_Name:'ACME',Vehicle_Number:'MH12AA1',Agent_Username:'d1',...x});
const rows=[
 row(base('1',{PICKUPDROP:'PICKUP',Pickup_Address:'Baner,Pune',Customer_Address:'Office,Pune',Task_Status:'Completed','Distance(m)':'5000','Started Odometer Image':'http://img/a',Time:t(1),History_Description:'Created By Bulk Import - Asha Rao - 11'})),
 row(base('1',{PICKUPDROP:'PICKUP',Pickup_Address:'Baner,Pune',Customer_Address:'Office,Pune',Task_Status:'Completed','Started Odometer Image':'http://img/a',Time:t(2),History_Description:'Successful at'})),
 row(base('1',{PICKUPDROP:'PICKUP',Pickup_Address:'Baner,Pune',Customer_Address:'Office,Pune',Task_Status:'Completed','Started Odometer Image':'http://img/a',Time:t(3),History_Description:'Modified  by Asha Rao-11'})),
 row(base('2',{PICKUPDROP:'DROP',Pickup_Address:'Office,Pune',Customer_Address:'Wakad,Pune',Task_Status:'Unassigned','Started Odometer Image':'http://img/a',Time:t(4),History_Description:'Created By Bulk Import - Asha Rao - 11'})),
 row(base('2',{PICKUPDROP:'DROP',Pickup_Address:'Office,Pune',Customer_Address:'Wakad,Pune',Task_Status:'Unassigned','Started Odometer Image':'http://img/a',Time:t(5),History_Description:'Status updated from Started to Successful by Ravi K-22'})),
 row(base('3',{PICKUPDROP:'DROP',Pickup_Address:'Office,Pune',Customer_Address:'Hinjewadi,Pune',Task_Status:'Completed',Time:t(6),History_Description:'Created By Bulk Import - Bob - 12'})),
 row(base('3',{PICKUPDROP:'DROP',Pickup_Address:'Office,Pune',Customer_Address:'Hinjewadi,Pune',Task_Status:'Completed',Time:t(7),History_Description:'Successful at Ravi K-22'})),
 row(base('3',{PICKUPDROP:'DROP',Pickup_Address:'Office,Pune',Customer_Address:'Hinjewadi,Pune',Task_Status:'Completed',Time:t(7),History_Description:'Successful at Ravi K-22'})), // exact duplicate row
 row(base('3',{PICKUPDROP:'DROP',Pickup_Address:'Office,Pune',Customer_Address:'Hinjewadi,Pune',Task_Status:'Completed',Time:t(8),History_Description:'Status updated from Accepted to Started by Ravi K-22'}))];
const run=(text:string)=>{const p=Papa.parse<Record<string,string>>(text,{header:true,skipEmptyLines:true});const h=p.meta.fields!;return build(p.data,autoMap(h),DEFAULT_CONFIG,'t',h)};
const ds=run(Papa.unparse(rows,{columns:H}));const by=new Map(ds.masters.map(m=>[m.taskId,m]));
// employee location rule
assert.equal(employeeLocation(by.get('1')!),'Baner,Pune');assert.equal(employeeLocation(by.get('2')!),'Wakad,Pune');
// team upload
const R=parseActivities(ds.history);const tu=teamUpload(ds.masters,creators(R.acts));
const asha=tu.members.find(m=>m.name==='Asha Rao')!;
assert.equal(tu.members.length,2);assert.equal(asha.total.length,2);assert.equal(asha.pickup.length,1);assert.equal(asha.drop.length,1);assert.equal(asha.unassigned.length,1);assert.equal(asha.assigned.length,1);assert.equal(tu.noCreator.length,0);
assert.equal(tu.members.reduce((s,m)=>s+m.total.length,0),ds.masters.length,'every task counted exactly once');
// location performance
const E=lpEvents(ds.history,by);const named=locPerf(E.events,ds.masters,'named'),drv=locPerf(E.events,ds.masters,'driver');
assert.equal(named.tot.n.locationModified,1);assert.equal(named.tot.n.startedToSuccessful,1);assert.equal(named.tot.n.employeeMarkedSuccessful,1,'duplicate history row counted once');assert.equal(named.tot.n.driverSelfCompleted,1);
assert.equal(named.meta.una,1,'unnamed "Successful at" stays unattributed in names-only mode');assert.equal(drv.meta.una,0,'credited to trip driver in driver mode');
assert.equal(E.ignored.get('Accepted → Started'),1,'untracked transition reported, not silently dropped');
// exceptions
const X=findExceptions(ds,DEFAULT_ODO);const has=(id:string,c:string)=>X.some(e=>e.m.taskId===id&&e.cat===c);
assert.ok(has('1','Odometer image reused across trips'),'image shared by tasks 1 and 2');assert.ok(has('3','Missing start odometer image'));assert.ok(has('3','Missing start event'));
assert.equal(new Set(X.map(e=>e.id)).size,X.length,'exception IDs are unique');
// audit plus: risk, km compare, status classification
import {DEFAULT_RISK,ruleFlags,riskGroups,kmSuspicion,statusClass,level} from '../src/engine/risk';import {historyFacts} from '../src/engine/exceptions';
const fl=ruleFlags(ds,DEFAULT_RISK);
assert.ok(fl.get('1')!.has('ri'),'image shared with task 2');assert.ok(fl.get('3')!.has('mp')&&fl.get('3')!.has('mo'));assert.ok(!fl.has('2'),'non-completed tasks are not rule-checked');
const rg=riskGroups(ds.masters,fl,m=>m.driver,{...DEFAULT_RISK,min:1});assert.equal(rg.length,1);assert.equal(rg[0].n,2);assert.ok((rg[0].score??-1)>0);
assert.equal(riskGroups(ds.masters,fl,m=>m.driver,{...DEFAULT_RISK,min:5})[0].score,undefined,'too few completed trips = low data, not a score');assert.equal(level(undefined),'Low data');
const mm=(o:number,p:number)=>({...by.get('1')!,status:'Completed',odoKm:o,distanceKm:p});
assert.deepEqual(kmSuspicion(mm(10,30),DEFAULT_RISK),['PTrack KM above odometer KM (possible over-billing)']);assert.deepEqual(kmSuspicion(mm(50,10),DEFAULT_RISK),['Odometer KM above PTrack KM']);assert.deepEqual(kmSuspicion(mm(10,12),DEFAULT_RISK),[],'within tolerance');
const HF=historyFacts(ds.history);assert.equal(statusClass(by.get('3')!,HF),'Missing start event');assert.equal(statusClass(by.get('2')!,HF),'Not completed');
console.log('team upload / location performance / exceptions / audit plus checks: OK');
if(process.argv[2]){const r=run(fs.readFileSync(process.argv[2],'utf8'));const A=parseActivities(r.history);const T=teamUpload(r.masters,creators(A.acts));
 assert.equal(T.members.reduce((s,m)=>s+m.total.length,0)+T.noCreator.length,r.masters.length,'team upload reconciles to unique tasks');
 const L=locPerf(lpEvents(r.history,new Map(r.masters.map(m=>[m.taskId,m]))).events,r.masters,'named');
 assert.equal(L.employees.reduce((s,e)=>s+e.totalActivity,0),L.tot.totalActivity,'employee rows reconcile to total');assert.equal(L.locations.reduce((s,e)=>s+e.totalActivity,0),L.tot.totalActivity,'location rows reconcile to total');
 console.log('real file: tasks',r.masters.length,'members',T.members.length,'activity',L.tot.totalActivity,'reconciles')}
