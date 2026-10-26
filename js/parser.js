// ตัวอ่านไฟล์บท
// รูปแบบบท:
//   # scene_id              เริ่มฉากใหม่
//   :label                  ป้ายสำหรับกระโดดภายในฉาก
//   @bg BG01                เปลี่ยนพื้นหลัง (ล้างตัวละครบนจอ)   @bg BG01 night = ใช้ไฟล์ BG01_night
//   @cg CG02 / @cg off      แสดง CG / ปิด CG
//   @show fasai happy       แสดงตัวละคร   @hide fasai   @clear
//   @set AFF_baibua+3, OBS-5, FLAG=1
//   @if OBS>=40 -> label    @goto label   @jump scene   @call scene   @end
//   @ending E_ID            จบเกม
//   @title ข้อความ          การ์ดข้อความกลางจอ
//   @msg ข้อความ            ข้อความในโทรศัพท์    @note ข้อความ  โน้ต/จดหมาย
//   @fx rain|norain|dark|light|shake|flash|black
//   ชื่อ: บทพูด             ชื่อ[สีหน้า]: บทพูด
//   * ความคิดในใจ          > คำบรรยาย
//   - ตัวเลือก {AFF_x+3} [if COND] -> label
//   // คอมเมนต์
// แทนชื่อผู้เล่นด้วย {P}  ชื่อสาวคนปัจจุบัน {G}  ชื่อสาวที่สนิทที่สุด {TOP}
(function () {
  function parseEffects(s, where) {
    if (!s) return [];
    return s.split(',').map(x => x.trim()).filter(Boolean).map(x => {
      const m = x.match(/^([A-Za-z_]\w*)\s*(\+=|-=|\+|-|=)\s*(-?\d+(?:\.\d+)?)$/);
      if (!m) throw new Error((where || '') + ' ค่าไม่ถูกต้อง: ' + x);
      let op = m[2];
      if (op === '+=') op = '+';
      if (op === '-=') op = '-';
      return { k: m[1], op, n: +m[3] };
    });
  }

  function parseLine(ln, where) {
    if (ln.startsWith('@')) {
      const cmd = ln.slice(1).split(/\s+/)[0];
      const arg = ln.slice(1 + cmd.length).trim();
      const a = arg.split(/\s+/);
      switch (cmd) {
        case 'bg': return { t: 'bg', id: a[0] === 'off' ? null : a[0], v: a[1] || null };
        case 'cg': return { t: 'cg', id: a[0] === 'off' ? null : a[0] };
        case 'show': return { t: 'show', k: a[0], e: a[1] || 'normal' };
        case 'hide': return { t: 'hide', k: a[0] };
        case 'clear': return { t: 'hideall' };
        case 'set': return { t: 'set', eff: parseEffects(arg, where) };
        case 'if': {
          const m = arg.match(/^(.*?)\s*->\s*(\S+)$/);
          if (!m) throw new Error(where + ' @if ต้องมี -> ป้าย');
          return { t: 'if', cond: m[1], target: m[2] };
        }
        case 'goto': return { t: 'goto', target: a[0] };
        case 'jump': return { t: 'jump', scene: a[0] };
        case 'call': return { t: 'call', scene: a[0] };
        case 'end': return { t: 'end' };
        case 'ending': return { t: 'ending', id: a[0] };
        case 'title': return { t: 'title', text: arg };
        case 'msg': return { t: 'msg', text: arg };
        case 'note': return { t: 'note', text: arg };
        case 'fx': return { t: 'fx', name: a[0] };
        case 'bgm': return { t: 'bgm', id: a[0] || 'auto' };
        case 'checkpoint': return { t: 'checkpoint', id: a[0] || 'cp' };
        default: throw new Error(where + ' ไม่รู้จักคำสั่ง @' + cmd);
      }
    }
    if (ln.startsWith('* ')) return { t: 'think', text: ln.slice(2) };
    if (ln.startsWith('> ')) return { t: 'narr', text: ln.slice(2) };
    const m = ln.match(/^([^:\[\]{}<>*@\-]{1,24}?)(?:\[(\w+)\])?\s*:\s*(.+)$/);
    if (m) return { t: 'say', who: m[1].trim(), e: m[2] || null, text: m[3] };
    return { t: 'narr', text: ln };
  }

  function parseChoice(body, where) {
    let target = null, cond = null, eff = [];
    let m = body.match(/->\s*(\S+)\s*$/);
    if (m) { target = m[1]; body = body.slice(0, m.index).trim(); }
    for (let guard = 0; guard < 4; guard++) {
      m = body.match(/\[if\s+([^\]]+)\]\s*$/);
      if (m) { cond = m[1].trim(); body = body.slice(0, m.index).trim(); continue; }
      m = body.match(/\{([^}]*)\}\s*$/);
      if (m) { eff = parseEffects(m[1], where); body = body.slice(0, m.index).trim(); continue; }
      break;
    }
    return { text: body, eff, cond, target };
  }

  function parse(src, file) {
    const scenes = {};
    let cur = null;
    src.split(/\r?\n/).forEach((raw, i) => {
      const ln = raw.trim();
      const where = file + ':' + (i + 1);
      if (!ln || ln.startsWith('//')) return;
      if (ln.startsWith('# ')) {
        const id = ln.slice(2).trim();
        if (scenes[id]) throw new Error(where + ' ฉากซ้ำ ' + id);
        cur = scenes[id] = { id, code: [], labels: {}, src: where };
        return;
      }
      if (!cur) throw new Error(where + ' บรรทัดอยู่นอกฉาก');
      const last = cur.code[cur.code.length - 1];
      if (ln.startsWith(':')) {
        cur.labels[ln.slice(1).trim()] = cur.code.length;
        if (last && last.t === 'choice') last.closed = true;
        return;
      }
      if (ln.startsWith('- ')) {
        let block = last;
        if (!block || block.t !== 'choice' || block.closed) {
          block = { t: 'choice', opts: [], at: where };
          cur.code.push(block);
        }
        block.opts.push(parseChoice(ln.slice(2), where));
        return;
      }
      const ins = parseLine(ln, where);
      ins.at = where;
      cur.code.push(ins);
    });
    return scenes;
  }

  // คอมไพล์เงื่อนไข: ตัวแปรที่ไม่มีค่าถือเป็น 0
  const cache = {};
  function compile(expr) {
    if (cache[expr]) return cache[expr];
    const js = expr.replace(/\b([A-Za-z_]\w*)\b/g, w =>
      (w === 'true' || w === 'false') ? w : '(v.' + w + '||0)');
    return (cache[expr] = new Function('v', 'return !!(' + js + ');'));
  }

  window.Parser = { parse, parseLine, parseEffects, compile };
})();
