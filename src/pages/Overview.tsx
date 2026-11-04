import {useMemo,useState} from 'react';import Chart from '../components/Chart';import KpiModal from '../components/KpiModal';
import {computeKpis} from '../engine/kpis';import {Config,Dataset,Kpi,Master} from '../engine/types';
const top=(ms:Master[],f:(m:Master)=>string|undefined,n=10)=>{const c=new Map<string,number>();for(const m of ms){const k=f(m);if(k)c.set(k,(c.get(k)||0)+1)}return[...c].sort((a,b)=>b[1]-a[1]).slice(0,n)};
const bar=(d:[string,number][],h=true)=>({tooltip:{trigger:'axis'},grid:{left:h?110:40,right:20,top:10,bottom:h?20:60},[h?'yAxis':'xAxis']:{type:'category',data:[...d].reverse().map(x=>x[0]),axisLabel:{width:100,overflow:'truncate'}},[h?'xAxis':'yAxis']:{type:'value'},series:[{type:'bar',data:[...d].reverse().map(x=>x[1])}]}) as any;
export default function Overview({ds,cfg,setCfg}:{ds:Dataset;cfg:Config;setCfg:(c:Config)=>void}){
 const [from,setFrom]=useState('');const [to,setTo]=useState('');const [co,setCo]=useState('');const [st,setSt]=useState('');const [open,setOpen]=useState<Kpi|null>(null);
 const dates=ds.masters.map(m=>m.date).filter(Boolean) as string[];const companies=[...new Set(ds.masters.map(m=>m.company).filter(Boolean))].sort() as string[];
 const statuses=[...new Set(ds.masters.map(m=>m.status).filter(Boolean))] as string[];
 const ms=useMemo(()=>ds.masters.filter(m=>(!from||(m.date??'')>=from)&&(!to||(m.date??'')<=to)&&(!co||m.company===co)&&(!st||m.status===st)),[ds,from,to,co,st]);
 const kpis=useMemo(()=>computeKpis(ms,cfg),[ms,cfg]);
 const daily=useMemo(()=>{const c=new Map<string,[number,number]>();for(const m of ms){if(!m.date)continue;const a=c.get(m.date)||[0,0];a[0]++;if(m.status==='Completed'&&m.distanceKm!==undefined&&m.distanceKm>=0)a[1]+=m.distanceKm;c.set(m.date,a)}return[...c].sort()},[ms]);
 const veh=useMemo(()=>top(ms,m=>m.vehicle),[ms]),drv=useMemo(()=>top(ms,m=>m.driver),[ms]),cos=useMemo(()=>top(ms,m=>m.company),[ms]);
 const pd=useMemo(()=>top(ms,m=>m.pickupDrop),[ms]),stat=useMemo(()=>top(ms,m=>m.status),[ms]);
 const S=(p:{v:string;set:(s:string)=>void;l:string;o:string[]})=><select className="border rounded p-1.5 text-sm bg-white" value={p.v} onChange={e=>p.set(e.target.value)}><option value="">{p.l}</option>{p.o.map(x=><option key={x}>{x}</option>)}</select>;
 const Card=(p:{t:string;children:React.ReactNode})=><div className="bg-white rounded-xl border p-4"><div className="text-sm font-medium mb-1">{p.t}</div>{p.children}</div>;
 const q=ds.dq;
 return <div className="space-y-5">
  <div className="flex flex-wrap items-end gap-3 justify-between"><div><h1 className="text-2xl font-semibold">Executive Overview</h1>
   <div className="text-xs text-slate-500">Source: {ds.fileName} (imported CSV, not live PTrack) | last import {ds.importedAt} | {ms.length.toLocaleString()} of {ds.masters.length.toLocaleString()} tasks in filter</div></div>
   <div className="flex flex-wrap gap-2 items-center"><input type="date" min={dates.sort()[0]} max={dates[dates.length-1]} value={from} onChange={e=>setFrom(e.target.value)} className="border rounded p-1.5 text-sm"/>
    <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="border rounded p-1.5 text-sm"/>
    <S v={co} set={setCo} l="All companies" o={companies}/><S v={st} set={setSt} l="All statuses" o={statuses}/></div></div>
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{kpis.map(k=><button key={k.id} onClick={()=>setOpen(k)} className="text-left bg-white rounded-xl border p-4 hover:border-blue-500 hover:shadow transition">
   <div className="text-xs text-slate-500">{k.label}</div><div className="text-2xl font-semibold mt-1">{k.value}</div>
   <div className="text-[11px] text-slate-400 mt-1">{k.confirm?'Requires PTrack Confirmation':'Click for calculation'}</div></button>)}</div>
  <div className="grid lg:grid-cols-2 gap-4">
   <Card t="Daily trips (unique tasks, by scheduled date)"><Chart option={{xAxis:{type:'category',data:daily.map(d=>d[0])},yAxis:{type:'value'},series:[{type:'line',smooth:true,areaStyle:{opacity:.1},data:daily.map(d=>d[1][0])}]}}/></Card>
   <Card t="Daily PTrack distance, KM (completed tasks)"><Chart option={{xAxis:{type:'category',data:daily.map(d=>d[0])},yAxis:{type:'value'},series:[{type:'bar',data:daily.map(d=>Math.round(d[1][1]))}]}}/></Card>
   <Card t="Trips by status"><Chart option={{tooltip:{trigger:'item'},series:[{type:'pie',radius:['45%','70%'],data:stat.map(s=>({name:s[0],value:s[1]}))}]}}/></Card>
   <Card t="Pickup vs Drop"><Chart option={{tooltip:{trigger:'item'},series:[{type:'pie',radius:['45%','70%'],data:pd.map(s=>({name:s[0],value:s[1]}))}]}}/></Card>
   <Card t="Top 10 companies (trips)"><Chart h={300} option={bar(cos)}/></Card>
   <Card t="Top 10 vehicles (trips)"><Chart h={300} option={bar(veh)}/></Card>
   <Card t="Top 10 drivers: Agent_Username (trips) - mapping Requires PTrack Confirmation"><Chart h={300} option={bar(drv)}/></Card>
   <Card t="Data quality summary"><table className="text-sm w-full"><tbody>{([
    ['CSV rows imported',q.rows],['Unique Task IDs',q.uniqueIds],['History rows per task (avg)',+(q.rows/q.uniqueIds).toFixed(1)],['Rows missing Task ID',q.missingIds],['Exact duplicate history rows',q.exactDupHistory],
    ['Tasks missing vehicle (assigned)',ds.masters.filter(m=>m.issues.some(i=>i.code==='MISSING_VEHICLE')).length],['Tasks missing driver (assigned)',ds.masters.filter(m=>m.issues.some(i=>i.code==='MISSING_DRIVER')).length],
    ['Completed tasks missing start/end odometer',ds.masters.filter(m=>m.issues.some(i=>i.code.startsWith('MISSING_ODO'))).length],['Negative odometer difference',ds.masters.filter(m=>m.issues.some(i=>i.code==='NEG_ODO')).length],
    ['Odometer vs PTrack KM gap (needs review)',ds.masters.filter(m=>m.issues.some(i=>i.code==='KM_GAP')).length]] as [string,number][]).map(r=><tr key={r[0]} className="border-b last:border-0"><td className="py-1.5">{r[0]}</td><td className="text-right font-medium">{r[1].toLocaleString()}</td></tr>)}</tbody></table></Card></div>
  <div className="bg-white rounded-xl border p-4 text-sm"><div className="font-medium mb-2">Configurable rules (Requires PTrack Confirmation)</div><div className="flex flex-wrap gap-4">
   <label>Completion rate base <select className="border rounded p-1 ml-1" value={cfg.completionBase} onChange={e=>setCfg({...cfg,completionBase:e.target.value as Config['completionBase']})}><option value="all">All unique tasks</option><option value="closed">Closed tasks only</option></select></label>
   <label>Employees travelled = <select className="border rounded p-1 ml-1" value={cfg.employeeField} onChange={e=>setCfg({...cfg,employeeField:e.target.value as Config['employeeField']})}><option value="actual">Actual_Emp</option><option value="inCab">In Cab Employees</option><option value="planned">Planned_Emp</option></select></label>
   <div className="text-xs text-slate-500 self-center">KM-gap threshold ({cfg.gapKm} km) is applied at import; re-import to change it.</div></div></div>
  {open&&<KpiModal k={open} onClose={()=>setOpen(null)}/>}</div>}
