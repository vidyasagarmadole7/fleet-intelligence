import {Config,Kpi,Master} from './types';
const fmt=(n:number,d=0)=>n.toLocaleString('en-IN',{maximumFractionDigits:d});
const sum=(a:number[])=>a.reduce((x,y)=>x+y,0);
export const needsReview=(m:Master)=>m.issues.some(i=>i.sev!=='info');
export function computeKpis(ms:Master[],cfg:Config):Kpi[]{
 const by=(s:string)=>ms.filter(m=>m.status===s);
 const done=by('Completed'),canc=by('Cancelled'),fail=by('Failed');
 const base=cfg.completionBase==='all'?ms:ms.filter(m=>['Completed','Cancelled','Failed'].includes(m.status??''));
 const dist=done.filter(m=>m.distanceKm!==undefined&&m.distanceKm>=0);
 const odo=done.filter(m=>m.odoKm!==undefined&&m.odoKm>=0);
 const veh=ms.filter(m=>m.vehicle),vend=ms.filter(m=>m.vendor);
 const ef=cfg.employeeField,emp=done.filter(m=>m[ef]!==undefined);
 let req=0,got=0;const inc:Master[]=[];
 for(const m of ms){let miss=false;const need=(v:unknown)=>{req++;if(v!==undefined)got++;else miss=true};
  need(m.company);if(m.status!=='Unassigned'){need(m.vehicle);need(m.driver);need(m.vendor)}
  if(m.status==='Completed'){need(m.startOdo);need(m.endOdo)}if(miss)inc.push(m)}
 const rev=ms.filter(needsReview);
 const k=(o:Partial<Kpi>&Pick<Kpi,'id'|'label'|'value'|'formula'|'sources'|'rule'|'included'>):Kpi=>({excluded:0,excludedWhy:'None',issues:'',...o});
 return[
 k({id:'total',label:'Unique Trips / Tasks',value:fmt(ms.length),formula:'COUNT(DISTINCT Task_ID)',sources:'Task_ID',rule:'History rows are collapsed to one Task Master record; repeated rows are never counted as trips.',included:ms,excludedWhy:'Rows without a Task ID are excluded at import'}),
 k({id:'done',label:'Completed Trips',value:fmt(done.length),formula:'COUNT(DISTINCT Task_ID) WHERE status = Completed',sources:'Task_ID, Task_Status',rule:'Status taken from the latest history row of each task.',confirm:'Which status is authoritative (latest history vs task status)',included:done,excluded:ms.length-done.length,excludedWhy:'Tasks in any other status'}),
 k({id:'canc',label:'Cancelled Trips',value:fmt(canc.length),formula:'COUNT(DISTINCT Task_ID) WHERE status = Cancelled',sources:'Task_ID, Task_Status',rule:'Exact status match.',included:canc,excluded:ms.length-canc.length,excludedWhy:'Other statuses'}),
 k({id:'fail',label:'Failed Trips',value:fmt(fail.length),formula:'COUNT(DISTINCT Task_ID) WHERE status = Failed',sources:'Task_ID, Task_Status',rule:'Shown because the export carries an explicit Failed status.',confirm:'Reliability of Failed status',included:fail,excluded:ms.length-fail.length,excludedWhy:'Other statuses'}),
 k({id:'rate',label:'Completion Rate',value:base.length?fmt(done.length/base.length*100,1)+'%':'-',formula:cfg.completionBase==='all'?'Completed / all unique tasks':'Completed / (Completed + Cancelled + Failed)',sources:'Task_ID, Task_Status',rule:'Denominator is configurable in Settings.',confirm:'Whether Unassigned / in-flight tasks belong in the denominator',included:base,excluded:ms.length-base.length,excludedWhy:'Open tasks excluded when "closed only" base is chosen'}),
 k({id:'km',label:'Total KM (PTrack Distance)',value:fmt(sum(dist.map(m=>m.distanceKm!))),formula:'SUM(Distance(m) / 1000) per unique completed task',sources:'Distance(m)',rule:'Distance counted once per task, never per history row. Blank or "-" is not treated as zero.',included:dist,excluded:done.length-dist.length,excludedWhy:'Completed tasks with missing or negative distance'}),
 k({id:'odo',label:'Total Odometer KM',value:fmt(sum(odo.map(m=>m.odoKm!))),formula:'SUM(End Odometer - Start Odometer) per unique completed task',sources:'Started / Completed Odometer Reading',rule:'Only tasks with both readings and end >= start.',included:odo,excluded:done.length-odo.length,excludedWhy:'Missing readings or negative difference',issues:'Compare with PTrack distance on the Odometer & KM Audit module.'}),
 k({id:'veh',label:'Vehicles Used',value:fmt(new Set(veh.map(m=>m.vehicle)).size),formula:'COUNT(DISTINCT Vehicle_Number)',sources:'Vehicle_Number',rule:'Vehicle values kept exactly as exported (no normalisation).',included:veh,excluded:ms.length-veh.length,excludedWhy:'Tasks with no vehicle (mostly Unassigned)'}),
 k({id:'emp',label:'Employees Travelled',value:fmt(sum(emp.map(m=>m[ef] as number))),formula:`SUM(${ef==='actual'?'Actual_Emp':ef==='inCab'?'In Cab Employees':'Planned_Emp'}) per unique completed task`,sources:'Planned_Emp / Actual_Emp / In Cab Employees',rule:'Fields kept separate; blank is not zero.',confirm:'Which employee field defines "travelled" (Actual vs In-Cab)',included:emp,excluded:done.length-emp.length,excludedWhy:'Completed tasks with no value in the chosen field'}),
 k({id:'vend',label:'Vendors',value:fmt(new Set(vend.map(m=>m.vendor)).size),formula:'COUNT(DISTINCT Vendor_Name)',sources:'Vendor_Name',rule:'Blank or "-" excluded.',included:vend,excluded:ms.length-vend.length,excludedWhy:'Tasks with no vendor'}),
 k({id:'comp',label:'Data Completeness',value:req?fmt(got/req*100,1)+'%':'-',formula:'Populated required fields / required fields',sources:'Team_Name, Vehicle, Agent, Vendor, Odometers',rule:'Assigned tasks need vehicle/driver/vendor; completed tasks need both odometers.',confirm:'Required-field policy',included:inc,excluded:ms.length-inc.length,excludedWhy:'Tasks with every required field present (shown list = tasks with gaps)',issues:'Completeness is not accuracy: a filled field can still be wrong.'}),
 k({id:'rev',label:'Tasks Needing Review',value:fmt(rev.length),formula:'Tasks with >= 1 warning/critical validation issue',sources:'All validated fields',rule:'Issue list shown per record.',included:rev,excluded:ms.length-rev.length,excludedWhy:'Tasks with no warning/critical issue'})]}
