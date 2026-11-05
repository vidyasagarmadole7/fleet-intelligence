import {useState} from 'react';import {NavLink,Route,Routes,Navigate} from 'react-router-dom';
import {LayoutDashboard,Route as RouteI,Building2,Car,User,Users,Gauge,ShieldCheck,Upload,AlertTriangle} from 'lucide-react';
import {DEFAULT_CONFIG,Dataset} from './engine/types';import Overview from './pages/Overview';import Import from './pages/Import';import Odometer from './pages/Odometer';import Trips from './pages/Trips';import Activity from './pages/Activity';import Company from './pages/Company';import Vehicles from './pages/Vehicles';import Drivers from './pages/Drivers';import Occupancy from './pages/Occupancy';import Exceptions from './pages/Exceptions';
const MODS=[['Executive Overview','/',LayoutDashboard,true],['Trip Analytics','/m/trips',RouteI,true],['Company / Location Performance','/m/company',Building2,true],['Vehicle Performance','/m/vehicle',Car,true],['Driver Performance','/m/driver',User,true],['Employee & Occupancy','/m/occupancy',Users,true],['Odometer & KM Audit','/m/odometer',Gauge,true],['Employee Activity & Vendor Audit','/m/activity',ShieldCheck,true]] as const;
export default function App(){
 const [ds,setDs]=useState<Dataset|null>(null);const [cfg,setCfg]=useState(DEFAULT_CONFIG);
 const empty=<div className="bg-white border rounded-xl p-10 text-center"><div className="text-lg font-medium">No data imported</div><p className="text-slate-500 text-sm my-2">Import a PTrack CSV export to begin. No demo or fake data is generated.</p><NavLink to="/import" className="text-blue-600">Go to Data Import</NavLink></div>;
 return <div className="flex min-h-screen"><aside className="w-64 shrink-0 bg-[#0b1b3a] text-slate-200 p-4 hidden md:block">
  <div className="text-white font-semibold text-lg mb-1">PTrack Fleet Intelligence</div><div className="text-xs text-slate-400 mb-5">Poona Travels</div>
  {MODS.map(([l,to,I,live])=><NavLink key={to} to={to} end className={({isActive})=>`flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-1 ${isActive?'bg-blue-600 text-white':'hover:bg-white/10'}`}><I size={16}/><span className="flex-1">{l}</span>{!live&&<span className="text-[10px] opacity-60">soon</span>}</NavLink>)}
  <div className="border-t border-white/10 my-3"/><NavLink to="/exceptions" className={({isActive})=>`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${isActive?'bg-blue-600':'hover:bg-white/10'}`}><AlertTriangle size={16}/>Exception Management</NavLink><NavLink to="/import" className={({isActive})=>`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${isActive?'bg-blue-600':'hover:bg-white/10'}`}><Upload size={16}/>Data Import</NavLink></aside>
  <main className="flex-1 p-6 min-w-0"><Routes>
   <Route path="/" element={ds?<Overview ds={ds} cfg={cfg} setCfg={setCfg}/>:empty}/>
   <Route path="/import" element={<Import cfg={cfg} ds={ds} onDone={setDs}/>}/>
   <Route path="/m/trips" element={ds?<Trips ds={ds}/>:empty}/>
   <Route path="/m/activity" element={ds?<Activity ds={ds}/>:empty}/>
   <Route path="/m/company" element={ds?<Company ds={ds} cfg={cfg}/>:empty}/>
   <Route path="/m/vehicle" element={ds?<Vehicles ds={ds}/>:empty}/>
   <Route path="/m/driver" element={ds?<Drivers ds={ds}/>:empty}/>
   <Route path="/m/occupancy" element={ds?<Occupancy ds={ds} cfg={cfg}/>:empty}/>
   <Route path="/exceptions" element={ds?<Exceptions ds={ds}/>:empty}/>
   <Route path="/m/odometer" element={ds?<Odometer ds={ds}/>:empty}/>
   <Route path="/m/:slug" element={<div className="bg-white border rounded-xl p-10 text-center"><div className="text-lg font-medium">Module not built yet</div><p className="text-sm text-slate-500">This module is next in the build plan. It will reuse the same Task Master and validation engine.</p></div>}/>
   <Route path="*" element={<Navigate to="/"/>}/></Routes></main></div>}
