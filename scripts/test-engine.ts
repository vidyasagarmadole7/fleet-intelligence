import fs from 'fs';import Papa from 'papaparse';
import {build} from '../src/engine/build';import {autoMap} from '../src/engine/fields';
import {DEFAULT_CONFIG} from '../src/engine/types';import {computeKpis} from '../src/engine/kpis';
const p=Papa.parse<Record<string,string>>(fs.readFileSync(process.argv[2],'utf8'),{header:true,skipEmptyLines:true});
const h=p.meta.fields!;const ds=build(p.data,autoMap(h),DEFAULT_CONFIG,'task.csv',h);
console.log(ds.dq,'masters',ds.masters.length,'history',ds.history.length);
for(const k of computeKpis(ds.masters,DEFAULT_CONFIG))console.log(k.label.padEnd(30),k.value.padStart(10),'excl',k.excluded);
const c:Record<string,number>={};for(const i of ds.issues)c[i.code]=(c[i.code]||0)+1;console.log(c);
