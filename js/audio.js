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
    if (/^(end_release|end_f_good|end_eh)$/.test(id)) return 'sad';
    if (/^end_/.test(id)) return 'sweet';
    if (/^(f\d+|rf\d+|gen_fasai_\d+|s17|s18)$/.test(id)) return 'library';
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

// เสียงเอฟเฟกต์ สังเคราะห์ด้วย Web Audio ไม่ต้องมีไฟล์เสียง
// buzz = โทรศัพท์สั่น, lock = กุญแจหมุน, thunder = ฟ้าร้อง, rain(on) = เสียงฝนวนลูป
(function () {
  let ctx = null, master = null, rainNode = null, rainGain = null, rainWant = false;
  function vol() { return (window.Engine && Engine.settings.sfx != null) ? Engine.settings.sfx : 0.7; }
  function ready() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try { ctx = new AC(); } catch (e) { return false; }
      master = ctx.createGain(); master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    master.gain.value = vol();
    return vol() > 0;
  }
  function noiseBuf(sec, brown) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  }
  const Sfx = {
    buzz() {
      if (!ready()) return;
      const t0 = ctx.currentTime;
      [0, 0.32].forEach(off => {
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.value = 165;
        f.type = 'lowpass'; f.frequency.value = 900;
        const t = t0 + off;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.22, t + 0.02);
        g.gain.setValueAtTime(0.22, t + 0.2);
        g.gain.linearRampToValueAtTime(0, t + 0.24);
        o.connect(f); f.connect(g); g.connect(master);
        o.start(t); o.stop(t + 0.26);
      });
      if (navigator.vibrate) try { navigator.vibrate([200, 120, 200]); } catch (e) {}
    },
    lock() {
      if (!ready()) return;
      const t0 = ctx.currentTime;
      [[0, 2600, 0.5], [0.16, 1800, 0.7]].forEach(([off, freq, amp]) => {
        const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        s.buffer = noiseBuf(0.06);
        f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 6;
        const t = t0 + off;
        g.gain.setValueAtTime(amp, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        s.connect(f); f.connect(g); g.connect(master); s.start(t);
      });
    },
    thunder() {
      if (!ready()) return;
      const t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noiseBuf(3, true);
      f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(120, t + 2.8);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.9, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.8); g.gain.exponentialRampToValueAtTime(0.001, t + 3);
      s.connect(f); f.connect(g); g.connect(master); s.start(t);
    },
    rain(on) {
      rainWant = !!on;
      if (!on) {
        if (rainNode) { const n = rainNode, gg = rainGain; rainNode = null; rainGain = null;
          try { gg.gain.setTargetAtTime(0, ctx.currentTime, 0.4); setTimeout(() => { try { n.stop(); } catch (e) {} }, 1500); } catch (e) {} }
        return;
      }
      if (rainNode || !ready()) return;
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noiseBuf(2); s.loop = true;
      f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 0.5;
      g.gain.value = 0; g.gain.setTargetAtTime(0.1, ctx.currentTime, 0.6);
      s.connect(f); f.connect(g); g.connect(master); s.start();
      rainNode = s; rainGain = g;
    },
    setVolume() {
      if (master) master.gain.value = vol();
      if (vol() === 0) Sfx.rain(false); else if (rainWant && !rainNode) Sfx.rain(true);
    },
    state() { return { rain: !!rainNode, ctx: ctx ? ctx.state : null }; },
    unlock() { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); if (rainWant && !rainNode) Sfx.rain(true); }
  };
  window.Sfx = Sfx;
  if (window.addEventListener) ['pointerup', 'touchend', 'keydown'].forEach(ev => window.addEventListener(ev, Sfx.unlock, { passive: true }));
})();
