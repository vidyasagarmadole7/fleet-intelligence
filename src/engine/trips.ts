import {Dataset,Master} from './types';
export interface TripFact{m:Master;startedMs?:number;doneMs?:number;durMin?:number;seqIssue?:string}
/** Duration = history "Successful at" minus "Started at" (first occurrence each). Requires PTrack Confirmation. */
export function tripFacts(ds:Dataset):{facts:TripFact[];noStart:number;noSuccess:number;badSeq:number}{
 const st=new Map<string,number>(),ok=new Map<string,number>();
 for(const h of ds.history){if(h.ms===undefined)continue;
  if(h.desc==='Started at'){const o=st.get(h.taskId);if(o===undefined||h.ms<o)st.set(h.taskId,h.ms)}
  else if(h.desc==='Successful at'){const o=ok.get(h.taskId);if(o===undefined||h.ms<o)ok.set(h.taskId,h.ms)}}
 let noStart=0,noSuccess=0,badSeq=0;
 const facts=ds.masters.map(m=>{const s=st.get(m.taskId),d=ok.get(m.taskId);const f:TripFact={m,startedMs:s,doneMs:d};
  if(m.status==='Completed'){if(s===undefined)noStart++;if(d===undefined)noSuccess++}
  if(s!==undefined&&d!==undefined){if(d<s){f.seqIssue='Completed before it started';badSeq++}else f.durMin=(d-s)/60000}
  return f});
 return{facts,noStart,noSuccess,badSeq}}
