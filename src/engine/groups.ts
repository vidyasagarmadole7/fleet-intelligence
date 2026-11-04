import {Master} from './types';
import {needsReview} from './kpis';

/** One definition of "valid odometer pair" used by every module. */
export const odoOk=(m:Master)=>m.startOdo!==undefined&&m.endOdo!==undefined&&(m.odoKm??-1)>=0;
/** PTrack distance counted once per completed task, only when present and non-negative. */
export const validKm=(m:Master)=>m.status==='Completed'&&m.distanceKm!==undefined&&m.distanceKm>=0;
export type EmpField='actual'|'inCab'|'planned';

export interface G{
 key:string;ms:Master[];
 total:number;done:number;canc:number;fail:number;
 km:number;kmN:number;avgKm?:number;
 emp:number;empN:number;
 odoDone:number;odoOkN:number;odoMissing:number;compliance?:number;
 days:Set<string>;lastDate?:string;dq:'OK'|'Review'|'Critical'}

export function dqStatus(ms:Master[]):G['dq']{
 let s:G['dq']='OK';
 for(const m of ms)for(const i of m.issues){if(i.sev==='critical')return'Critical';if(i.sev==='warn')s='Review'}
 return s}

/** Groups unique tasks (Task Masters) by a key. Tasks with no key are returned separately, never silently dropped. */
export function groupBy(ms:Master[],keyFn:(m:Master)=>string|undefined,emp:EmpField='actual'):{groups:G[];missing:Master[]}{
 const map=new Map<string,Master[]>();const missing:Master[]=[];
 for(const m of ms){const k=keyFn(m);if(k===undefined){missing.push(m);continue}const a=map.get(k);if(a)a.push(m);else map.set(k,[m])}
 const groups:G[]=[];
 for(const [key,list] of map){
  const done=list.filter(m=>m.status==='Completed');
  const km=done.filter(validKm);const e=done.filter(m=>m[emp]!==undefined);
  const kmSum=km.reduce((s,m)=>s+m.distanceKm!,0);
  const okN=done.filter(odoOk).length;
  const days=new Set(list.map(m=>m.date).filter((d):d is string=>!!d));
  groups.push({key,ms:list,total:list.length,done:done.length,canc:list.filter(m=>m.status==='Cancelled').length,fail:list.filter(m=>m.status==='Failed').length,
   km:kmSum,kmN:km.length,avgKm:km.length?kmSum/km.length:undefined,
   emp:e.reduce((s,m)=>s+(m[emp] as number),0),empN:e.length,
   odoDone:done.length,odoOkN:okN,odoMissing:done.filter(m=>m.startOdo===undefined||m.endOdo===undefined).length,
   compliance:done.length?okN/done.length*100:undefined,
   days,lastDate:[...days].sort().pop(),dq:dqStatus(list)})}
 return{groups,missing}}

/** Distinct non-missing values of a field with their task counts, most frequent first. */
export function distinct(ms:Master[],f:(m:Master)=>string|undefined):[string,number][]{
 const c=new Map<string,number>();for(const m of ms){const v=f(m);if(v)c.set(v,(c.get(v)||0)+1)}
 return[...c].sort((a,b)=>b[1]-a[1]||(a[0]<b[0]?-1:1))}
export function primary(ms:Master[],f:(m:Master)=>string|undefined):string{
 const d=distinct(ms,f);if(!d.length)return'-';return d.length===1?d[0][0]:`${d[0][0]} (+${d.length-1} more)`}

export const reviewTasks=(ms:Master[])=>ms.filter(needsReview);
export const monthOf=(d:string)=>d.slice(0,7);
