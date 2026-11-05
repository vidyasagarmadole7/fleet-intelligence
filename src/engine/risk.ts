import {Dataset,Master} from './types';
import {DEFAULT_ODO} from './odometer';
import {historyFacts} from './exceptions';

export const RULES=[
 {k:'mo',label:'Missing odometer'},{k:'ri',label:'Reused / identical image'},{k:'od',label:'Odometer vs PTrack difference'},
 {k:'em',label:'Employee count mismatch'},{k:'rd',label:'Reading decreased / implausible'},{k:'mp',label:'Missing photo'}] as const;
export interface RiskCfg{w:Record<string,number>;sat:number;min:number;tol:number;max:number;emb:'planned'|'cab'|'any';kmPct:number;kmAbs:number}
/** Defaults copied from the v11 dashboard (weights 30/25/25/20, full score at 20%, min 3 trips). All Require PTrack Confirmation. */
export const DEFAULT_RISK:RiskCfg={w:{mo:30,ri:25,od:25,em:20,rd:0,mp:0},sat:20,min:3,tol:DEFAULT_ODO.gapKm,max:DEFAULT_ODO.maxTripKm,emb:'planned',kmPct:30,kmAbs:5};

/** Rule flags per COMPLETED task. Rules look at one task each; nothing is guessed. */
export function ruleFlags(ds:Dataset,c:RiskCfg):Map<string,Set<string>>{
 const img=new Map<string,number>();for(const m of ds.masters)for(const u of new Set([m.startImg,m.endImg].filter(Boolean) as string[]))img.set(u,(img.get(u)||0)+1);
 const out=new Map<string,Set<string>>();
 for(const m of ds.masters){if(m.status!=='Completed')continue;const f=new Set<string>();
  if(m.startOdo===undefined||m.endOdo===undefined)f.add('mo');
  if((m.startImg&&(m.startImg===m.endImg||img.get(m.startImg)!>1))||(m.endImg&&img.get(m.endImg)!>1))f.add('ri');
  if(m.odoKm!==undefined&&m.odoKm>=0&&m.odoKm<=c.max&&m.distanceKm!==undefined&&Math.abs(m.odoKm-m.distanceKm)>c.tol)f.add('od');
  const pl=m.planned,ac=m.actual,ic=m.inCab;
  if(c.emb==='planned'?(ic!==undefined&&pl!==undefined&&ic!==pl):c.emb==='cab'?(ic!==undefined&&ac!==undefined&&ic!==ac):((ac!==undefined&&pl!==undefined&&ac!==pl)||(ic!==undefined&&ac!==undefined&&ic!==ac)))f.add('em');
  if((m.startOdo!==undefined&&m.endOdo!==undefined&&m.endOdo<m.startOdo)||(m.odoKm!==undefined&&m.odoKm>c.max))f.add('rd');
  if(!m.startImg||!m.endImg)f.add('mp');
  out.set(m.taskId,f)}
 return out}

export interface Risk{key:string;ms:Master[];n:number;cnt:Record<string,number>;score?:number}
/** Score 0-100 = sum(weight x min(1, share of completed trips with the flag / full-score share)) / sum(weights) x 100. A review priority, not proof. */
export function riskGroups(ms:Master[],flags:Map<string,Set<string>>,keyFn:(m:Master)=>string|undefined,c:RiskCfg):Risk[]{
 const g=new Map<string,Master[]>();for(const m of ms){const k=keyFn(m);if(!k)continue;const a=g.get(k);if(a)a.push(m);else g.set(k,[m])}
 const tw=Object.values(c.w).reduce((a,b)=>a+b,0);
 return[...g].map(([key,list])=>{const done=list.filter(m=>m.status==='Completed'),n=done.length;const cnt:Record<string,number>={};let s=0;
  for(const r of RULES){cnt[r.k]=done.filter(m=>flags.get(m.taskId)?.has(r.k)).length;s+=(c.w[r.k]||0)*Math.min(1,(n?cnt[r.k]/n:0)/Math.max(.01,c.sat/100))}
  return{key,ms:list,n,cnt,score:n>=c.min&&tw?Math.round(s/tw*100):undefined}}).sort((a,b)=>(b.score??-1)-(a.score??-1)||b.n-a.n)}
export const level=(s?:number)=>s===undefined?'Low data':s>=60?'High':s>=30?'Medium':'Low';

/** Odometer vs PTrack distance for one completed task. Map/Google KM is not available (needs an API key and network). */
export function kmSuspicion(m:Master,c:RiskCfg):string[]{
 if(m.status!=='Completed')return[];const o=m.odoKm!==undefined&&m.odoKm>=0&&m.odoKm<=c.max?m.odoKm:undefined,p=m.distanceKm!==undefined&&m.distanceKm>=0?m.distanceKm:undefined;
 if(o===undefined||p===undefined)return[];const lim=(b:number)=>Math.max(c.kmAbs,b*c.kmPct/100),r:string[]=[];
 if(p-o>lim(o))r.push('PTrack KM above odometer KM (possible over-billing)');if(o-p>lim(p))r.push('Odometer KM above PTrack KM');return r}

/** Statuses of completed trips, from recorded history only. */
export function statusClass(m:Master,F:ReturnType<typeof historyFacts>):string{
 if(m.status!=='Completed')return'Not completed';
 const s=F.succMs.get(m.taskId),modAfter=s!==undefined&&(F.mods.get(m.taskId)||[]).some(x=>x>s);
 if(modAfter)return'Modified after completion';
 const hs=F.started.has(m.taskId),ok=F.succ.has(m.taskId);
 return hs&&ok?'Recorded start-to-success flow':!hs&&ok?'Missing start event':'No success event (insufficient evidence)'}
