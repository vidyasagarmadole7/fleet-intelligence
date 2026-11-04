import {Hist} from './types';
export interface Act{taskId:string;type:string;empId?:string;empName?:string;driver?:string;ms?:number;prev?:string;next?:string;desc:string}
const RANK:Record<string,number>={Created:0,Assigned:1,Unassigned:1,Accepted:2,Declined:2,Started:3,Successful:4};
export const EMP_TYPES=['Task created (bulk import)','Task modified','Driver assigned','Marked unassigned'];
/** Parses History_Description. Only recognised patterns become activities; nothing is guessed. */
export function parseActivities(hist:Hist[]){
 const acts:Act[]=[];const idName=new Map<string,string>();let other=0;const byTask=new Map<string,Act[]>();
 for(const h of hist){const d=(h.desc??'').trim();let a:Act|undefined,m:RegExpMatchArray|null;
  if(m=d.match(/^Created By Bulk Import\s*-\s*(.+?)\s*-\s*(\d+)$/i))a={taskId:h.taskId,type:'Task created (bulk import)',empName:m[1],empId:m[2],desc:d};
  else if(m=d.match(/^Modified\s+by\s+(.+?)-(\d+)$/i))a={taskId:h.taskId,type:'Task modified',empName:m[1],empId:m[2],desc:d};
  else if(m=d.match(/^Assigned\s+(.+?)\s+to task\s*-\s*(\d+)$/i))a={taskId:h.taskId,type:'Driver assigned',driver:m[1],empId:m[2],desc:d};
  else if(m=d.match(/^Task mark as Unassigned\.?\s*-\s*(\d+)$/i))a={taskId:h.taskId,type:'Marked unassigned',empId:m[1],desc:d};
  else if(m=d.match(/^(Accepted|Started|Successful|Declined) at$/i))a={taskId:h.taskId,type:m[1][0].toUpperCase()+m[1].slice(1).toLowerCase(),desc:d};
  else{other++;continue}
  a.ms=h.ms;if(a.empName&&a.empId)idName.set(a.empId,a.empName);
  const l=byTask.get(h.taskId);if(l)l.push(a);else byTask.set(h.taskId,[a])}
 const paths=new Map<string,number>();
 for(const list of byTask.values()){
  const ev=list.map(a=>({a,label:a.type==='Task created (bulk import)'?'Created':a.type==='Driver assigned'?'Assigned':a.type==='Marked unassigned'?'Unassigned':a.type==='Task modified'?'':a.type})).filter(x=>x.label);
  ev.sort((x,y)=>(x.a.ms??0)-(y.a.ms??0)||RANK[x.label]-RANK[y.label]);
  const seq:string[]=[];for(const e of ev){const p=seq[seq.length-1];e.a.prev=p??'-';e.a.next=e.label;if(e.label!==p)seq.push(e.label)}
  for(const a of list){if(a.type==='Task modified'){a.prev='-';a.next='(status unchanged)'}acts.push(a)}
  const k=seq.join(' > ')||'(no status events)';paths.set(k,(paths.get(k)||0)+1)}
 return{acts,idName,paths,other}}
