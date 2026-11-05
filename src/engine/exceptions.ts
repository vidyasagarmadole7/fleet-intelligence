import {Dataset,Master} from './types';
import {auditOdometer,OdoThresholds} from './odometer';
import {occupancy} from './occupancy';

export type Sev='High'|'Medium'|'Low';
export interface Exc{id:string;m:Master;cat:string;sev:Sev;desc:string;source:string;related:string[]}
export const REVIEW_STATUSES=['Pending','Reviewed','Accepted','Rejected'] as const;
export type Review={st:typeof REVIEW_STATUSES[number];as:string;nt:string;at:string};
const slug=(s:string)=>s.replace(/\W+/g,'');

/**
 * Automated, rule-based findings ported from the v11 audit dashboard plus the odometer / occupancy engines.
 * Exception ID = Task ID + category, so re-importing the same file never creates duplicates.
 * A finding is a lead for human review, never proof. Source data is not modified.
 */
export function findExceptions(ds:Dataset,odo:OdoThresholds):Exc[]{
 const out=new Map<string,Exc>();
 const add=(m:Master,cat:string,sev:Sev,desc:string,source:string,related:string[]=[])=>{const id=`${m.taskId}-${slug(cat)}`;if(!out.has(id))out.set(id,{id,m,cat,sev,desc,source,related})};
 const byId=new Map(ds.masters.map(m=>[m.taskId,m]));
 // history facts per task (exact duplicate rows ignored)
 const started=new Set<string>(),succMs=new Map<string,number>(),succ=new Set<string>(),mods=new Map<string,number[]>();const seen=new Set<string>();
 for(const h of ds.history){const d=(h.desc??'').trim();const fp=`${h.taskId}|${d}|${h.ms??''}`;if(seen.has(fp))continue;seen.add(fp);
  if(/^started\b/i.test(d))started.add(h.taskId);
  if(/^successful\b/i.test(d)){succ.add(h.taskId);if(h.ms!==undefined){const c=succMs.get(h.taskId);if(c===undefined||h.ms<c)succMs.set(h.taskId,h.ms)}}
  if(/^modified\b/i.test(d)&&h.ms!==undefined){const a=mods.get(h.taskId)||[];a.push(h.ms);mods.set(h.taskId,a)}}
 // image / reading reuse across tasks
 const img=new Map<string,string[]>(),srd=new Map<string,string[]>();
 for(const m of ds.masters){for(const u of new Set([m.startImg,m.endImg].filter(Boolean) as string[])){const a=img.get(u)||[];a.push(m.taskId);img.set(u,a)}
  if(m.vehicle&&m.startOdo!==undefined){const k=`${m.vehicle}|${m.startOdo}`;const a=srd.get(k)||[];a.push(m.taskId);srd.set(k,a)}}
 for(const m of ds.masters){
  const done=m.status==='Completed';
  if(done&&!m.startImg)add(m,'Missing start odometer image','Medium','Completed trip: Started Odometer Image is empty','Started Odometer Image');
  if(done&&!m.endImg)add(m,'Missing completion odometer image','Medium','Completed trip: Completed Odometer Image is empty','Completed Odometer Image');
  if(m.startImg&&m.startImg===m.endImg)add(m,'Same image for start and end','High','Start and completion image URLs are identical','Started / Completed Odometer Image');
  const reused=[...new Set([m.startImg,m.endImg].filter(Boolean).flatMap(u=>img.get(u!)!))].filter(i=>i!==m.taskId);
  if(reused.length)add(m,'Odometer image reused across trips','High',`Same image URL appears on ${reused.length} other trip(s)`,'Odometer Image URLs',reused);
  if(m.vehicle&&m.startOdo!==undefined){const r=srd.get(`${m.vehicle}|${m.startOdo}`)!.filter(i=>i!==m.taskId);if(r.length)add(m,'Repeated start reading (same vehicle)','Medium',`Start reading ${m.startOdo} also starts ${r.length} other trip(s) of ${m.vehicle}`,'Started Odometer Reading, Vehicle_Number',r)}
  if(done&&!started.has(m.taskId))add(m,'Missing start event','Medium','Completed without a "Started at" history event','History_Description');
  if(done&&!succ.has(m.taskId))add(m,'No success event','Medium','Status is Completed but there is no "Successful at" history event','History_Description');
  const s=succMs.get(m.taskId);if(s!==undefined&&(mods.get(m.taskId)||[]).some(x=>x>s))add(m,'Modified after completion','Medium','A "Modified by" event is dated after the success event','History_Description');
  if(done&&m.totalMin!==undefined&&(m.totalMin<3||m.totalMin>300))add(m,'Suspicious duration','Medium',`Total_Time_Taken is ${m.totalMin} min (expected 3-300 min)`,'Total_Time_Taken(min)');
  if(done){const ok=m.lat!==undefined&&m.lng!==undefined&&Math.abs(m.lat)<=90&&Math.abs(m.lng)<=180&&!(m.lat===0&&m.lng===0);if(!ok)add(m,'Invalid GPS coordinates','Low','Latitude/Longitude missing or out of range','Latitude, Longitude')}
  if(done&&(!m.driver||!m.vehicle))add(m,'Missing critical fields','Medium','Driver or vehicle is blank on a completed trip','Agent_Username, Vehicle_Number')}
 for(const r of auditOdometer(ds.masters,ds.history,odo)){
  if(r.status==='Normal'||r.status==='Insufficient Data')continue;
  add(r.m,`Odometer audit: ${r.status}`,r.status==='Critical'?'High':r.status==='Needs Review'?'Medium':'Low',r.reasons.join('; ')||r.status,'Odometer readings, PTrack distance',r.prev?[r.prev.taskId]:[])}
 // Planned/Actual/In-Cab mismatches are NOT queued here: on real exports Actual_Emp is almost always 1, which would bury real findings. They stay visible, filterable, in Employee & Occupancy.
 for(const r of occupancy(ds.masters.filter(m=>m.status==='Completed')))if(r.status==='Invalid value')add(r.m,'Employee count: invalid value','Low',`Planned ${r.m.planned??'-'} / Actual ${r.m.actual??'-'} / In-Cab ${r.m.inCab??'-'}`,'Planned_Emp, Actual_Emp, In Cab Employees');
 void byId;
 const rank={High:0,Medium:1,Low:2};
 return[...out.values()].sort((a,b)=>rank[a.sev]-rank[b.sev]||a.cat.localeCompare(b.cat)||a.m.taskId.localeCompare(b.m.taskId))}
