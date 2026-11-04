import {ReactNode,useMemo,useState} from 'react';
import {Dataset,Master} from '../engine/types';

export interface Filt{from:string;to:string;company:string;vendor:string;vehicle:string;driver:string;status:string;pickupCat:string}
const EMPTY:Filt={from:'',to:'',company:'',vendor:'',vehicle:'',driver:'',status:'',pickupCat:''};
const opts=(ms:Master[],k:(m:Master)=>string|undefined)=>[...new Set(ms.map(k).filter(Boolean))].sort() as string[];

/** Shared filter state + bar used by the module pages. Filters apply to unique Task Masters, so every number downstream respects them. */
export function useFilters(ds:Dataset,extra?:ReactNode):{ms:Master[];bar:ReactNode;active:boolean}{
 const [v,setV]=useState<Filt>(EMPTY);
 const ms=useMemo(()=>ds.masters.filter(m=>(!v.from||(m.date??'')>=v.from)&&(!v.to||(m.date??'')<=v.to)&&(!v.company||m.company===v.company)&&(!v.vendor||m.vendor===v.vendor)
  &&(!v.vehicle||m.vehicle===v.vehicle)&&(!v.driver||m.driver===v.driver)&&(!v.status||m.status===v.status)&&(!v.pickupCat||m.pickupCat===v.pickupCat)),[ds,v]);
 const L=useMemo(()=>({company:opts(ds.masters,m=>m.company),vendor:opts(ds.masters,m=>m.vendor),vehicle:opts(ds.masters,m=>m.vehicle),driver:opts(ds.masters,m=>m.driver),status:opts(ds.masters,m=>m.status),pickupCat:opts(ds.masters,m=>m.pickupCat)}),[ds]);
 const S=(k:keyof Filt,l:string)=><select key={k} className="border rounded p-1.5 text-sm bg-white max-w-44" value={v[k]} onChange={e=>setV({...v,[k]:e.target.value})}><option value="">{l}</option>{L[k as keyof typeof L].map(x=><option key={x}>{x}</option>)}</select>;
 const active=JSON.stringify(v)!==JSON.stringify(EMPTY);
 const bar=<div className="flex flex-wrap gap-2 items-center">
  <input type="date" value={v.from} onChange={e=>setV({...v,from:e.target.value})} className="border rounded p-1.5 text-sm" title="From (scheduled date)"/>
  <input type="date" value={v.to} onChange={e=>setV({...v,to:e.target.value})} className="border rounded p-1.5 text-sm" title="To (scheduled date)"/>
  {S('company','All companies')}{S('vendor','All vendors')}{S('vehicle','All vehicles')}{S('driver','All drivers')}{S('status','All statuses')}{S('pickupCat','All pickup categories')}
  {extra}{active&&<button className="text-sm text-blue-600" onClick={()=>setV(EMPTY)}>Reset filters</button>}</div>;
 return{ms,bar,active}}
