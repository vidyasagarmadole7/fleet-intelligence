import {useMemo,useState} from 'react';
import Chart from '../components/Chart';import KpiModal from '../components/KpiModal';
import {Card,Col,DataTable,Empty,Header,Notice,Tile,TripsDrawer,D,f,hbar,mkKpi,pct,pie,stackedH} from '../components/Kit';
import {useFilters} from '../components/Filters';
import {Dataset,Kpi,Master} from '../engine/types';
import {G,distinct,groupBy,monthOf,primary,reviewTasks} from '../engine/groups';
import {tripFacts} from '../engine/trips';

/** One implementation behind both Vehicle Performance and Driver Performance so calculations can never drift apart. */
export interface EntityCfg{
 title:string;noun:string;nounPlural:string;
 key:(m:Master)=>string|undefined;
 notice?:string;
 extra:{label:string;f:(m:Master)=>string|undefined}[];
 checks:{label:string;f:(m:Master)=>string|undefined}[];
 showEmployees:boolean;
 missingKeyWhy:string}

const top=(g:G[],v:(g:G)=>number,n=10):D=>[...g].sort((a,b)=>v(b)-v(a)).slice(0,n).map(x=>[x.key,v(x)]);

export default function EntityModule({ds,cfg}:{ds:Dataset;cfg:EntityCfg}){
 const {ms,bar}=useFilters(ds);
 const [open,setOpen]=useState<Kpi|null>(null);const [drill,setDrill]=useState<G|null>(null);
 const T=useMemo(()=>tripFacts(ds),[ds]);
 const dur=useMemo(()=>{const o=new Map<string,number>();for(const x of T.facts)if(x.durMin!==undefined)o.set(x.m.taskId,x.durMin);return o},[T]);
 const {groups,missing}=useMemo(()=>groupBy(ms,cfg.key),[ms,cfg]);
 const withKey=useMemo(()=>ms.filter(m=>cfg.key(m)!==undefined),[ms,cfg]);
 const avgDur=(g:G)=>{const d=g.ms.map(m=>dur.get(m.taskId)).filter((x):x is number=>x!==undefined);return d.length?d.reduce((a,b)=>a+b,0)/d.length:undefined};

 const kpis=useMemo(()=>{
  const done=withKey.filter(m=>m.status==='Completed'),canc=withKey.filter(m=>m.status==='Cancelled');
  const km=done.filter(m=>m.distanceKm!==undefined&&m.distanceKm>=0);const kmSum=km.reduce((s,m)=>s+m.distanceKm!,0);
  const okN=done.filter(m=>m.startOdo!==undefined&&m.endOdo!==undefined&&(m.odoKm??-1)>=0);
  const missOdo=done.filter(m=>m.startOdo===undefined||m.endOdo===undefined);
  const revG=groups.filter(g=>g.dq!=='OK');const revT=reviewTasks(revG.flatMap(g=>g.ms));
  const none=`Tasks with no ${cfg.noun.toLowerCase()} (${cfg.missingKeyWhy})`;
  const field=cfg.noun==='Vehicle'?'Vehicle_Number':'Agent_Username';
  const k:Kpi[]=[
   mkKpi({id:'n',label:`Total ${cfg.nounPlural}`,value:f(groups.length),formula:`COUNT(DISTINCT ${field})`,sources:field,rule:'Values kept exactly as exported (no normalisation).',included:withKey,excluded:missing.length,why:none,confirm:cfg.notice?'Field mapping':undefined}),
   mkKpi({id:'t',label:'Total Trips',value:f(withKey.length),formula:`COUNT(DISTINCT Task_ID) WHERE ${field} is present`,sources:`Task_ID, ${field}`,rule:'One record per unique Task ID; history rows never counted as trips.',included:withKey,excluded:missing.length,why:none}),
   mkKpi({id:'c',label:'Completed Trips',value:f(done.length),formula:`COUNT(DISTINCT Task_ID) WHERE status = Completed AND ${field} present`,sources:`Task_ID, Task_Status, ${field}`,rule:'Status from latest history row.',confirm:'Authoritative status',included:done,excluded:withKey.length-done.length,why:'Other statuses'}),
   mkKpi({id:'x',label:'Cancelled Trips',value:f(canc.length),formula:`COUNT(DISTINCT Task_ID) WHERE status = Cancelled AND ${field} present`,sources:`Task_ID, Task_Status, ${field}`,rule:'Exact status match.',included:canc,excluded:withKey.length-canc.length,why:'Other statuses'}),
   mkKpi({id:'km',label:'Total KM (PTrack Distance)',value:f(kmSum),formula:'SUM(Distance(m) / 1000) per unique completed task',sources:'Distance(m)',rule:'Counted once per task. Blank or "-" is not zero.',included:km,excluded:done.length-km.length,why:'Completed tasks with missing or negative distance'}),
   mkKpi({id:'avg',label:'Average KM per Trip',value:km.length?f(kmSum/km.length,1):'-',formula:'Total KM / completed tasks that have a valid distance',sources:'Distance(m)',rule:'Tasks without a valid distance are not counted as 0 km.',included:km,excluded:done.length-km.length,why:'Completed tasks with missing or negative distance'}),
   mkKpi({id:'oc',label:'Odometer Compliance',value:done.length?pct(okN.length/done.length*100):'-',formula:'Completed tasks with start AND end reading and end >= start / completed tasks',sources:'Started / Completed Odometer Reading',rule:'Compliance = readings present and valid. It does not prove the readings are correct (see Odometer & KM Audit).',confirm:'Odometer compliance definition',included:okN,excluded:done.length-okN.length,why:'Completed tasks with missing or negative readings'}),
   mkKpi({id:'mo',label:'Missing Odometer Records',value:f(missOdo.length),formula:'COUNT completed tasks WHERE start OR end reading is missing',sources:'Started / Completed Odometer Reading',rule:'Missing is reported separately, never treated as 0.',included:missOdo,excluded:done.length-missOdo.length,why:'Completed tasks with both readings'}),
   mkKpi({id:'rv',label:`${cfg.nounPlural} Requiring Review`,value:f(revG.length),formula:`COUNT(${cfg.noun.toLowerCase()}s) with >= 1 warning/critical validation issue on any of their tasks`,sources:'All validated fields',rule:`Number is ${cfg.noun.toLowerCase()}s; the supporting list shows the tasks that raised the flag. A flag means "look at it", not "something is wrong".`,included:revT,excluded:groups.length-revG.length,why:`${cfg.nounPlural} with no warning/critical issue`})];
  return k},[withKey,groups,missing,cfg]);

 /* analytics */
 const byDay=useMemo(()=>{const c=new Map<string,{t:number;s:Set<string>}>();for(const m of withKey){if(!m.date)continue;const o=c.get(m.date)||{t:0,s:new Set<string>()};o.t++;o.s.add(cfg.key(m)!);c.set(m.date,o)}return[...c].sort((a,b)=>a[0]<b[0]?-1:1)},[withKey,cfg]);
 const byMonth=useMemo(()=>{const c=new Map<string,{t:number;s:Set<string>}>();for(const m of withKey){if(!m.date)continue;const k=monthOf(m.date);const o=c.get(k)||{t:0,s:new Set<string>()};o.t++;o.s.add(cfg.key(m)!);c.set(k,o)}return[...c].sort((a,b)=>a[0]<b[0]?-1:1)},[withKey,cfg]);
 const topTrips=useMemo(()=>[...groups].sort((a,b)=>b.total-a.total).slice(0,10),[groups]);
 const pdKeys=useMemo(()=>distinct(withKey,m=>m.pickupDrop).map(x=>x[0]),[withKey]);
 const durTop=useMemo(()=>topTrips.map(g=>[g.key,avgDur(g)] as [string,number|undefined]).filter((x):x is [string,number]=>x[1]!==undefined),[topTrips,dur]);

 /* assignment verification: one entity linked to more than one value of another field. Informational - may be legitimate. */
 const verify=useMemo(()=>cfg.checks.map(c=>{const rows=groups.map(g=>({g,vals:distinct(g.ms,c.f)})).filter(x=>x.vals.length>1).sort((a,b)=>b.vals.length-a.vals.length);return{label:c.label,rows}}),[groups,cfg]);

 const cols:Col<G>[]=[
  {key:'k',label:cfg.noun,get:g=>g.key},
  ...cfg.extra.map((e,i)=>({key:'x'+i,label:e.label,get:(g:G)=>primary(g.ms,e.f)})),
  {key:'t',label:'Total Trips',get:g=>g.total,right:true},{key:'d',label:'Completed',get:g=>g.done,right:true},{key:'c',label:'Cancelled',get:g=>g.canc,right:true},
  {key:'km',label:'Total KM',get:g=>Math.round(g.km*10)/10,right:true},{key:'a',label:'Avg KM / Trip',get:g=>g.avgKm===undefined?undefined:+g.avgKm.toFixed(1),right:true},
  {key:'oc',label:'Odometer Compliance %',get:g=>g.compliance===undefined?undefined:+g.compliance.toFixed(1),show:g=>pct(g.compliance),right:true},
  {key:'du',label:'Avg Duration (min)',get:g=>{const a=avgDur(g);return a===undefined?undefined:+a.toFixed(1)},right:true},
  {key:'ad',label:'Active Days',get:g=>g.days.size,right:true},{key:'ld',label:'Last Trip Date',get:g=>g.lastDate},
  {key:'as',label:'Activity Status',get:g=>g.done>0?'Active (has completed trips)':'No completed trips'},
  {key:'q',label:'Data Quality Status',get:g=>g.dq,show:g=><span className={g.dq==='Critical'?'text-red-600 font-medium':g.dq==='Review'?'text-amber-600':'text-emerald-600'}>{g.dq}</span>}];

 if(!ds.masters.length)return <Empty text="The imported file has no trips."/>;
 return <div className="space-y-5">
  <Header title={cfg.title} ds={ds} shown={ms.length} total={ds.masters.length}/>
  {bar}
  {cfg.notice&&<Notice>Requires PTrack Confirmation: {cfg.notice}</Notice>}
  {missing.length>0&&<Notice tone="slate">{f(missing.length)} task(s) in this filter have no {cfg.noun.toLowerCase()} ({cfg.missingKeyWhy}). They are excluded from this module and listed in the KPI details, not counted as an "unknown {cfg.noun.toLowerCase()}".</Notice>}
  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{kpis.map(k=><Tile key={k.id} k={k} onOpen={setOpen}/>)}</div>
  {groups.length===0?<Empty text={`No ${cfg.nounPlural.toLowerCase()} found for the current filters.`}/>:<>
  <div className="grid lg:grid-cols-2 gap-4">
   <Card t={`Top 10 ${cfg.nounPlural.toLowerCase()} by trips`}><Chart h={320} option={hbar(top(groups,g=>g.total))}/></Card>
   <Card t={`Top 10 ${cfg.nounPlural.toLowerCase()} by PTrack KM`} note="Completed tasks with a valid distance only"><Chart h={320} option={hbar(top(groups,g=>Math.round(g.km)))}/></Card>
   <Card t="Completion performance (top 10 by trips)" note="Other = Unassigned / Assigned / Accepted / In Transit / unknown statuses"><Chart h={320} option={stackedH(topTrips.map(g=>g.key),[{name:'Completed',data:topTrips.map(g=>g.done)},{name:'Cancelled',data:topTrips.map(g=>g.canc)},{name:'Failed',data:topTrips.map(g=>g.fail)},{name:'Other',data:topTrips.map(g=>g.total-g.done-g.canc-g.fail)}])}/></Card>
   <Card t="Pickup vs Drop (top 10 by trips)" note="Tasks with no PICKUPDROP value are not shown in this chart"><Chart h={320} option={pdKeys.length?stackedH(topTrips.map(g=>g.key),pdKeys.map(k=>({name:k,data:topTrips.map(g=>g.ms.filter(m=>m.pickupDrop===k).length)}))):{title:{text:'No PICKUPDROP data',left:'center',top:'center'}}}/></Card>
   <Card t={`Daily trips and active ${cfg.nounPlural.toLowerCase()}`} note="Active = at least one trip on that scheduled date"><Chart option={{legend:{top:0},xAxis:{type:'category',data:byDay.map(d=>d[0])},yAxis:{type:'value'},series:[{name:'Trips',type:'bar',data:byDay.map(d=>d[1].t)},{name:`Active ${cfg.nounPlural.toLowerCase()}`,type:'line',data:byDay.map(d=>d[1].s.size)}]}}/></Card>
   <Card t={`Monthly trips and active ${cfg.nounPlural.toLowerCase()}`}><Chart option={{legend:{top:0},xAxis:{type:'category',data:byMonth.map(d=>d[0])},yAxis:{type:'value'},series:[{name:'Trips',type:'bar',data:byMonth.map(d=>d[1].t)},{name:`Active ${cfg.nounPlural.toLowerCase()}`,type:'line',data:byMonth.map(d=>d[1].s.size)}]}}/></Card>
   {cfg.showEmployees&&<Card t="Employees transported (top 10)" note="Employee field per Settings (default Actual_Emp), completed tasks only, blank not counted as 0"><Chart h={320} option={hbar(top(groups,g=>g.emp))}/></Card>}
   <Card t="Average trip duration, minutes (top 10 by trips)" note={durTop.length?'"Started at" to "Successful at" in history. Requires PTrack Confirmation.':'No trips with both timestamps'}><Chart h={320} option={durTop.length?hbar(durTop):{title:{text:'No duration data',left:'center',top:'center'}}}/></Card>
   <Card t={`${cfg.noun} assignment verification`} note="Informational. One entity linked to several values can be legitimate (shared vehicle, relief driver, vendor change). It is listed for review only.">
    <table className="text-sm w-full"><tbody>{verify.map(v=><tr key={v.label} className="border-b last:border-0 align-top"><td className="py-1.5">{v.label}</td><td className="text-right font-medium">{f(v.rows.length)}</td></tr>)}</tbody></table>
    {verify.map(v=>v.rows.length>0&&<details key={v.label} className="mt-2 text-xs"><summary className="cursor-pointer text-blue-600">{v.label}: show {Math.min(15,v.rows.length)} of {v.rows.length}</summary>
     <ul className="mt-1 space-y-1">{v.rows.slice(0,15).map(x=><li key={x.g.key}><span className="font-medium">{x.g.key}</span>: {x.vals.slice(0,4).map(y=>`${y[0]} (${y[1]})`).join(', ')}{x.vals.length>4?` +${x.vals.length-4} more`:''}</li>)}</ul></details>)}</Card>
  </div>
  <DataTable title={`${cfg.noun} table`} rows={groups} cols={cols} exportName={`${cfg.noun.toLowerCase()}_performance.csv`} defaultSort={['t',-1]} onRow={setDrill} search={g=>g.key+' '+cfg.extra.map(e=>primary(g.ms,e.f)).join(' ')}
   note={`Click a row to see every trip for that ${cfg.noun.toLowerCase()}. ${cfg.noun==='Vehicle'?'Utilization % is not calculated: the export has no operating-days or availability data. Active Days is shown instead.':'Utilization is not scored; Active Days and Last Trip Date are shown instead.'}`}/></>}
  {open&&<KpiModal k={open} onClose={()=>setOpen(null)}/>}
  {drill&&<TripsDrawer title={`${cfg.noun}: ${drill.key}`} sub={`${f(drill.total)} trips | ${f(drill.done)} completed | ${f(drill.canc)} cancelled | ${f(drill.km,1)} KM`} ms={drill.ms} onClose={()=>setDrill(null)}/>}
 </div>}
