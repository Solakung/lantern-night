// เอนจินหลัก: รันบท แสดงภาพ ตัวแปร เซฟ/โหลด
(function () {
  const $ = s => document.querySelector(s);
  const SCENES = {};
  window.SCENES = SCENES;

  // ---------- โหลดบททั้งหมด ----------
  function loadStory() {
    for (const s of (window.STORY || [])) {
      const parsed = Parser.parse(s.src, s.file);
      for (const id in parsed) {
        if (SCENES[id]) throw new Error('ฉากซ้ำ ' + id + ' ใน ' + s.file);
        SCENES[id] = parsed[id];
      }
    }
  }

  // ---------- ค่าเริ่มต้น ----------
  const CLAMP = /^(AFF_|OBS$|KNOW$|BODY$|ART$|MIND$|ENERGY$)/;
  function newVars() {
    const v = { KNOW: 10, BODY: 10, ART: 10, MIND: 15, ENERGY: 100, OBS: 0, EVIDENCE: 0, WEEK: 1 };
    for (const g of GIRLS) v['AFF_' + g] = 0;
    return v;
  }

  const E = window.Engine = {
    st: null,
    settings: { speed: 30, auto: 1500, size: 1, skipUnread: false, music: 0.6 },
    global: { cg: {}, end: {}, read: {}, clears: 0, umbrella: false },
    autoOn: false, skipOn: false, typing: false, waiting: null, log: []
  };

  function loadGlobal() {
    try { Object.assign(E.global, JSON.parse(localStorage.getItem('yd_global') || '{}')); } catch (e) {}
    try { Object.assign(E.settings, JSON.parse(localStorage.getItem('yd_settings') || '{}')); } catch (e) {}
  }
  let globalTimer = null;
  E.saveGlobal = function () {
    clearTimeout(globalTimer);
    globalTimer = setTimeout(() => {
      try { localStorage.setItem('yd_global', JSON.stringify(E.global)); } catch (e) {}
    }, 300);
  };
  E.saveSettings = function () {
    try { localStorage.setItem('yd_settings', JSON.stringify(E.settings)); } catch (e) {}
  };

  // ---------- ตัวแปร ----------
  E.val = k => E.st.v[k] || 0;
  E.applyEffects = function (eff, silent) {
    const v = E.st.v;
    const shown = [];
    for (const x of eff) {
      const before = v[x.k] || 0;
      let n = x.op === '=' ? x.n : before + (x.op === '+' ? x.n : -x.n);
      if (CLAMP.test(x.k)) n = Math.max(0, Math.min(100, n));
      v[x.k] = n;
      if (!silent && STAT_NAMES[x.k] && n !== before) shown.push(STAT_NAMES[x.k] + (n > before ? ' +' : ' ') + (n - before));
    }
    if (shown.length) UI.toast(shown.join(' · '));
  };
  E.test = function (cond) {
    if (!cond) return true;
    refreshDerived();
    try { return Parser.compile(cond)(E.st.v); }
    catch (e) { console.error('เงื่อนไขผิด', cond, e); return false; }
  };

  // ตัวแปรที่คำนวณอัตโนมัติ
  function refreshDerived() {
    const v = E.st.v;
    let top = 0, best = -1;
    ['baibua', 'nina', 'prang', 'mintra'].forEach((g, i) => {
      if ((v['AFF_' + g] || 0) > best) { best = v['AFF_' + g] || 0; top = i; }
    });
    v.TOP = top;
    v.AFF_TOP = best;
    if (v.CUR != null) v.AFF_CUR = v['AFF_' + GIRLS[v.CUR]] || 0;
    v.DANGER = v.OBS >= 75 ? 2 : v.OBS >= 40 ? 1 : 0;
    v.CLEARS = E.global.clears || 0;
  }
  E.refreshDerived = refreshDerived;

  E.text = function (s) {
    const v = E.st.v;
    return s.replace(/\{P\}/g, E.st.player)
      .replace(/\{G\}/g, v.CUR != null ? CHARS[GIRLS[v.CUR]].name : '')
      .replace(/\{TOP\}/g, CHARS[GIRLS[v.TOP || 0]].name);
  };

  // ---------- เริ่มเกม / ฉาก ----------
  E.newGame = function (player) {
    E.st = {
      v: newVars(), player: player || 'ภูมิ',
      scene: null, pc: 0, stack: [], queue: [], dyn: {},
      vis: { bg: null, bgv: null, cg: null, spr: {}, fx: {} },
      mode: 'scene', plan: null
    };
    E.log = [];
    Schedule.start();
    E.next();
  };

  function sceneOf(id) { return SCENES[id] || (E.st.dyn[id] && { id, code: E.st.dyn[id], labels: {} }); }

  E.playScene = function (id, isCall) {
    const sc = sceneOf(id);
    if (!sc) { console.error('ไม่พบฉาก', id); return E.endScene(); }
    if (isCall && E.st.scene) E.st.stack.push({ scene: E.st.scene, pc: E.st.pc + 1 });
    E.st.scene = id;
    E.st.pc = 0;
    E.st.mode = 'scene';
    if (!id.startsWith('_')) E.st.v['SEEN_' + id] = 1;
    if (!id.startsWith('_')) E.st.v.ROLL = Math.floor(Math.random() * 100);   // สุ่มทางแยกในฉาก (ฉากทั่วไปที่เล่นซ้ำได้)
    if (!id.startsWith('_')) { E.st.vis.bgm = null; Music.refresh(); }
    E.run();
  };

  // ฉากชั่วคราว (ผลกิจกรรม ฯลฯ) สร้างจากบรรทัดบท
  E.playDynamic = function (id, lines) {
    E.st.dyn[id] = lines.map(l => typeof l === 'string' ? Parser.parseLine(l, id) : l);
    E.playScene(id);
  };

  E.endScene = function () {
    if (E.st.stack.length) {
      const r = E.st.stack.pop();
      E.st.scene = r.scene; E.st.pc = r.pc;
      return E.run();
    }
    E.st.scene = null;
    E.next();
  };

  // ไปทำรายการถัดไปในคิว
  E.next = function () {
    UI.hideChoices();
    const item = E.st.queue.shift();
    if (!item) return Schedule.flow();
    Schedule.handle(item);
  };

  function jumpLabel(target) {
    const sc = sceneOf(E.st.scene);
    if (target in sc.labels) { E.st.pc = sc.labels[target]; return true; }
    if (SCENES[target]) { E.playScene(target); return 'scene'; }
    console.error('ไม่พบป้าย', target, 'ใน', E.st.scene);
    return false;
  }

  // ---------- ตัวรันบท ----------
  E.run = function () {
    let guard = 0;
    while (E.st.mode === 'scene' && E.st.scene) {
      if (++guard > 5000) { console.error('วนไม่จบใน', E.st.scene); return; }
      const sc = sceneOf(E.st.scene);
      const ins = sc.code[E.st.pc];
      if (!ins) return E.endScene();
      switch (ins.t) {
        case 'bg': setBg(ins.id, ins.v); E.st.pc++; break;
        case 'cg': setCg(ins.id); E.st.pc++; break;
        case 'show': showSprite(ins.k, ins.e); E.st.pc++; break;
        case 'hide': delete E.st.vis.spr[ins.k]; UI.renderSprites(); E.st.pc++; break;
        case 'hideall': E.st.vis.spr = {}; UI.renderSprites(); E.st.pc++; break;
        case 'set': E.applyEffects(ins.eff); E.st.pc++; break;
        case 'fx': setFx(ins.name); E.st.pc++; break;
        case 'bgm': E.st.vis.bgm = ins.id === 'auto' ? null : ins.id; Music.refresh(); E.st.pc++; break;
        case 'if':
          if (E.test(ins.cond)) { const r = jumpLabel(ins.target); if (r === 'scene') return; if (!r) E.st.pc++; }
          else E.st.pc++;
          break;
        case 'goto': { const r = jumpLabel(ins.target); if (r === 'scene') return; if (!r) E.st.pc++; break; }
        case 'jump': return E.playScene(ins.scene);
        case 'call': return E.playScene(ins.scene, true);
        case 'end': return E.endScene();
        case 'ending': return E.ending(ins.id);
        default: return display(ins);
      }
    }
  };

  E.advance = function () {
    if (!E.st || E.st.mode !== 'scene') return;
    if (E.typing) return UI.finishTyping();
    const ins = sceneOf(E.st.scene).code[E.st.pc];
    if (!ins || ins.t === 'choice' || ins.t === 'title') return;
    E.st.pc++;
    E.run();
  };

  E.choose = function (opt) {
    UI.hideChoices();
    E.log.push({ who: '', text: '▸ ' + E.text(opt.text) });
    E.applyEffects(opt.eff);
    if (opt.target) {
      const r = jumpLabel(opt.target);
      if (r === 'scene') return;
      if (r === false) E.st.pc++;
    } else E.st.pc++;
    E.run();
  };

  function display(ins) {
    const key = E.st.scene + ':' + E.st.pc;
    const read = !!E.global.read[key];
    if (ins.t === 'choice') {
      E.skipOn = E.skipOn && false;
      UI.setSkip(false);
      const opts = ins.opts.filter(o => E.test(o.cond));
      return UI.showChoices(opts.length ? opts : ins.opts.slice(0, 1));
    }
    if (ins.t === 'title') { UI.titleCard(E.text(ins.text)); return; }
    if (ins.t === 'say') {
      const k = SPEAKER_KEY[ins.who];
      if (k && (ins.e || !E.st.vis.spr[k]) && !E.st.vis.cg) showSprite(k, ins.e || (E.st.vis.spr[k] || 'normal'));
      // ตัวละครที่ไม่มีภาพ (เช่น ป้าแดง) พูด ให้ตัวละครบนจอหรี่ลง ส่วนตัวเอกพูดไม่ต้องหรี่
      UI.renderSprites(k || (ins.who === 'ภูมิ' ? null : '_offscreen'));
    } else UI.renderSprites(null);
    E.global.read[key] = 1;
    E.saveGlobal();
    const who = ins.t === 'say' ? (ins.who === 'ภูมิ' ? E.st.player : ins.who) : '';
    const text = E.text(ins.text);
    E.log.push({ who, text });
    if (E.log.length > 150) E.log.shift();
    UI.say(ins.t, who, text, read);
  }

  // ---------- ภาพ ----------
  function setBg(id, variant) {
    E.st.vis.bg = id; E.st.vis.bgv = variant;
    E.st.vis.spr = {}; E.st.vis.cg = null;
    UI.renderAll();
  }
  function setCg(id) {
    E.st.vis.cg = id;
    if (id) { E.global.cg[id] = 1; E.saveGlobal(); }
    UI.renderAll();
  }
  function showSprite(k, e) {
    if (!CHARS[k]) return;
    E.st.vis.spr[k] = e || 'normal';
    UI.renderSprites();
  }
  function setFx(name) {
    const fx = E.st.vis.fx;
    if (name === 'rain') fx.rain = 1;
    else if (name === 'norain') delete fx.rain;
    else if (name === 'dark') fx.dark = 1;
    else if (name === 'light') { delete fx.dark; delete fx.black; delete fx.night; }
    else if (name === 'night') fx.night = 1;
    else if (name === 'day') delete fx.night;
    else if (name === 'black') fx.black = 1;
    else UI.oneShot(name);
    UI.renderFx();
    Music.refresh();
  }

  // ---------- ฉากจบ ----------
  E.ending = function (id) {
    const info = ENDINGS.find(e => e.id === id) || { name: id, type: '' };
    E.global.end[id] = 1;
    E.global.clears = (E.global.clears || 0) + 1;
    if (id === 'E_LIBRARY' || id === 'E_F_BAD') { E.global.umbrella = true; E.global.cg.CG36 = 1; }
    // ภาพเฉลยฉากเปิดเกม ปลดล็อกเมื่อจบเรื่องของฟ้าใส
    if ((info.route === 'fasai' || id === 'E_RELEASE') && !E.global.cg.CG45) { E.global.cg.CG45 = 1; setTimeout(() => UI.toast('ปลดล็อกภาพพิเศษในแกลเลอรี: รอยยิ้มที่ท่าเรือ'), 1500); }
    E.saveGlobal();
    try { localStorage.removeItem('yd_save_auto'); } catch (e) {}
    E.st.mode = 'ending';
    UI.showEnding(info);
  };

  // ---------- เซฟ / โหลด ----------
  E.snapshot = function (label) {
    return JSON.parse(JSON.stringify(Object.assign({}, E.st, {
      time: Date.now(), label: label || ('สัปดาห์ ' + E.st.v.WEEK)
    })));
  };
  E.save = function (slot) {
    if (!E.st || E.st.mode === 'ending') return false;
    try {
      localStorage.setItem('yd_save_' + slot, JSON.stringify(E.snapshot(UI.saveLabel())));
      return true;
    } catch (e) { return false; }
  };
  E.autosave = () => E.save('auto');
  E.readSlot = function (slot) {
    try { return JSON.parse(localStorage.getItem('yd_save_' + slot) || 'null'); } catch (e) { return null; }
  };
  E.load = function (slot) {
    const data = E.readSlot(slot);
    if (!data) return false;
    delete data.time; delete data.label;
    E.st = data;
    E.log = [];
    E.autoOn = E.skipOn = false;
    UI.enterGame();
    UI.renderAll();
    Music.refresh();
    if (E.st.mode === 'planner') return UI.showPlanner();
    if (!E.st.scene) return E.next();
    const ins = sceneOf(E.st.scene).code[E.st.pc];
    if (ins && ins.t === 'title') { E.st.pc++; return E.run(); }
    E.run();
    return true;
  };

  window.addEventListener('DOMContentLoaded', () => {
    loadGlobal();
    try { loadStory(); }
    catch (e) { document.body.innerHTML = '<pre style="color:#fff;padding:20px;white-space:pre-wrap">บทมีข้อผิดพลาด:\n' + e.message + '</pre>'; throw e; }
    UI.init();
  });
})();
