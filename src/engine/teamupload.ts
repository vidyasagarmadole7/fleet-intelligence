import {Master} from './types';
import {Act} from './activity';

const unusable=(s?:string)=>!s||s.trim()===''||s.trim()==='-'||/^https?:/i.test(s.trim());
const tidy=(s:string)=>s.replace(/\s+/g,' ').trim();

/**
 * Employee location rule copied from the v11 audit dashboard:
 * PICKUP trip -> Pickup_Address, any other trip (DROP) -> Customer_Address, falling back to the other address when blank.
 * On the sample export Order_ID equals this location for ~99% of PICKUP and ~91% of DROP trips (see locationEvidence).
 */
export function employeeLocation(m:Master):string|undefined{
 const p=(m.pickupDrop??'').toUpperCase();
 const a=p==='PICKUP'?(m.pickupAddr||m.dropAddr):(m.dropAddr||m.pickupAddr);
 return unusable(a)?undefined:tidy(a!);}

const stem=(s?:string)=>tidy((s??'').split(',')[0]).toLowerCase();
/** How often Order_ID equals the first part of the employee location. Reported on screen, never assumed. */
export function locationEvidence(ms:Master[]){
 const r={pickup:{n:0,hit:0},drop:{n:0,hit:0}};
 for(const m of ms){const p=(m.pickupDrop??'').toUpperCase();const k=p==='PICKUP'?'pickup':p==='DROP'?'drop':undefined;if(!k||!m.orderId)continue;const l=employeeLocation(m);if(!l)continue;r[k].n++;if(stem(l)===stem(m.orderId))r[k].hit++}
 return r}

export interface Member{name:string;ids:Set<string>;total:Master[];pickup:Master[];drop:Master[];other:Master[];assigned:Master[];unassigned:Master[];loc:Map<string,Master[]>}

/** Earliest "Created By Bulk Import - NAME - ID" per task. */
export function creators(acts:Act[]):Map<string,{name:string;id?:string}>{
 const best=new Map<string,Act>();
 for(const a of acts){if(a.type!=='Task created (bulk import)'||!a.empName)continue;const b=best.get(a.taskId);if(!b||(a.ms??Infinity)<(b.ms??Infinity))best.set(a.taskId,a)}
 return new Map([...best].map(([k,a])=>[k,{name:tidy(a.empName!),id:a.empId}]))}

/** One row per uploader. A task is counted once, under the member named in its creation event. Assigned = any status other than Unassigned. */
export function teamUpload(ms:Master[],cr:Map<string,{name:string;id?:string}>){
 const map=new Map<string,Member>();const noCreator:Master[]=[];
 for(const m of ms){
  const c=cr.get(m.taskId);if(!c){noCreator.push(m);continue}
  const o=map.get(c.name)||{name:c.name,ids:new Set<string>(),total:[],pickup:[],drop:[],other:[],assigned:[],unassigned:[],loc:new Map<string,Master[]>()};
  if(c.id)o.ids.add(c.id);o.total.push(m);
  const p=(m.pickupDrop??'').toUpperCase();if(p==='PICKUP')o.pickup.push(m);else if(p==='DROP')o.drop.push(m);else o.other.push(m);
  (m.status==='Unassigned'?o.unassigned:o.assigned).push(m);
  const l=employeeLocation(m)??'Unattributed / Unknown';const a=o.loc.get(l);if(a)a.push(m);else o.loc.set(l,[m]);
  map.set(c.name,o)}
 return{members:[...map.values()].sort((a,b)=>b.total.length-a.total.length||a.name.localeCompare(b.name)),noCreator}}
