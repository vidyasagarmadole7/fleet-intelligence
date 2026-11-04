import EntityModule from './EntityModule';import {Dataset} from '../engine/types';
export default function Drivers({ds}:{ds:Dataset}){
 return <EntityModule ds={ds} cfg={{title:'Driver Performance Analytics',noun:'Driver',nounPlural:'Drivers',key:m=>m.driver,showEmployees:true,
  notice:'Agent_Username / Agent_ID are used as the driver identity exactly as exported. PTrack must confirm that they identify the actual driver (the export may hold a CAB number or a login instead).',
  missingKeyWhy:'Unassigned or no Agent_Username',
  extra:[{label:'Agent ID',f:m=>m.agentId},{label:'Vehicle',f:m=>m.vehicle},{label:'Vendor',f:m=>m.vendor}],
  checks:[{label:'Drivers linked to more than one Agent ID',f:m=>m.agentId},{label:'Drivers linked to more than one vehicle',f:m=>m.vehicle},{label:'Drivers linked to more than one vendor',f:m=>m.vendor}]}}/>}
