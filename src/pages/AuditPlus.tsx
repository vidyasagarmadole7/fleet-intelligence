import {useMemo,useState} from 'react';
import Chart from '../components/Chart';import KpiModal from '../components/KpiModal';
import {Card,Col,DataTable,Empty,Header,Notice,Tile,TripsDrawer,f,hbar,mkKpi,pct,pie} from '../components/Kit';
import {useFilters} from '../components/Filters';
import {Dataset,Kpi,Master} from '../engine/types';
import {DEFAULT_RISK,RULES,Risk,RiskCfg,kmSuspicion,level,riskGroups,ruleFlags,statusClass} from '../engine/risk';
import {G,groupBy} from '../engine/groups';
import {historyFacts} from '../engine/exceptions';

type Tab='risk'|'km'|'status';
const LV:Record<string,string>={High:'text-red-600 font-medium',Medium:'text-amber-600',Low:'text-emerald-600','Low data':'text-slate-500'};
const Num=({v,set,w=60}:{v:number;set:(n:number)=>void;w?:number})=><input type="number" min={0} value={v} onChange={e=>set(Math.max(0,Number(e.target.value)||0))} className="border rounded p-1 text-sm" style={{width:w}}/>;

/** v11 "Audit Plus": Risk Score, KM Compare & Billing, Status Audit. Review priorities, never proof. */
export default function AuditPlus({ds}:{ds:Dataset}){
 const {ms,bar}=useFilters(ds);
 const [tab,setTab]=useState<Tab>('risk');const [cfg,setCfg]=useState<RiskCfg>(DEFAULT_RISK);
 const [open,setOpen]=useState<Kpi|null>(null);const [drill,setDrill]=useState<{t:string;sub?:string;ms:Master[]}|null>(null);
 const flags=useMemo(()=>ruleFlags(ds,cfg),[ds,cfg]);
 const F=useMemo(()=>historyFacts(ds.history),[ds]);
 const actOne=useMemo(()=>{const a=ds.masters.map(m=>m.actual).filter((x):x is number=>x!==undefined);return a.length?a.filter(x=>x===1).length/a.length*100:0},[ds]);
 if(!ds.masters.length)return <Empty text="The imported file has no trips."/>;
 return <div className="space-y-5">
  <Header title="Audit Plus: Risk, KM Compare & Status" ds={ds} shown={ms.length} total={ds.masters.length}/>
  {bar}
  <div className="flex gap-2">{([['risk','Risk Score'],['km','KM Compare & Billing'],['status','Status Audit']] as const).map(([k,l])=><button key={k} onClick={()=>setTab(k)} className={`px-4 py-2 rounded-lg text-sm border ${tab===k?'bg-blue-600 text-white border-blue-600':'bg-white'}`}>{l}</button>)}</div>
  {tab==='risk'&&<RiskTab ms={ms} flags={flags} cfg={cfg} setCfg={setCfg} actOne={actOne} setOpen={setOpen} setDrill={setDrill}/>}
  {tab==='km'&&<KmTab ms={ms} cfg={cfg} setCfg={setCfg} setOpen={setOpen} setDrill={setDrill}/>}
  {tab==='status'&&<StatusTab ms={ms} F={F} flags={flags} setOpen={setOpen} setDrill={setDrill}/>}
  {open&&<KpiModal k={open} onClose={()=>setOpen(null)}/>}
  {drill&&<TripsDrawer title={drill.t} sub={drill.sub} ms={drill.ms} onClose={()=>setDrill(null)}/>}
 </div>}
type P={setOpen:(k:Kpi)=>void;setDrill:(d:{t:string;sub?:string;ms:Master[]})=>void};

function RiskTab({ms,flags,cfg,setCfg,actOne,setOpen,setDrill}:P&{ms:Master[];flags:Map<string,Set<string>>;cfg:RiskCfg;setCfg:(c:RiskCfg)=>void;actOne:number}){
 const [by,setBy]=useState<'drv'|'veh'|'co'>('drv');
 const key=by==='drv'?(m:Master)=>m.driver:by==='veh'?(m:Master)=>m.vehicle:(m:Master)=>m.company;
 const R=useMemo(()=>riskGroups(ms,flags,key,cfg),[ms,flags,by,cfg]);
 const noun=by==='drv'?'Driver':by==='veh'?'Vehicle':'Company';
 const kp=useMemo(()=>(['High','Medium','Low','Low data'] as const).map(l=>{const rows=R.filter(r=>level(r.score)===l);
  return mkKpi({id:l,label:l==='High'?'High risk (60+)':l==='Medium'?'Medium risk (30-59)':l==='Low'?'Low risk (under 30)':`Low data (under ${cfg.min} completed trips)`,value:f(rows.length),formula:`COUNT(${noun.toLowerCase()}s) with level ${l}`,sources:'Completed tasks and the rule flags below',rule:'Score = sum(weight x min(1, share of completed trips with the rule / full-score share)) / sum(weights) x 100. A score is a review priority, not proof of wrongdoing.',confirm:'Weights and thresholds (copied from v11)',included:rows.flatMap(r=>r.ms),excluded:0})}),[R,cfg,by]);
 const cols:Col<Risk>[]=[{key:'k',label:noun,get:r=>r.key},{key:'t',label:'Trips',get:r=>r.ms.length,right:true},{key:'n',label:'Completed',get:r=>r.n,right:true},
  ...RULES.map(x=>({key:x.k,label:x.label,get:(r:Risk)=>r.cnt[x.k],right:true}) as Col<Risk>),
  {key:'s',label:'Risk score',get:r=>r.score,show:r=>r.score===undefined?'low data':String(r.score),right:true},{key:'l',label:'Level',get:r=>level(r.score),show:r=><span className={LV[level(r.score)]}>{level(r.score)}</span>}];
 const set=(k:string,v:number)=>setCfg({...cfg,w:{...cfg.w,[k]:v}});
 return <div className="space-y-4">
  <Notice tone="slate">Rules run on COMPLETED trips only. Weight 0 turns a rule off. Odometer-vs-PTrack tolerance {cfg.tol} km and plausible trip {cfg.max} km. All values are the v11 defaults and need PTrack confirmation.{actOne>=80?` Actual_Emp is 1 on ${actOne.toFixed(0)}% of trips, so the employee rule compares In-Cab with Planned by default.`:''}</Notice>
  <div className="bg-white border rounded-xl p-4 space-y-2"><div className="text-sm font-medium">Score settings</div>
   <div className="flex flex-wrap gap-3 text-sm items-center">{RULES.map(r=><label key={r.k}>{r.label} weight <Num v={cfg.w[r.k]??0} set={v=>set(r.k,v)} w={52}/></label>)}</div>
   <div className="flex flex-wrap gap-3 text-sm items-center"><label>Full score when a rule hits <Num v={cfg.sat} set={v=>setCfg({...cfg,sat:v})} w={52}/> % of completed trips</label><label>Min completed trips <Num v={cfg.min} set={v=>setCfg({...cfg,min:v})} w={52}/></label><label>Odometer vs PTrack tolerance (km) <Num v={cfg.tol} set={v=>setCfg({...cfg,tol:v})} w={52}/></label>
    <label>Employee mismatch means <select className="border rounded p-1 bg-white" value={cfg.emb} onChange={e=>setCfg({...cfg,emb:e.target.value as RiskCfg['emb']})}><option value="planned">In-Cab vs Planned</option><option value="cab">In-Cab vs Actual</option><option value="any">Actual vs Planned, or In-Cab vs Actual</option></select></label></div></div>
  <div className="flex gap-2 items-center text-sm"><b>Score by</b>{([['drv','Driver'],['veh','Vehicle'],['co','Company']] as const).map(([k,l])=><button key={k} onClick={()=>setBy(k)} className={`px-3 py-1.5 rounded border ${by===k?'bg-blue-600 text-white':'bg-white'}`}>{l}</button>)}</div>
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{kp.map(k=><Tile key={k.id} k={k} onOpen={setOpen}/>)}</div>
  <div className="grid lg:grid-cols-2 gap-4"><Card t={`Top 10 ${noun.toLowerCase()}s by risk score`} note="Only those with enough completed trips"><Chart h={340} option={hbar(R.filter(r=>r.score!==undefined).slice(0,10).map(r=>[r.key,r.score!] as [string,number]))}/></Card>
   <Card t="Flagged completed trips by rule"><Chart h={340} option={pie(RULES.filter(r=>(cfg.w[r.k]??0)>0).map(r=>[r.label,R.reduce((s,x)=>s+x.cnt[r.k],0)] as [string,number]).filter(x=>x[1]>0))}/></Card></div>
  <DataTable title={`Risk score per ${noun.toLowerCase()}`} rows={R} cols={cols} exportName={`risk_by_${noun.toLowerCase()}.csv`} defaultSort={['s',-1]} search={r=>r.key} onRow={r=>setDrill({t:`${noun}: ${r.key}`,sub:`Risk ${r.score??'low data'}`,ms:r.ms})} note="Click a row to see that entity's trips."/></div>}

function KmTab({ms,cfg,setCfg,setOpen,setDrill}:P&{ms:Master[];cfg:RiskCfg;setCfg:(c:RiskCfg)=>void}){
 const [by,setBy]=useState<'co'|'ven'|'veh'|'drv'>('co');
 const key=by==='co'?(m:Master)=>m.company:by==='ven'?(m:Master)=>m.vendor:by==='veh'?(m:Master)=>m.vehicle:(m:Master)=>m.driver;
 const noun=by==='co'?'Company':by==='ven'?'Vendor':by==='veh'?'Vehicle':'Driver';
 const {groups}=useMemo(()=>groupBy(ms,key),[ms,by]);
 const ok=(m:Master)=>m.status==='Completed'&&m.odoKm!==undefined&&m.odoKm>=0&&m.odoKm<=cfg.max&&m.distanceKm!==undefined&&m.distanceKm>=0;
 const sus=useMemo(()=>ms.map(m=>({m,r:kmSuspicion(m,cfg)})).filter(x=>x.r.length),[ms,cfg]);
 const both=useMemo(()=>ms.filter(ok),[ms,cfg]);
 const sum=(a:Master[],g:(m:Master)=>number)=>a.reduce((s,m)=>s+g(m),0);
 const row=(g:G)=>{const b=g.ms.filter(ok);const p=sum(b,m=>m.distanceKm!),o=sum(b,m=>m.odoKm!);return{g,n:b.length,p,o,d:p-o,su:g.ms.filter(m=>kmSuspicion(m,cfg).length).length}};
 const rows=useMemo(()=>groups.map(row),[groups,cfg]);
 const P=sum(both,m=>m.distanceKm!),O=sum(both,m=>m.odoKm!);
 const kp=[mkKpi({id:'p',label:'PTrack KM (billed) on comparable trips',value:f(P),formula:'SUM(Distance(m) / 1000) over completed trips that also have a valid odometer KM',sources:'Distance(m)',rule:'Comparable = completed, valid distance, odometer KM between 0 and the plausible maximum.',included:both,excluded:ms.filter(m=>m.status==='Completed').length-both.length,why:'Completed trips missing a distance or a valid odometer difference'}),
  mkKpi({id:'o',label:'Odometer KM on the same trips',value:f(O),formula:'SUM(Completed reading - Started reading) over the same trips',sources:'Started / Completed Odometer Reading',rule:'Same trip set as PTrack KM, so the two totals are comparable.',included:both,excluded:0}),
  mkKpi({id:'d',label:'PTrack minus Odometer KM',value:(P-O>0?'+':'')+f(P-O),formula:'PTrack KM - Odometer KM on the same trips',sources:'Distance(m), odometer readings',rule:'Positive = PTrack shows more km than the odometer. A review hint for billing, not proof.',confirm:'Which source is billed',included:both,excluded:0}),
  mkKpi({id:'s',label:'Suspicious KM trips',value:f(sus.length),formula:`COUNT trips where the two sources differ by more than max(${cfg.kmAbs} km, ${cfg.kmPct}%)`,sources:'Distance(m), odometer readings',rule:'Both directions are listed so over-billing and under-recording are both visible.',confirm:'Tolerance values',included:sus.map(x=>x.m),excluded:both.length-sus.length,why:'Trips within tolerance'})];
 const cols:Col<ReturnType<typeof row>>[]=[{key:'k',label:noun,get:r=>r.g.key},{key:'t',label:'Trips',get:r=>r.g.total,right:true},{key:'c',label:'Completed',get:r=>r.g.done,right:true},{key:'n',label:'Comparable trips',get:r=>r.n,right:true},
  {key:'p',label:'PTrack KM (comparable)',get:r=>Math.round(r.p),right:true},{key:'o',label:'Odometer KM (comparable)',get:r=>Math.round(r.o),right:true},{key:'d',label:'PTrack - Odometer',get:r=>Math.round(r.d),right:true},
  {key:'dp',label:'Difference %',get:r=>r.o?+(r.d/r.o*100).toFixed(1):undefined,right:true},{key:'s',label:'Suspicious trips',get:r=>r.su,right:true}];
 const scols:Col<{m:Master;r:string[]}>[]=[{key:'t',label:'Task ID',get:x=>x.m.taskId},{key:'c',label:'Company',get:x=>x.m.company},{key:'v',label:'Vehicle',get:x=>x.m.vehicle},{key:'dr',label:'Driver',get:x=>x.m.driver},
  {key:'p',label:'PTrack KM',get:x=>x.m.distanceKm===undefined?undefined:+x.m.distanceKm.toFixed(1),right:true},{key:'o',label:'Odometer KM',get:x=>x.m.odoKm,right:true},
  {key:'d',label:'PTrack - Odometer',get:x=>x.m.distanceKm!==undefined&&x.m.odoKm!==undefined?+(x.m.distanceKm-x.m.odoKm).toFixed(1):undefined,right:true},{key:'r',label:'Reason',get:x=>x.r.join(' | ')}];
 return <div className="space-y-4">
  <Notice tone="slate">Compares PTrack distance with odometer distance on the same trips. The v11 Google/OSM map-KM comparison is <b>not included</b>: it needs a Maps API key and network access. Vehicle-day KM spikes and repeat offenders need several dates in the file (this view works with one).</Notice>
  <div className="flex flex-wrap gap-3 text-sm items-center"><label>Suspicious when sources differ by more than <Num v={cfg.kmPct} set={v=>setCfg({...cfg,kmPct:v})} w={52}/> % and <Num v={cfg.kmAbs} set={v=>setCfg({...cfg,kmAbs:v})} w={52}/> km</label>
   <b className="ml-4">Group by</b>{([['co','Company'],['ven','Vendor'],['veh','Vehicle'],['drv','Driver']] as const).map(([k,l])=><button key={k} onClick={()=>setBy(k)} className={`px-3 py-1.5 rounded border ${by===k?'bg-blue-600 text-white':'bg-white'}`}>{l}</button>)}</div>
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{kp.map(k=><Tile key={k.id} k={k} onOpen={setOpen}/>)}</div>
  <Card t={`Top 10 ${noun.toLowerCase()}s by PTrack minus odometer KM`} note="Positive = PTrack above odometer"><Chart h={340} option={hbar([...rows].sort((a,b)=>b.d-a.d).slice(0,10).map(r=>[r.g.key,Math.round(r.d)] as [string,number]))}/></Card>
  <DataTable title={`Billing summary by ${noun.toLowerCase()}`} rows={rows} cols={cols} exportName={`km_billing_by_${noun.toLowerCase()}.csv`} defaultSort={['d',-1]} search={r=>r.g.key} onRow={r=>setDrill({t:`${noun}: ${r.g.key}`,ms:r.g.ms})}/>
  <DataTable title="Suspicious KM trips" rows={sus} cols={scols} exportName="suspicious_km_trips.csv" defaultSort={['d',-1]} search={x=>[x.m.taskId,x.m.vehicle,x.m.driver,x.m.company].join(' ')} onRow={x=>setDrill({t:`Task ${x.m.taskId}`,ms:[x.m]})}/></div>}

function StatusTab({ms,F,flags,setOpen,setDrill}:P&{ms:Master[];F:ReturnType<typeof historyFacts>;flags:Map<string,Set<string>>}){
 const rows=useMemo(()=>ms.filter(m=>m.status==='Completed').map(m=>({m,c:statusClass(m,F)})),[ms,F]);
 const cats=[...new Set(rows.map(r=>r.c))].sort();const [sel,setSel]=useState('');
 const kp=cats.map(c=>{const l=rows.filter(r=>r.c===c);return mkKpi({id:c,label:c,value:f(l.length),formula:`COUNT completed trips classified "${c}"`,sources:'Task_Status, History_Description',rule:'Classification uses recorded history only. "Started at" and "Successful at" lines do not name a person, so it never says who completed a trip.',included:l.map(r=>r.m),excluded:rows.length-l.length,why:'Other classifications'})});
 const shown=sel?rows.filter(r=>r.c===sel):rows;
 const cols:Col<{m:Master;c:string}>[]=[{key:'t',label:'Task ID',get:r=>r.m.taskId},{key:'co',label:'Company',get:r=>r.m.company},{key:'dr',label:'Driver',get:r=>r.m.driver},{key:'c',label:'Classification',get:r=>r.c},
  {key:'s',label:'Started event',get:r=>F.started.has(r.m.taskId)?'yes':'no'},{key:'ok',label:'Success event',get:r=>F.succ.has(r.m.taskId)?'yes':'no'},{key:'f',label:'Rule flags',get:r=>[...(flags.get(r.m.taskId)||[])].map(k=>RULES.find(x=>x.k===k)?.label).join('; ')||undefined}];
 return <div className="space-y-4">
  <Notice tone="slate">Classification of COMPLETED trips from recorded history. "Recorded start-to-success flow" means both a Started and a Successful line exist; it does not prove the trip was done correctly. Anything about WHO did it needs the source-system audit log.</Notice>
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{kp.map(k=><Tile key={k.id} k={k} onOpen={setOpen}/>)}</div>
  <Card t="Classification of completed trips"><Chart h={260} option={hbar(cats.map(c=>[c,rows.filter(r=>r.c===c).length] as [string,number]))}/></Card>
  <div className="text-sm flex gap-2 items-center">Show only <select className="border rounded p-1.5 bg-white" value={sel} onChange={e=>setSel(e.target.value)}><option value="">All classifications</option>{cats.map(c=><option key={c}>{c}</option>)}</select></div>
  <DataTable title="Completed trips" rows={shown} cols={cols} exportName="status_audit.csv" defaultSort={['c',1]} search={r=>[r.m.taskId,r.m.driver,r.c].join(' ')} onRow={r=>setDrill({t:`Task ${r.m.taskId}`,ms:[r.m]})}/></div>}
