export function noticeLink(value:unknown){return typeof value==="string"&&(/^\/workflow(?:\/(?:handoffs|tasks\/[1-9]\d*))?$/.test(value)||value==="/checklist")?value:"/checklist";}
