// Demo: one random symbol fills the screen and runs through all its iterations (the original, every way to make it up, every way to unmake it), then another is chosen. Nothing else is shown.
(function () {
  const STEP = 220, REST = 1400; // ms per iteration; pause on the last one before the next shape
  G = 9; // the whole symbol list fits a 9 grid
  const svg = document.getElementById('stage');
  let last = '', timer = 0;
  function next() {
    const names = Object.keys(SYMBOLS).filter(n => n !== last), name = last = names[Math.floor(Math.random() * names.length)], rows = SYMBOLS[name];
    const ox = Math.floor((G - rows[0].length) / 2), oy = Math.floor((G - rows.length) / 2), cells = Array(G * G).fill(null), start = [];
    rows.forEach((row, y) => [...row].forEach((c, x) => { if (c === 'X') { cells[(oy + y) * G + ox + x] = { s: 'square', r: 0, q: 0 }; start.push({ x: ox + x, y: oy + y, s: 'square', r: 0, q: 0 }); } }));
    const R = rng(codeSeed(patternCode(G, cells)));
    const made = makeWays(start, false, false, R), unmade = unmake(start, start.map(() => R()));
    const states = [made.states[0], ...made.states.slice(1), ...unmade.states.slice(1)];
    const chain = { states, orig: states[0] }, bb = bbox(chain, 'form');
    svg.setAttribute('viewBox', `${bb.x} ${bb.y} ${bb.w} ${bb.h}`);
    svg.innerHTML = defs() + '<g id="f"></g>';
    const g = svg.querySelector('#f'); let k = 0;
    const tick = () => { g.innerHTML = frame(chain, k, 'form'); k++; timer = setTimeout(k < states.length ? tick : () => { timer = setTimeout(next, REST); }, k < states.length ? STEP : 0); };
    tick();
  }
  next();
})();
