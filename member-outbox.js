// Only member intent is persisted: no officer data, auth tokens or credentials.
export function createMemberOutbox({storage,getUid,send,isOnline=()=>navigator.onLine,notify=()=>{},now=()=>Date.now(),id=()=>crypto.randomUUID()}) {
  let running=null;
  const key=uid=>`fqc:outbox:${uid}`;
  const read=uid=>{try {const rows=JSON.parse(storage.getItem(key(uid))||'[]');return Array.isArray(rows)?rows.filter(r=>r && ['rsvp','checkin'].includes(r.type)&&typeof r.eventId==='string'&&typeof r.id==='string').slice(0,100):[];}catch{return [];}};
  const write=(uid,rows)=>storage.setItem(key(uid),JSON.stringify(rows));
  const entries=()=>getUid()?read(getUid()):[];
  function enqueue(type,eventId,data={}) {
    const uid=getUid();if(!uid) throw new Error('Sign in before saving this action.');
    const rows=read(uid).filter(r=>!(r.type===type&&r.eventId===eventId));
    if(rows.length>=100) throw new Error('Reconnect to finish your pending actions first.');
    const entry={id:id(),type,eventId,...data,createdAt:now(),attempts:0,nextAt:0,status:'pending'};
    try {write(uid,[...rows,entry]);}catch{throw new Error('This browser could not save your action. Free some storage, then try again.');}
    notify({kind:'pending',uid,entry});return entry;
  }
  async function drain(uid) {
    if(!uid || getUid()!==uid || !isOnline())return;
    for(const entry of read(uid)) {
      if(getUid()!==uid || !isOnline())break;
      if(entry.status!=='pending' || entry.nextAt>now())continue;
      // Another tab may have replaced this RSVP while this drain was waiting.
      if(!read(uid).some(r=>r.id===entry.id))continue;
      try {
        if(now()-entry.createdAt>7*86400000)throw Object.assign(new Error('This saved action is too old. Please check with an officer.'),{code:'expired'});
        const result=await send(entry,uid);
        if(getUid()!==uid)break;
        const current=read(uid);const unchanged=current.some(r=>r.id===entry.id);
        write(uid,current.filter(r=>r.id!==entry.id));
        if(unchanged)notify({kind:'confirmed',uid,entry,result});
      } catch(error) {
        if(getUid()!==uid)break;
        const code=String(error?.code||'');
        const retry=!isOnline() || /unavailable|network|deadline|internal|timeout|resource-exhausted|unauthenticated|invalid-user-token/.test(code) || error instanceof TypeError;
        const next={...entry,attempts:entry.attempts+1,nextAt:now()+Math.min(60000,3000*2**Math.min(entry.attempts,5)),status:retry?'pending':'attention',message:retry?'Waiting to reconnect':String(error?.message||'Please check with an officer').slice(0,180)};
        if(!retry)delete next.location;
        write(uid,read(uid).map(r=>r.id===entry.id?next:r));
        notify({kind:retry?'pending':'attention',uid,entry:next});
        if(retry)break;
      }
    }
  }
  function flush({force=false}={}) {
    if(running)return running;
    if(force&&getUid())write(getUid(),read(getUid()).map(r=>r.status==='pending'?{...r,nextAt:0}:r));
    const uid=getUid();
    const action=()=>drain(uid);
    running=(globalThis.navigator?.locks ? navigator.locks.request(`fqc-member-outbox:${uid}`,action) : action()).finally(()=>{running=null;});
    return running;
  }
  return {enqueue,entries,flush,clear:uid=>storage.removeItem(key(uid))};
}
