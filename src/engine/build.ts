import {Config,Dataset,Hist,Issue,Master,Row} from './types';
const clean=(v?:string)=>{const t=v?.trim();return !t||t==='-'?undefined:t};
const num=(v?:string)=>{const c=clean(v);if(c===undefined)return;const n=Number(c.replace(/,/g,''));return Number.isFinite(n)?n:undefined};
const MON=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
/** Parses "04 Nov 2026 01:03:19 am" and the history variant "01:03:27:27 am" (extra seconds ignored). Wall-clock, no timezone shift. */
export function parseTs(v?:string):{ms:number;date:string}|undefined{
 const c=clean(v);if(!c)return;
 const m=c.match(/^(\d{1,2}) ([A-Za-z]{3}) (\d{4}) (\d{1,2}):(\d{2})(?::(\d{2}))?(?::\d{2})? ?(am|pm)$/i);if(!m)return;
 const mo=MON.indexOf(m[2].toLowerCase());if(mo<0)return;
 let h=Number(m[4])%12;if(m[7].toLowerCase()==='pm')h+=12;
 const ms=Date.UTC(+m[3],mo,+m[1],h,+m[5],+(m[6]||0));
 return{ms,date:`${m[3]}-${String(mo+1).padStart(2,'0')}-${m[1].padStart(2,'0')}`}}
export function build(rows:Row[],map:Record<string,string>,cfg:Config,fileName:string,headers:string[]):Dataset{
 const g=(r:Row,k:string)=>map[k]?clean(r[map[k]]):undefined;
 const groups=new Map<string,Row[]>();let missingIds=0,invalidTs=0;
 for(const r of rows){const id=g(r,'taskId');if(!id){missingIds++;continue}
  const a=groups.get(id);if(a)a.push(r);else groups.set(id,[r])}
 const history:Hist[]=[];const seen=new Set<string>();let dup=0;
 const masters:Master[]=[];const all:Issue[]=[];
 for(const [id,rs0] of groups){
  const iss:Issue[]=[];const add=(code:string,sev:Issue['sev'],msg:string)=>iss.push({taskId:id,code,sev,msg});
  // history = one record per CSV row; master values come from the latest history row
  for(const r of rs0){const t=parseTs(map.histTime?r[map.histTime]:undefined);if(map.histTime&&clean(r[map.histTime])&&!t)invalidTs++;
   const h:Hist={taskId:id,type:g(r,'histType'),desc:g(r,'histDesc'),ms:t?.ms,date:t?.date};
   const k=`${id}|${h.type}|${h.desc}|${h.ms}`;if(seen.has(k))dup++;else seen.add(k);history.push(h)}
  const tms=(r:Row)=>parseTs(map.histTime?r[map.histTime]:undefined)?.ms??0;
  const rs=[...rs0].sort((a,b)=>tms(b)-tms(a));
  const pick=(k:string)=>{const v=rs.map(r=>g(r,k)).filter((x):x is string=>!!x);
   if(new Set(v).size>1)add('CONFLICT_'+k.toUpperCase(),'warn',`${k} differs across history rows (${[...new Set(v)].slice(0,3).join(' | ')}); latest history row used`);return v[0]};
  const n=(k:string)=>{const v=pick(k);return v===undefined?undefined:num(v)};
  const status=pick('status'),sched=parseTs(pick('startBefore')),comp=parseTs(pick('completedAt'));
  const distM=n('distM'),distanceKm=distM===undefined?undefined:distM/1000;
  const startOdo=n('startOdo'),endOdo=n('endOdo');
  const odoKm=startOdo!==undefined&&endOdo!==undefined?endOdo-startOdo:undefined;
  const first=(k:string)=>rs.map(r=>g(r,k)).find(Boolean);
  const m:Master={taskId:id,orderId:pick('orderId'),pickupAddr:first('pickupAddr'),dropAddr:first('dropAddr'),company:pick('company'),vehicle:pick('vehicle'),driver:pick('driver'),agentId:pick('agentId'),
   vendor:pick('vendor'),distanceKm,pickupCat:pick('pickupCat'),status,pickupDrop:pick('pickupDrop'),shift:pick('shift'),tripType:pick('tripType'),
   planned:n('planned'),actual:n('actual'),inCab:n('inCab'),startOdo,endOdo,odoKm,scheduledMs:sched?.ms,date:(sched??comp)?.date,completedMs:comp?.ms,rowCount:rs.length,issues:iss};
  const done=status==='Completed',assigned=status!=='Unassigned';
  if(!status)add('MISSING_STATUS','critical','Task status missing');
  else if(!cfg.validStatuses.includes(status))add('INVALID_STATUS','warn',`Unrecognised status "${status}"`);
  if(!m.company)add('MISSING_COMPANY','warn','Company (Team_Name) missing');
  if(!m.date)add('INVALID_DATE','warn','No parsable scheduled/completion date');
  if(assigned&&!m.vehicle)add('MISSING_VEHICLE','warn','Vehicle number missing on an assigned task');
  if(assigned&&!m.driver)add('MISSING_DRIVER','warn','Agent/driver missing on an assigned task');
  if(done&&startOdo===undefined)add('MISSING_ODO_START','warn','Completed without start odometer');
  if(done&&endOdo===undefined)add('MISSING_ODO_END','warn','Completed without end odometer');
  if(distanceKm!==undefined&&distanceKm<0)add('NEG_DISTANCE','critical','Negative distance');
  if(done&&distanceKm===0)add('ZERO_DISTANCE','info','Completed with zero distance');
  if(odoKm!==undefined&&odoKm<0)add('NEG_ODO','critical',`End odometer lower than start (${odoKm} km)`);
  if(done&&odoKm!==undefined&&odoKm>=0&&distanceKm!==undefined&&distanceKm>=0&&Math.abs(odoKm-distanceKm)>cfg.gapKm)
   add('KM_GAP','warn',`Odometer ${odoKm.toFixed(1)} km vs PTrack ${distanceKm.toFixed(1)} km - needs review (threshold ${cfg.gapKm} km requires PTrack confirmation)`);
  masters.push(m);all.push(...iss)}
 return{masters,history,issues:all,importedAt:new Date().toLocaleString(),fileName,
  dq:{rows:rows.length,uniqueIds:groups.size,missingIds,exactDupHistory:dup,invalidTimestamps:invalidTs,unmappedHeaders:headers.filter(h=>!Object.values(map).includes(h))}}}
