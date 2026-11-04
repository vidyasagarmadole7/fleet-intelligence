import {useEffect,useRef} from 'react';import * as echarts from 'echarts';
export default function Chart({option,h=260}:{option:echarts.EChartsOption;h?:number}){
 const r=useRef<HTMLDivElement>(null);
 useEffect(()=>{const c=echarts.init(r.current!);c.setOption({grid:{left:48,right:16,top:28,bottom:28},tooltip:{trigger:'axis'},color:['#2563eb','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6'],...option});
  const on=()=>c.resize();window.addEventListener('resize',on);return()=>{window.removeEventListener('resize',on);c.dispose()}},[option]);
 return <div ref={r} style={{height:h}}/>}
