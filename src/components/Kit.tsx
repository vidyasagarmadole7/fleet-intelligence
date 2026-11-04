import {ReactNode,useMemo,useState} from 'react';
import {Download,X} from 'lucide-react';
import {Kpi,Master} from '../engine/types';
import {download} from './KpiModal';

export const f=(n:number|undefined,d=0)=>n===undefined?'-':n.toLocaleString('en-IN',{maximumFractionDigits:d});
export const pct=(n:number|undefined)=>n===undefined?'-':f(n,1)+'%';

export function mkKpi(o:{id:string;label:string;value:string;formula:string;sources:string;rule:string;included:Master[];excluded?:number;why?:string;confirm?:string;issues?:string}):Kpi{
 const {why,excluded,...rest}=o;return{issues:'',...rest,excluded:excluded??0,excludedWhy:why??'None'}}

export function Card({t,children,note}:{t:string;children:ReactNode;note?:string}){
 return <div className="bg-white rounded-xl border p-4"><div className="text-sm font-medium mb-1">{t}</div>{children}{note&&<div className="text-[11px] text-slate-400 mt-1">{note}</div>}</div>}

export function Tile({k,onOpen}:{k:Kpi;onOpen:(k:Kpi)=>void}){
 return <button onClick={()=>onOpen(k)} className="text-left bg-white rounded-xl border p-4 hover:border-blue-500 hover:shadow transition">
  <div className="text-xs text-slate-500">{k.label}</div><div className="text-2xl font-semibold mt-1">{k.value}</div>
  <div className="text-[11px] text-slate-400 mt-1">{k.confirm?'Requires PTrack Confirmation':'Click for calculation'}</div></button>}

export function Notice({children,tone='amber'}:{children:ReactNode;tone?:'amber'|'slate'}){
 return <div className={`text-sm rounded-lg p-3 border ${tone==='amber'?'bg-amber-50 border-amber-200 text-amber-800':'bg-slate-50 border-slate-200 text-slate-600'}`}>{children}</div>}

export function Empty({text}:{text:string}){return <div className="bg-white border rounded-xl p-8 text-center text-slate-500">{text}</div>}

export function Header({title,ds,shown,total,unit='tasks'}:{title:string;ds:{fileName:string;importedAt:string};shown:number;total:number;unit?:string}){
 return <div><h1 className="text-2xl font-semibold">{title}</h1>
  <div className="text-xs text-slate-500">Source: {ds.fileName} (imported CSV, not live PTrack) | last import {ds.importedAt} | {f(shown)} of {f(total)} {unit} in filter | one record per unique Task ID</div></div>}

/* ---------- chart option helpers (plain ECharts options) ---------- */
export type D=[string,number][];
export const hbar=(d:D)=>({tooltip:{trigger:'axis'},grid:{left:120,right:20,top:10,bottom:20},yAxis:{type:'category',data:[...d].reverse().map(x=>x[0]),axisLabel:{width:110,overflow:'truncate'}},xAxis:{type:'value'},series:[{type:'bar',data:[...d].reverse().map(x=>Math.round(x[1]*100)/100)}]}) as any;
export const pie=(d:D)=>({tooltip:{trigger:'item'},series:[{type:'pie',radius:['45%','70%'],data:d.map(x=>({name:x[0],value:x[1]}))}]}) as any;
export const stackedH=(cats:string[],series:{name:string;data:number[]}[])=>({tooltip:{trigger:'axis'},legend:{top:0},grid:{left:120,right:20,top:30,bottom:20},yAxis:{type:'category',data:[...cats].reverse(),axisLabel:{width:110,overflow:'truncate'}},xAxis:{type:'value'},
 series:series.map(s=>({name:s.name,type:'bar',stack:'t',data:[...s.data].reverse()}))}) as any;

/* ---------- data table: search, sort, pagination, CSV export ---------- */
export interface Col<T>{key:string;label:string;get:(r:T)=>string|number|undefined;show?:(r:T)=>ReactNode;right?:boolean}
export function DataTable<T>({title,rows,cols,search,onRow,exportName,pageSize=25,defaultSort,note}:{title:string;rows:T[];cols:Col<T>[];search?:(r:T)=>string;onRow?:(r:T)=>void;exportName:string;pageSize?:number;defaultSort?:[string,1|-1];note?:string}){
 const [q,setQ]=useState('');const [sort,setSort]=useState<[string,1|-1]|undefined>(defaultSort);const [page,setPage]=useState(0);
 const shown=useMemo(()=>{
  const needle=q.trim().toLowerCase();
  let r=needle&&search?rows.filter(x=>search(x).toLowerCase().includes(needle)):rows;
  if(sort){const c=cols.find(c=>c.key===sort[0]);if(c)r=[...r].sort((a,b)=>{const A=c.get(a),B=c.get(b);if(A===undefined)return 1;if(B===undefined)return-1;return(A>B?1:A<B?-1:0)*sort[1]})}
  return r},[rows,q,sort,cols,search]);
 const pages=Math.max(1,Math.ceil(shown.length/pageSize));const p=Math.min(page,pages-1);const pg=shown.slice(p*pageSize,p*pageSize+pageSize);
 return <div className="bg-white border rounded-xl overflow-hidden">
  <div className="flex flex-wrap items-center justify-between gap-2 p-3"><div className="font-medium text-sm">{title} <span className="text-slate-400 font-normal">({f(shown.length)} rows)</span></div>
   <div className="flex gap-2 items-center">{search&&<input placeholder="Search" value={q} onChange={e=>{setQ(e.target.value);setPage(0)}} className="border rounded p-1.5 text-sm"/>}
    <button disabled={!shown.length} className="text-sm flex gap-1 items-center text-blue-600 disabled:opacity-40" onClick={()=>download(exportName,shown.map(r=>Object.fromEntries(cols.map(c=>[c.label,c.get(r)??''])))) }><Download size={14}/>Export {f(shown.length)} rows</button></div></div>
  {note&&<div className="px-3 pb-2 text-[11px] text-slate-400">{note}</div>}
  {shown.length===0?<div className="p-6 text-center text-sm text-slate-500">No rows match.</div>:
  <div className="overflow-auto"><table className="text-xs w-full"><thead className="bg-slate-50"><tr>{cols.map(c=><th key={c.key} onClick={()=>setSort([c.key,sort?.[0]===c.key?(-sort[1] as 1|-1):-1])} className={`p-2 whitespace-nowrap cursor-pointer ${c.right?'text-right':'text-left'}`}>{c.label}{sort?.[0]===c.key?(sort[1]===1?' ▲':' ▼'):''}</th>)}</tr></thead>
   <tbody>{pg.map((r,i)=><tr key={i} onClick={()=>onRow?.(r)} className={`border-t ${onRow?'cursor-pointer hover:bg-blue-50':''}`}>{cols.map(c=><td key={c.key} className={`p-2 whitespace-nowrap ${c.right?'text-right':''}`}>{c.show?c.show(r):(c.get(r)??'-')}</td>)}</tr>)}</tbody></table></div>}
  <div className="flex items-center gap-3 text-sm p-3 border-t"><button disabled={p===0} onClick={()=>setPage(p-1)} className="border rounded px-3 py-1 disabled:opacity-40">Prev</button>Page {p+1} of {pages}<button disabled={p+1>=pages} onClick={()=>setPage(p+1)} className="border rounded px-3 py-1 disabled:opacity-40">Next</button></div></div>}

/* ---------- drill-down: all unique trips behind one row ---------- */
export function TripsDrawer({title,sub,ms,onClose}:{title:string;sub?:string;ms:Master[];onClose:()=>void}){
 const cols:Col<Master>[]=[
  {key:'t',label:'Task ID',get:m=>m.taskId},{key:'d',label:'Date',get:m=>m.date},{key:'c',label:'Company',get:m=>m.company},{key:'v',label:'Vehicle',get:m=>m.vehicle},{key:'dr',label:'Driver',get:m=>m.driver},
  {key:'vn',label:'Vendor',get:m=>m.vendor},{key:'s',label:'Status',get:m=>m.status},{key:'km',label:'PTrack KM',get:m=>m.distanceKm===undefined?undefined:+m.distanceKm.toFixed(2),right:true},
  {key:'so',label:'Start Odo',get:m=>m.startOdo,right:true},{key:'eo',label:'End Odo',get:m=>m.endOdo,right:true},{key:'ok',label:'Odometer KM',get:m=>m.odoKm,right:true},
  {key:'e',label:'Employees (Actual)',get:m=>m.actual,right:true},{key:'i',label:'Issues',get:m=>m.issues.map(i=>i.code).join(' ')||undefined}];
 return <div className="fixed inset-0 bg-slate-900/50 z-50 flex justify-end" onClick={onClose}>
  <div className="bg-white w-full max-w-5xl h-full overflow-auto p-6" onClick={e=>e.stopPropagation()}>
   <div className="flex justify-between mb-3"><div><div className="text-xs text-slate-400">Trip history (unique Task IDs)</div><h2 className="text-xl font-semibold">{title}</h2>{sub&&<div className="text-sm text-slate-500">{sub}</div>}</div><button onClick={onClose}><X/></button></div>
   <DataTable title="Trips" rows={ms} cols={cols} pageSize={15} exportName={`${title.replace(/\W+/g,'_')}_trips.csv`} defaultSort={['d',-1]} search={m=>[m.taskId,m.company,m.vehicle,m.driver,m.vendor,m.status].join(' ')}/></div></div>}
