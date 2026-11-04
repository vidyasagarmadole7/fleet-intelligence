import {useMemo,useState} from 'react';import Chart from '../components/Chart';import {download} from '../components/KpiModal';
import {Dataset,Master} from '../engine/types';import {tripFacts,TripFact} from '../engine/trips';
const f=(n:number|undefined,d=0)=>n===undefined?'-':n.toLocaleString('en-IN',{maximumFractionDigits:d});
const cnt=(a:TripFact[],k:(m:Master)=>string|undefined,n=10)=>{const c=new Map<string,number>();for(const x of a){const v=k(x.m);if(v)c.set(v,(c.get(v)||0)+1)}return[...c].sort((a,b)=>b[1]-a[1]).slice(0,n)};
const bar=(d:[string,number][])=>({tooltip:{trigger:'axis'},grid:{left:120,right:20,top:10,bottom:20},yAxis:{type:'category',data:[...d].reverse().map(x=>x[0]),axisLabel:{width:110,overflow:'truncate'}},xAxis:{type:'value'},series:[{type:'bar',data:[...d].reverse().map(x=>x[1])}]}) as any;
const pie=(d:[string,number][])=>({tooltip:{trigger:'item'},series:[{type:'pie',radius:['45%','70%'],data:d.map(x=>({name:x[0],value:x[1]}))}]}) as any;
type SortK='date'|'taskId'|'status'|'distanceKm'|'actual';
export default function Trips({ds}:{ds:Dataset}){
 const T=useMemo(()=>tripFacts(ds),[ds]);
 const [co,setCo]=useState('');const [st,setSt]=useState('');const [pd,setPd]=useState('');const [sh,setSh]=useState('');const [tt,setTt]=useState('');const [q,setQ]=useState('');
 const [from,setFrom]=useState('');const [to,setTo]=useState('');const [sort,setSort]=useState<[SortK,1|-1]>(['date',-1]);const [page,setPage]=useState(0);const [view,setView]=useState<'day'|'month'>('day');
 const opt=(k:(m:Master)=>string|undefined)=>[...new Set(ds.masters.map(k).filter(Boolean))].sort() as string[];
 const rows=useMemo(()=>T.facts.filter(x=>{const m=x.m;return(!co||m.company===co)&&(!st||m.status===st)&&(!pd||m.pickupDrop===pd)&&(!sh||m.shift===sh)&&(!tt||m.tripType===tt)&&(!from||(m.date??'')>=from)&&(!to||(m.date??'')<=to)&&(!q||m.taskId.includes(q)||(m.vehicle??'').toLowerCase().includes(q.toLowerCase())||(m.orderId??'').toLowerCase().includes(q.toLowerCase()))}),[T,co,st,pd,sh,tt,q,from,to]);
 const sorted=useMemo(()=>[...rows].sort((a,b)=>{const g=(x:TripFact)=>x.m[sort[0]];const A=g(a),B=g(b);if(A===undefined)return 1;if(B===undefined)return-1;return(A>B?1:A<B?-1:0)*sort[1]}),[rows,sort]);
 const by=(s:string)=>rows.filter(x=>x.m.status===s).length;
 const trend=useMemo(()=>{const c=new Map<string,Record<string,number>>();for(const x of rows){const d=x.m.date;if(!d)continue;const k=view==='day'?d:d.slice(0,7);const o=c.get(k)||{};const s=x.m.status??'(none)';o[s]=(o[s]||0)+1;c.set(k,o)}return[...c].sort((a,b)=>a[0]<b[0]?-1:1)},[rows,view]);
 const sts=[...new Set(rows.map(x=>x.m.status??'(none)'))];
 const durs=rows.filter(x=>x.durMin!==undefined).map(x=>x.durMin!);const avg=durs.length?durs.reduce((a,b)=>a+b,0)/durs.length:undefined;
 const B=[0,30,60,90,120,180,240];const buckets=B.map((lo,i)=>[i===B.length-1?`${lo}+`:`${lo}-${B[i+1]}`,durs.filter(d=>d>=lo&&(i===B.length-1||d<B[i+1])).length] as [string,number]);
 const val=useMemo(()=>({
  conflicts:rows.filter(x=>x.m.issues.some(i=>i.code.startsWith('CONFLICT'))).length,
  invalidStatus:rows.filter(x=>x.m.issues.some(i=>i.code==='INVALID_STATUS'||i.code==='MISSING_STATUS')).length,
  missingInfo:rows.filter(x=>!x.m.company||!x.m.date||!x.m.orderId||(x.m.status!=='Unassigned'&&(!x.m.vehicle||!x.m.driver))).length,
  noStart:rows.filter(x=>x.m.status==='Completed'&&x.startedMs===undefined).length,noDone:rows.filter(x=>x.m.status==='Completed'&&x.doneMs===undefined).length,
  seq:rows.filter(x=>x.seqIssue).length,multi:rows.filter(x=>x.m.rowCount>1).length}),[rows]);
 const S=(v:string,set:(s:string)=>void,l:string,o:string[])=><select className="border rounded p-1.5 text-sm bg-white" value={v} onChange={e=>{set(e.target.value);setPage(0)}}><option value="">{l}</option>{o.map(x=><option key={x}>{x}</option>)}</select>;
 const Card=(p:{t:string;children:React.ReactNode})=><div className="bg-white rounded-xl border p-4"><div className="text-sm font-medium mb-1">{p.t}</div>{p.children}</div>;
 const row=(x:TripFact)=>({Task_ID:x.m.taskId,Order_ID:x.m.orderId,Date:x.m.date,Pickup_Address:x.m.pickupAddr,Customer_Address:x.m.dropAddr,Company:x.m.company,Vehicle:x.m.vehicle,Driver:x.m.driver,Vendor:x.m.vendor,Status:x.m.status,Pickup_Drop:x.m.pickupDrop,Trip_Type:x.m.tripType,Distance_KM:x.m.distanceKm?.toFixed(2),Start_Odo:x.m.startOdo,End_Odo:x.m.endOdo,Employees:x.m.actual,Duration_Min:x.durMin?.toFixed(1)});
 const H=(l:string,k?:SortK)=><th key={l} className={`text-left p-2 whitespace-nowrap ${k?'cursor-pointer':''}`} onClick={()=>k&&setSort([k,sort[0]===k?(-sort[1] as 1|-1):1])}>{l}{k&&sort[0]===k?(sort[1]===1?' ▲':' ▼'):''}</th>;
 const pg=sorted.slice(page*50,page*50+50);
 const kp:[string,string,string][]=[['Total trips',f(rows.length),'Unique Task IDs in filter'],['Completed',f(by('Completed')),''],['Cancelled',f(by('Cancelled')),''],['Failed',f(by('Failed')),'Requires PTrack Confirmation'],
  ['Completion rate',rows.length?f(by('Completed')/rows.length*100,1)+'%':'-','Completed / all trips in filter'],['Avg trip duration',avg===undefined?'-':f(avg,1)+' min',`${f(durs.length)} trips; "Started at" to "Successful at". Requires PTrack Confirmation`]];
 return <div className="space-y-5"><div><h1 className="text-2xl font-semibold">Trip Analytics</h1><div className="text-xs text-slate-500">Source: {ds.fileName} | one record per unique Task ID | {f(rows.length)} of {f(ds.masters.length)} trips in filter</div></div>
  <div className="flex flex-wrap gap-2"><input type="date" value={from} onChange={e=>{setFrom(e.target.value);setPage(0)}} className="border rounded p-1.5 text-sm"/><input type="date" value={to} onChange={e=>{setTo(e.target.value);setPage(0)}} className="border rounded p-1.5 text-sm"/>
   {S(co,setCo,'All companies',opt(m=>m.company))}{S(st,setSt,'All statuses',opt(m=>m.status))}{S(pd,setPd,'Pickup & Drop',opt(m=>m.pickupDrop))}{S(sh,setSh,'All shifts',opt(m=>m.shift))}{S(tt,setTt,'All trip types',opt(m=>m.tripType))}
   <input placeholder="Search task, vehicle, order" value={q} onChange={e=>{setQ(e.target.value);setPage(0)}} className="border rounded p-1.5 text-sm bg-white"/></div>
  <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">{kp.map(([a,b,c])=><div key={a} className="bg-white rounded-xl border p-4"><div className="text-xs text-slate-500">{a}</div><div className="text-2xl font-semibold mt-1">{b}</div><div className="text-[11px] text-slate-400 mt-1">{c||'\u00a0'}</div></div>)}</div>
  {rows.length===0?<div className="bg-white border rounded-xl p-8 text-center text-slate-500">No trips match the filters.</div>:<>
  <div className="grid lg:grid-cols-2 gap-4">
   <Card t={`Trips by ${view} and status`}><div className="text-xs mb-1"><button className={view==='day'?'font-semibold':'text-blue-600'} onClick={()=>setView('day')}>Daily</button> | <button className={view==='month'?'font-semibold':'text-blue-600'} onClick={()=>setView('month')}>Monthly</button> (scheduled date)</div>
    <Chart option={{legend:{top:0},xAxis:{type:'category',data:trend.map(t=>t[0])},yAxis:{type:'value'},series:sts.map(s=>({name:s,type:'bar',stack:'t',data:trend.map(t=>t[1][s]||0)}))}}/></Card>
   <Card t="Trip completion by status"><Chart option={pie(cnt(rows,m=>m.status))}/></Card>
   <Card t="Pickup vs Drop (PICKUPDROP)"><Chart option={pie(cnt(rows,m=>m.pickupDrop))}/></Card>
   <Card t="Trip type (TRIP_TYPE) - rules Require PTrack Confirmation"><Chart option={pie(cnt(rows,m=>m.tripType))}/></Card>
   <Card t="Shift-wise trips (top 15)"><Chart h={340} option={bar(cnt(rows,m=>m.shift,15))}/></Card>
   <Card t="Company-wise trips (top 10)"><Chart h={340} option={bar(cnt(rows,m=>m.company))}/></Card>
   <Card t="Top 10 Order IDs - meaning Requires PTrack Confirmation (location?)"><Chart h={300} option={bar(cnt(rows,m=>m.orderId))}/></Card>
   <Card t="Pickup category (Pick_up_From) - blank excluded"><Chart h={300} option={bar(cnt(rows,m=>m.pickupCat))}/></Card>
   <Card t="Trip duration distribution (minutes)"><Chart option={{xAxis:{type:'category',data:buckets.map(b=>b[0])},yAxis:{type:'value'},series:[{type:'bar',data:buckets.map(b=>b[1])}]}}/></Card>
   <Card t="Trip validation (in current filter)"><table className="text-sm w-full"><tbody>{([['Trips whose history rows disagree on a field',val.conflicts],['Missing / invalid status',val.invalidStatus],['Missing company, date, order, or vehicle/driver',val.missingInfo],['Completed without "Started at" history',val.noStart],['Completed without "Successful at" history',val.noDone],['Completed before started (bad sequence)',val.seq],['Trips with more than one history row (normal)',val.multi]] as [string,number][]).map(r=><tr key={r[0]} className="border-b last:border-0"><td className="py-1.5">{r[0]}</td><td className="text-right font-medium">{f(r[1])}</td></tr>)}</tbody></table>
    <div className="text-xs text-slate-500 mt-2">Back-to-back vs separate analysis is not computed: the business rule Requires PTrack Confirmation. Raw TRIP_TYPE values are shown as exported.</div></Card></div>
  <div className="bg-white border rounded-xl overflow-auto"><div className="flex justify-between p-3"><div className="font-medium text-sm">Trip table</div><button className="text-sm text-blue-600" onClick={()=>download('trips.csv',sorted.map(row))}>Export {f(sorted.length)} rows</button></div>
   <table className="text-xs w-full"><thead className="bg-slate-50"><tr>{H('Task ID','taskId')}{H('Order ID')}{H('Date','date')}{H('Pickup Address')}{H('Customer Address')}{H('Company')}{H('Vehicle')}{H('Driver')}{H('Vendor')}{H('Status','status')}{H('Distance KM','distanceKm')}{H('Start Odo')}{H('End Odo')}{H('Employees','actual')}</tr></thead>
    <tbody>{pg.map(x=><tr key={x.m.taskId} className="border-t"><td className="p-2">{x.m.taskId}</td><td className="p-2 max-w-40 truncate">{x.m.orderId}</td><td className="p-2">{x.m.date}</td><td className="p-2 max-w-40 truncate" title={x.m.pickupAddr}>{x.m.pickupAddr}</td><td className="p-2 max-w-40 truncate" title={x.m.dropAddr}>{x.m.dropAddr}</td><td className="p-2">{x.m.company}</td><td className="p-2">{x.m.vehicle??'-'}</td><td className="p-2">{x.m.driver??'-'}</td><td className="p-2">{x.m.vendor??'-'}</td><td className="p-2">{x.m.status}</td><td className="p-2">{f(x.m.distanceKm,1)}</td><td className="p-2">{f(x.m.startOdo)}</td><td className="p-2">{f(x.m.endOdo)}</td><td className="p-2">{f(x.m.actual)}</td></tr>)}</tbody></table></div>
  <div className="flex items-center gap-3 text-sm"><button disabled={page===0} onClick={()=>setPage(page-1)} className="border rounded px-3 py-1 disabled:opacity-40">Prev</button>Page {page+1} of {Math.max(1,Math.ceil(sorted.length/50))}<button disabled={(page+1)*50>=sorted.length} onClick={()=>setPage(page+1)} className="border rounded px-3 py-1 disabled:opacity-40">Next</button></div></>}
 </div>}
