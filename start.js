// Start screen, as on Spot: a black screen with a round "open" button; the About drawer slides out from the right strip. Skipped when the address has a query (?...).
(function () {
  var root = document.documentElement;
  if (!root.classList.contains("show-start")) return;
  var drawer = document.getElementById("startDrawer"), strip = document.getElementById("startStrip");
  var link = document.querySelector(".cp-foot .hint a:last-of-type");
  if (link) document.getElementById("startVersion").textContent = link.textContent;
  function open() {
    if (!root.classList.contains("show-start")) return;
    root.classList.add("start-leaving");
    setTimeout(function () { root.classList.remove("show-start", "start-leaving"); }, 500);
  }
  document.getElementById("startOpen").addEventListener("click", open);
  function setAbout(on) { drawer.classList.toggle("is-open", on); strip.setAttribute("aria-expanded", String(on)); }
  // Phones fire a pretend rollover around a tap; ignore those so the tap decides.
  var lastTouch = 0, openedAt = 0;
  window.addEventListener("pointerdown", function (e) { if (e.pointerType !== "mouse") lastTouch = Date.now(); }, true);
  var touchy = function () { return Date.now() - lastTouch < 800; };
  strip.addEventListener("mouseenter", function () { if (!touchy() && !drawer.classList.contains("is-open")) { openedAt = Date.now(); setAbout(true); } });
  drawer.addEventListener("mouseleave", function () { if (!touchy()) setAbout(false); });
  document.getElementById("startOpen").addEventListener("mouseenter", function () { if (!touchy()) setAbout(false); });
  strip.addEventListener("click", function () { if (Date.now() - openedAt < 400) return; setAbout(!drawer.classList.contains("is-open")); });
  window.addEventListener("keydown", function (e) { if (e.key === "Escape") setAbout(false); });
  document.getElementById("startScreen").addEventListener("pointerdown", function (e) { if (!drawer.contains(e.target)) setAbout(false); });
  // Fill the drawer from about.html (the one copy of the About text).
  fetch("about.html").then(function (r) { return r.text(); }).then(function (html) {
    var main = new DOMParser().parseFromString(html, "text/html").querySelector("main");
    if (!main) return;
    main.querySelectorAll(".foot").forEach(function (n) { n.remove(); });
    main.querySelectorAll('a[href="./"]').forEach(function (n) { (n.parentNode.tagName === "P" ? n.parentNode : n).remove(); });
    var box = document.getElementById("startAboutContent");
    box.innerHTML = main.innerHTML;
    var h1 = box.querySelector("h1"), first = box.querySelector("h2 + p") || (h1 && h1.nextElementSibling);
    if (h1) h1.textContent = "Form";
    if (!first) return;
    // Phones: the panel covers the circle, so it carries its own way in: the first paragraph, an open circle and "More about Form", the rest unfolding below.
    box.classList.add("is-short");
    var circle = function () {
      var b = document.createElement("button");
      b.type = "button"; b.className = "sa-open"; b.textContent = "open";
      b.addEventListener("click", function () { setAbout(false); open(); });
      return b;
    };
    var more = document.createElement("button");
    more.type = "button"; more.className = "sa-more"; more.textContent = "More about Form \u2193";
    more.addEventListener("click", function () { box.classList.remove("is-short"); more.remove(); });
    var lead = document.createElement("div");
    lead.className = "sa-lead"; lead.appendChild(circle()); lead.appendChild(more);
    // The lead goes before the first heading (after the title, quote and one-line description), so the open circle is always on the first screen however long the Summary grows.
    var h2 = box.querySelector("h2"); if (h2) h2.before(lead); else first.after(lead);
    var tail = circle(); tail.classList.add("sa-open-end"); box.appendChild(tail);
  }).catch(function () { /* keeps the plain link to about.html */ });
  // First visit: the About panel slides out by itself, so the project is introduced before the circle.
  setTimeout(function () { if (root.classList.contains("show-start") && !drawer.classList.contains("is-open")) setAbout(true); }, 700);
  window.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === " ") && root.classList.contains("show-start") && e.target === document.body) { e.preventDefault(); open(); }
  });
})();
// The start loop: the demo's loop (a random symbol made up and unmade by a random rule, one step at a time, then the next), white on black, with no text. It borrows the engine
// in app.js, so the grid and the ink colour are set for the loop and put back when the screen is left.
(function () {
  var root = document.documentElement;
  if (!root.classList.contains("show-start")) return;
  var svg = document.getElementById("startLoop"); if (!svg || typeof ruleWays !== "function") return;
  var keepG = G, keepINK = INK, dead = false, last = "", timer = 0;
  var pick = function (a) { return a[Math.floor(Math.random() * a.length)]; }, MAKES = ["move", "change", "grow"];
  function round() {
    if (dead) return;
    G = 9; INK = "#ffffff"; // the whole symbol list fits a 9 grid
    var names = Object.keys(SYMBOLS).filter(function (n) { return n !== last; }), name = last = pick(names), rows = SYMBOLS[name];
    var ox = Math.floor((G - rows[0].length) / 2), oy = Math.floor((G - rows.length) / 2), cells = Array(G * G).fill(null), start = [];
    rows.forEach(function (row, y) { [].forEach.call(row, function (c, x) { if (c === "X") { cells[(oy + y) * G + ox + x] = { s: "square", r: 0, q: 0 }; start.push({ x: ox + x, y: oy + y, s: "square", r: 0, q: 0 }); } }); });
    var A = pick(MAKES), others = MAKES.filter(function (x) { return x !== A; }), B = pick(["unmake", others[0], others[1], null]), rules = B ? [A, B] : [A], per = pick([1, 2, 3, 0]);
    var code = patternCode(G, cells, rules, per), made = ruleWays(rules, start, false, false, rng(codeSeed(code)), per);
    if (!made || made.states.length < 2) return round();
    var states = made.states.map(function (s, id) { return Object.assign({}, s, { id: id, phase: id ? s.phase : "start" }); }), chain = { states: states, orig: states[0] }, bb = bbox(chain, "form");
    svg.setAttribute("viewBox", bb.x + " " + bb.y + " " + bb.w + " " + bb.h);
    svg.innerHTML = '<g id="startLoopG" fill="#fff"></g>';
    var g = svg.firstChild, n = states.length, step = Math.max(60, Math.min(220, 24000 / n)), k = 0;
    (function tick() {
      if (dead) return;
      g.innerHTML = frame(chain, k, "form"); k++;
      timer = setTimeout(k < n ? tick : function () { timer = setTimeout(round, 1400); }, k < n ? step : 0);
    })();
  }
  // Leaving the start screen stops the loop and gives the tool its grid and ink back.
  new MutationObserver(function () {
    if (!root.classList.contains("show-start")) { dead = true; clearTimeout(timer); G = keepG; INK = keepINK; svg.innerHTML = ""; this.disconnect(); }
  }).observe(root, { attributes: true, attributeFilter: ["class"] });
  svg.addEventListener("click", function () { document.getElementById("startOpen").click(); }); // the whole loop is the way in
  round();
})();
