import {Master} from './types';
export type OccStatus='Consistent'|'Planned differs from Actual'|'Actual differs from In-Cab'|'Planned, Actual and In-Cab all differ'|'Insufficient Data'|'Invalid value';
export interface OccRow{m:Master;variance?:number;cabVariance?:number;status:OccStatus;missing:string[]}
export const OCC_STATUSES:OccStatus[]=['Consistent','Planned differs from Actual','Actual differs from In-Cab','Planned, Actual and In-Cab all differ','Insufficient Data','Invalid value'];
/**
 * Keeps Planned_Emp, Actual_Emp and In Cab Employees separate. Blank is never zero.
 * variance = Actual - Planned (only when both exist); cabVariance = In-Cab - Actual (only when both exist).
 * "Consistent" only means the fields that exist agree with each other - it does not prove the count is right.
 * No occupancy % is computed: no vehicle capacity field exists in the export.
 */
export function occupancy(ms:Master[]):OccRow[]{
 return ms.map(m=>{
  const missing:string[]=[];if(m.planned===undefined)missing.push('Planned');if(m.actual===undefined)missing.push('Actual');if(m.inCab===undefined)missing.push('In-Cab');
  const r:OccRow={m,missing,status:'Consistent'};
  if([m.planned,m.actual,m.inCab].some(v=>v!==undefined&&(v<0||!Number.isInteger(v)))){r.status='Invalid value';return r}
  const pa=m.planned!==undefined&&m.actual!==undefined,ac=m.actual!==undefined&&m.inCab!==undefined;
  if(pa)r.variance=m.actual!-m.planned!;if(ac)r.cabVariance=m.inCab!-m.actual!;
  if(!pa&&!ac){r.status='Insufficient Data';return r}
  const a=pa&&r.variance!==0,b=ac&&r.cabVariance!==0;
  r.status=a&&b?'Planned, Actual and In-Cab all differ':a?'Planned differs from Actual':b?'Actual differs from In-Cab':'Consistent';
  return r})}
