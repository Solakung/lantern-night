// โหลดภาพล่วงหน้า ให้ภาพพร้อมก่อนฉากเรียกใช้ คนเข้าเกมครั้งแรกจะได้ไม่เห็นภาพโผล่ช้า
// - ด่วน (hi): ภาพของฉากที่กำลังเล่น + ฉากถัดไปในคิว + สัปดาห์แรกตอนอยู่หน้าเริ่มเกม
// - ไม่ด่วน (lo): ทยอยโหลดตัวละครและฉากหลังทั้งหมดตอนว่าง (ข้ามถ้าผู้เล่นเปิดโหมดประหยัดเน็ต/เน็ตช้ามาก)
(function () {
  const P = window.Preload = {};
  if (typeof Image === 'undefined') { P.scenes = P.ahead = P.idle = function () {}; return; }

  const done = new Set(), busy = new Set();
  const hi = [], lo = [];
  const MAX = 4, MAX_LO = 2;
  let active = 0, activeLo = 0, idleQueued = false;
  const conn = (typeof navigator !== 'undefined' && navigator.connection) || {};
  const thrifty = !!conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');

  const hasVariant = key => !window.BG_VARIANTS || BG_VARIANTS.includes(key);
  const bg = id => 'assets/bg/' + id + '.webp';
  const spr = (k, e) => ({ u: 'assets/sprites/' + k + '_' + (e || 'normal') + '.webp', fb: e && e !== 'normal' ? 'assets/sprites/' + k + '_normal.webp' : null });

  function pump() {
    while (active < MAX) {
      let job = hi.shift(), isLo = false;
      if (!job && activeLo < MAX_LO && !thrifty) { job = lo.shift(); isLo = true; }
      if (!job) return;
      if (done.has(job.u) || busy.has(job.u)) continue;
      busy.add(job.u); active++; if (isLo) activeLo++;
      const img = new Image();
      const fin = ok => {
        active--; if (isLo) activeLo--;
        busy.delete(job.u); done.add(job.u);
        if (!ok && job.fb) push([{ u: job.fb }], isLo ? lo : hi);   // ไม่มีภาพกลางคืน/สีหน้านี้ ใช้ภาพหลักแทน
        pump();
      };
      img.onload = () => fin(true);
      img.onerror = () => fin(false);
      img.src = job.u;
    }
  }
  function push(jobs, q) { for (const j of jobs) if (!done.has(j.u)) q.push(j); }

  // ไล่หาภาพที่ฉากใช้ เรียงตามลำดับที่โผล่ (depth = ตามไปดูฉากที่กระโดดต่อกี่ชั้น)
  function collect(id, depth, out, seen) {
    const sc = window.SCENES && window.SCENES[id];
    if (!sc || seen.has(id)) return out;
    seen.add(id);
    const sub = [];
    for (const ins of sc.code) {
      switch (ins.t) {
        case 'bg': if (ins.id && ins.id !== 'BLACK') out.push({ u: bg(ins.v && hasVariant(ins.id + '_' + ins.v) ? ins.id + '_' + ins.v : ins.id) }); break;
        case 'cg': if (ins.id) out.push({ u: 'assets/cg/' + ins.id + '.webp' }); break;
        case 'show': out.push(spr(ins.k, ins.e)); break;
        case 'say': { const k = window.SPEAKER_KEY && window.SPEAKER_KEY[ins.who]; if (k) out.push(spr(k, ins.e)); break; }
        case 'jump': case 'call': sub.push(ins.scene); break;
        case 'goto': case 'if': sub.push(ins.target); break;
        case 'choice': for (const o of ins.opts) if (o.target) sub.push(o.target); break;
      }
    }
    if (depth > 0) for (const s of sub) collect(s, depth - 1, out, seen);
    return out;
  }

  // โหลดภาพของฉากเหล่านี้แบบด่วน ตามลำดับ
  P.scenes = function (ids) {
    const seen = new Set(), jobs = [];
    for (const id of ids) collect(id, 1, jobs, seen);
    // งานใหม่แซงคิวด่วนเดิม (ฉากที่กำลังจะเล่นสำคัญกว่าของที่ค้างอยู่)
    hi.splice(0, hi.length, ...jobs.filter(j => !done.has(j.u)), ...hi);
    pump();
  };

  // เริ่มฉาก: ภาพฉากนี้ก่อน ตามด้วยฉากถัดไปในคิวอีก 2 ฉาก
  P.ahead = function (current) {
    const ids = current ? [current] : [];
    const q = (window.Engine && Engine.st && Engine.st.queue) || [];
    for (const it of q) {
      const id = typeof it === 'string' ? it : (it && it.k === 'scene' ? it.id : null);
      if (id && !ids.includes(id)) ids.push(id);
      if (ids.length >= 3) break;
    }
    P.scenes(ids);
    P.idle();
  };

  // ตอนว่าง: ทยอยโหลดตัวละครทุกตัวกับฉากหลังทุกฉากที่บทเรียกใช้ (CG ไม่ทยอย เพราะโหลดตอนเริ่มฉากก็ทัน)
  P.idle = function () {
    if (idleQueued || thrifty || !window.SCENES) return;
    idleQueued = true;
    const sprites = [], bgs = [], seen = new Set();
    for (const id in SCENES) {
      for (const j of collect(id, 0, [], new Set())) {
        if (seen.has(j.u) || j.u.indexOf('assets/cg/') === 0) continue;
        seen.add(j.u);
        (j.u.indexOf('assets/sprites/') === 0 ? sprites : bgs).push(j);
      }
    }
    push(sprites.concat(bgs), lo);
    pump();
  };
})();
