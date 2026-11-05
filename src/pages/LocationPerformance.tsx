import {useMemo,useState} from 'react';
import Chart from '../components/Chart';import KpiModal from '../components/KpiModal';
import {Card,Col,DataTable,Drawer,Empty,Notice,Tile,D,f,hbar,mkKpi,pct,pie,stackedH} from '../components/Kit';
import {useFilters} from '../components/Filters';
import {Dataset,Kpi} from '../engine/types';
import {DSC,LPT,LPU,LpDriver,LpEvent,LpRow,lpEvents,locPerf} from '../engine/locperf';
import {employeeLocation} from '../engine/teamupload';

const day=(ms?:number)=>ms===undefined?undefined:new Date(ms).toISOString().slice(0,10);
const tm=(ms?:number)=>ms===undefined?undefined:new Date(ms).toISOString().slice(11,16);

/** History-based activity by employee, location and driver (ported from the v11 "Location Performance" tab). */
export default function LocationPerformance({ds}:{ds:Dataset}){
 const [mode,setMode]=useState<'named'|'driver'>('named');
 const toggle=<span className="flex gap-1 text-sm"><button className={`px-3 py-1.5 rounded border ${mode==='named'?'bg-blue-600 text-white':'bg-white'}`} onClick={()=>setMode('named')} title="Unnamed 'Successful at' events stay unattributed">History names only</button>
  <button className={`px-3 py-1.5 rounded border ${mode==='driver'?'bg-blue-600 text-white':'bg-white'}`} onClick={()=>setMode('driver')} title="Unnamed 'Successful at' events are credited to the trip driver">Use trip driver</button></span>;
 const {ms,bar}=useFilters(ds,toggle);
 const E=useMemo(()=>lpEvents(ds.history,new Map(ds.masters.map(m=>[m.taskId,m]))),[ds]);
 const L=useMemo(()=>locPerf(E.events,ms,mode),[E,ms,mode]);
 const [open,setOpen]=useState<Kpi|null>(null);const [drill,setDrill]=useState<{t:string;ev:LpEvent[]}|null>(null);
 const named=useMemo(()=>L.employees.filter(e=>!e.isUna).sort((a,b)=>b.totalActivity-a.totalActivity||a.name.localeCompare(b.name)),[L]);
 const locs=useMemo(()=>[...L.locations].sort((a,b)=>b.totalActivity-a.totalActivity||a.name.localeCompare(b.name)),[L]);
 const allEv=useMemo(()=>L.employees.flatMap(e=>e.ev),[L]);
 const active=LPT.map((t,i)=>({t,i})).filter(x=>L.tot.n[x.t.k]>0);
 const T=L.tot.totalActivity;

 const kpis=useMemo(()=>[...LPT.map((t,i)=>{
   const ev=allEv.filter(o=>o.t===i);const tasks=[...new Map(ev.map(o=>[o.m.taskId,o.m])).values()];
   return mkKpi({id:t.k,label:t.label,value:f(L.tot.n[t.k]),formula:`COUNT(history events) classified as "${t.label}"`,sources:'History_Description',rule:'Value counts EVENTS (one task can have several). The supporting list shows the unique tasks behind them. Exact duplicate history rows are counted once.',included:tasks,excluded:0,confirm:i===DSC||i===11?'Meaning of "Successful at" with / without a name':undefined})}),
   mkKpi({id:'tot',label:'Total Activity',value:f(T),formula:'SUM of the 13 tracked activity types',sources:'History_Description',rule:'Includes events with no employee name (unattributed).',included:[...new Map(allEv.map(o=>[o.m.taskId,o.m])).values()],excluded:0})],[L,allEv]);

 const topEmp=named.slice(0,15);
 const stack=(rows:LpRow[],names:(r:LpRow)=>string)=>stackedH(rows.map(names),active.map(({t})=>({name:t.label,data:rows.map(r=>r.n[t.k])})));
 const drvTop=useMemo(()=>[...L.drivers].filter(d=>d.driverSelfCompleted>0).sort((a,b)=>b.driverSelfCompleted-a.driverSelfCompleted||a.driver.localeCompare(b.driver)).slice(0,10).map(d=>[d.driver,d.driverSelfCompleted] as [string,number]),[L]);
 const trend=useMemo(()=>{const c=new Map<string,number>();for(const o of allEv)if(o.t===DSC){const k=day(o.ms);if(k)c.set(k,(c.get(k)||0)+1)}return[...c].sort((a,b)=>a[0]<b[0]?-1:1).slice(-14)},[allEv]);

 const typeCols=<T extends {n:Record<string,number>;totalActivity:number}>(g:(r:T)=>T)=>LPT.map(t=>({key:t.k,label:t.label,get:(r:T)=>g(r).n[t.k],right:true}) as Col<T>);
 const lcol:Col<LpRow>[]=[{key:'nm',label:'Location',get:r=>r.name},...typeCols<LpRow>(r=>r),{key:'tot',label:'Total activity',get:r=>r.totalActivity,right:true},{key:'sh',label:'Share %',get:r=>+(r.totalActivity/T*100).toFixed(1),right:true}];
 const ecol:Col<LpRow>[]=[{key:'nm',label:'Employee',get:r=>r.name+(r.isDrv?' (driver)':'')},...typeCols<LpRow>(r=>r),{key:'tot',label:'Total activity',get:r=>r.totalActivity,right:true}];
 const dcol:Col<LpDriver>[]=[{key:'d',label:'Driver / Agent',get:d=>d.driver},{key:'t',label:'Total Trips',get:d=>d.totalTrips,right:true},{key:'a',label:'Accepted → Successful',get:d=>d.acceptedToSuccessful,right:true},{key:'s',label:'Started → Successful',get:d=>d.startedToSuccessful,right:true},
  {key:'st',label:'Successful Trips',get:d=>d.successfulTrips,right:true},{key:'sc',label:'Driver Self-Completed Trips',get:d=>d.driverSelfCompleted,right:true},{key:'r',label:'Success Rate %',get:d=>+d.successRate.toFixed(1),show:d=>pct(d.successRate),right:true}];
 const evCols:Col<LpEvent>[]=[{key:'t',label:'Task ID',get:o=>o.m.taskId},{key:'d',label:'Date',get:o=>day(o.ms)},{key:'tm',label:'Time (as exported)',get:o=>tm(o.ms)},{key:'c',label:'Company',get:o=>o.m.company},{key:'dr',label:'Driver',get:o=>o.m.driver},
  {key:'e',label:'Employee',get:o=>o.nm||LPU},{key:'a',label:'Activity',get:o=>LPT[o.t].label},{key:'l',label:'Location',get:o=>employeeLocation(o.m)},{key:'o',label:'Original description',get:o=>o.desc}];
 const ign=[...E.ignored];

 if(!ds.masters.length)return <Empty text="The imported file has no trips."/>;
 return <div className="space-y-5">
  {bar}
  <Notice tone="slate">{f(L.meta.tasks)} trips in scope | {f(L.meta.matched)} matched history events | source: History_Description. <b>Successful at</b> with no name = the driver completed the trip himself (Driver Self-Completed). <b>Successful at NAME</b> = that employee marked it successful. <b>Status updated from X to Y by NAME</b> is credited to the named employee. Location Modified = <b>Modified by NAME</b>. Location = employee location (PICKUP: Pickup_Address, DROP: Customer_Address). All rules are from the v11 audit dashboard and need PTrack confirmation.</Notice>
  {ign.length>0&&<Notice>{f(ign.reduce((s,x)=>s+x[1],0))} status-change event(s) in the file are not one of the 13 tracked types and are NOT counted: {ign.map(([k,n])=>`${k} (${n})`).join(', ')}.</Notice>}
  {T===0?<Empty text="No Location Performance activity found for the current filters. Widen the date range or clear a filter."/>:<>
  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{kpis.map(k=><Tile key={k.id} k={k} onOpen={setOpen}/>)}</div>
  <div className="grid lg:grid-cols-2 gap-4">
   <Card t="Employee activity performance (top 15 named)" note={L.meta.una?`${f(L.meta.una)} events have no employee name and are not shown here`:undefined}><Chart h={420} option={topEmp.length?stack(topEmp,r=>r.name+(r.isDrv?' (driver)':'')):{title:{text:'No named employees in scope',left:'center',top:'center'}}}/></Card>
   <Card t="Activity distribution"><Chart h={420} option={pie(active.map(({t})=>[t.label,L.tot.n[t.k]] as D[number]))}/></Card>
   <Card t="Top 10 locations by activity" note="Employee location"><Chart h={380} option={stack(locs.slice(0,10),r=>r.name)}/></Card>
   <Card t="Successful conversion paths" note="Every tracked transition into Successful, plus Successful at NAME"><Chart h={380} option={hbar(active.filter(x=>x.i>=1&&x.i<=11).map(({t})=>[t.label,L.tot.n[t.k]] as D[number]))}/></Card>
   <Card t="Driver self-completed trips (top 10)" note="Unique trips with a plain 'Successful at' event"><Chart h={340} option={drvTop.length?hbar(drvTop):{title:{text:'None in scope',left:'center',top:'center'}}}/></Card>
   <Card t="Driver self-completed trend" note="Daily events, latest 14 dates in scope"><Chart h={340} option={{xAxis:{type:'category',data:trend.map(x=>x[0])},yAxis:{type:'value'},series:[{type:'bar',data:trend.map(x=>x[1])}]}}/></Card>
  </div>
  <DataTable title="Location performance details" rows={locs} cols={lcol} exportName="location_performance_activity.csv" defaultSort={['tot',-1]} search={r=>r.name} onRow={r=>setDrill({t:`Location: ${r.name}`,ev:r.ev})} note="Click a row to see the underlying history events."/>
  <DataTable title="Employee performance details" rows={named} cols={ecol} exportName="employee_performance_activity.csv" defaultSort={['tot',-1]} search={r=>r.name} onRow={r=>setDrill({t:`Employee: ${r.name}`,ev:r.ev})}/>
  <DataTable title="Driver performance" rows={L.drivers} cols={dcol} exportName="driver_activity_performance.csv" defaultSort={['sc',-1]} search={d=>d.driver} onRow={d=>setDrill({t:`Driver: ${d.driver}`,ev:d.ev})}
   note="Driver Self-Completed = unique trips with a plain 'Successful at' event. Success Rate = unique trips with any tracked successful event / total trips in scope."/></>}
  {open&&<KpiModal k={open} onClose={()=>setOpen(null)}/>}
  {drill&&<Drawer title={drill.t} sub={`${f(drill.ev.length)} events`} onClose={()=>setDrill(null)}><DataTable title="History events" rows={drill.ev} cols={evCols} pageSize={15} exportName={`${drill.t.replace(/\W+/g,'_')}_events.csv`} defaultSort={['d',-1]} search={o=>[o.m.taskId,o.nm,o.desc].join(' ')}/></Drawer>}
 </div>}
