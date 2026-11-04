export type Row = Record<string,string>;
export interface FieldDef{key:string;label:string;aliases:string[];note?:string}
export interface Config{completionBase:'all'|'closed';gapKm:number;employeeField:'actual'|'inCab'|'planned';validStatuses:string[]}
export const DEFAULT_CONFIG:Config={completionBase:'all',gapKm:10,employeeField:'actual',
 validStatuses:['Completed','Cancelled','Failed','Unassigned','Assigned','Accepted','In Transit']};
export interface Issue{taskId:string;code:string;sev:'info'|'warn'|'critical';msg:string}
export interface Master{taskId:string;orderId?:string;company?:string;vehicle?:string;driver?:string;agentId?:string;vendor?:string;
 distanceKm?:number;pickupCat?:string;status?:string;pickupDrop?:string;shift?:string;tripType?:string;
 planned?:number;actual?:number;inCab?:number;startOdo?:number;endOdo?:number;odoKm?:number;
 scheduledMs?:number;date?:string;completedMs?:number;rowCount:number;issues:Issue[]}
export interface Hist{taskId:string;type?:string;desc?:string;ms?:number;date?:string}
export interface Dataset{masters:Master[];history:Hist[];issues:Issue[];importedAt:string;fileName:string;
 dq:{rows:number;uniqueIds:number;missingIds:number;exactDupHistory:number;unmappedHeaders:string[];invalidTimestamps:number}}
export interface Kpi{id:string;label:string;value:string;formula:string;sources:string;rule:string;confirm?:string;
 included:Master[];excluded:number;excludedWhy:string;issues:string}
