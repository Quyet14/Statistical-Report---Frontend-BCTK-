// @ts-nocheck
export function scene3d(kind: string, L: string[] = []): string {
const cb=(c,st,i)=>`<div class="cb ${c}" style="${st}">${i||''}</div>`;
const gr=(st,i)=>`<div class="gr" style="${st}">${i}</div>`;
const flo=(w,d,dz)=>cb('fl0',`left:${-w/2}px;top:${-d/2}px;--w:${w}px;--h:${d}px;--d:14px${dz?';transform:translateZ('+dz+'px)':''}`);
const rail=(l,t,w,h)=>cb('rl',`left:${l}px;top:${t}px;--w:${w}px;--h:${h}px;--d:8px`);
const cor='--c1:var(--coral);--c2:#ffb191;--c3:#d4532a';
let b='';
if(kind==='flow'){
 b=gr('top:112px',flo(470,250))+[0,1,2].map(i=>cb('c3',`left:${-205+i*170}px;top:42px;--w:70px;--h:70px;--d:70px;--i:${i}`,`<b>${i+1}</b>`)).join('')+rail(-135,73,100,8)+rail(35,73,100,8)+'<div class="ball" style="top:64px"></div>';
}else if(kind==='chart'){
 b=gr('top:112px',flo(470,250))+[60,92,76,118,102,138,164].map((h,i)=>cb('bar',`left:${-155+i*46}px;top:${112-h}px;--w:34px;--h:${h}px;--d:34px;--i:${i}${i===6?';'+cor:''}`)).join('');
}else if(kind==='tasks'){
 const T=L.length?L:['Kiểm tra','Bàn giao','Cập nhật'];
 b=gr('top:112px',flo(470,250))+T.slice(0,3).map((l,i)=>cb('sl',`left:-125px;top:${-100+i*70}px;--w:250px;--h:54px;--d:16px;--i:${i}`,`<i class="tk" style="--i:${i}"></i><span>${l}</span>`)).join('');
}else if(kind==='approve'){
 b=gr('top:112px',flo(470,250))+cb('doc','left:-85px;top:-98px;--w:170px;--h:210px;--d:10px;--c1:#fff;--c2:#f1f8f9;--c3:var(--t4)','<s class="ln" style="width:55%;height:11px;background:var(--t5);margin-top:26px"></s><s class="ln"></s><s class="ln" style="width:70%"></s><s class="ln"></s><em class="seal">✓</em>')+cb('stp','left:5px;top:4px;--w:64px;--h:46px;--d:64px;'+cor);
}else if(kind==='org'){
 b=gr('top:112px',flo(470,250))+'<div class="orb3"></div>'+rail(-4,-4,8,32)+rail(-154,28,308,8)+rail(-154,28,8,34)+rail(-4,28,8,34)+rail(146,28,8,34)+cb('c3','left:-60px;top:-60px;--w:120px;--h:56px;--d:70px;--i:0',`<b>${L[0]||''}</b>`)+[1,2,3].map(i=>cb('c3',`left:${-190+(i-1)*150}px;top:62px;--w:80px;--h:50px;--d:60px;--i:${i}`,`<b>${L[i]||''}</b>`)).join('');
}else if(kind==='cal'){
 const on=[1,4,9,12,16,19,23,26],on2=[2,7,14,21];
 b=gr('top:112px',flo(400,255,-12)+'<div class="tls">'+Array.from({length:28},(_,i)=>cb('tl'+(on.includes(i)?' on':on2.includes(i)?' on2':''),`--w:40px;--h:40px;--d:10px;--i:${i}`)).join('')+'</div>');
}else{
 b=gr('top:112px',flo(330,250)+cb('qr3','left:-85px;top:-85px;--w:170px;--h:170px;--d:14px;--c1:#fff;--c2:#f1f8f9;--c3:var(--t4)','<div class="qg">'+'<i></i>'.repeat(25)+'</div>')+cb('laser','left:-100px;top:-90px;--w:200px;--h:6px;--d:6px;'+cor));
}
return '<div class="sc3">'+gr('top:112px','<div class="sh"></div><div class="halo"><i></i></div>')+b+'</div>';
}