import {X,Download} from 'lucide-react';import {Kpi} from '../engine/types';
export function download(name:string,rows:Record<string,unknown>[]){
 if(!rows.length)return;const k=Object.keys(rows[0]);
 const csv=[k.join(','),...rows.map(r=>k.map(c=>`"${String(r[c]??'').replace(/"/g,'""')}"`).join(','))].join('\n');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=name;a.click()}
const flat=(k:Kpi)=>k.included.map(m=>({Task_ID:m.taskId,Date:m.date??'',Company:m.company??'',Vehicle:m.vehicle??'',Driver:m.driver??'',Vendor:m.vendor??'',Status:m.status??'',Distance_KM:m.distanceKm??'',Odometer_KM:m.odoKm??'',History_Rows:m.rowCount,Issues:m.issues.map(i=>i.code).join(' ')}));
export default function KpiModal({k,onClose}:{k:Kpi;onClose:()=>void}){
 const rows=flat(k);const L=(a:string,b:string)=><div className="mb-2"><div className="text-[11px] uppercase tracking-wide text-slate-400">{a}</div><div className="text-sm">{b||'-'}</div></div>;
 return <div className="fixed inset-0 bg-slate-900/50 z-50 flex justify-end" onClick={onClose}>
 <div className="bg-white w-full max-w-3xl h-full overflow-auto p-6" onClick={e=>e.stopPropagation()}>
  <div className="flex justify-between"><div><div className="text-xs text-slate-400">KPI calculation transparency</div><h2 className="text-xl font-semibold">{k.label}: {k.value}</h2></div><button onClick={onClose}><X/></button></div>
  <div className="grid sm:grid-cols-2 gap-x-6 mt-4">{L('Formula',k.formula)}{L('Source fields',k.sources)}{L('Records included',k.included.length.toLocaleString())}{L('Records excluded',`${k.excluded.toLocaleString()} - ${k.excludedWhy}`)}{L('Inclusion / handling rule',k.rule)}{L('Data quality note',k.issues)}</div>
  {k.confirm&&<div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded p-3 my-3">Requires PTrack Confirmation: {k.confirm}</div>}
  <div className="flex justify-between items-center mt-4 mb-2"><div className="font-medium">Supporting records (first 200 of {rows.length.toLocaleString()})</div>
   <button className="text-sm flex gap-1 items-center text-blue-600" onClick={()=>download(`${k.id}.csv`,rows)}><Download size={14}/>Export all</button></div>
  <div className="overflow-auto border rounded"><table className="text-xs w-full"><thead className="bg-slate-50 sticky top-0"><tr>{rows[0]&&Object.keys(rows[0]).map(c=><th key={c} className="text-left p-2 whitespace-nowrap">{c}</th>)}</tr></thead>
   <tbody>{rows.slice(0,200).map((r,i)=><tr key={i} className="border-t">{Object.values(r).map((v,j)=><td key={j} className="p-2 whitespace-nowrap">{String(v)}</td>)}</tr>)}</tbody></table></div>
 </div></div>}
