import {useState} from 'react';import Papa from 'papaparse';import {Upload} from 'lucide-react';
import {FIELDS,autoMap} from '../engine/fields';import {build} from '../engine/build';import {Config,Dataset,Row} from '../engine/types';import {download} from '../components/KpiModal';
export default function Import({cfg,onDone,ds}:{cfg:Config;onDone:(d:Dataset)=>void;ds:Dataset|null}){
 const [raw,setRaw]=useState<{rows:Row[];headers:string[];name:string}|null>(null);const [map,setMap]=useState<Record<string,string>>({});const [busy,setBusy]=useState(false);const [err,setErr]=useState('');
 const pick=(f:File)=>{setBusy(true);setErr('');Papa.parse<Row>(f,{header:true,skipEmptyLines:true,complete:r=>{setBusy(false);const h=r.meta.fields??[];
  if(!h.length){setErr('No header row detected.');return}setRaw({rows:r.data,headers:h,name:f.name});setMap(autoMap(h))},error:e=>{setBusy(false);setErr(e.message)}})};
 const run=()=>{if(!raw||!map.taskId){setErr('Map the Task ID column before importing.');return}const d=build(raw.rows,map,cfg,raw.name,raw.headers);onDone(d)};
 return <div className="space-y-5">
  <h1 className="text-2xl font-semibold">Data Import</h1>
  <label className="block border-2 border-dashed rounded-xl bg-white p-10 text-center cursor-pointer hover:border-blue-500">
   <Upload className="mx-auto mb-2 text-blue-600"/><div className="font-medium">{busy?'Parsing CSV...':'Choose a PTrack CSV export'}</div><div className="text-sm text-slate-500">Parsed in your browser. Nothing is uploaded anywhere.</div>
   <input type="file" accept=".csv" className="hidden" onChange={e=>e.target.files?.[0]&&pick(e.target.files[0])}/></label>
  {err&&<div className="bg-red-50 text-red-700 p-3 rounded text-sm">{err}</div>}
  {raw&&<div className="bg-white rounded-xl border p-5">
   <div className="font-medium mb-1">{raw.name}: {raw.rows.length.toLocaleString()} rows, {raw.headers.length} columns</div>
   <div className="text-sm text-slate-500 mb-3">Column mapping (auto-detected, editable). Unmapped columns stay in the raw data and are listed after import.</div>
   <div className="grid md:grid-cols-2 gap-x-6 gap-y-2">{FIELDS.map(f=><label key={f.key} className="flex items-center gap-2 text-sm"><span className="w-44 shrink-0">{f.label}{f.key==='taskId'&&' *'}</span>
    <select className="border rounded p-1 flex-1 min-w-0" value={map[f.key]??''} onChange={e=>setMap({...map,[f.key]:e.target.value})}><option value="">(not mapped)</option>{raw.headers.map(h=><option key={h}>{h}</option>)}</select>
    {f.note&&<span title={f.note} className="text-amber-600 text-xs">?</span>}</label>)}</div>
   <div className="text-xs text-slate-500 mt-3 overflow-auto"><div className="font-medium mb-1">Preview (first 3 rows)</div><table><tbody>{raw.rows.slice(0,3).map((r,i)=><tr key={i}>{raw.headers.slice(0,8).map(h=><td key={h} className="pr-3 whitespace-nowrap">{r[h]}</td>)}</tr>)}</tbody></table></div>
   <button onClick={run} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg">Validate and import</button></div>}
  {ds&&<div className="bg-white rounded-xl border p-5 text-sm space-y-1">
   <div className="font-medium text-base mb-2">Import summary: {ds.fileName} ({ds.importedAt})</div>
   <div>CSV rows: <b>{ds.dq.rows.toLocaleString()}</b> | Unique Task IDs (Task Master): <b>{ds.dq.uniqueIds.toLocaleString()}</b> | History records: <b>{ds.history.length.toLocaleString()}</b></div>
   <div>Rows without Task ID: <b>{ds.dq.missingIds}</b> | Exact duplicate history rows: <b>{ds.dq.exactDupHistory}</b> | Unparsable history timestamps: <b>{ds.dq.invalidTimestamps}</b></div>
   <div>Validation issues: <b>{ds.issues.length.toLocaleString()}</b> on <b>{new Set(ds.issues.map(i=>i.taskId)).size.toLocaleString()}</b> tasks</div>
   <div className="text-slate-500">Unmapped columns preserved in raw data: {ds.dq.unmappedHeaders.join(', ')||'none'}</div>
   <button className="text-blue-600 mt-2" onClick={()=>download('validation-issues.csv',ds.issues.map(i=>({Task_ID:i.taskId,Code:i.code,Severity:i.sev,Message:i.msg})))}>Download error report (CSV)</button></div>}
 </div>}
