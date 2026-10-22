// ระบบสัปดาห์ ตารางกิจกรรม การเยี่ยมสาว และเหตุการณ์ตามสัปดาห์
(function () {
  const v = () => Engine.st.v;
  const seen = id => !!v()['SEEN_' + id];
  const test = c => Engine.test(c);

  // ฉากรูทที่เกิดตอนไปหาสาว เรียงตามลำดับ (w = สัปดาห์ขั้นต่ำ, c = เงื่อนไข)
  const ROUTES = {
    baibua: [
      { id: 'b1', w: 2 },
      { id: 'b2', w: 3, c: 'AFF_baibua>=15' },
      { id: 'b3', w: 5, c: 'AFF_baibua>=25' },
      { id: 'b5', w: 6, c: 'SEEN_s11a || AFF_baibua>=40' },
      { id: 'b4', w: 7, c: 'AFF_baibua>=35' },
      { id: 'b7', w: 9, c: 'AFF_baibua>=45' },
      { id: 'b8', w: 10, c: 'AFF_baibua>=50' }
    ],
    nina: [
      { id: 'n1', w: 2 },
      { id: 'n2', w: 3, c: 'AFF_nina>=15' },
      { id: 'n3', w: 5, c: 'AFF_nina>=25' },
      { id: 'n4', w: 6, c: 'SEEN_s12a' },
      { id: 'n5', w: 7, c: 'AFF_nina>=35' },
      { id: 'n7', w: 9, c: 'AFF_nina>=40' },
      { id: 'n8', w: 10, c: 'AFF_nina>=50' }
    ],
    prang: [
      { id: 'p1', w: 2 },
      { id: 'p2', w: 3, c: 'AFF_prang>=15' },
      { id: 'p3', w: 5, c: 'AFF_prang>=25' },
      { id: 'p4', w: 6, c: 'SEEN_s13a' },
      { id: 'p5', w: 7, c: 'AFF_prang>=35' },
      { id: 'p7', w: 9, c: 'AFF_prang>=40' },
      { id: 'p8', w: 10, c: 'AFF_prang>=50' }
    ],
    mintra: [
      { id: 'm1', w: 2 },
      { id: 'm2', w: 3, c: 'AFF_mintra>=15' },
      { id: 'm3', w: 5, c: 'AFF_mintra>=25' },
      { id: 'm4', w: 6, c: 'SEEN_s14a && MT_RECEIPT' },
      { id: 'm5', w: 7, c: 'AFF_mintra>=35' },
      { id: 'm7', w: 9, c: 'AFF_mintra>=40' },
      { id: 'm8', w: 10, c: 'AFF_mintra>=50' }
    ],
    fasai: [
      { id: 'f1', w: 2 },
      { id: 'f2', w: 3, c: 'AFF_fasai>=15' },
      { id: 'f3', w: 5, c: 'AFF_fasai>=25' },
      { id: 'f4', w: 6, c: 'AFF_fasai>=30' },
      { id: 'f5', w: 7, c: 'AFF_fasai>=35' }
    ]
  };
  // ฉากที่เกิดเองตอนต้นสัปดาห์ เมื่อเงื่อนไขครบ (สัปดาห์ต่ำสุด-สูงสุด)
  const FORCED = [
    { id: 'b6', w: 9, to: 10, c: 'AFF_baibua>=40 && (AFF_fasai>=25 || SAT_FASAI)' },
    { id: 'n6', w: 8, to: 10, c: 'AFF_nina>=30 && PITY>=2' },
    { id: 'p6', w: 8, to: 10, c: 'AFF_prang>=30 && PEEK>=1' },
    { id: 'm6', w: 8, to: 10, c: 'AFF_mintra>=30 && OVERSTEP>=1' },
    { id: 'f6', w: 8, to: 10, c: 'AFF_fasai>=40' },
    { id: 'f7', w: 9, to: 11, c: 'SEEN_f6 && F_FIGHT && HONEST>=2' },
    { id: 'f8', w: 10, to: 11, c: 'F_COUNSEL' }
  ];
  const NIGHT_BEFORE = ['b9', 'n9', 'p9', 'm9', 'f9'];
  const RANDOM = {
    baibua: [{ id: 'rb1' }, { id: 'rb2' }, { id: 'rb3' }, { id: 'rb4' }, { id: 'rb5' }, { id: 'rb6', w: 7 }],
    nina: [{ id: 'rn1' }, { id: 'rn2' }, { id: 'rn3' }, { id: 'rn4' }, { id: 'rn5', w: 7 }, { id: 'rn6' }],
    prang: [{ id: 'rp1' }, { id: 'rp2' }, { id: 'rp3' }, { id: 'rp4' }, { id: 'rp5' }, { id: 'rp6', w: 7 }],
    mintra: [{ id: 'rm1' }, { id: 'rm2' }, { id: 'rm3' }, { id: 'rm4' }, { id: 'rm5' }, { id: 'rm6', w: 7 }],
    fasai: [{ id: 'rf1' }, { id: 'rf2' }, { id: 'rf3' }, { id: 'rf4' }, { id: 'rf5' }, { id: 'rf6' }]
  };
  const CRISIS = { baibua: 's11a', nina: 's12a', prang: 's13a', mintra: 's14a' };

  const S = window.Schedule = { ROUTES, RANDOM };

  S.start = function () {
    Engine.st.queue = ['s00', 's01', 's02', 's03', 's04', 's05', 's06']
      .map(id => ({ k: 'scene', id })).concat([{ k: 'nextWeek' }]);
  };

  S.flow = function () { Engine.st.queue.push({ k: 'nextWeek' }); Engine.next(); };

  S.handle = function (item) {
    const st = Engine.st;
    switch (item.k) {
      case 'scene': return Engine.playScene(item.id);
      case 'title': return Engine.playDynamic('_title', ['@bg BLACK', '@title ' + item.text]);
      case 'planner':
        st.mode = 'planner';
        st.plan = st.plan && st.plan.length === 4 ? st.plan : [null, null, null, null];
        Engine.autosave();
        return UI.showPlanner();
      case 'slot': return doSlot(item.i, item.act);
      case 'weekEnd': return weekEnd();
      case 'nextWeek': return nextWeek();
      case 'calc': return calc(item.what);
    }
  };

  // ---------- เริ่มสัปดาห์ ----------
  function nextWeek() {
    const st = Engine.st, vv = st.v;
    const w = vv.WEEK = (vv.WEEK || 1) + (st.started ? 1 : 0);
    st.started = true;
    if (w > 1) {
      let rec = (vv.MIND < 20 && vv.OBS >= 50) ? 15 : 30;
      vv.ENERGY = Math.min(100, (vv.ENERGY || 0) + rec);
      if (w <= 11) vv.KNOW = Math.min(100, vv.KNOW + 3);
      // ฟ้าใสหึงเองเมื่อเห็นว่าภูมิสนิทกับคนอื่นมากกว่าเธอชัดเจน
      Engine.refreshDerived();
      if (w >= 4 && !vv.ROUTE_FASAI && vv.AFF_TOP > (vv.AFF_fasai || 0) + 20) vv.OBS = Math.min(100, vv.OBS + 2);
    }
    const q = [];
    const left = 12 - w;
    if (w > 1) q.push({ k: 'title', text: 'สัปดาห์ที่ ' + w + (left > 0 ? ' · อีก ' + left + ' สัปดาห์ถึงคืนโคมทะเล' : ' · คืนโคมทะเล') });
    if (w === 2) q.push({ k: 'scene', id: 's07' }, { k: 'scene', id: 's08' });
    if (w === 5) q.push({ k: 'scene', id: 's10' });
    if (w === 10) q.push({ k: 'scene', id: 's19' });
    if (w >= 5 && w <= 10) {
      const order = ['baibua', 'nina', 'prang', 'mintra']
        .sort((a, b) => (vv['AFF_' + b] || 0) - (vv['AFF_' + a] || 0));
      for (const g of order) {
        const id = CRISIS[g];
        if (!seen(id) && (vv['AFF_' + g] || 0) >= 30 && vv.OBS >= 25) { q.push({ k: 'scene', id }); break; }
      }
      if (!seen('s15') && vv.EVIDENCE >= 2) q.push({ k: 'scene', id: 's15' });
      else if (seen('s15') && !seen('s17') && w >= 6) q.push({ k: 'scene', id: 's17' });
    }
    for (const f of FORCED) if (w >= f.w && w <= f.to && !seen(f.id) && test(f.c)) q.push({ k: 'scene', id: f.id });

    if (w === 12) {
      q.push({ k: 'scene', id: 's21' });
    } else if (w >= 2) {
      if (w === 7 && vv.RETAKE) q.push({ k: 'scene', id: 'retake' }, { k: 'weekEnd' });
      else if (w === 9 && vv.SICKWEEK) q.push({ k: 'weekEnd' });
      else q.push({ k: 'planner' });
    } else q.push({ k: 'weekEnd' });
    st.queue = q.concat(st.queue);
    Engine.next();
  }

  // ---------- จบสัปดาห์ ----------
  function weekEnd() {
    const vv = v(), w = vv.WEEK;
    const q = [];
    if (w === 4) q.push({ k: 'scene', id: 's09' });
    if (w === 6) q.push({ k: 'scene', id: 'exam_mid' });
    if (w === 8 && vv.BODY < 20) q.push({ k: 'scene', id: 'sick' });
    if (w === 9) q.push({ k: 'scene', id: 's18' });
    if (w === 11) {
      q.push({ k: 'scene', id: 'exam_final' }, { k: 'calc', what: 'route' });
    }
    q.push({ k: 'nextWeek' });
    Engine.st.queue = q.concat(Engine.st.queue);
    Engine.next();
  }

  function calc(what) {
    const vv = v();
    if (what === 'route') {
      Engine.refreshDerived();
      vv.ROUTE = vv.ROUTE_FASAI ? 4 : vv.TOP;
      const q = [];
      if (!vv.FAIL_FINAL) q.push({ k: 'scene', id: NIGHT_BEFORE[vv.ROUTE] });
      q.push({ k: 'scene', id: 's20' });
      Engine.st.queue = q.concat(Engine.st.queue);
    }
    Engine.next();
  }

  // ---------- ตัวเลือกในตาราง ----------
  S.options = function (slot) {
    const vv = v(), out = [];
    for (const a of ACTIVITIES) {
      if (a.slots && !a.slots.includes(slot)) continue;
      const blocked = a.once && vv.CALLW === vv.WEEK && !(Engine.st.plan || []).includes(a.id);
      out.push({ id: a.id, name: a.name, place: a.place, energy: a.energy, eff: a.eff, blocked });
    }
    for (const g of GIRLS) out.push({ id: 'visit_' + g, name: 'ไปหา' + CHARS[g].name, girl: g, energy: 10, eff: {} });
    return out;
  };

  S.confirmPlan = function (plan) {
    const st = Engine.st;
    st.plan = null;
    st.queue = plan.map((act, i) => ({ k: 'slot', i, act })).concat([{ k: 'weekEnd' }], st.queue);
    st.mode = 'scene';
    UI.hidePlanner();
    Engine.next();
  };

  function pickVisit(g) {
    const vv = v(), w = vv.WEEK;
    if (g !== 'fasai' && w >= 8 && vv['LASTV_' + g] === w - 1 && !seen('s16')) return 's16';
    for (const r of ROUTES[g]) {
      if (seen(r.id)) continue;
      if (w >= r.w && test(r.c)) return r.id;
    }
    const pool = RANDOM[g].filter(r => !seen(r.id) && w >= (r.w || 0));
    if (pool.length) return pool[Math.floor(Math.random() * pool.length)].id;
    return 'gen_' + g;
  }

  function doSlot(i, act) {
    const st = Engine.st, vv = st.v, w = vv.WEEK;
    vv.SLOT = i;
    const head = '@title ' + SLOT_NAMES[i];
    if (vv.FAINT) {
      vv.FAINT = 0;
      return Engine.playDynamic('_slot', ['@bg BG13', head,
        '> ฉันหมดแรงหลับไปตั้งแต่เมื่อไหร่ไม่รู้ ตื่นมาอีกทีก็เลยเวลานัดไปแล้ว',
        'เจได[serious]: มึงนอนเหมือนคนตาย พักบ้างนะเพื่อน']);
    }
    if (act.startsWith('visit_')) {
      const g = act.slice(6);
      vv.CUR = GIRLS.indexOf(g);
      vv.ENERGY = Math.max(0, vv.ENERGY - 10);
      if (g === 'fasai') { vv.OBS = Math.max(0, vv.OBS - 5); vv.SAT_FASAI = (vv.SAT_FASAI || 0) + 1; }
      else if (w >= 3) vv.OBS = Math.min(100, vv.OBS + ((vv['AFF_' + g] || 0) >= 30 ? 4 : 2));
      const id = pickVisit(g);
      vv['LASTV_' + g] = w;
      st.queue.unshift({ k: 'scene', id });
      return Engine.playDynamic('_slot', ['@bg BLACK', '@title ' + SLOT_NAMES[i] + ' · ไปหา' + CHARS[g].name]);
    }
    const a = ACTIVITIES.find(x => x.id === act);
    if (!a) return Engine.next();
    if (a.once) vv.CALLW = w;
    const low = vv.ENERGY < 20;
    const parts = [], eff = [];
    for (const k in a.eff) {
      let n = a.eff[k];
      if (low && n > 0 && STAT_NAMES[k] && k !== 'ENERGY') n = Math.max(1, Math.floor(n / 2));
      eff.push({ k, op: '+', n });
      if (STAT_NAMES[k]) parts.push(STAT_NAMES[k] + ' ' + (n > 0 ? '+' : '') + n);
    }
    if (a.energy) { eff.push({ k: 'ENERGY', op: '-', n: a.energy }); parts.push('พลังงาน -' + a.energy); }
    Engine.applyEffects(eff, true);
    if (vv.ENERGY <= 0) { vv.ENERGY = 0; vv.FAINT = 1; }

    const lines = ['@bg ' + a.bg, head];
    if (a.id === 'jedi') lines.push.apply(lines, jediLines());
    else if (a.lines.length) lines.push(a.lines[Math.floor(Math.random() * a.lines.length)]);
    if (a.id === 'read' && Math.random() < 0.3) lines.push(
      'ฟ้าใส[happy]: (วางที่คั่นหนังสือรูปดาวข้างแขน) ใช้อันนี้นะคะ อันเก่าของเธอขาดแล้ว',
      '* ฉันไม่เคยบอกใครว่าที่คั่นหนังสือขาด');
    if (a.id === 'meditate' && vv.OBS >= 60) {
      lines.push('* โทรศัพท์สั่นหนึ่งครั้ง ฉันไม่หยิบขึ้นมาดู และรู้สึกว่าตัวเองตัดสินใจถูก', '@set MIND+2');
    }
    if (low) lines.push('* ร่างกายล้าจนทำได้ไม่เต็มที่');
    lines.push('> ' + a.name + ' — ' + parts.join(' · '));
    if (vv.FAINT) lines.push('* หัวเริ่มหมุน ...ช่วงต่อไปคงไม่ไหวแล้ว');

    // ทริกเกอร์ตามค่าสถานะ
    const trig = [];
    const T = (cond, id) => { if (cond && !seen(id)) trig.push({ k: 'scene', id }); };
    T(a.id === 'dock' && vv.BODY >= 30, 't1');
    T(a.id === 'run' && vv.BODY >= 60, 't2');
    T((a.id === 'read' || a.id === 'study') && vv.KNOW >= 40, 't3');
    T(a.id === 'read' && vv.KNOW >= 70, 't4');
    T((a.id === 'music' || a.id === 'amp') && vv.ART >= 40, 't5');
    T(a.id === 'bake' && vv.ART >= 30 && vv.BAKED >= 3, 't6');
    T(a.id === 'art' && vv.ART >= 60, 't7');
    T(w >= 9 && i === 3 && ['KNOW', 'BODY', 'ART', 'MIND'].every(k => vv[k] >= 40), 't10');
    if (trig.length) st.queue = trig.concat(st.queue);
    Engine.playDynamic('_slot', lines);
  }

  function jediLines() {
    Engine.refreshDerived();
    const vv = v();
    const top = GIRLS[vv.TOP], name = CHARS[top].name;
    const L = ['เจได[normal]: เฮ้ย มานั่งนี่ เล่าอะไรให้ฟัง'];
    if (vv.AFF_TOP < 15) L.push('เจได[tease]: ช่วงนี้มึงยังไม่ติดใครเลยนะ ระวังขึ้นคานตั้งแต่ปีสอง');
    else if (vv.AFF_TOP < 35) L.push('เจได[tease]: ' + name + 'ถามกูว่ามึงชอบสีอะไร กูบอกชมพู', 'ภูมิ: กูไม่ได้ชอบสีชมพู', 'เจได[normal]: กูรู้ แต่อยากเห็นมึงใส่เสื้อชมพูที่เขาจะซื้อให้');
    else if (vv.AFF_TOP < 60) L.push('เจได[tease]: ทั้งเกาะรู้แล้วนะว่ามึงกับ' + name + 'ไปไหนมาไหนด้วยกัน');
    else L.push('เจได[serious]: กูว่า' + name + 'คิดกับมึงจริงจังแล้วนะ อย่าทำเขาเสียใจล่ะ');
    if (vv.OBS >= 60) L.push('เจได[serious]: ...แล้วก็ เมื่อวานพี่ฟ้าใสมาถามกูว่ามึงกลับห้องกี่โมง กูไม่ได้บอกนะ', '* ไม่ได้บอก แต่เธอคงรู้อยู่แล้ว');
    else if (vv.OBS >= 35) L.push('เจได[normal]: ช่วงนี้ห้องสมุดเปิดดึกนะ ไฟชั้นสองเปิดทุกคืนเลย');
    return L;
  }
})();
