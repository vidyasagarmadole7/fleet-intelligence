import EntityModule from './EntityModule';import {Dataset} from '../engine/types';
export default function Vehicles({ds}:{ds:Dataset}){
 return <EntityModule ds={ds} cfg={{title:'Vehicle Performance Analytics',noun:'Vehicle',nounPlural:'Vehicles',key:m=>m.vehicle,showEmployees:false,
  missingKeyWhy:'mostly Unassigned',
  extra:[{label:'Driver',f:m=>m.driver},{label:'Vendor',f:m=>m.vendor},{label:'Company',f:m=>m.company}],
  checks:[{label:'Vehicles linked to more than one driver (Agent_Username)',f:m=>m.driver},{label:'Vehicles linked to more than one vendor',f:m=>m.vendor},{label:'Vehicles linked to more than one company',f:m=>m.company}]}}/>}
