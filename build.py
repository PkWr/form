#!/usr/bin/env python3
"""Build the About page, the Changelog page and the version label from the vault notes.

The notes in the vault are the master. about.html (between its markers),
changelog.html and the version label in index.html are generated: edit the
notes, then run this script. Usage: python3 build.py [--check]
--check shows what would change and writes nothing (exit 1 if anything differs).
"""
import difflib, html, os, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
VAULT = pathlib.Path(os.environ.get("FORM_VAULT", pathlib.Path.home() / "Vaults/2026-PkWr/40 Projects/Form"))
ROMAN = r"(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)"


def read_note(name):
    t = (VAULT / name).read_text(encoding="utf-8")
    t = re.sub(r"\A---\n.*?\n---\n", "", t, flags=re.S)   # frontmatter
    return re.sub(r"<!--.*?-->", "", t, flags=re.S)          # notes to self


def inline(t):
    t = html.escape(t, quote=False)
    t = re.sub(r"\*([^*]+)\*", r"<em>\1</em>", t)
    return re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', t)


def blocks(text):
    """Yield (kind, value): h1, h2, p, li, rule."""
    para = []
    def flush():
        if para:
            yield ("p", " ".join(para)); para.clear()
    for line in text.splitlines():
        s = line.strip()
        if not s:
            yield from flush(); continue
        if s == "---":
            yield from flush(); yield ("rule", ""); continue
        if s.startswith("## "):
            yield from flush(); yield ("h2", s[3:]); continue
        if s.startswith("# "):
            yield from flush(); yield ("h1", s[2:]); continue
        if s.startswith("- "):
            yield from flush(); yield ("li", s[2:]); continue
        para.append(s)
    yield from flush()


def render(text, back=True):
    out, in_ul, foot = [], False, False
    if back:
        out.append('  <p><a href="./">← Form</a></p>')
    def close_ul():
        nonlocal in_ul
        if in_ul:
            out.append("  </ul>"); in_ul = False
    for kind, val in blocks(text):
        if kind != "li":
            close_ul()
        if kind == "h1":
            out.append(f"  <h1>{inline(val)}</h1>")
        elif kind == "h2":
            out.append(""); out.append(f"  <h2>{inline(val)}</h2>")
        elif kind == "rule":
            foot = True; out.append("")
        elif kind == "p":
            cls = ' class="foot"' if foot else ""
            out.append(f"  <p{cls}>{inline(val)}</p>")
        elif kind == "li":
            m = re.match(rf"({ROMAN})\.\s+(.*)", val)
            if m:
                out.append(f'  <p class="s"><span class="n">{m.group(1)}</span>{inline(m.group(2))}</p>')
            else:
                if not in_ul:
                    out.append("  <ul>"); in_ul = True
                out.append(f"    <li>{inline(val)}</li>")
    close_ul()
    return "\n".join(out)


def changelog_entries(text):
    ents = re.findall(r"^## (v\d+(?:\.\d+)*) \((\d{4}-\d{2}-\d{2})\)\s*$", text, flags=re.M)
    if not ents:
        sys.exit("Changelog.md: no entry headings like '## v0.1 (2026-10-31)'")
    vs = [e[0] for e in ents]; ds = [e[1] for e in ents]
    if len(set(vs)) != len(vs):
        sys.exit("Changelog.md: duplicate version")
    if ds != sorted(ds, reverse=True):
        sys.exit("Changelog.md: entries must be newest first")
    return ents


def changelog_body(text):
    # The public page shows additions only. Bullets tagged [fix], [amend] or [gone] stay in the vault note but are left off, and a version with nothing left is left off too.
    head, *secs = re.split(r"(?m)^(?=## v\d)", text)
    keep = []
    for sec in secs:
        lines = [l for l in sec.split("\n") if not re.match(r"^- \[(fix|amend|gone)\]", l, re.I)]
        if any(l.startswith("- ") for l in lines):
            keep.append("\n".join(lines).rstrip() + "\n\n")
    text = head + "".join(keep)
    # headings 'v0.1 (2026-10-31)' show as 'v0.1, 2026-10-31'
    return re.sub(r"^## (v\d+(?:\.\d+)*) \((\d{4}-\d{2}-\d{2})\)\s*$", r"## \1, \2", text, flags=re.M)


def between(src, a, b, new, name):
    pat = re.compile(re.escape(a) + r".*?" + re.escape(b), re.S)
    if not pat.search(src):
        sys.exit(f"{name}: markers {a} ... {b} not found")
    return pat.sub(lambda m: a + new + b, src, count=1)


def main():
    check = "--check" in sys.argv
    about = read_note("About Form.md"); chlog = read_note("Changelog.md")
    version = changelog_entries(chlog)[0][0]
    A0 = "<!-- about:start (generated from the vault note 'About Form' by build.py; do not edit) -->"
    A1 = "<!-- about:end -->"
    page_a = (HERE / "about.html").read_text(encoding="utf-8")
    new_a = between(page_a, A0, A1, "\n" + render(about) + "\n", "about.html")
    head = page_a.split('<body class="page">')[0].replace("<title>About Form</title>", "<title>Changelog</title>")
    new_c = (head.replace("<!doctype html>\n", "<!doctype html>\n<!-- Generated from the vault note 'Changelog' by build.py. Do not edit. -->\n", 1)
             + '<body class="page">\n<main class="about">\n' + render(changelog_body(chlog))
             + '\n  <p class="foot"><a href="about.html">About</a></p>\n</main>\n</body>\n</html>\n')
    page_i = (HERE / "index.html").read_text(encoding="utf-8")
    new_i = between(page_i, "<!-- version:start -->", "<!-- version:end -->", version, "index.html")
    # Browsers keep old copies of the stylesheet and scripts; tying them to the version makes every release load together.
    new_i = re.sub(r'(style\.css|glyphs\.js|app\.js|book\.js|gif\.js|preview\.js|start\.js)(\?v=[^"]*)?"', lambda m: m.group(1) + "?v=" + version + '"', new_i)
    page_d = (HERE / "demo.html").read_text(encoding="utf-8")
    new_d = re.sub(r'(app\.js)(\?v=[^"]*)?"', lambda m: m.group(1) + "?v=" + version + '"', page_d)
    new_d = re.sub(r'(demo\.js)(\?v=[^"]*)?"', lambda m: m.group(1) + "?v=" + version + '"', new_d)
    changed = False
    for name, old, new in (("demo.html", page_d, new_d), ("about.html", page_a, new_a),
                           ("changelog.html", (HERE / "changelog.html").read_text(encoding="utf-8") if (HERE / "changelog.html").exists() else "", new_c),
                           ("index.html", page_i, new_i)):
        if old == new:
            continue
        changed = True
        if check:
            sys.stdout.writelines(difflib.unified_diff(old.splitlines(True), new.splitlines(True), name + " (now)", name + " (built)"))
        else:
            (HERE / name).write_text(new, encoding="utf-8"); print("wrote", name)
    print(f"version {version}; " + ("differences found" if changed and check else "up to date" if not changed else "done"))
    sys.exit(1 if (check and changed) else 0)


main()
