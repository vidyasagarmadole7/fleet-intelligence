import {useMemo,useState} from 'react';
import Chart from '../components/Chart';import KpiModal from '../components/KpiModal';
import {Card,Col,DataTable,Drawer,Empty,Header,Notice,Tile,TripsDrawer,f,hbar,mkKpi,pie} from '../components/Kit';
import {useFilters} from '../components/Filters';
import {Dataset,Kpi,Master} from '../engine/types';
import {DEFAULT_ODO} from '../engine/odometer';
import {Exc,REVIEW_STATUSES,Review,findExceptions} from '../engine/exceptions';

const KEY='fleet_intelligence_exception_reviews';
const load=():Record<string,Review>=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}};
const SEV:Record<string,string>={High:'text-red-600 font-medium',Medium:'text-amber-600',Low:'text-slate-500'};

/** Exception Management: automated findings + human review status. Review notes live only in this browser. */
export default function Exceptions({ds}:{ds:Dataset}){
 const {ms,bar}=useFilters(ds);
 const [rev,setRev]=useState<Record<string,Review>>(load);
 const [cat,setCat]=useState('');const [sev,setSev]=useState('');const [rs,setRs]=useState('');
 const [open,setOpen]=useState<Kpi|null>(null);const [edit,setEdit]=useState<Exc|null>(null);const [trips,setTrips]=useState<{t:string;ms:Master[]}|null>(null);
 const all=useMemo(()=>findExceptions(ds,DEFAULT_ODO),[ds]);
 const byId=useMemo(()=>new Map(ds.masters.map(m=>[m.taskId,m])),[ds]);
 const inScope=useMemo(()=>{const s=new Set(ms.map(m=>m.taskId));return all.filter(e=>s.has(e.m.taskId))},[all,ms]);
 const status=(e:Exc)=>rev[e.id]?.st??'Pending';
 const rows=useMemo(()=>inScope.filter(e=>(!cat||e.cat===cat)&&(!sev||e.sev===sev)&&(!rs||status(e)===rs)),[inScope,cat,sev,rs,rev]);
 const cats=useMemo(()=>[...new Set(inScope.map(e=>e.cat))].sort(),[inScope]);
 const actualOne=useMemo(()=>{const a=ds.masters.map(m=>m.actual).filter((x):x is number=>x!==undefined);return a.length?a.filter(x=>x===1).length/a.length*100:0},[ds]);

 const save=(e:Exc,v:Review)=>{const n={...rev,[e.id]:v};setRev(n);try{localStorage.setItem(KEY,JSON.stringify(n))}catch{/* storage unavailable: kept in memory only */}};
 const kpis=useMemo(()=>{
  const mk=(id:string,label:string,list:Exc[],formula:string,rule:string,value?:string)=>mkKpi({id,label,value:value??f(list.length),formula,sources:'Task Master, History_Description, odometer fields',rule,included:[...new Map(list.map(e=>[e.m.taskId,e.m])).values()],excluded:0,why:'None'});
  return[mk('t','Total Exceptions',inScope,'COUNT(findings) in the current filters','One finding per task + category. A finding is a lead for review, not proof of an error.'),
   mk('h','High severity',inScope.filter(e=>e.sev==='High'),'COUNT(findings) with severity High','Severity per rule (reading reversal, reused image, critical odometer audit).'),
   mk('m','Medium severity',inScope.filter(e=>e.sev==='Medium'),'COUNT(findings) with severity Medium','Severity per rule.'),
   mk('l','Low severity',inScope.filter(e=>e.sev==='Low'),'COUNT(findings) with severity Low','Severity per rule.'),
   mk('p','Pending review',inScope.filter(e=>status(e)==='Pending'),'COUNT(findings) with review status Pending','Review status is saved in this browser only.'),
   mk('x','Tasks affected',inScope,'COUNT(DISTINCT Task_ID) with at least one finding','',f(new Set(inScope.map(e=>e.m.taskId)).size))]},[inScope,rev]);

 const cols:Col<Exc>[]=[
  {key:'id',label:'Exception ID',get:e=>e.id},{key:'t',label:'Task ID',get:e=>e.m.taskId},{key:'d',label:'Date',get:e=>e.m.date},{key:'c',label:'Company',get:e=>e.m.company},{key:'v',label:'Vehicle',get:e=>e.m.vehicle},{key:'dr',label:'Driver',get:e=>e.m.driver},
  {key:'cat',label:'Exception Type',get:e=>e.cat},{key:'s',label:'Severity',get:e=>e.sev,show:e=><span className={SEV[e.sev]}>{e.sev}</span>},{key:'ds',label:'Description',get:e=>e.desc},{key:'so',label:'Source Data',get:e=>e.source},
  {key:'r',label:'Related Task IDs',get:e=>e.related.slice(0,6).join(' ')||undefined},{key:'rs',label:'Review Status',get:e=>status(e)},{key:'as',label:'Assigned To',get:e=>rev[e.id]?.as||undefined},{key:'nt',label:'Reviewer Comments',get:e=>rev[e.id]?.nt||undefined},{key:'at',label:'Reviewed At',get:e=>rev[e.id]?.at}];

 if(!ds.masters.length)return <Empty text="The imported file has no trips."/>;
 return <div className="space-y-5">
  <Header title="Exception Management" ds={ds} shown={ms.length} total={ds.masters.length}/>
  {bar}
  <Notice>Review status, assignee and comments are saved <b>only in this browser</b> (not on a server). Use "Export" to keep a copy. Findings are recalculated from the CSV, so re-importing never creates duplicates. Planned / Actual / In-Cab mismatches are not queued here{actualOne>=80?` because Actual_Emp is 1 on ${actualOne.toFixed(0)}% of trips, which would bury real findings`:''}; they stay in Employee & Occupancy. Thresholds: odometer vs PTrack tolerance {DEFAULT_ODO.gapKm} km, plausible trip {DEFAULT_ODO.maxTripKm} km, duration 3-300 min (v11 values, need PTrack confirmation).</Notice>
  <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">{kpis.map(k=><Tile key={k.id} k={k} onOpen={setOpen}/>)}</div>
  {inScope.length===0?<Empty text="No exceptions for the current filters."/>:<>
  <div className="grid lg:grid-cols-3 gap-4">
   <Card t="Exceptions by type"><Chart h={360} option={hbar(cats.map(c=>[c,inScope.filter(e=>e.cat===c).length] as [string,number]).sort((a,b)=>b[1]-a[1]))}/></Card>
   <Card t="Exceptions by severity"><Chart h={360} option={pie((['High','Medium','Low'] as const).map(s=>[s,inScope.filter(e=>e.sev===s).length] as [string,number]).filter(x=>x[1]>0))}/></Card>
   <Card t="Review progress"><Chart h={360} option={pie(REVIEW_STATUSES.map(s=>[s,inScope.filter(e=>status(e)===s).length] as [string,number]).filter(x=>x[1]>0))}/></Card>
  </div>
  <div className="flex flex-wrap gap-2 items-center text-sm">
   <select className="border rounded p-1.5 bg-white" value={cat} onChange={e=>setCat(e.target.value)}><option value="">All exception types</option>{cats.map(c=><option key={c}>{c}</option>)}</select>
   <select className="border rounded p-1.5 bg-white" value={sev} onChange={e=>setSev(e.target.value)}><option value="">All severities</option>{['High','Medium','Low'].map(c=><option key={c}>{c}</option>)}</select>
   <select className="border rounded p-1.5 bg-white" value={rs} onChange={e=>setRs(e.target.value)}><option value="">All review statuses</option>{REVIEW_STATUSES.map(c=><option key={c}>{c}</option>)}</select></div>
  <DataTable title="Exceptions" rows={rows} cols={cols} exportName="exceptions.csv" search={e=>[e.id,e.m.taskId,e.m.vehicle,e.m.driver,e.cat,e.desc].join(' ')} onRow={setEdit} note="Click a row to review it. Sorted by severity."/></>}
  {open&&<KpiModal k={open} onClose={()=>setOpen(null)}/>}
  {edit&&<ReviewModal e={edit} cur={rev[edit.id]} onClose={()=>setEdit(null)} onSave={v=>{save(edit,v);setEdit(null)}} onTrips={()=>setTrips({t:`Task ${edit.m.taskId} and related`,ms:[edit.m,...edit.related.map(i=>byId.get(i)).filter((x):x is Master=>!!x)]})}/>}
  {trips&&<TripsDrawer title={trips.t} ms={trips.ms} onClose={()=>setTrips(null)}/>}
 </div>}

function ReviewModal({e,cur,onClose,onSave,onTrips}:{e:Exc;cur?:Review;onClose:()=>void;onSave:(v:Review)=>void;onTrips:()=>void}){
 const [st,setSt]=useState<Review['st']>(cur?.st??'Pending');const [as,setAs]=useState(cur?.as??'');const [nt,setNt]=useState(cur?.nt??'');
 return <Drawer title={`${e.cat} - Task ${e.m.taskId}`} sub={`Severity ${e.sev} | ${e.id}`} onClose={onClose}>
  <div className="space-y-3 max-w-xl text-sm">
   <div className="bg-slate-50 border rounded-lg p-3"><div><b>Rule / observed:</b> {e.desc}</div><div><b>Source data:</b> {e.source}</div><div><b>Vehicle:</b> {e.m.vehicle??'-'} | <b>Driver:</b> {e.m.driver??'-'} | <b>Company:</b> {e.m.company??'-'}</div>{e.related.length>0&&<div><b>Related tasks:</b> {e.related.slice(0,10).join(', ')}</div>}</div>
   <button className="text-blue-600" onClick={onTrips}>View trip{e.related.length?'s':''}</button>
   <div className="flex gap-2"><select className="border rounded p-2 bg-white" value={st} onChange={x=>setSt(x.target.value as Review['st'])}>{REVIEW_STATUSES.map(s=><option key={s}>{s}</option>)}</select><input className="border rounded p-2 flex-1" placeholder="Assigned to" value={as} onChange={x=>setAs(x.target.value)}/></div>
   <textarea className="border rounded p-2 w-full" rows={4} placeholder="Reviewer comments" value={nt} onChange={x=>setNt(x.target.value)}/>
   <button className="bg-blue-600 text-white px-4 py-2 rounded-lg" onClick={()=>onSave({st,as:as.trim(),nt:nt.trim(),at:new Date().toISOString().slice(0,16).replace('T',' ')})}>Save review</button>
   <div className="text-xs text-slate-400">A finding is a lead for review, not proof. Source data is never modified.</div></div></Drawer>}
