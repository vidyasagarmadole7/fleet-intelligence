import fs from 'fs';import Papa from 'papaparse';
import {build} from '../src/engine/build';import {autoMap} from '../src/engine/fields';import {DEFAULT_CONFIG} from '../src/engine/types';import {parseActivities} from '../src/engine/activity';
const p=Papa.parse<Record<string,string>>(fs.readFileSync(process.argv[2],'utf8'),{header:true,skipEmptyLines:true});
const h=p.meta.fields!;const ds=build(p.data,autoMap(h),DEFAULT_CONFIG,'t',h);const r=parseActivities(ds.history);
const c:Record<string,number>={};for(const a of r.acts)c[a.type]=(c[a.type]||0)+1;console.log(c,'other(not activity)',r.other);
console.log('employees',new Set(r.acts.filter(a=>a.empId).map(a=>a.empId)).size,'ids with name',r.idName.size,'ids w/o name',[...new Set(r.acts.filter(a=>a.empId&&!r.idName.has(a.empId)).map(a=>a.empId))]);
console.log([...r.paths].sort((a,b)=>b[1]-a[1]).slice(0,8));
const v=new Set(ds.masters.map(m=>m.vendor).filter(Boolean));console.log('vendors',v.size,'tasks w/o vendor',ds.masters.filter(m=>!m.vendor).length);
