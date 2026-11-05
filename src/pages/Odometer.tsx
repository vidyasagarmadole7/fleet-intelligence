import {useMemo,useState} from 'react';import {X} from 'lucide-react';
import {Dataset} from '../engine/types';import {auditOdometer,DEFAULT_ODO,OdoRow,OdoStatus,OdoThresholds} from '../engine/odometer';import {download} from '../components/KpiModal';
const f=(n:number|undefined,d=0)=>n===undefined?'-':n.toLocaleString('en-IN',{maximumFractionDigits:d});
const COL:Record<OdoStatus,string>={Normal:'bg-emerald-100 text-emerald-800',Warning:'bg-amber-100 text-amber-800',Critical:'bg-red-100 text-red-800','Needs Review':'bg-orange-100 text-orange-800','Insufficient Data':'bg-slate-200 text-slate-700'};
const STATUSES:OdoStatus[]=['Critical','Needs Review','Warning','Insufficient Data','Normal'];
const REVIEW=['Pending','Reviewed','Accepted','Rejected'];
export default function Odometer({ds}:{ds:Dataset}){
 const [t,setT]=useState<OdoThresholds>(DEFAULT_ODO);const [st,setSt]=useState<OdoStatus|''>('');const [q,setQ]=useState('');const [page,setPage]=useState(0);
 const [rev,setRev]=useState<Record<string,string>>({});const [veh,setVeh]=useState<string|null>(null);const [only,setOnly]=useState('');
 const rows=useMemo(()=>auditOdometer(ds.masters,ds.history,t),[ds,t]);
 const k=useMemo(()=>{
  const valid=rows.filter(r=>r.m.odoKm!==undefined&&r.m.odoKm>=0);const within=valid.filter(r=>r.m.odoKm!<=t.maxTripKm);
  const both=within.filter(r=>r.m.distanceKm!==undefined&&r.m.distanceKm>=0);
  const so=both.reduce((a,r)=>a+r.m.odoKm!,0),sg=both.reduce((a,r)=>a+r.m.distanceKm!,0);
  const has=(s:string)=>rows.filter(r=>r.reasons.some(x=>x.includes(s)));
  const bad=new Set(rows.filter(r=>r.status==='Critical'||r.status==='Needs Review').map(r=>r.m.vehicle));
  return{n:rows.length,so,sg,pairs:both.length,outl:valid.length-within.length,
   cards:[['Completed vehicle trips',f(rows.length),''],['Odometer KM (within limit)',f(so),`${f(both.length)} trips with both readings; ${f(valid.length-within.length)} above ${t.maxTripKm} km excluded`],
    ['PTrack distance, same trips',f(sg),'Same trips as the odometer KM'],['KM difference (odometer - PTrack)',f(so-sg),'Not proof of misuse'],
    ['Missing start odometer',f(has('Start odometer missing').length),''],['Missing end odometer',f(has('End odometer missing').length),''],
    ['Odometer vs PTrack mismatch',f(has('vs PTrack').length),`> ${t.gapKm} km gap`],['Negative KM records',f(has('lower than start').length),''],
    ['Start below previous closing',f(has('below previous').length),'Continuity break'],['Possible unrecorded movement',f(has('Unrecorded').length),'Needs Review, not fraud'],
    ['Vehicles requiring review',f(bad.size),'Critical or Needs Review'],['Odometer compliance',f(valid.length/rows.length*100,1)+'%','Trips with both readings and end >= start']] as [string,string,string][]}},[rows,t]);
 const list=useMemo(()=>rows.filter(r=>(!st||r.status===st)&&(!q||(r.m.vehicle??'').toLowerCase().includes(q.toLowerCase())||r.m.taskId.includes(q))&&(!only||r.reasons.some(x=>x.includes(only)))),[rows,st,q,only]);
 const cnt=(s:OdoStatus)=>rows.filter(r=>r.status===s).length;const pg=list.slice(page*50,page*50+50);
 const flat=(r:OdoRow)=>({Task_ID:r.m.taskId,Vehicle:r.m.vehicle,Date:r.m.date,Prev_Closing:r.prev?.endOdo??'',Start:r.m.startOdo??'',End:r.m.endOdo??'',Odometer_KM:r.m.odoKm??'',PTrack_KM:r.m.distanceKm?.toFixed(2)??'',Gap:r.gap?.toFixed(1)??'',Continuity_Diff:r.contDiff??'',Status:r.status,Reasons:r.reasons.join(' | '),Review:rev[r.m.taskId]??'Pending'});
 const th=(l:string,k2:keyof OdoThresholds)=><label className="text-sm">{l} <input type="number" className="border rounded p-1 w-20 ml-1" value={t[k2]} onChange={e=>{setT({...t,[k2]:Number(e.target.value)});setPage(0)}}/></label>;
 return <div className="space-y-5"><div><h1 className="text-2xl font-semibold">Odometer & KM Audit</h1>
  <div className="text-xs text-slate-500">Completed trips with a vehicle, ordered per vehicle by actual start (history "Started at"), else scheduled time. Source: {ds.fileName}</div></div>
  <div className="bg-white border rounded-xl p-4 flex flex-wrap gap-4 items-center"><span className="text-sm font-medium">Thresholds (Requires PTrack Confirmation)</span>{th('KM gap (odometer vs PTrack)','gapKm')}{th('Continuity gap','contKm')}{th('Max trip KM','maxTripKm')}</div>
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{k.cards.map(([a,b,c])=><div key={a} className="bg-white rounded-xl border p-4"><div className="text-xs text-slate-500">{a}</div><div className="text-2xl font-semibold mt-1">{b}</div><div className="text-[11px] text-slate-400 mt-1">{c||'\u00a0'}</div></div>)}</div>
  <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-xl p-3">A positive KM gap does not prove unauthorised use or fraud. It is shown as "Possible Unrecorded Vehicle Movement - Needs Review". Overlap detection uses Completion_Time and the history "Started at" time; impossible travel-time detection is not built yet. Odometer-image checks (missing, reused, same start/end image) are in Exception Management.</div>
  <div className="flex flex-wrap gap-2 items-center">
   {STATUSES.map(s=><button key={s} onClick={()=>{setSt(st===s?'':s);setPage(0)}} className={`px-3 py-1 rounded-full text-sm border ${st===s?'ring-2 ring-blue-500':''} ${COL[s]}`}>{s} ({f(cnt(s))})</button>)}
   <select className="border rounded p-1.5 text-sm bg-white" value={only} onChange={e=>{setOnly(e.target.value);setPage(0)}}><option value="">All reasons</option><option value="vs PTrack">KM mismatch</option><option value="lower than start">Negative KM</option><option value="below previous">Below previous closing</option><option value="Unrecorded">Possible unrecorded movement</option><option value="Overlaps">Overlap</option><option value="missing">Missing reading</option></select>
   <input placeholder="Search vehicle or task" className="border rounded p-1.5 text-sm bg-white" value={q} onChange={e=>{setQ(e.target.value);setPage(0)}}/>
   <button className="text-sm text-blue-600 ml-auto" onClick={()=>download('odometer-audit.csv',list.map(flat))}>Export {f(list.length)} rows</button></div>
  <div className="bg-white border rounded-xl overflow-auto"><table className="text-xs w-full"><thead className="bg-slate-50"><tr>{['Task','Vehicle','Date','Prev close','Start','End','Odo KM','PTrack KM','Gap','Cont. diff','Status','Why flagged','Review'].map(h=><th key={h} className="text-left p-2 whitespace-nowrap">{h}</th>)}</tr></thead>
   <tbody>{pg.map(r=><tr key={r.m.taskId} className="border-t align-top"><td className="p-2">{r.m.taskId}</td><td className="p-2"><button className="text-blue-600" onClick={()=>setVeh(r.m.vehicle!)}>{r.m.vehicle}</button></td><td className="p-2">{r.m.date}</td>
    <td className="p-2">{f(r.prev?.endOdo)}</td><td className="p-2">{f(r.m.startOdo)}</td><td className="p-2">{f(r.m.endOdo)}</td><td className="p-2">{f(r.m.odoKm,1)}</td><td className="p-2">{f(r.m.distanceKm,1)}</td><td className="p-2">{f(r.gap,1)}</td><td className="p-2">{f(r.contDiff)}</td>
    <td className="p-2"><span className={`px-2 py-0.5 rounded-full whitespace-nowrap ${COL[r.status]}`}>{r.status}</span></td><td className="p-2 min-w-64">{r.reasons.join('; ')||'-'}</td>
    <td className="p-2">{r.status!=='Normal'&&<select className="border rounded p-1" value={rev[r.m.taskId]??'Pending'} onChange={e=>setRev({...rev,[r.m.taskId]:e.target.value})}>{REVIEW.map(x=><option key={x}>{x}</option>)}</select>}</td></tr>)}</tbody></table>
   {!pg.length&&<div className="p-8 text-center text-slate-500 text-sm">No records match.</div>}</div>
  <div className="flex items-center gap-3 text-sm"><button disabled={page===0} onClick={()=>setPage(page-1)} className="border rounded px-3 py-1 disabled:opacity-40">Prev</button>Page {page+1} of {Math.max(1,Math.ceil(list.length/50))}<button disabled={(page+1)*50>=list.length} onClick={()=>setPage(page+1)} className="border rounded px-3 py-1 disabled:opacity-40">Next</button>
   <span className="text-xs text-slate-400">Review statuses live in this browser tab only and are lost on refresh (no backend yet).</span></div>
  {veh&&<div className="fixed inset-0 bg-slate-900/50 z-50 flex justify-end" onClick={()=>setVeh(null)}><div className="bg-white w-full max-w-3xl h-full overflow-auto p-6" onClick={e=>e.stopPropagation()}>
   <div className="flex justify-between"><h2 className="text-xl font-semibold">Odometer timeline: {veh}</h2><button onClick={()=>setVeh(null)}><X/></button></div>
   <table className="text-xs w-full mt-4"><thead className="bg-slate-50"><tr>{['Task','Date','Start','End','Odo KM','Cont. diff','Status'].map(h=><th key={h} className="text-left p-2">{h}</th>)}</tr></thead>
    <tbody>{rows.filter(r=>r.m.vehicle===veh).map(r=><tr key={r.m.taskId} className="border-t"><td className="p-2">{r.m.taskId}</td><td className="p-2">{r.m.date}</td><td className="p-2">{f(r.m.startOdo)}</td><td className="p-2">{f(r.m.endOdo)}</td><td className="p-2">{f(r.m.odoKm,1)}</td><td className="p-2">{f(r.contDiff)}</td><td className="p-2"><span className={`px-2 py-0.5 rounded-full ${COL[r.status]}`}>{r.status}</span></td></tr>)}</tbody></table></div></div>}
 </div>}
