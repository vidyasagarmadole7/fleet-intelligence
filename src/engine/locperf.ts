import {Hist,Master} from './types';
import {employeeLocation} from './teamupload';

/** The 13 tracked activities, ported 1:1 from the v11 dashboard. `succ` = counts toward a successful trip. */
export const LPT:{k:string;label:string;color:string;from?:string;to?:string;succ?:boolean}[]=[
 {k:'locationModified',label:'Location Modified',color:'#e37400'},
 {k:'acceptedToSuccessful',label:'Accepted → Successful',color:'#4285f4',from:'accepted',to:'successful',succ:true},
 {k:'startedToSuccessful',label:'Started → Successful',color:'#9334e6',from:'started',to:'successful',succ:true},
 {k:'assignedToSuccessful',label:'Assigned → Successful',color:'#00897b',from:'assigned',to:'successful',succ:true},
 {k:'unassignedToSuccessful',label:'Unassigned → Successful',color:'#8d6e63',from:'unassigned',to:'successful',succ:true},
 {k:'cancelledToSuccessful',label:'Cancelled → Successful',color:'#5c6bc0',from:'cancelled',to:'successful',succ:true},
 {k:'successfulToSuccessful',label:'Successful → Successful',color:'#78909c',from:'successful',to:'successful',succ:true},
 {k:'successfulToStarted',label:'Successful → Started',color:'#d81b60',from:'successful',to:'started'},
 {k:'successfulToCancelled',label:'Successful → Cancelled',color:'#c62828',from:'successful',to:'cancelled'},
 {k:'successfulToUnassigned',label:'Successful → Unassigned',color:'#f9a825',from:'successful',to:'unassigned'},
 {k:'successfulToAssigned',label:'Successful → Assigned',color:'#7cb342',from:'successful',to:'assigned'},
 {k:'employeeMarkedSuccessful',label:'Employee Marked Successful (Successful at NAME)',color:'#26a69a',succ:true},
 {k:'driverSelfCompleted',label:'Driver Self-Completed (Successful at)',color:'#34a853',succ:true}];
export const DSC=12;
const IDX=new Map(LPT.map((t,i)=>[t.from?`${t.from}>${t.to}`:'',i]));
export const LPU='Unattributed (no name in history)',LPK='Unassigned / Unknown';
const name=(s:string)=>s.replace(/\s+/g,' ').replace(/\s*-\s*\d+\s*$/,'').trim();
const X=/^\s*status\s+updated\s+from\s+(.+?)\s+to\s+(.+?)\s+by\b\s*(.*?)\s*$/i,M0=/^\s*modified\s+by\b\s*(.*?)\s*$/i,S0=/^\s*successful\s+at\b[\s:\-]*(.*?)\s*$/i;

export type Parsed={t:number;nm:string}|{ignored:string}|null;
export function lpParse(d:string):Parsed{
 let m:RegExpExecArray|null;
 if((m=M0.exec(d)))return{t:0,nm:name(m[1])};
 if((m=X.exec(d))){const i=IDX.get(`${m[1].toLowerCase()}>${m[2].toLowerCase()}`);return i===undefined?{ignored:`${m[1]} → ${m[2]}`}:{t:i,nm:name(m[3])}}
 if((m=S0.exec(d))){const n=name(m[1]);return/[a-z]/i.test(n)&&!/^\d|\d:\d|\b(am|pm)\b/i.test(n)?{t:11,nm:n}:{t:DSC,nm:''}}
 return null}

export interface LpEvent{t:number;nm:string;m:Master;ms?:number;desc:string}
/** Parses History_Description once. Exact duplicate rows (same task, text, time) are counted once. */
export function lpEvents(hist:Hist[],byId:Map<string,Master>){
 const out:LpEvent[]=[];const ignored=new Map<string,number>();const seen=new Set<string>();let dup=0;
 for(const h of hist){
  const d=h.desc;if(!d||d.length>400)continue;const low=d.toLowerCase();if(!low.includes('modified')&&!low.includes('successful')&&!low.includes('status updated'))continue;
  const m=byId.get(h.taskId);if(!m)continue;
  const p=lpParse(d);if(!p)continue;
  const fp=`${h.taskId}|${d}|${h.ms??''}`;if(seen.has(fp)){dup++;continue}seen.add(fp);
  if('ignored' in p){ignored.set(p.ignored,(ignored.get(p.ignored)||0)+1);continue}
  out.push({t:p.t,nm:p.nm,m,ms:h.ms,desc:d})}
 return{events:out,ignored,dup}}

export interface Counts{n:Record<string,number>;totalActivity:number}
const zero=():Counts=>({n:Object.fromEntries(LPT.map(t=>[t.k,0])),totalActivity:0});
export interface LpRow extends Counts{key:string;name:string;isUna?:boolean;isDrv?:boolean;ev:LpEvent[]}
export interface LpDriver{driver:string;tid:Set<string>;sid:Set<string>;self:Set<string>;acceptedToSuccessful:number;startedToSuccessful:number;ev:LpEvent[];totalTrips:number;successfulTrips:number;driverSelfCompleted:number;successRate:number}

/** mode "named": unnamed "Successful at" stays unattributed. mode "driver": it is credited to the trip's driver. */
export function locPerf(events:LpEvent[],scope:Master[],mode:'named'|'driver'){
 const ids=new Set(scope.map(m=>m.taskId));const emp=new Map<string,LpRow>(),loc=new Map<string,LpRow>(),drv=new Map<string,LpDriver>();
 const tot=zero();let una=0,matched=0;
 const row=(mp:Map<string,LpRow>,key:string,nm:string,x?:Partial<LpRow>)=>{let r=mp.get(key);if(!r){r={...zero(),key,name:nm,ev:[],...x};mp.set(key,r)}return r};
 const dr=(n:string)=>{const k=n.toLowerCase();let d=drv.get(k);if(!d){d={driver:n,tid:new Set(),sid:new Set(),self:new Set(),acceptedToSuccessful:0,startedToSuccessful:0,ev:[],totalTrips:0,successfulTrips:0,driverSelfCompleted:0,successRate:0};drv.set(k,d)}return d};
 for(const m of scope)dr(m.driver||LPK).tid.add(m.taskId);
 for(const o of events){
  if(!ids.has(o.m.taskId))continue;
  let nm=o.nm,kind:'emp'|'drv'|'una'='emp';
  if(!nm){if(o.t===DSC&&mode==='driver'&&o.m.driver){nm=o.m.driver;kind='drv'}else{nm=LPU;kind='una';una++}}
  const f=LPT[o.t].k;
  const e=row(emp,(kind==='emp'?'e:':kind==='drv'?'d:':'u:')+nm.toLowerCase(),nm,{isUna:kind==='una',isDrv:kind==='drv'});
  e.n[f]++;e.totalActivity++;e.ev.push(o);tot.n[f]++;tot.totalActivity++;matched++;
  const ln=employeeLocation(o.m)??'Unattributed / Unknown';const l=row(loc,'l:'+ln.toLowerCase(),ln);l.n[f]++;l.totalActivity++;l.ev.push(o);
  const d=dr(o.m.driver||LPK);d.ev.push(o);
  if(o.t===1)d.acceptedToSuccessful++;if(o.t===2)d.startedToSuccessful++;if(LPT[o.t].succ)d.sid.add(o.m.taskId);if(o.t===DSC)d.self.add(o.m.taskId)}
 const drivers=[...drv.values()].map(d=>{d.totalTrips=d.tid.size;d.successfulTrips=d.sid.size;d.driverSelfCompleted=d.self.size;d.successRate=d.totalTrips?d.successfulTrips/d.totalTrips*100:0;return d});
 return{employees:[...emp.values()],locations:[...loc.values()],drivers,tot,meta:{tasks:scope.length,matched,una}}}
