// หน้าจอทั้งหมด: หน้าแรก กล่องข้อความ ตัวเลือก ตารางสัปดาห์ เซฟ/โหลด แกลเลอรี ตั้งค่า
(function () {
  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const EXTS = ['webp', 'png', 'jpg'];

  // โหลดภาพจากโฟลเดอร์ assets ถ้าไม่มีไฟล์จะใช้ภาพแทนชั่วคราว
  function loadImg(img, base, onFail) {
    let i = 0;
    img.classList.remove('ok');
    img.addEventListener('load', () => img.classList.add('ok'), { once: true });
    img.onerror = () => {
      i++;
      if (i < EXTS.length) img.src = base + '.' + EXTS[i];
      else { img.onerror = null; if (onFail) onFail(); else img.remove(); }
    };
    img.src = base + '.' + EXTS[0];
  }

  const UI = window.UI = {};
  let typeTimer = null, autoTimer = null, fullText = '';

  UI.init = function () {
    document.title = GAME_TITLE;
    bindInput();
    initFullscreen();
    applySettings();
    UI.showTitle();
  };

  // ---------- เต็มจอ + ล็อกแนวนอน ----------
  // Android/Chrome: เต็มจอแล้วล็อกแนวนอนได้ · iPhone Safari ไม่รองรับทั้งสองอย่าง ปุ่มจะไม่โผล่ เหลือแค่คำแนะนำให้หมุนจอ
  const docEl = document.documentElement;
  const fsSupported = !!(docEl.requestFullscreen || docEl.webkitRequestFullscreen);
  const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  UI.fsSupported = fsSupported;
  UI.toggleFullscreen = async function () {
    try {
      if (isFs()) {
        if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
        await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else {
        await (docEl.requestFullscreen || docEl.webkitRequestFullscreen).call(docEl, { navigationUI: 'hide' });
        // ล็อกได้เฉพาะตอนเต็มจอบนมือถือ บนคอมจะ error เงียบๆ ไม่เป็นไร
        if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape').catch(() => {});
      }
    } catch (e) { UI.toast('เบราว์เซอร์นี้ไม่ยอมเปิดเต็มจอ'); }
  };
  function syncFs() {
    const b = $('#fs-btn');
    if (!b) return;
    const on = isFs();
    b.classList.toggle('on', on);
    b.title = b.ariaLabel = on ? 'ออกจากเต็มจอ' : 'เต็มจอ (แนวนอน)';
    b.innerHTML = on
      ? '<svg viewBox="0 0 24 24"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
  }
  function initFullscreen() {
    if (!fsSupported) return;
    const b = el('button');
    b.id = 'fs-btn';
    b.onclick = e => { e.stopPropagation(); UI.toggleFullscreen(); };
    $('#game').appendChild(b);
    document.addEventListener('fullscreenchange', syncFs);
    document.addEventListener('webkitfullscreenchange', syncFs);
    syncFs();
  }

  function applySettings() {
    document.documentElement.style.setProperty('--fs', (Engine.settings.size || 1));
    if (window.Music) Music.setVolume();
    if (window.Sfx) Sfx.setVolume();
  }

  // ---------- หน้าแรก ----------
  UI.showTitle = function () {
    if (window.Sfx) Sfx.rain(false);
    stopTimers();
    $('#game').classList.remove('ingame');
    hideAll();
    const t = $('#title');
    t.classList.remove('hidden');
    Music.play('title');
    const hasAuto = !!Engine.readSlot('auto');
    t.innerHTML = '';
    const box = el('div', 'title-inner');
    box.appendChild(el('div', 'title-kicker', 'มหาวิทยาลัยศิลปะชายทะเล · 12 สัปดาห์ก่อนคืนโคมทะเล'));
    box.appendChild(el('h1', 'title-main', esc(GAME_TITLE)));
    box.appendChild(el('div', 'title-sub', esc(GAME_SUBTITLE)));
    const menu = el('div', 'title-menu');
    const btn = (label, fn, dis) => { const b = el('button', 'tbtn', label); b.disabled = !!dis; b.onclick = fn; menu.appendChild(b); };
    btn('เริ่มเกมใหม่', askName);
    btn('เล่นต่อ', () => Engine.load('auto'), !hasAuto);
    btn('โหลดเกม', () => UI.openSaves('load'));
    btn('แกลเลอรี', UI.openGallery);
    btn('ตั้งค่า', UI.openSettings);
    box.appendChild(menu);
    // ครั้งแรกที่เปิดเว็บ ให้แตะก่อน เบราว์เซอร์จะยอมเปิดเพลงพร้อมเมนู
    if (!UI._tapped) {
      box.appendChild(el('div', 'tap-hint', 'แตะเพื่อเริ่ม'));
      t.classList.add('gate');
      t.onclick = () => { UI._tapped = true; t.classList.remove('gate'); t.onclick = null; };
    } else { t.classList.remove('gate'); t.onclick = null; }
    box.appendChild(el('div', 'rotate-hint', UI.fsSupported
      ? 'เล่นแนวนอนจะเห็นภาพเต็มกว่า แตะปุ่มมุมซ้ายบนเพื่อเต็มจอ'
      : 'เล่นแนวนอนจะเห็นภาพเต็มกว่า ลองหมุนโทรศัพท์ดูนะ'));
    t.appendChild(box);
    t.classList.remove('haunted', 'pic'); t.style.backgroundImage = '';
    // พื้นหลังหน้าแรก: ปกติใช้ภาพคืนโคมทะเล (CG05) ถ้าเคยเจอฉากจบห้องสมุด เปลี่ยนเป็น CG36
    const haunt = !!Engine.global.umbrella;
    const src = haunt ? 'assets/cg/CG36.webp' : 'assets/cg/CG05.webp';
    const shade = haunt ? 'rgba(8,10,18,.55), rgba(8,10,18,.7)' : 'rgba(10,14,28,.35), rgba(10,14,28,.6)';
    const img = new Image();
    // ภาพหน้าแรกขึ้นแล้ว ค่อยแอบโหลดภาพช่วงต้นเกม (หรือจุดที่เซฟอัตโนมัติไว้) รอไว้ระหว่างผู้เล่นอยู่หน้านี้
    const preload = () => {
      const auto = Engine.readSlot('auto');
      Preload.scenes((auto && auto.scene ? [auto.scene] : []).concat(['s00', 's01', 's02']));
      Preload.idle();
    };
    img.onload = () => { t.classList.add('pic'); if (haunt) t.classList.add('haunted'); t.style.backgroundImage = 'linear-gradient(' + shade + '), url(' + src + ')'; preload(); };
    img.onerror = () => { if (haunt) t.appendChild(el('div', 'title-umbrella', umbrellaSvg())); preload(); };
    img.src = src;
  };

  function umbrellaSvg() {
    return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 6C17 6 6 17 6 30h52C58 17 47 6 32 6z" fill="#f4f1ea" opacity=".9"/><path d="M32 30v22a5 5 0 0 1-10 0" stroke="#f4f1ea" stroke-width="3" fill="none" stroke-linecap="round"/></svg>';
  }

  function askName() {
    const m = modal('ตั้งชื่อตัวเอก');
    const input = el('input', 'name-input');
    input.value = 'ภูมิ'; input.maxLength = 12;
    m.body.appendChild(el('p', 'hint', 'ชื่อนี้จะใช้แทนชื่อ "ภูมิ" ตลอดทั้งเรื่อง'));
    m.body.appendChild(input);
    const go = el('button', 'tbtn primary', 'เริ่มเรื่อง');
    go.onclick = () => { const n = input.value.trim() || 'ภูมิ'; closeModal(); UI.enterGame(); Engine.newGame(n); };
    m.body.appendChild(go);
    // เคยจบเกมแล้ว ให้ข้ามสัปดาห์แรกได้
    if ((Engine.global.clears || 0) > 0) {
      const skip = el('button', 'tbtn', 'ข้ามสัปดาห์แรก');
      skip.onclick = () => { const n = input.value.trim() || 'ภูมิ'; closeModal(); UI.enterGame(); Engine.newGame(n, true); };
      m.body.appendChild(skip);
      m.body.appendChild(el('p', 'hint', 'เคยเล่นจบแล้ว ข้ามไปเริ่มสัปดาห์ที่ 2 ได้เลย'));
    }
    setTimeout(() => input.select(), 50);
  }

  UI.enterGame = function () {
    hideAll();
    $('#game').classList.add('ingame');
    $('#quick').classList.remove('hidden');
  };

  function hideAll() {
    ['#title', '#planner', '#ending', '#textbox', '#choices', '#quick', '#titlecard'].forEach(s => $(s).classList.add('hidden'));
  }

  // ---------- ภาพบนจอ ----------
  UI.renderAll = function () {
    const vis = Engine.st.vis;
    // พื้นหลัง
    const bg = $('#bg');
    const id = vis.bg;
    const key = id ? id + (vis.bgv ? '_' + vis.bgv : '') : null;
    if (bg.dataset.key !== String(key)) {
      bg.dataset.key = String(key);
      bg.innerHTML = '';
      if (id) {
        const info = BGS[id] || { name: id, c: ['#333', '#111'] };
        const ph = el('div', 'bg-ph');
        ph.style.background = 'linear-gradient(170deg,' + info.c[0] + ',' + info.c[1] + ')';
        if (info.name) ph.appendChild(el('span', 'ph-label', esc(id + ' · ' + info.name + (vis.bgv ? ' (' + vis.bgv + ')' : ''))));
        bg.appendChild(ph);
        if (id !== 'BLACK') {
          const img = el('img');
          img.alt = '';
          img.onload = () => ph.remove();
          // ไม่มีภาพเวอร์ชันกลางคืน/เย็น ใช้ภาพหลักแล้วย้อมสีแทน
          const fallback = vis.bgv ? () => { bg.classList.add('tint-' + vis.bgv); loadImg(img, 'assets/bg/' + id); } : null;
          bg.classList.remove('tint-night', 'tint-sunset');
          // รู้อยู่แล้วว่าไม่มีภาพเวอร์ชันนี้ ข้ามไปย้อมสีเลย ไม่ต้องลองโหลดให้เสียเวลา
          if (vis.bgv && window.BG_VARIANTS && !BG_VARIANTS.includes(key)) fallback();
          else loadImg(img, 'assets/bg/' + key, fallback);
          bg.appendChild(img);
        }
      }
    }
    // CG
    const cg = $('#cg');
    if (cg.dataset.key !== String(vis.cg)) {
      cg.dataset.key = String(vis.cg);
      cg.innerHTML = '';
      cg.classList.toggle('hidden', !vis.cg);
      if (vis.cg) {
        const ph = el('div', 'cg-ph', '<span>' + esc(vis.cg) + '</span><b>' + esc(CGS[vis.cg] || '') + '</b>');
        cg.appendChild(ph);
        const img = el('img'); img.alt = '';
        img.onload = () => ph.remove();
        loadImg(img, 'assets/cg/' + vis.cg);
        cg.appendChild(img);
      }
    }
    UI.renderSprites();
    UI.renderFx();
  };

  UI.renderSprites = function (speaker) {
    const box = $('#sprites');
    const spr = Engine.st.vis.spr;
    const keys = Object.keys(spr);
    box.classList.toggle('hidden', !!Engine.st.vis.cg);
    // ลบตัวที่ไม่อยู่แล้ว
    [...box.children].forEach(c => { if (!(c.dataset.k in spr)) c.remove(); });
    keys.forEach((k, i) => {
      let node = box.querySelector('[data-k="' + k + '"]');
      if (!node) {
        node = el('div', 'sprite enter');
        node.dataset.k = k;
        box.appendChild(node);
        setTimeout(() => node.classList.remove('enter'), 30);
      }
      const pos = keys.length === 1 ? 50 : 18 + (64 / (keys.length - 1)) * i;
      node.style.left = pos + '%';
      if (node.dataset.e !== spr[k]) {
        node.dataset.e = spr[k];
        node.innerHTML = '';
        const c = CHARS[k];
        const ph = el('div', 'spr-ph', '<div class="spr-head"></div><div class="spr-body"></div><span>' + esc(c.name) + '<small>' + esc(spr[k]) + '</small></span>');
        ph.style.setProperty('--c', c.color);
        node.appendChild(ph);
        const img = el('img'); img.alt = c.name;
        img.onload = () => ph.remove();
        loadImg(img, 'assets/sprites/' + k + '_' + spr[k], () => loadImg(img, 'assets/sprites/' + k + '_normal'));
        node.appendChild(img);
      }
      if (speaker !== undefined) node.classList.toggle('dim', !!speaker && speaker !== k);
    });
  };

  UI.renderFx = function () {
    const fx = Engine.st.vis.fx || {};
    if (window.Sfx) Sfx.rain(!!fx.rain && Engine.st.mode === 'scene');
    $('#fx').className = 'layer' + (fx.rain ? ' rain' : '') + (fx.dark ? ' dark' : '') + (fx.black ? ' black' : '') + (fx.night ? ' night' : '');
  };
  UI.oneShot = function (name) {
    const g = $('#game');
    g.classList.remove('shake', 'flash');
    void g.offsetWidth;
    if (name === 'shake' || name === 'flash') g.classList.add(name);
  };

  // ---------- ข้อความ ----------
  UI.say = function (type, who, text, read) {
    $('#planner').classList.add('hidden');
    const tb = $('#textbox');
    tb.classList.remove('hidden');
    tb.className = 'type-' + type;
    const nb = $('#namebox');
    nb.textContent = who || '';
    nb.classList.toggle('hidden', !who);
    const k = SPEAKER_KEY[who];
    nb.style.setProperty('--c', k ? CHARS[k].color : (who === Engine.st.player ? '#7aa0b8' : '#8a8a8a'));
    const label = type === 'msg' ? '📱 ข้อความ' : type === 'note' ? 'โน้ต' : '';
    if (label) { nb.textContent = label; nb.classList.remove('hidden'); }
    fullText = text;
    if (type === 'msg' && !Engine.skipOn && window.Sfx) Sfx.buzz();
    const t = $('#text');
    stopTimers();
    if (Engine.skipOn && (read || Engine.settings.skipUnread)) {
      t.textContent = text; Engine.typing = false;
      autoTimer = setTimeout(() => Engine.advance(), 40);
      return;
    }
    if (Engine.skipOn) { Engine.skipOn = false; UI.setSkip(false); }
    const speed = Engine.settings.speed;
    if (!speed) { t.textContent = text; Engine.typing = false; return scheduleAuto(); }
    Engine.typing = true;
    const chars = [...text];
    let i = 0;
    t.textContent = '';
    typeTimer = setInterval(() => {
      i += 1;
      t.textContent = chars.slice(0, i).join('');
      if (i >= chars.length) { clearInterval(typeTimer); Engine.typing = false; scheduleAuto(); }
    }, speed);
  };
  UI.finishTyping = function () {
    clearInterval(typeTimer);
    $('#text').textContent = fullText;
    Engine.typing = false;
    scheduleAuto();
  };
  function scheduleAuto() {
    if (!Engine.autoOn) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => Engine.advance(), Engine.settings.auto + [...fullText].length * 25);
  }
  function stopTimers() { clearInterval(typeTimer); clearTimeout(autoTimer); }

  UI.titleCard = function (text) {
    $('#textbox').classList.add('hidden');
    const c = $('#titlecard');
    c.textContent = text;
    c.classList.remove('hidden');
    stopTimers();
    autoTimer = setTimeout(() => { c.classList.add('hidden'); Engine.st.pc++; Engine.run(); }, Engine.skipOn ? 250 : 1600);
    c.onclick = () => { clearTimeout(autoTimer); c.classList.add('hidden'); Engine.st.pc++; Engine.run(); };
  };

  UI.showChoices = function (opts) {
    stopTimers();
    const box = $('#choices');
    box.innerHTML = '';
    box.classList.remove('hidden');
    opts.forEach(o => {
      const b = el('button', 'choice', esc(Engine.text(o.text)));
      b.onclick = e => { e.stopPropagation(); Engine.choose(o); };
      box.appendChild(b);
    });
  };
  UI.hideChoices = function () { $('#choices').classList.add('hidden'); };

  UI.toast = function (msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('show'), 1800);
  };

  UI.setSkip = function (on) { $('#q-skip').classList.toggle('on', on); };
  UI.setAuto = function (on) { $('#q-auto').classList.toggle('on', on); };

  // ---------- ตารางสัปดาห์ ----------
  const tier = a => a < 15 ? 'เพิ่งรู้จัก' : a < 35 ? 'เพื่อน' : a < 60 ? 'สนิท' : 'คนพิเศษ';
  const mood = o => o < 25 ? '' : o < 40 ? 'บางครั้งรู้สึกเหมือนมีคนมองอยู่' : o < 60 ? 'ข้อความจากเบอร์ไม่รู้จักมาบ่อยขึ้น' : o < 75 ? 'ร่มสีขาวโผล่ในสายตาบ่อยเกินไปแล้ว ...อย่าทำให้เธอหึงไปมากกว่านี้เลย' : 'ไม่ว่าจะไปที่ไหน เหมือนเธอรู้ก่อนเสมอ ...ตอนนี้เธอไม่ยอมปล่อยแล้ว';

  UI.showPlanner = function () {
    if (window.Sfx) Sfx.rain(false);
    Music.refresh();
    stopTimers();
    const st = Engine.st, v = st.v;
    $('#textbox').classList.add('hidden');
    $('#cg').classList.add('hidden');
    const p = $('#planner');
    p.classList.remove('hidden');
    p.innerHTML = '';
    // สมุดจดตารางของภูมิ
    const book = el('div', 'pl-book');
    const page = el('div', 'pl-page');

    const top = el('div', 'pl-top');
    top.appendChild(el('div', 'pl-tape'));
    top.appendChild(el('div', 'pl-week', 'สัปดาห์ที่ <b>' + v.WEEK + '</b>'));
    const left = 12 - v.WEEK;
    top.appendChild(el('div', 'pl-left', left > 0 ? 'อีก ' + left + ' สัปดาห์ถึงคืนโคมทะเล' : 'คืนนี้คืนโคมทะเล'));
    const cal = el('div', 'pl-cal');
    for (let w = 1; w <= 12; w++) {
      const c = el('span', w < v.WEEK ? 'done' : w === v.WEEK ? 'now' : '', w === 12 ? '🏮' : String(w));
      cal.appendChild(c);
    }
    top.appendChild(cal);
    page.appendChild(top);

    const grid = el('div', 'pl-grid');
    // ตารางกิจกรรม
    const table = el('div', 'pl-table');
    table.appendChild(el('div', 'pl-th', '<span>ช่วงเวลา</span><span>จะทำอะไร</span>'));
    st.plan.forEach((act, i) => {
      const o = act && Schedule.options(i).find(x => x.id === act);
      const row = el('button', 'pl-row' + (o ? ' set' : ''));
      if (o && o.girl) { row.classList.add('girl'); row.style.setProperty('--c', CHARS[o.girl].color); }
      row.innerHTML = '<span class="pl-when">' + SLOT_NAMES[i] + '</span><span class="pl-what">' +
        (o ? esc(o.name) + (o.place ? '<small>' + esc(o.place) + '</small>' : '') : '<em>แตะเพื่อเขียน...</em>') + '</span>';
      row.onclick = () => pickSlot(i);
      table.appendChild(row);
    });
    const est = st.plan.reduce((s, a) => {
      const o = a && ACTIVITIES.find(x => x.id === a);
      return s + (o ? (o.energy || 0) - (o.eff.ENERGY || 0) : a ? 10 : 0);
    }, 0);
    table.appendChild(el('div', 'pl-est', 'แรงที่จะใช้ ' + est + ' จาก ' + v.ENERGY + (est > v.ENERGY ? '<em>อาจหมดแรงกลางสัปดาห์!</em>' : '')));
    grid.appendChild(table);

    const side = el('div', 'pl-side');
    const n1 = el('div', 'note yellow');
    n1.appendChild(el('div', 'note-h', 'สภาพตัวเอง'));
    ['KNOW', 'BODY', 'ART', 'MIND', 'ENERGY'].forEach(k => {
      const row = el('div', 'stat' + (k === 'ENERGY' ? ' energy' : ''));
      row.innerHTML = '<span>' + STAT_NAMES[k] + '</span><div class="bar"><i style="width:' + (v[k] || 0) + '%"></i></div><b>' + (v[k] || 0) + '</b>';
      row.title = STAT_HINTS[k] || '';
      n1.appendChild(row);
      if (STAT_HINTS[k]) n1.appendChild(el('div', 'stat-hint', esc(STAT_HINTS[k])));
    });
    side.appendChild(n1);
    const n2 = el('div', 'note pink');
    n2.appendChild(el('div', 'note-h', 'คนบนเกาะ'));
    GIRLS.forEach(g => {
      const a = v['AFF_' + g] || 0;
      n2.appendChild(el('div', 'rel', '<i style="background:' + CHARS[g].color + '"></i><span>' + CHARS[g].name + '</span><small>' + tier(a) + '</small>'));
      const rp = ROUTE_PROGRESS[g];
      if (rp && v['SEEN_' + rp.seen]) {
        const n = Math.max(0, Math.min(rp.max, v[rp.k] || 0));
        n2.appendChild(el('div', 'rel-prog', esc(rp.label) + ' ' + '●'.repeat(n) + '○'.repeat(rp.max - n) +
          (rp.dec && v[rp.dec] ? ' · <b>เธอเลือกทางของตัวเองแล้ว</b>' : '')));
      }
    });
    side.appendChild(n2);
    grid.appendChild(side);
    page.appendChild(grid);

    const m = mood(v.OBS);
    if (m) page.appendChild(el('div', 'pl-mood', esc(m)));

    const go = el('button', 'pl-go', 'เริ่มสัปดาห์ →');
    go.disabled = st.plan.some(x => !x);
    go.onclick = () => Schedule.confirmPlan(st.plan.slice());
    page.appendChild(go);
    book.appendChild(page);
    p.appendChild(book);
  };
  UI.hidePlanner = () => $('#planner').classList.add('hidden');

  function pickSlot(i) {
    const st = Engine.st;
    const m = modal(SLOT_NAMES[i]);
    m.box.classList.add('paper');
    const opts = Schedule.options(i);
    const list = el('div', 'opt-list');
    opts.forEach(o => {
      const usedElsewhere = ACTIVITIES.find(a => a.id === o.id && a.once) && st.plan.some((p, j) => p === o.id && j !== i);
      const b = el('button', 'opt' + (o.girl ? ' girl' : ''));
      if (o.girl) b.style.setProperty('--c', CHARS[o.girl].color);
      const effs = Object.keys(o.eff).filter(k => STAT_NAMES[k]).map(k => STAT_NAMES[k] + ' ' + (o.eff[k] > 0 ? '+' : '') + o.eff[k]);
      if (o.energy) effs.push('พลังงาน -' + o.energy);
      b.innerHTML = '<b>' + esc(o.name) + '</b><small>' + esc(o.place ? o.place + ' · ' : '') + effs.join(' · ') + '</small>';
      b.disabled = o.blocked || usedElsewhere;
      b.onclick = () => { st.plan[i] = o.id; closeModal(); UI.showPlanner(); };
      list.appendChild(b);
    });
    m.body.appendChild(list);
  }

  // ---------- ฉากจบ ----------
  UI.showEnding = function (info) {
    if (window.Sfx) Sfx.rain(false);
    stopTimers();
    $('#textbox').classList.add('hidden');
    $('#quick').classList.add('hidden');
    const e = $('#ending');
    e.classList.remove('hidden');
    e.className = 'screen end-' + (info.type || '').toLowerCase();
    e.innerHTML = '';
    const box = el('div', 'end-inner');
    if (info.extra) {
      box.appendChild(el('div', 'end-big', esc(info.type)));
      box.appendChild(el('div', 'end-type', 'Ending'));
    } else box.appendChild(el('div', 'end-type', esc(info.type ? info.type + ' End' : 'End')));
    box.appendChild(el('h2', 'end-name', esc(info.name)));
    const main = ENDINGS.filter(x => !x.extra);
    const got = main.filter(x => Engine.global.end[x.id]).length;
    if (info.quip) box.appendChild(el('p', 'end-quip', esc(info.quip)));
    box.appendChild(el('p', 'end-count', 'เก็บฉากจบแล้ว ' + got + ' / ' + main.length));
    const meta = ENDINGS.find(x => x.id === info.id);
    if (meta && meta.hint) box.appendChild(el('p', 'end-hint', '<b>ยังมีทางอื่นอีก</b> ' + esc(meta.hint)));
    if (info.retry && Engine.readSlot('cp_' + info.retry)) {
      const r = el('button', 'tbtn primary', esc(info.retryLabel || 'ย้อนกลับ'));
      r.onclick = () => Engine.load('cp_' + info.retry);
      box.appendChild(r);
    }
    const b = el('button', 'tbtn' + (info.retry ? '' : ' primary'), 'กลับหน้าแรก');
    b.onclick = UI.showTitle;
    box.appendChild(b);
    e.appendChild(box);
  };

  // ---------- หน้าต่าง ----------
  function modal(title) {
    closeModal();
    const bg = el('div', 'modal-bg');
    const m = el('div', 'modal');
    const h = el('div', 'modal-head', '<b>' + esc(title) + '</b>');
    const x = el('button', 'modal-x', '✕');
    x.onclick = closeModal;
    h.appendChild(x);
    const body = el('div', 'modal-body');
    m.appendChild(h); m.appendChild(body);
    bg.appendChild(m);
    bg.onclick = e => { if (e.target === bg) closeModal(); };
    $('#game').appendChild(bg);
    stopTimers();
    return { body, box: m };
  }
  function closeModal() {
    const m = document.querySelector('.modal-bg');
    if (m) { m.remove(); if (Engine.autoOn && !Engine.typing) scheduleAuto(); }
  }
  UI.closeModal = closeModal;

  UI.saveLabel = function () {
    const st = Engine.st;
    if (st.mode === 'planner') return 'สัปดาห์ ' + st.v.WEEK + ' · วางตาราง';
    const last = Engine.log[Engine.log.length - 1];
    return 'สัปดาห์ ' + st.v.WEEK + (last ? ' · ' + (last.who ? last.who + ': ' : '') + last.text.slice(0, 28) : '');
  };

  UI.openSaves = function (mode) {
    const m = modal(mode === 'save' ? 'บันทึกเกม' : 'โหลดเกม');
    const list = el('div', 'save-list');
    const slots = ['auto', 1, 2, 3, 4, 5, 6];
    slots.forEach(s => {
      if (mode === 'save' && s === 'auto') return;
      const d = Engine.readSlot(s);
      const b = el('button', 'save-slot' + (d ? '' : ' empty'));
      const when = d ? new Date(d.time).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '';
      b.innerHTML = '<span>' + (s === 'auto' ? 'อัตโนมัติ' : 'ช่อง ' + s) + '</span><b>' + (d ? esc(d.label) : 'ว่าง') + '</b><small>' + when + '</small>';
      if (mode === 'load') {
        b.disabled = !d;
        b.onclick = () => { closeModal(); Engine.load(s); };
      } else b.onclick = () => {
        if (d && !confirm('บันทึกทับช่อง ' + s + '?')) return;
        UI.toast(Engine.save(s) ? 'บันทึกแล้ว' : 'บันทึกไม่สำเร็จ');
        closeModal();
      };
      list.appendChild(b);
    });
    m.body.appendChild(list);
  };

  UI.openLog = function () {
    const m = modal('ย้อนอ่าน');
    const list = el('div', 'log-list');
    Engine.log.forEach(l => list.appendChild(el('p', '', (l.who ? '<b>' + esc(l.who) + '</b> ' : '') + esc(l.text))));
    m.body.appendChild(list);
    setTimeout(() => { list.scrollTop = list.scrollHeight; }, 0);
  };

  UI.openGallery = function () {
    const m = modal('แกลเลอรี');
    const got = Object.keys(CGS).filter(k => Engine.global.cg[k]).length;
    m.body.appendChild(el('h3', 'gal-h', 'ภาพ CG · ' + got + ' / ' + Object.keys(CGS).length));
    const grid = el('div', 'gal-grid');
    Object.keys(CGS).forEach(k => {
      const ok = Engine.global.cg[k];
      const c = el('button', 'gal-item' + (ok ? '' : ' locked'));
      c.innerHTML = ok ? '<span>' + esc(CGS[k]) + '</span>' : '<span>???</span>';
      if (ok) {
        const img = el('img'); img.alt = '';
        loadImg(img, 'assets/cg/' + k, () => img.remove());
        c.prepend(img);
        c.onclick = () => viewCg(k);
      } else c.disabled = true;
      grid.appendChild(c);
    });
    m.body.appendChild(grid);
    const eg = ENDINGS.filter(x => !x.extra && Engine.global.end[x.id]).length;
    m.body.appendChild(el('h3', 'gal-h', 'ฉากจบ · ' + eg + ' / ' + ENDINGS.filter(x => !x.extra).length));
    const list = el('div', 'end-list');
    ENDINGS.forEach(x => {
      const ok = Engine.global.end[x.id];
      list.appendChild(el('div', 'end-row' + (ok ? '' : ' locked'),
        '<i>' + x.type + '</i><span>' + (ok ? esc(x.name) : '???') + '</span><small>' + (x.route === 'main' ? 'บทหลัก' : CHARS[x.route].name) + '</small>' +
        (ok && x.hint ? '<em>' + esc(x.hint) + '</em>' : '')));
    });
    m.body.appendChild(list);
  };
  function viewCg(k) {
    const v = el('div', 'cg-view');
    const ph = el('div', 'cg-ph', '<span>' + k + '</span><b>' + esc(CGS[k]) + '</b>');
    v.appendChild(ph);
    const img = el('img'); img.alt = '';
    img.onload = () => ph.remove();
    loadImg(img, 'assets/cg/' + k);
    v.appendChild(img);
    v.onclick = () => v.remove();
    $('#game').appendChild(v);
  }

  UI.openSettings = function () {
    const s = Engine.settings;
    const m = modal('ตั้งค่า');
    const row = (label, opts, key) => {
      const r = el('div', 'set-row', '<span>' + label + '</span>');
      const g = el('div', 'seg');
      opts.forEach(([name, val]) => {
        const b = el('button', s[key] === val ? 'on' : '', name);
        b.onclick = () => { s[key] = val; Engine.saveSettings(); applySettings(); [...g.children].forEach(c => c.classList.remove('on')); b.classList.add('on'); };
        g.appendChild(b);
      });
      r.appendChild(g);
      m.body.appendChild(r);
    };
    row('ความเร็วตัวอักษร', [['ช้า', 50], ['ปกติ', 30], ['เร็ว', 12], ['ทันที', 0]], 'speed');
    row('หน่วงโหมดอัตโนมัติ', [['สั้น', 800], ['ปกติ', 1500], ['ยาว', 2500]], 'auto');
    row('ขนาดตัวอักษร', [['เล็ก', 0.9], ['ปกติ', 1], ['ใหญ่', 1.15]], 'size');
    row('เสียงเพลง', [['ปิด', 0], ['เบา', 0.3], ['ปกติ', 0.6], ['ดัง', 1]], 'music');
    row('เสียงเอฟเฟกต์', [['ปิด', 0], ['เบา', 0.35], ['ปกติ', 0.7], ['ดัง', 1]], 'sfx');
    row('ข้ามข้อความที่ยังไม่อ่าน', [['ไม่', false], ['ข้าม', true]], 'skipUnread');
  };

  UI.openMenu = function () {
    const m = modal('เมนู');
    const list = el('div', 'title-menu');
    const add = (label, fn) => { const b = el('button', 'tbtn', label); b.onclick = fn; list.appendChild(b); };
    add('บันทึก', () => UI.openSaves('save'));
    add('โหลด', () => UI.openSaves('load'));
    add('ย้อนอ่าน', UI.openLog);
    add('ตั้งค่า', UI.openSettings);
    if (UI.fsSupported) add('เต็มจอ / ออกจากเต็มจอ', () => { closeModal(); UI.toggleFullscreen(); });
    add('กลับหน้าแรก', () => { closeModal(); if (confirm('กลับหน้าแรก? ความคืบหน้าที่ยังไม่บันทึกจะหายไป')) UI.showTitle(); });
    m.body.appendChild(list);
  };

  // ---------- การกด ----------
  function bindInput() {
    const game = $('#game');
    game.addEventListener('click', e => {
      if (e.target.closest('button, .modal-bg, #planner, #title, #ending, #titlecard, .cg-view, input')) return;
      if (!Engine.st || Engine.st.mode !== 'scene') return;
      if (Engine.autoOn) { Engine.autoOn = false; UI.setAuto(false); }
      Engine.advance();
    });
    document.addEventListener('keydown', e => {
      if (document.querySelector('.modal-bg') || !Engine.st || Engine.st.mode !== 'scene') return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); Engine.advance(); }
      if (e.key === 'Control') { Engine.skipOn = true; UI.setSkip(true); Engine.advance(); }
    });
    document.addEventListener('keyup', e => { if (e.key === 'Control') { Engine.skipOn = false; UI.setSkip(false); } });
    $('#q-auto').onclick = () => { Engine.autoOn = !Engine.autoOn; UI.setAuto(Engine.autoOn); if (Engine.autoOn && !Engine.typing) Engine.advance(); };
    $('#q-skip').onclick = () => { Engine.skipOn = !Engine.skipOn; UI.setSkip(Engine.skipOn); if (Engine.skipOn) Engine.advance(); };
    $('#q-log').onclick = UI.openLog;
    $('#q-save').onclick = () => UI.openSaves('save');
    $('#q-load').onclick = () => UI.openSaves('load');
    $('#q-menu').onclick = UI.openMenu;
  }
})();
