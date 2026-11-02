// Demo: a random symbol, then the rule sentence picks itself at random (the words spin and lock one by one: the rule, how many blocks at a time, and what follows), then the loop runs
// through every iteration, then a new symbol and a new draw of the rule. Nothing else is shown.
(function () {
  const REST = 1400, TICK = 85, LOCK = [2000, 4200, 6400], HOLD = 4500; // ms: when each word locks, and how long the finished sentence stays
  G = 9; // the whole symbol list fits a 9 grid
  INK = '#231F20'; PAPER = '#DEDDD2'; // the colours of the printed book
  const stage = document.getElementById('stage'), intro = document.getElementById('intro');
  const pick = a => a[Math.floor(Math.random() * a.length)], MAKES = ['move', 'change', 'grow'];
  let last = '';
  function choose() { const A = pick(MAKES), others = MAKES.filter(x => x !== A), B = pick(['unmake', others[0], others[1], null]); return { rules: B ? [A, B] : [A], per: pick([1, 2, 3, 0]) }; }
  function symbol() {
    const names = Object.keys(SYMBOLS).filter(n => n !== last), name = last = pick(names), rows = SYMBOLS[name];
    const ox = Math.floor((G - rows[0].length) / 2), oy = Math.floor((G - rows.length) / 2), cells = Array(G * G).fill(null), start = [];
    rows.forEach((row, y) => [...row].forEach((c, x) => { if (c === 'X') { cells[(oy + y) * G + ox + x] = { s: 'square', r: 0, q: 0 }; start.push({ x: ox + x, y: oy + y, s: 'square', r: 0, q: 0 }); } }));
    return { cells, start };
  }
  // the sentence, centred, in three lines; words still spinning are drawn lighter
  // The sentence is live text in IBM Plex Mono Light Italic (the tool's own face), every line the same size. The number of ways has a line of its own,
  // written as a power of ten from 10,000 up (or "over" when it is a minimum): 5.3 × 10 with a raised 5.
  const SZ = 64, esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  function numText(n, more) {
    if (typeof n !== 'number') return esc(n);
    if (n < 10000 && !more) return esc(n.toLocaleString('en-GB'));
    const k = Math.floor(Math.log10(n)), m = (Math.floor(n / Math.pow(10, k) * 10) / 10).toFixed(1).replace('.0', '');
    return esc((more ? 'over ' : '') + m + ' \u00d7 10') + `<tspan baseline-shift="super" font-size="${SZ * 0.6}">${k}</tspan>`;
  }
  function drawIntro(w, locked) {
    const line = (t, y, lk) => t ? `<text x="600" y="${y}" opacity="${lk ? 1 : 0.3}">${t}</text>` : '';
    intro.innerHTML = `<g text-anchor="middle" fill="#231F20" font-family="'IBM Plex Mono',ui-monospace,monospace" font-style="italic" font-weight="300" font-size="${SZ}">`
      + line(numText(w.n, w.more), 330, locked[3]) + line(esc(`${w.ways} I can ${w.a}`), 410, locked[0]) + line(esc(`${w.per} at a time`), 490, locked[1]) + line(w.b ? esc(`and ${w.b}`) : '', 570, locked[2]) + '</g>';
  }
  function run() {
    const { cells, start } = symbol(), sel = choose(), code = patternCode(G, cells, sel.rules, sel.per), R = rng(codeSeed(code));
    const made = ruleWays(sel.rules, start, false, false, R, sel.per);
    if (!made || made.states.length < 2) return run();
    const states = made.states.map((s, id) => ({ ...s, id, phase: id ? s.phase : 'start' })), chain = { states, orig: states[0] }, bb = bbox(chain, 'form');
    const final = { n: made.total, more: !!made.more, ways: made.total === 1 && !made.more ? 'way' : 'ways', a: RULE_VERB[sel.rules[0]], per: PER_BLOCKS[sel.per], b: sel.rules[1] ? RULE_VERB[sel.rules[1]] : '' };
    const spin = { a: MAKES.map(r => RULE_VERB[r]), per: [1, 2, 3, 0].map(p => PER_BLOCKS[p]), b: ['unmake you', 'make you up', 'change you', 'grow you', '\u2026'] };
    stage.style.display = 'none'; intro.style.display = 'block'; let t = 0;
    const step = () => {
      t += 260 + t * 0.15; // the words spin quickly, then slow towards each lock
      const locked = [t >= LOCK[0], t >= LOCK[1], t >= LOCK[2]], all = locked[0] && locked[1] && locked[2];
      const w = { n: all ? final.n : '\u2026', more: all && final.more, ways: all ? final.ways : 'ways', a: locked[0] ? final.a : pick(spin.a), per: locked[1] ? final.per : pick(spin.per), b: locked[2] ? final.b : pick(spin.b) };
      drawIntro(w, [locked[0], locked[1], locked[2], all]);
      if (t >= LOCK[2] + HOLD) play(chain, bb); else setTimeout(step, 260 + t * 0.15);
    };
    step();
  }
  function play(chain, bb) {
    intro.style.display = 'none'; stage.style.display = 'block';
    stage.setAttribute('viewBox', `${bb.x} ${bb.y} ${bb.w} ${bb.h}`);
    stage.innerHTML = defs() + '<g id="f" fill="' + INK + '"></g>';
    const g = stage.querySelector('#f'), n = chain.states.length, step = Math.max(60, Math.min(220, 24000 / n)); let k = 0;
    const tick = () => { g.innerHTML = frame(chain, k, 'form'); k++; setTimeout(k < n ? tick : () => setTimeout(run, REST), k < n ? step : 0); };
    tick();
  }
  run();
})();
