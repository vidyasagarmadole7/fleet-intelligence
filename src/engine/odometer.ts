import {Hist,Master} from './types';
export type OdoStatus='Normal'|'Warning'|'Critical'|'Needs Review'|'Insufficient Data';
export interface OdoThresholds{gapKm:number;contKm:number;maxTripKm:number}
/** Defaults copied from the v11 audit dashboard (tolerance 5 km, plausible trip max 300 km). Still Require PTrack Confirmation. */
export const DEFAULT_ODO:OdoThresholds={gapKm:5,contKm:5,maxTripKm:300};
export interface OdoRow{m:Master;startedMs?:number;prev?:Master;contDiff?:number;gap?:number;status:OdoStatus;reasons:string[]}
const RANK:Record<OdoStatus,number>={'Critical':4,'Needs Review':3,'Warning':2,'Insufficient Data':1,'Normal':0};
export function auditOdometer(ms:Master[],hist:Hist[],t:OdoThresholds):OdoRow[]{
 const started=new Map<string,number>();for(const h of hist)if(h.desc==='Started at'&&h.ms!==undefined)started.set(h.taskId,h.ms);
 const byV=new Map<string,Master[]>();
 for(const m of ms)if(m.status==='Completed'&&m.vehicle){const a=byV.get(m.vehicle);if(a)a.push(m);else byV.set(m.vehicle,[m])}
 const out:OdoRow[]=[];
 for(const list of byV.values()){
  const key=(m:Master)=>started.get(m.taskId)??m.scheduledMs??m.completedMs??0;
  list.sort((a,b)=>key(a)-key(b));
  list.forEach((m,i)=>{
   const prev=i>0?list[i-1]:undefined;const r:OdoRow={m,startedMs:started.get(m.taskId),prev,status:'Normal',reasons:[]};
   const R:[OdoStatus,string][]=[];
   if(m.startOdo===undefined)R.push(['Insufficient Data','Start odometer missing']);
   if(m.endOdo===undefined)R.push(['Insufficient Data','End odometer missing']);
   if(m.odoKm!==undefined){
    if(m.odoKm<0)R.push(['Critical',`End reading lower than start (${m.odoKm} km)`]);
    else{if(m.distanceKm!==undefined&&m.distanceKm>=0){r.gap=m.odoKm-m.distanceKm;if(Math.abs(r.gap)>t.gapKm)R.push(['Needs Review',`Odometer ${m.odoKm.toFixed(1)} km vs PTrack ${m.distanceKm.toFixed(1)} km`])}
     if(m.odoKm>t.maxTripKm)R.push(['Warning',`Unusually high odometer KM (> ${t.maxTripKm})`])}}
   if(prev){
    if(prev.endOdo!==undefined&&m.startOdo!==undefined){r.contDiff=m.startOdo-prev.endOdo;
     if(r.contDiff<0)R.push(['Critical',`Start is ${-r.contDiff} km below previous closing`]);
     else if(r.contDiff>t.contKm)R.push(['Needs Review',`Possible Unrecorded Vehicle Movement - Needs Review (${r.contDiff} km gap)`])}
    else if(prev.endOdo===undefined)R.push(['Insufficient Data','Previous trip closing reading missing']);
    const s=r.startedMs??m.scheduledMs;if(prev.completedMs!==undefined&&s!==undefined&&prev.completedMs>s)R.push(['Warning','Overlaps previous trip (previous completed after this one started)'])}
   for(const [s,msg] of R){r.reasons.push(msg);if(RANK[s]>RANK[r.status])r.status=s}
   out.push(r)})}
 return out}
