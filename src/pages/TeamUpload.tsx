import {useMemo,useState} from 'react';
import Chart from '../components/Chart';import KpiModal from '../components/KpiModal';
import {Card,Col,DataTable,Empty,Notice,Tile,TripsDrawer,f,hbar,mkKpi,pct,stackedH} from '../components/Kit';
import {useFilters} from '../components/Filters';
import {Dataset,Kpi,Master} from '../engine/types';
import {parseActivities} from '../engine/activity';
import {Member,creators,teamUpload} from '../engine/teamupload';

interface ML{member:string;loc:string;ms:Master[]}
/** Who uploaded the trips: from the "Created By Bulk Import - NAME - ID" line in History_Description. */
export default function TeamUpload({ds}:{ds:Dataset}){
 const {ms,bar}=useFilters(ds);
 const R=useMemo(()=>parseActivities(ds.history),[ds]);
 const cr=useMemo(()=>creators(R.acts),[R]);
 const {members,noCreator}=useMemo(()=>teamUpload(ms,cr),[ms,cr]);
 const [open,setOpen]=useState<Kpi|null>(null);const [drill,setDrill]=useState<{t:string;sub:string;ms:Master[]}|null>(null);
 const all=useMemo(()=>members.flatMap(m=>m.total),[members]);
 const sel=(k:'pickup'|'drop'|'assigned'|'unassigned')=>members.flatMap(m=>m[k]);
 const kpis=useMemo(()=>{
  const mk=(id:string,label:string,list:Master[],formula:string,rule:string)=>mkKpi({id,label,value:f(list.length),formula,sources:'History_Description, PICKUPDROP, Task_Status',rule,included:list,excluded:ms.length-list.length,why:'Tasks outside this group, or with no "Created By Bulk Import" event'});
  return[mk('t','Total Uploaded',all,'COUNT(DISTINCT Task_ID) with a "Created By Bulk Import - NAME" event','One task counts once, under the member named in its creation event.'),
   mk('p','Total Pickup',sel('pickup'),'Uploaded tasks WHERE PICKUPDROP = PICKUP','Exact value match.'),
   mk('d','Total Drop',sel('drop'),'Uploaded tasks WHERE PICKUPDROP = DROP','Exact value match.'),
   mk('a','Assigned',sel('assigned'),'Uploaded tasks WHERE Task_Status != Unassigned','Assigned = any status other than Unassigned (v11 rule). Requires PTrack confirmation of the status list.'),
   mk('u','Unassigned',sel('unassigned'),'Uploaded tasks WHERE Task_Status = Unassigned','Current status of the task, not at upload time.')]},[members,ms]);
 const mlRows=useMemo<ML[]>(()=>members.flatMap(m=>[...m.loc].map(([loc,l])=>({member:m.name,loc,ms:l}))).sort((a,b)=>a.member.localeCompare(b.member)||b.ms.length-a.ms.length),[members]);
 const total=all.length;
 const cols:Col<Member>[]=[
  {key:'n',label:'Member',get:m=>m.name},{key:'id',label:'User ID',get:m=>[...m.ids].join(', ')||undefined},
  {key:'p',label:'Pickup',get:m=>m.pickup.length,right:true},{key:'d',label:'Drop',get:m=>m.drop.length,right:true},{key:'o',label:'PICKUPDROP blank / other',get:m=>m.other.length,right:true},
  {key:'t',label:'Total',get:m=>m.total.length,right:true},{key:'s',label:'% Share',get:m=>+(m.total.length/total*100).toFixed(1),show:m=>pct(m.total.length/total*100),right:true},
  {key:'a',label:'Assigned',get:m=>m.assigned.length,right:true},{key:'u',label:'Unassigned',get:m=>m.unassigned.length,right:true},
  {key:'up',label:'Unassigned %',get:m=>+(m.unassigned.length/m.total.length*100).toFixed(1),show:m=>pct(m.unassigned.length/m.total.length*100),right:true},{key:'l',label:'Distinct locations',get:m=>m.loc.size,right:true}];
 const lcols:Col<ML>[]=[{key:'m',label:'Member',get:r=>r.member},{key:'l',label:'Location',get:r=>r.loc},{key:'n',label:'Uploaded trips',get:r=>r.ms.length,right:true}];
 if(!ds.masters.length)return <Empty text="The imported file has no trips."/>;
 return <div className="space-y-5">
  {bar}
  <Notice tone="slate">Uploader = the name in the "Created By Bulk Import - NAME - ID" history line (one per task). Location = employee location (PICKUP trip: Pickup_Address, DROP trip: Customer_Address). Both rules come from the v11 audit dashboard and still need PTrack confirmation.</Notice>
  {noCreator.length>0&&<Notice>{f(noCreator.length)} task(s) in this filter have no "Created By Bulk Import" event (created another way, or history missing). They are not assigned to any member and not counted in the totals below.</Notice>}
  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{kpis.map(k=><Tile key={k.id} k={k} onOpen={setOpen}/>)}</div>
  {members.length===0?<Empty text="No uploaded tasks found for the current filters."/>:<>
  <div className="grid lg:grid-cols-3 gap-4">
   <Card t="Upload count per member"><Chart h={340} option={hbar(members.map(m=>[m.name,m.total.length]))}/></Card>
   <Card t="Pickup / Drop split per member"><Chart h={340} option={stackedH(members.map(m=>m.name),[{name:'Pickup',data:members.map(m=>m.pickup.length)},{name:'Drop',data:members.map(m=>m.drop.length)},{name:'Blank / other',data:members.map(m=>m.other.length)}])}/></Card>
   <Card t="Assigned vs Unassigned per member" note="Status at the time of export"><Chart h={340} option={stackedH(members.map(m=>m.name),[{name:'Assigned',data:members.map(m=>m.assigned.length)},{name:'Unassigned',data:members.map(m=>m.unassigned.length)}])}/></Card>
  </div>
  <DataTable title="Upload count per member" rows={members} cols={cols} exportName="team_upload_members.csv" defaultSort={['t',-1]} search={m=>m.name} onRow={m=>setDrill({t:`Uploaded by ${m.name}`,sub:`${f(m.total.length)} trips`,ms:m.total})} note="Click a row to see every trip that member uploaded."/>
  <DataTable title="Upload count per member by location" rows={mlRows} cols={lcols} exportName="team_upload_by_location.csv" defaultSort={['m',1]} search={r=>r.member+' '+r.loc} onRow={r=>setDrill({t:`${r.member} / ${r.loc}`,sub:`${f(r.ms.length)} trips`,ms:r.ms})}/></>}
  {open&&<KpiModal k={open} onClose={()=>setOpen(null)}/>}
  {drill&&<TripsDrawer title={drill.t} sub={drill.sub} ms={drill.ms} onClose={()=>setDrill(null)}/>}
 </div>}
