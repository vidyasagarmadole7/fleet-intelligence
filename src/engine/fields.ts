import {FieldDef} from './types';
export const FIELDS:FieldDef[]=[
{key:'taskId',label:'Task ID',aliases:['task_id','taskid']},
{key:'orderId',label:'Order ID',aliases:['order_id'],note:'Requires PTrack Confirmation (location?)'},
{key:'company',label:'Company',aliases:['team_name'],note:'Requires PTrack Confirmation'},
{key:'vehicle',label:'Vehicle Number',aliases:['vehicle_number']},
{key:'driver',label:'Driver (Agent username)',aliases:['agent_username'],note:'Requires PTrack Confirmation'},
{key:'agentId',label:'Agent ID',aliases:['agent_id'],note:'Requires PTrack Confirmation'},
{key:'vendor',label:'Vendor',aliases:['vendor_name']},
{key:'distM',label:'Distance (metres)',aliases:['distance(m)','distance_m']},
{key:'pickupCat',label:'Pickup Category',aliases:['pick_up_from']},
{key:'status',label:'Task Status',aliases:['task_status']},
{key:'pickupDrop',label:'Pickup / Drop',aliases:['pickupdrop']},
{key:'shift',label:'Shift',aliases:['shift']},
{key:'tripType',label:'Trip Type',aliases:['trip_type'],note:'Requires PTrack Confirmation'},
{key:'planned',label:'Planned Employees',aliases:['planned_emp']},
{key:'actual',label:'Actual Employees',aliases:['actual_emp']},
{key:'inCab',label:'In-Cab Employees',aliases:['in cab employees']},
{key:'startOdo',label:'Start Odometer',aliases:['started odometer reading']},
{key:'endOdo',label:'End Odometer',aliases:['completed odometer reading']},
{key:'startBefore',label:'Scheduled Start',aliases:['start_before']},
{key:'completedAt',label:'Completion Time',aliases:['completion_time']},
{key:'histType',label:'History Type',aliases:['type']},
{key:'histDesc',label:'History Description',aliases:['history_description']},
{key:'histTime',label:'History Time',aliases:['time']}];
export function autoMap(headers:string[]){const m:Record<string,string>={};
 for(const f of FIELDS){const h=headers.find(h=>f.aliases.includes(h.trim().toLowerCase()));if(h)m[f.key]=h}return m}
