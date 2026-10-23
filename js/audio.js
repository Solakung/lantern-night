// เพลงประกอบ: เลือกเพลงตามฉากอัตโนมัติ ค่อยๆ เฟดเปลี่ยนเพลง
// ไฟล์อยู่ที่ assets/bgm/<ชื่อ>.mp3 ถ้ายังไม่มีไฟล์ เกมจะเงียบเฉยๆ ไม่ error
(function () {
  const TRACKS = ['title', 'island', 'sweet', 'library', 'tension', 'horror', 'festival', 'sad'];
  const FADE = 1200;
  const missing = {};
  let cur = null, curName = null, want = null, unlocked = false;

  function vol() { return (window.Engine && Engine.settings.music != null) ? Engine.settings.music : 0.6; }

  // เพลงหลักของแต่ละฉาก
  function sceneTrack(id) {
    if (!id) return 'island';
    if (/^(bd|nd|pd|md|fd)$/.test(id)) return 'sweet';
    if (/^(s21|b10|n10|p10|m10|f10)$/.test(id)) return 'festival';
    if (/^(b11|n11|p11|m11|f11|s26|s27)$/.test(id)) return 'horror';
    if (/^end_.*bad$|^end_lib$/.test(id)) return 'horror';
    if (/^(end_release|end_f_good)$/.test(id)) return 'sad';
    if (/^end_/.test(id)) return 'sweet';
    if (/^(f\d+|rf\d+|gen_fasai|s17|s18)$/.test(id)) return 'library';
    if (/^(s00|s10|s14a|s20)$/.test(id)) return 'tension';
    return 'island';
  }

  function fade(a, to, done) {
    const from = a.volume, t0 = performance.now();
    (function step(t) {
      const k = Math.min(1, (t - t0) / FADE);
      a.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k < 1) requestAnimationFrame(step); else if (done) done();
    })(t0);
  }

  function play(name) {
    want = name;
    if (!unlocked) return;
    if (name === curName) { if (cur) { if (cur.paused) cur.play().catch(() => {}); fade(cur, vol()); } return; }
    const old = cur;
    curName = name; cur = null;
    if (old) fade(old, 0, () => { old.pause(); old.src = ''; });
    if (!name || missing[name] || vol() === 0) return;
    const a = new Audio('assets/bgm/' + name + '.mp3');
    a.loop = true; a.volume = 0;
    a.onerror = () => { missing[name] = true; if (cur === a) cur = null; };
    cur = a;
    a.play().then(() => fade(a, vol())).catch(err => {
      // เบราว์เซอร์ยังไม่ยอมให้เล่น (มือถือต้องรอให้ผู้เล่นแตะจอก่อน) รอแตะครั้งถัดไปแล้วลองใหม่
      if (err && err.name === 'NotAllowedError') { if (cur === a) { cur = null; curName = null; } unlocked = false; }
    });
  }

  const Music = {
    TRACKS,
    sceneTrack,
    now: () => curName,
    play,
    // คำนวณเพลงที่ควรเล่นจากสถานะปัจจุบัน
    refresh() {
      if (!window.Engine || !Engine.st) return;
      const st = Engine.st, vis = st.vis || {};
      if (vis.bgm) return play(vis.bgm === 'off' ? null : vis.bgm);
      let base = st.mode === 'planner' ? 'island' : sceneTrack(st.scene);
      if (vis.fx && vis.fx.dark && base !== 'horror') base = 'tension';
      play(base);
    },
    setVolume() {
      const w = want;
      if (vol() === 0) {
        if (cur) { const o = cur; cur = null; fade(o, 0, () => o.pause()); }
        curName = null; want = w;
      } else if (cur) cur.volume = vol();
      else { curName = null; play(w); }
    },
    unlock() {
      if (unlocked) return;
      unlocked = true;
      play(want);
    }
  };
  window.Music = Music;
  if (window.addEventListener) ['pointerup', 'touchend', 'click', 'keydown'].forEach(ev => window.addEventListener(ev, Music.unlock, { once: false, passive: true }));
})();
