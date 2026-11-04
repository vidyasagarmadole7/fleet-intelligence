import {useMemo,useState} from 'react';
import Chart from '../components/Chart';import KpiModal from '../components/KpiModal';
import {Card,Col,DataTable,Empty,Header,Notice,Tile,D,f,mkKpi,pie} from '../components/Kit';
import {useFilters} from '../components/Filters';
import {Config,Dataset,Kpi,Master} from '../engine/types';
import {monthOf} from '../engine/groups';
import {OCC_STATUSES,OccRow,occupancy} from '../engine/occupancy';

const sum=(a:(number|undefined)[])=>a.reduce<number>((s,v)=>s+(v??0),0);
export default function Occupancy({ds,cfg}:{ds:Dataset;cfg:Config}){
 const [scope,setScope]=useState<'completed'|'all'>('completed');
 const {ms:filtered,bar}=useFilters(ds,<label className="text-sm flex items-center gap-1">Trips<select className="border rounded p-1.5 bg-white" value={scope} onChange={e=>setScope(e.target.value as 'completed'|'all')}><option value="completed">Completed only</option><option value="all">All statuses</option></select></label>);
 const [open,setOpen]=useState<Kpi|null>(null);const [stat,setStat]=useState('');
 const ms=useMemo(()=>scope==='completed'?filtered.filter(m=>m.status==='Completed'):filtered,[filtered,scope]);
 const rows=useMemo(()=>occupancy(ms),[ms]);
 const shownRows=useMemo(()=>stat?rows.filter(r=>r.status===stat):rows,[rows,stat]);
 const sc=scope==='completed'?'completed tasks':'all tasks';

 const kpis=useMemo(()=>{
  const P=ms.filter(m=>m.planned!==undefined),A=ms.filter(m=>m.actual!==undefined),C=ms.filter(m=>m.inCab!==undefined);
  const both=rows.filter(r=>r.variance!==undefined);const mis=rows.filter(r=>r.status!=='Consistent'&&r.status!=='Insufficient Data');
  const ef=cfg.employeeField,E=ms.filter(m=>m[ef]!==undefined);const efl=ef==='actual'?'Actual_Emp':ef==='inCab'?'In Cab Employees':'Planned_Emp';
  const vSum=sum(both.map(r=>r.variance));
  return[
   mkKpi({id:'p',label:'Total Planned Employees',value:f(sum(P.map(m=>m.planned))),formula:`SUM(Planned_Emp) per unique task (${sc})`,sources:'Planned_Emp',rule:'Read once per task, never summed across history rows. Blank is not 0.',included:P,excluded:ms.length-P.length,why:'Tasks with no Planned_Emp'}),
   mkKpi({id:'a',label:'Total Actual Employees',value:f(sum(A.map(m=>m.actual))),formula:`SUM(Actual_Emp) per unique task (${sc})`,sources:'Actual_Emp',rule:'Kept separate from Planned and In-Cab.',included:A,excluded:ms.length-A.length,why:'Tasks with no Actual_Emp'}),
   mkKpi({id:'c',label:'Total In-Cab Employees',value:f(sum(C.map(m=>m.inCab))),formula:`SUM(In Cab Employees) per unique task (${sc})`,sources:'In Cab Employees',rule:'Kept separate from Planned and Actual.',included:C,excluded:ms.length-C.length,why:'Tasks with no In Cab Employees'}),
   mkKpi({id:'avg',label:`Avg Employees per Trip (${efl})`,value:E.length?f(sum(E.map(m=>m[ef]))/E.length,2):'-',formula:`SUM(${efl}) / tasks that have a value in ${efl}`,sources:efl,rule:'Tasks without a value are not counted as 0 employees.',confirm:'Which employee field defines "travelled"',included:E,excluded:ms.length-E.length,why:`Tasks with no ${efl}`}),
   mkKpi({id:'v',label:'Employee Count Variance (Actual - Planned)',value:both.length?(vSum>0?'+':'')+f(vSum):'-',formula:'SUM(Actual_Emp - Planned_Emp) over tasks that have BOTH values',sources:'Planned_Emp, Actual_Emp',rule:'Positive = more boarded than planned. Only tasks with both values are compared.',included:both.map(r=>r.m),excluded:ms.length-both.length,why:'Tasks missing Planned or Actual'}),
   mkKpi({id:'m',label:'Trips with Employee Count Mismatch',value:f(mis.length),formula:'COUNT tasks WHERE Planned != Actual OR Actual != In-Cab (only compared when both values exist), or a value is invalid',sources:'Planned_Emp, Actual_Emp, In Cab Employees',rule:'A mismatch means "review", not wrongdoing: late boarding, no-shows and walk-ins all create differences.',included:mis.map(r=>r.m),excluded:ms.length-mis.length,why:'Consistent or insufficient-data tasks'})]},[ms,rows,cfg]);

 const coRows=useMemo(()=>{const c=new Map<string,{p:number;a:number;i:number;n:number}>();for(const m of ms){const k=m.company??'(Company missing)';const o=c.get(k)||{p:0,a:0,i:0,n:0};o.p+=m.planned??0;o.a+=m.actual??0;o.i+=m.inCab??0;o.n++;c.set(k,o)}return[...c].sort((a,b)=>b[1].a-a[1].a).slice(0,10)},[ms]);
 const trend=(kf:(d:string)=>string)=>{const c=new Map<string,{p:number;a:number;i:number}>();for(const m of ms){if(!m.date)continue;const k=kf(m.date);const o=c.get(k)||{p:0,a:0,i:0};o.p+=m.planned??0;o.a+=m.actual??0;o.i+=m.inCab??0;c.set(k,o)}return[...c].sort((a,b)=>a[0]<b[0]?-1:1)};
 const day=useMemo(()=>trend(d=>d),[ms]),month=useMemo(()=>trend(monthOf),[ms]);
 const shift=useMemo(()=>{const c=new Map<string,number>();for(const m of ms){if(!m.shift||m[cfg.employeeField]===undefined)continue;c.set(m.shift,(c.get(m.shift)||0)+(m[cfg.employeeField] as number))}return[...c].sort((a,b)=>b[1]-a[1]).slice(0,15) as D},[ms,cfg]);
 const varDist=useMemo(()=>{const B=['<= -3','-2','-1','0','+1','+2','>= +3'];const n=B.map(()=>0);for(const r of rows){if(r.variance===undefined)continue;const v=r.variance;n[v<=-3?0:v>=3?6:v+3]++}return{B,n}},[rows]);
 const cov=[['Planned_Emp',ms.filter(m=>m.planned!==undefined).length],['Actual_Emp',ms.filter(m=>m.actual!==undefined).length],['In Cab Employees',ms.filter(m=>m.inCab!==undefined).length]] as [string,number][];

 const cols:Col<OccRow>[]=[
  {key:'t',label:'Task ID',get:r=>r.m.taskId},{key:'c',label:'Company',get:r=>r.m.company},{key:'v',label:'Vehicle Number',get:r=>r.m.vehicle},{key:'d',label:'Date',get:r=>r.m.date},
  {key:'p',label:'Planned Employees',get:r=>r.m.planned,right:true},{key:'a',label:'Actual Employees',get:r=>r.m.actual,right:true},{key:'i',label:'In-Cab Employees',get:r=>r.m.inCab,right:true},
  {key:'va',label:'Variance (Actual - Planned)',get:r=>r.variance,show:r=>r.variance===undefined?'-':(r.variance>0?'+':'')+r.variance,right:true},
  {key:'vc',label:'In-Cab - Actual',get:r=>r.cabVariance,show:r=>r.cabVariance===undefined?'-':(r.cabVariance>0?'+':'')+r.cabVariance,right:true},
  {key:'m',label:'Missing Fields',get:r=>r.missing.join(', ')||undefined},
  {key:'s',label:'Occupancy Status',get:r=>r.status,show:r=><span className={r.status==='Consistent'?'text-emerald-600':r.status==='Insufficient Data'?'text-slate-500':'text-amber-600'}>{r.status}</span>}];

 if(!ds.masters.length)return <Empty text="The imported file has no trips."/>;
 return <div className="space-y-5">
  <Header title="Employee & Occupancy Analytics" ds={ds} shown={ms.length} total={ds.masters.length}/>
  {bar}
  <Notice tone="slate">Planned_Emp, Actual_Emp and In Cab Employees are kept as three separate fields. Blank is never treated as 0. Occupancy % and under/over-utilization are <b>not calculated</b>: the export has no vehicle seating-capacity field. Each task is counted once (not once per history row).</Notice>
  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">{kpis.map(k=><Tile key={k.id} k={k} onOpen={setOpen}/>)}</div>
  {ms.length===0?<Empty text="No trips match the filters."/>:<>
  <div className="grid lg:grid-cols-2 gap-4">
   <Card t="Planned vs Actual vs In-Cab by company (top 10 by actual)" note="Each series sums only tasks that have that field, so see the coverage table for gaps"><Chart h={340} option={{legend:{top:0},xAxis:{type:'category',data:coRows.map(r=>r[0]),axisLabel:{interval:0,rotate:30,width:80,overflow:'truncate'}},yAxis:{type:'value'},grid:{left:48,right:16,top:30,bottom:70},series:[{name:'Planned',type:'bar',data:coRows.map(r=>r[1].p)},{name:'Actual',type:'bar',data:coRows.map(r=>r[1].a)},{name:'In-Cab',type:'bar',data:coRows.map(r=>r[1].i)}]}}/></Card>
   <Card t="Occupancy status of trips"><Chart h={340} option={pie(OCC_STATUSES.map(s=>[s,rows.filter(r=>r.status===s).length] as [string,number]).filter(x=>x[1]>0))}/></Card>
   <Card t="Daily employee transportation" note="Scheduled date; per-field sums"><Chart option={{legend:{top:0},xAxis:{type:'category',data:day.map(d=>d[0])},yAxis:{type:'value'},series:[{name:'Planned',type:'line',data:day.map(d=>d[1].p)},{name:'Actual',type:'line',data:day.map(d=>d[1].a)},{name:'In-Cab',type:'line',data:day.map(d=>d[1].i)}]}}/></Card>
   <Card t="Monthly employee transportation"><Chart option={{legend:{top:0},xAxis:{type:'category',data:month.map(d=>d[0])},yAxis:{type:'value'},series:[{name:'Planned',type:'bar',data:month.map(d=>d[1].p)},{name:'Actual',type:'bar',data:month.map(d=>d[1].a)},{name:'In-Cab',type:'bar',data:month.map(d=>d[1].i)}]}}/></Card>
   <Card t="Employee count variance (Actual - Planned)" note="Tasks with both values only"><Chart option={{xAxis:{type:'category',data:varDist.B},yAxis:{type:'value'},series:[{type:'bar',data:varDist.n}]}}/></Card>
   <Card t="Shift-wise employee transportation" note={shift.length?`Field: ${cfg.employeeField}. Shift values as exported.`:'No shift data in this filter'}><Chart h={320} option={shift.length?{tooltip:{trigger:'axis'},grid:{left:120,right:20,top:10,bottom:20},yAxis:{type:'category',data:[...shift].reverse().map(x=>x[0]),axisLabel:{width:110,overflow:'truncate'}},xAxis:{type:'value'},series:[{type:'bar',data:[...shift].reverse().map(x=>x[1])}]}:{title:{text:'No shift data',left:'center',top:'center'}}}/></Card>
   <Card t="Field coverage (missing data shown separately)"><table className="text-sm w-full"><tbody>{cov.map(([n,c])=><tr key={n} className="border-b last:border-0"><td className="py-1.5">{n}</td><td className="text-right">{f(c)} present</td><td className="text-right font-medium text-amber-600">{f(ms.length-c)} missing</td></tr>)}</tbody></table></Card>
  </div>
  <DataTable title="Employee occupancy table" rows={shownRows} cols={cols} exportName="employee_occupancy.csv" defaultSort={['t',1]} search={r=>[r.m.taskId,r.m.company,r.m.vehicle,r.status].join(' ')}
   note="Variance and status are computed only when the fields being compared both exist."/>
  <div className="flex items-center gap-2 text-sm"><span>Show only:</span><select className="border rounded p-1.5 bg-white" value={stat} onChange={e=>setStat(e.target.value)}><option value="">All statuses</option>{OCC_STATUSES.map(s=><option key={s}>{s}</option>)}</select></div></>}
  {open&&<KpiModal k={open} onClose={()=>setOpen(null)}/>}
 </div>}
