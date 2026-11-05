import {useMemo,useState} from 'react';
import Chart from '../components/Chart';import KpiModal from '../components/KpiModal';
import {Card,Col,DataTable,Empty,Header,Notice,Tile,TripsDrawer,D,f,hbar,mkKpi,pct,stackedH} from '../components/Kit';
import {useFilters} from '../components/Filters';
import {Config,Dataset,Kpi,Master} from '../engine/types';
import {G,distinct,groupBy,monthOf} from '../engine/groups';import {employeeLocation,locationEvidence} from '../engine/teamupload';

type LocField='empLoc'|'orderId'|'pickupAddr'|'dropAddr';
const LOC:{k:LocField;label:string;src:string}[]=[{k:'empLoc',label:'Employee location (PICKUP: Pickup, DROP: Customer address)',src:'Pickup_Address / Customer_Address by PICKUPDROP'},{k:'orderId',label:'Order ID',src:'Order_ID'},{k:'pickupAddr',label:'Pickup Address',src:'Pickup_Address'},{k:'dropAddr',label:'Customer Address',src:'Customer_Address'}];
const NO_CO='(Company missing)';
const top=(g:G[],v:(g:G)=>number,n=10):D=>[...g].sort((a,b)=>v(b)-v(a)).slice(0,n).map(x=>[x.key,v(x)]);

export default function Company({ds,cfg}:{ds:Dataset;cfg:Config}){
 const [loc,setLoc]=useState<LocField>('empLoc');
 const L=LOC.find(l=>l.k===loc)!;
 const {ms,bar}=useFilters(ds,<label className="text-sm flex items-center gap-1">Location field<select className="border rounded p-1.5 bg-white" value={loc} onChange={e=>setLoc(e.target.value as LocField)}>{LOC.map(l=><option key={l.k} value={l.k}>{l.label}</option>)}</select></label>);
 const [open,setOpen]=useState<Kpi|null>(null);const [drill,setDrill]=useState<{t:string;sub:string;ms:Master[]}|null>(null);
 const {groups}=useMemo(()=>groupBy(ms,m=>m.company??NO_CO,cfg.employeeField),[ms,cfg.employeeField]);
 const locOf=(m:Master):string|undefined=>loc==='empLoc'?employeeLocation(m):m[loc];
 const ev=useMemo(()=>locationEvidence(ds.masters),[ds]);
 const evTxt=(x:{n:number;hit:number})=>x.n?`${(x.hit/x.n*100).toFixed(0)}%`:'n/a';
 const locGroups=useMemo(()=>groupBy(ms.filter(m=>locOf(m)!==undefined),m=>(m.company??NO_CO)+'\u0001'+locOf(m),cfg.employeeField).groups,[ms,loc,cfg.employeeField]);
 const noLoc=ms.filter(m=>locOf(m)===undefined);
 const empLabel=cfg.employeeField==='actual'?'Actual_Emp':cfg.employeeField==='inCab'?'In Cab Employees':'Planned_Emp';

 const kpis=useMemo(()=>{
  const named=ms.filter(m=>m.company);const done=ms.filter(m=>m.status==='Completed'),canc=ms.filter(m=>m.status==='Cancelled');
  const km=done.filter(m=>m.distanceKm!==undefined&&m.distanceKm>=0);const kmSum=km.reduce((s,m)=>s+m.distanceKm!,0);
  const emp=done.filter(m=>m[cfg.employeeField]!==undefined);
  const base=cfg.completionBase==='all'?ms:ms.filter(m=>['Completed','Cancelled','Failed'].includes(m.status??''));
  const withLoc=ms.filter(m=>locOf(m)!==undefined);
  return[
   mkKpi({id:'co',label:'Total Companies',value:f(new Set(named.map(m=>m.company)).size),formula:'COUNT(DISTINCT Team_Name)',sources:'Team_Name',rule:'Team_Name is treated as Company Name only as a working assumption. Original values preserved.',confirm:'Team_Name = Company Name',included:named,excluded:ms.length-named.length,why:'Tasks with no Team_Name'}),
   mkKpi({id:'lo',label:`Total Locations (${L.label})`,value:f(new Set(withLoc.map(locOf)).size),formula:`COUNT(DISTINCT ${L.src})`,sources:L.src,rule:'The location field is selectable. Order_ID is NOT assumed to be an employee location.',confirm:'Business meaning of Order_ID / address direction',included:withLoc,excluded:noLoc.length,why:`Tasks with no ${L.src}`}),
   mkKpi({id:'t',label:'Total Trips',value:f(ms.length),formula:'COUNT(DISTINCT Task_ID)',sources:'Task_ID',rule:'Includes tasks with no company (shown as "(Company missing)" in the ranking so totals reconcile).',included:ms}),
   mkKpi({id:'km',label:'Total KM (PTrack Distance)',value:f(kmSum),formula:'SUM(Distance(m) / 1000) per unique completed task',sources:'Distance(m)',rule:'Counted once per task, never per history row.',included:km,excluded:done.length-km.length,why:'Completed tasks with missing or negative distance'}),
   mkKpi({id:'emp',label:'Employees Transported',value:f(emp.reduce((s,m)=>s+(m[cfg.employeeField] as number),0)),formula:`SUM(${empLabel}) per unique completed task`,sources:empLabel,rule:'Field is chosen in Settings (Executive Overview). Blank is not 0.',confirm:'Which employee field defines "travelled"',included:emp,excluded:done.length-emp.length,why:'Completed tasks with no value in the chosen field'}),
   mkKpi({id:'cx',label:'Cancellation %',value:base.length?pct(canc.length/base.length*100):'-',formula:cfg.completionBase==='all'?'Cancelled / all unique tasks':'Cancelled / (Completed + Cancelled + Failed)',sources:'Task_ID, Task_Status',rule:'Same denominator setting as Completion Rate on the Executive Overview.',confirm:'Whether open / Unassigned tasks belong in the denominator',included:canc,excluded:base.length-canc.length,why:'Tasks not cancelled'}),
   mkKpi({id:'av',label:'Average KM per Trip',value:km.length?f(kmSum/km.length,1):'-',formula:'Total KM / completed tasks with a valid distance',sources:'Distance(m)',rule:'Tasks without a valid distance are not counted as 0 km.',included:km,excluded:done.length-km.length,why:'Completed tasks with missing or negative distance'})]},[ms,cfg,loc]);

 const top5=useMemo(()=>[...groups].sort((a,b)=>b.total-a.total).slice(0,5).map(g=>g.key),[groups]);
 const series=(keyFn:(m:Master)=>string|undefined)=>{
  const c=new Map<string,Map<string,number>>();
  for(const m of ms){const k=keyFn(m);if(!k)continue;const co=m.company??NO_CO;const name=top5.includes(co)?co:'Other companies';const o=c.get(k)||new Map();o.set(name,(o.get(name)||0)+1);c.set(k,o)}
  const x=[...c.keys()].sort();return{x,names:[...top5,'Other companies'],get:(n:string)=>x.map(k=>c.get(k)?.get(n)||0)}};
 const daily=useMemo(()=>series(m=>m.date),[ms,top5]),monthly=useMemo(()=>series(m=>m.date?monthOf(m.date):undefined),[ms,top5]);
 const locTop=useMemo(()=>top(locGroups,g=>g.total),[locGroups]);
 const pickDist=useMemo(()=>distinct(ms,m=>m.pickupAddr).slice(0,10),[ms]),dropDist=useMemo(()=>distinct(ms,m=>m.dropAddr).slice(0,10),[ms]);
 const cancTop=useMemo(()=>[...groups].filter(g=>g.total>=5).sort((a,b)=>b.canc/b.total-a.canc/a.total).slice(0,10).map(g=>[g.key,+(g.canc/g.total*100).toFixed(1)] as [string,number]),[groups]);

 const cCols:Col<G>[]=[
  {key:'rk',label:'Company',get:g=>g.key},{key:'t',label:'Total Trips',get:g=>g.total,right:true},{key:'d',label:'Completed',get:g=>g.done,right:true},{key:'c',label:'Cancelled',get:g=>g.canc,right:true},
  {key:'cp',label:'Cancellation %',get:g=>+(g.canc/g.total*100).toFixed(1),show:g=>pct(g.canc/g.total*100),right:true},
  {key:'km',label:'Total KM',get:g=>Math.round(g.km*10)/10,right:true},{key:'a',label:'Avg KM / Trip',get:g=>g.avgKm===undefined?undefined:+g.avgKm.toFixed(1),right:true},
  {key:'e',label:`Employees (${empLabel})`,get:g=>g.empN?g.emp:undefined,right:true},
  {key:'l',label:`Distinct ${L.label}`,get:g=>new Set(g.ms.map(locOf).filter(Boolean)).size,right:true}];
 const lCols:Col<G>[]=[
  {key:'co',label:'Company Name',get:g=>g.ms[0].company??NO_CO},{key:'lo',label:`Location / ${L.label}`,get:g=>locOf(g.ms[0])},
  {key:'t',label:'Total Trips',get:g=>g.total,right:true},{key:'d',label:'Completed',get:g=>g.done,right:true},{key:'c',label:'Cancelled',get:g=>g.canc,right:true},
  {key:'km',label:'Total KM',get:g=>Math.round(g.km*10)/10,right:true},{key:'e',label:'Employee Count',get:g=>g.empN?g.emp:undefined,right:true},
  {key:'a',label:'Avg KM / Trip',get:g=>g.avgKm===undefined?undefined:+g.avgKm.toFixed(1),right:true}];

 if(!ds.masters.length)return <Empty text="The imported file has no trips."/>;
 return <div className="space-y-5">
  <Header title="Company / Location Performance" ds={ds} shown={ms.length} total={ds.masters.length}/>
  {bar}
  <Notice>Requires PTrack Confirmation: Team_Name is used as Company Name. Default location = employee location (PICKUP trip: Pickup_Address, DROP trip: Customer_Address), the rule used in the v11 audit dashboard. Check on this file: Order_ID equals that location on {evTxt(ev.pickup)} of PICKUP and {evTxt(ev.drop)} of DROP trips. Other fields can be chosen above. Values are shown exactly as exported.</Notice>
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{kpis.map(k=><Tile key={k.id} k={k} onOpen={setOpen}/>)}</div>
  {ms.length===0?<Empty text="No trips match the filters."/>:<>
  <div className="grid lg:grid-cols-2 gap-4">
   <Card t="Company ranking: top 10 by trips"><Chart h={320} option={hbar(top(groups,g=>g.total))}/></Card>
   <Card t="Company KM comparison: top 10 by PTrack KM" note="Completed tasks with a valid distance only"><Chart h={320} option={hbar(top(groups,g=>Math.round(g.km)))}/></Card>
   <Card t="Cancellation % by company" note="Only companies with at least 5 trips, so one cancelled trip does not show as 100%"><Chart h={320} option={cancTop.length?hbar(cancTop):{title:{text:'No company has 5+ trips in this filter',left:'center',top:'center'}}}/></Card>
   <Card t={`Location ranking: top 10 ${L.label} by trips`} note={`Company + ${L.label}; meaning requires PTrack confirmation`}><Chart h={320} option={locTop.length?hbar(locTop.map(x=>[x[0].split('\u0001').reverse().join(' / '),x[1]] as [string,number])):{title:{text:`No ${L.src} data`,left:'center',top:'center'}}}/></Card>
   <Card t="Pickup address distribution (top 10)" note="Raw Pickup_Address values. Direction depends on PICKUPDROP; not interpreted."><Chart h={320} option={pickDist.length?hbar(pickDist):{title:{text:'No Pickup_Address data',left:'center',top:'center'}}}/></Card>
   <Card t="Customer address distribution (top 10)" note="Raw Customer_Address values. Direction depends on PICKUPDROP; not interpreted."><Chart h={320} option={dropDist.length?hbar(dropDist):{title:{text:'No Customer_Address data',left:'center',top:'center'}}}/></Card>
   <Card t="Daily trips: top 5 companies" note="Scheduled date"><Chart option={{legend:{top:0},xAxis:{type:'category',data:daily.x},yAxis:{type:'value'},series:daily.names.map(n=>({name:n,type:'line',data:daily.get(n)}))}}/></Card>
   <Card t="Monthly trips: top 5 companies + others"><Chart option={{legend:{top:0},xAxis:{type:'category',data:monthly.x},yAxis:{type:'value'},series:monthly.names.map(n=>({name:n,type:'bar',stack:'m',data:monthly.get(n)}))}}/></Card>
  </div>
  <DataTable title="Company performance ranking" rows={groups} cols={cCols} exportName="company_performance.csv" defaultSort={['t',-1]} search={g=>g.key}
   onRow={g=>setDrill({t:`Company: ${g.key}`,sub:`${f(g.total)} trips | ${f(g.km,1)} KM`,ms:g.ms})} note="Click a row to see every trip for that company."/>
  <DataTable title={`Location performance (${L.label})`} rows={locGroups} cols={lCols} exportName="location_performance.csv" defaultSort={['t',-1]} search={g=>(g.ms[0].company??'')+' '+(locOf(g.ms[0])??'')}
   onRow={g=>setDrill({t:`${g.ms[0].company??NO_CO} / ${locOf(g.ms[0])}`,sub:`${f(g.total)} trips`,ms:g.ms})}
   note={`${f(noLoc.length)} task(s) have no ${L.src} and are not in this table. "Employee Count" follows the employee field in Settings.`}/></>}
  {open&&<KpiModal k={open} onClose={()=>setOpen(null)}/>}
  {drill&&<TripsDrawer title={drill.t} sub={drill.sub} ms={drill.ms} onClose={()=>setDrill(null)}/>}
 </div>}
