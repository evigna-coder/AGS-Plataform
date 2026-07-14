"""Mapa de módulos interactivo a partir del knowledge graph de Graphify.

Agrega los ~18k nodos de graphify-out/graph.json a nivel módulo (carpeta por app)
y genera un HTML autocontenido con el mapa (zoom/pan, hover, filtro por app,
vista tabla) en .planning/graphs/graph-modulos.html.

Uso (desde la raíz del repo, después de /gsd:graphify build):
    python scripts/graph-modulos.py

Dependencias: pip install networkx scipy  (graphifyy ya trae networkx)
"""

import json
import math
import re
import subprocess
from collections import defaultdict
from pathlib import Path

import networkx as nx

ROOT = Path(__file__).resolve().parent.parent
GRAPH_JSON = ROOT / "graphify-out" / "graph.json"
OUT_DIR = ROOT / ".planning" / "graphs"

# Paleta categórica validada (skill dataviz — CVD y contraste OK; los WARN de
# contraste en claro se cubren con labels directos + vista tabla).
APPS = [
    ("sistema-modular", "sistema-modular", "#2a78d6", "#3987e5"),
    ("reportes-ot", "reportes-ot", "#1baf7a", "#199e70"),
    ("portal-ingeniero", "portal-ingeniero", "#eda100", "#c98500"),
    ("shared", "packages/shared", "#008300", "#008300"),
    ("infra", "infra / docs", "#4a3aa7", "#9085e9"),
]

MIN_GROUP = 12  # grupos con menos entidades caen en "<app>:otros"
LABEL_MIN_ENTITIES = 60  # umbral para label siempre visible en el mapa


def group_of(src: str):
    """Mapea un source file a (app, grupo). None = excluir del mapa."""
    if not src:
        return None
    p = src.replace("\\", "/")
    if p.startswith((".claude/", ".planning/", "gsd-")) or "/node_modules/" in p:
        return None

    if p.startswith("packages/shared"):
        return ("shared", "shared")

    m = re.match(r"apps/(sistema-modular|portal-ingeniero)/src/([^/]+)(?:/([^/]+))?", p)
    if m:
        app, top, sub = m.groups()
        short = "SM" if app == "sistema-modular" else "PI"
        if top in ("pages", "components") and sub and "." not in sub:
            return (app, f"{short}:{top}/{sub}")
        if "." in top:  # archivo directo bajo src/ (App.tsx, main.tsx)
            return (app, f"{short}:src")
        return (app, f"{short}:{top}")

    m = re.match(r"apps/reportes-ot/([^/]+)(?:/([^/]+))?", p)
    if m:
        top, sub = m.groups()
        if top in ("components", "pages") and sub and "." not in sub:
            return ("reportes-ot", f"RO:{top}/{sub}")
        if "." in top:
            return ("reportes-ot", "RO:root")
        return ("reportes-ot", f"RO:{top}")

    m = re.match(r"apps/(sistema-modular|portal-ingeniero|reportes-ot)/([^/]+)", p)
    if m:  # archivos de app fuera de src (electron/, functions/, config)
        app, top = m.groups()
        short = {"sistema-modular": "SM", "portal-ingeniero": "PI", "reportes-ot": "RO"}[app]
        return (app, f"{short}:root" if "." in top else f"{short}:{top}")

    if p.startswith("functions/"):
        return ("infra", "functions")
    if p.startswith("scripts/"):
        return ("infra", "scripts")
    top = p.split("/")[0]
    return ("infra", "root" if "." in top else top)


def aggregate():
    graph = json.loads(GRAPH_JSON.read_text(encoding="utf-8"))
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", graph.get("links", []))
    print(f"raw: {len(nodes)} nodos, {len(edges)} edges")

    node_group = {}
    raw_groups = defaultdict(lambda: {"count": 0, "files": set(), "app": None})
    for n in nodes:
        g = group_of(n.get("source_file", ""))
        if not g:
            continue
        app, label = g
        node_group[n.get("id")] = label
        gm = raw_groups[label]
        gm["count"] += 1
        gm["files"].add(n.get("source_file"))
        gm["app"] = app

    final_label = {
        label: (f"{label.split(':')[0]}:otros" if ":" in label else "infra:otros")
        if gm["count"] < MIN_GROUP and label != "shared"
        else label
        for label, gm in raw_groups.items()
    }

    groups = defaultdict(lambda: {"count": 0, "files": set(), "app": None})
    for label, gm in raw_groups.items():
        fl = final_label[label]
        groups[fl]["count"] += gm["count"]
        groups[fl]["files"] |= gm["files"]
        groups[fl]["app"] = groups[fl]["app"] or gm["app"]

    gedges = defaultdict(int)
    for e in edges:
        gs, gt = node_group.get(e.get("source")), node_group.get(e.get("target"))
        if not gs or not gt:
            continue
        gs, gt = final_label[gs], final_label[gt]
        if gs != gt:
            gedges[tuple(sorted((gs, gt)))] += 1

    return groups, gedges


def disp_r(entities: int) -> float:
    """Radio en pantalla — debe coincidir con R() del HTML."""
    return max(6.0, min(42.0, math.sqrt(entities) * 1.35))


def layout(groups, gedges):
    G = nx.Graph()
    for label in groups:
        G.add_node(label)
    for (a, b), w in gedges.items():
        # distancia inversa al peso: módulos muy acoplados quedan cerca
        G.add_edge(a, b, dist=1.0 / math.log1p(w) + 0.35)

    main = max(nx.connected_components(G), key=len)
    dropped = sorted(set(G.nodes) - main)
    if dropped:
        print("aislados excluidos del mapa:", dropped)
    G = G.subgraph(main).copy()

    pos = nx.kamada_kawai_layout(G, weight="dist")

    # anti-solapamiento: separa círculos que colisionarían en pantalla
    labels = list(G.nodes)
    xs = [pos[l][0] for l in labels]
    ys = [pos[l][1] for l in labels]
    span_x, span_y = 1420.0, 1010.0
    P = {
        l: [
            (pos[l][0] - min(xs)) / (max(xs) - min(xs)) * span_x,
            (pos[l][1] - min(ys)) / (max(ys) - min(ys)) * span_y,
        ]
        for l in labels
    }
    for _ in range(400):
        moved = False
        for i, a in enumerate(labels):
            for b in labels[i + 1 :]:
                dx, dy = P[b][0] - P[a][0], P[b][1] - P[a][1]
                d = math.hypot(dx, dy) or 0.001
                mind = disp_r(groups[a]["count"]) + disp_r(groups[b]["count"]) + 26
                if d < mind:
                    push, ux, uy = (mind - d) / 2, dx / d, dy / d
                    P[a][0] -= ux * push
                    P[a][1] -= uy * push
                    P[b][0] += ux * push
                    P[b][1] += uy * push
                    moved = True
        if not moved:
            break

    xs = [P[l][0] for l in labels]
    ys = [P[l][1] for l in labels]
    return {
        l: (
            (P[l][0] - min(xs)) / (max(xs) - min(xs)),
            (P[l][1] - min(ys)) / (max(ys) - min(ys)),
        )
        for l in labels
    }


HTML_TEMPLATE = r"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AGS Plataform — mapa de módulos</title>
<style>
  :root {
    --surface: #fcfcfb; --panel: #ffffff; --text-1: #1c1c1a; --text-2: #5f5e57;
    --grid: #e8e7e2; --edge: #cfcec8; --ring: #fcfcfb; --border: #dddcd6;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --surface: #1a1a19; --panel: #222220; --text-1: #ffffff; --text-2: #c3c2b7;
      --grid: #33332f; --edge: #44443f; --ring: #1a1a19; --border: #3a3a35;
    }
  }
  * { box-sizing: border-box; margin: 0; }
  body { background: var(--surface); color: var(--text-1);
         font: 14px/1.5 Inter, system-ui, sans-serif; padding: 20px; }
  h1 { font-size: 18px; font-weight: 650; }
  .sub { color: var(--text-2); font-size: 12.5px; margin: 4px 0 14px; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
  .chip { display: inline-flex; align-items: center; gap: 7px; padding: 5px 12px;
          border: 1px solid var(--border); border-radius: 999px; background: var(--panel);
          cursor: pointer; font-size: 12.5px; color: var(--text-1); user-select: none; }
  .chip .dot { width: 10px; height: 10px; border-radius: 50%; }
  .chip.off { opacity: .38; }
  #wrap { border: 1px solid var(--border); border-radius: 10px; background: var(--panel);
          overflow: hidden; position: relative; }
  svg { display: block; width: 100%; height: 74vh; cursor: grab; }
  svg:active { cursor: grabbing; }
  .edge { stroke: var(--edge); fill: none; }
  .node circle { stroke: var(--ring); stroke-width: 2px; }
  .node text { fill: var(--text-1); font-size: 11px; paint-order: stroke;
               stroke: var(--panel); stroke-width: 3px; stroke-linejoin: round; pointer-events: none; }
  .dim { opacity: .12; }
  #tip { position: absolute; pointer-events: none; background: var(--panel);
         border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px;
         font-size: 12px; max-width: 300px; box-shadow: 0 4px 14px rgba(0,0,0,.12);
         display: none; z-index: 5; }
  #tip b { font-size: 12.5px; }
  #tip .muted { color: var(--text-2); }
  #tip ul { margin: 6px 0 0; padding-left: 16px; }
  .hint { color: var(--text-2); font-size: 12px; margin-top: 8px; }
  details { margin-top: 18px; }
  summary { cursor: pointer; color: var(--text-2); font-size: 13px; }
  table { border-collapse: collapse; margin-top: 10px; font-size: 12.5px; width: 100%; max-width: 760px; }
  th, td { text-align: left; padding: 5px 12px 5px 0; border-bottom: 1px solid var(--grid); }
  th { color: var(--text-2); font-weight: 600; font-size: 11px; text-transform: uppercase;
       letter-spacing: .04em; }
  td.num, th.num { text-align: right; }
  .swatch { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 7px; }
</style>
</head>
<body>
<h1>AGS Plataform — mapa de módulos</h1>
<div class="sub">__SUBTITLE__</div>
<div class="chips" id="chips"></div>
<div id="wrap"><svg id="svg" viewBox="0 0 1600 1100"></svg><div id="tip"></div></div>
<div class="hint">Rueda para zoom, arrastrar para mover. Pasá el mouse por un módulo para ver sus conexiones. Click en las etiquetas de arriba filtra por app.</div>
<details><summary>Ver como tabla</summary><div id="tablebox"></div></details>
<script>
const DATA = __DATA__;
const APPS = __APPS__;
const LABEL_MIN = __LABEL_MIN__;
const dark = matchMedia('(prefers-color-scheme: dark)').matches;
const color = Object.fromEntries(APPS.map(a => [a.key, dark ? a.dark : a.light]));
const appName = Object.fromEntries(APPS.map(a => [a.key, a.name]));

const W = 1600, H = 1100, M = 90;
const xs = DATA.nodes.map(n => n.x), ys = DATA.nodes.map(n => n.y);
const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
const sx = v => M + (v - x0) / (x1 - x0) * (W - 2 * M);
const sy = v => M + (v - y0) / (y1 - y0) * (H - 2 * M);
const R = n => Math.max(6, Math.min(42, Math.sqrt(n.entities) * 1.35));

const byId = {}; DATA.nodes.forEach(n => byId[n.id] = n);
const neighbors = {}; DATA.nodes.forEach(n => neighbors[n.id] = []);
DATA.edges.forEach(e => { neighbors[e.s].push([e.t, e.w]); neighbors[e.t].push([e.s, e.w]); });
Object.values(neighbors).forEach(l => l.sort((a, b) => b[1] - a[1]));

const svg = document.getElementById('svg');
const NS = 'http://www.w3.org/2000/svg';
const root = document.createElementNS(NS, 'g'); svg.appendChild(root);
const edgeG = document.createElementNS(NS, 'g'); root.appendChild(edgeG);
const nodeG = document.createElementNS(NS, 'g'); root.appendChild(nodeG);

const maxW = Math.max(...DATA.edges.map(e => e.w));
const edgeEls = DATA.edges.map(e => {
  const l = document.createElementNS(NS, 'line');
  l.setAttribute('x1', sx(byId[e.s].x)); l.setAttribute('y1', sy(byId[e.s].y));
  l.setAttribute('x2', sx(byId[e.t].x)); l.setAttribute('y2', sy(byId[e.t].y));
  l.setAttribute('class', 'edge');
  l.setAttribute('stroke-width', (0.6 + 3.4 * Math.log1p(e.w) / Math.log1p(maxW)).toFixed(2));
  l.setAttribute('opacity', (0.25 + 0.5 * Math.log1p(e.w) / Math.log1p(maxW)).toFixed(2));
  edgeG.appendChild(l); return l;
});

const tip = document.getElementById('tip');
const nodeEls = DATA.nodes.map(n => {
  const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'node');
  const c = document.createElementNS(NS, 'circle');
  c.setAttribute('cx', sx(n.x)); c.setAttribute('cy', sy(n.y)); c.setAttribute('r', R(n));
  c.setAttribute('fill', color[n.app]);
  g.appendChild(c);
  const t = document.createElementNS(NS, 'text');
  t.setAttribute('x', sx(n.x)); t.setAttribute('y', sy(n.y) - R(n) - 5);
  t.setAttribute('text-anchor', 'middle'); t.textContent = n.id;
  if (n.entities < LABEL_MIN) t.setAttribute('display', 'none');
  g.appendChild(t);
  g.addEventListener('mousemove', ev => {
    const top = neighbors[n.id].slice(0, 6)
      .map(p => '<li>' + p[0] + ' <span class="muted">(' + p[1] + ')</span></li>').join('');
    tip.innerHTML = '<b>' + n.id + '</b><br><span class="muted">' + appName[n.app] + ' · ' +
      n.entities + ' entidades · ' + n.files + ' archivos</span>' +
      (top ? '<div class="muted" style="margin-top:6px">Más conectado con:</div><ul>' + top + '</ul>' : '');
    tip.style.display = 'block';
    const r = document.getElementById('wrap').getBoundingClientRect();
    tip.style.left = Math.min(ev.clientX - r.left + 14, r.width - 310) + 'px';
    tip.style.top = (ev.clientY - r.top + 14) + 'px';
    highlight(n.id);
  });
  g.addEventListener('mouseleave', () => { tip.style.display = 'none'; highlight(null); });
  nodeG.appendChild(g); return g;
});

function highlight(id) {
  const keep = id ? new Set([id].concat(neighbors[id].map(x => x[0]))) : null;
  DATA.nodes.forEach((n, i) => {
    nodeEls[i].classList.toggle('dim', !!keep && !keep.has(n.id));
    const t = nodeEls[i].querySelector('text');
    if (n.entities < LABEL_MIN) t.setAttribute('display', keep && keep.has(n.id) ? '' : 'none');
  });
  DATA.edges.forEach((e, i) =>
    edgeEls[i].classList.toggle('dim', !!keep && e.s !== id && e.t !== id));
}

const off = new Set();
function applyFilter() {
  DATA.nodes.forEach((n, i) => nodeEls[i].style.display = off.has(n.app) ? 'none' : '');
  DATA.edges.forEach((e, i) =>
    edgeEls[i].style.display = (off.has(byId[e.s].app) || off.has(byId[e.t].app)) ? 'none' : '');
}
const chips = document.getElementById('chips');
APPS.forEach(a => {
  const el = document.createElement('span');
  el.className = 'chip';
  el.innerHTML = '<span class="dot" style="background:' + (dark ? a.dark : a.light) + '"></span>' + a.name;
  el.onclick = () => { off.has(a.key) ? off.delete(a.key) : off.add(a.key);
                       el.classList.toggle('off'); applyFilter(); };
  chips.appendChild(el);
});

let vb = { x: 0, y: 0, w: W, h: H }, drag = null;
const setVB = () => svg.setAttribute('viewBox', vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + vb.h);
setVB();
svg.addEventListener('wheel', ev => {
  ev.preventDefault();
  const k = ev.deltaY > 0 ? 1.15 : 1 / 1.15;
  const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  vb = { x: p.x - (p.x - vb.x) * k, y: p.y - (p.y - vb.y) * k, w: vb.w * k, h: vb.h * k };
  setVB();
}, { passive: false });
svg.addEventListener('mousedown', ev => drag = { x: ev.clientX, y: ev.clientY, vb: Object.assign({}, vb) });
addEventListener('mousemove', ev => {
  if (!drag) return;
  const scale = vb.w / svg.getBoundingClientRect().width;
  vb.x = drag.vb.x - (ev.clientX - drag.x) * scale;
  vb.y = drag.vb.y - (ev.clientY - drag.y) * scale;
  setVB();
});
addEventListener('mouseup', () => drag = null);

const rows = DATA.nodes.slice().sort((a, b) => b.entities - a.entities).map(n =>
  '<tr><td><span class="swatch" style="background:' + color[n.app] + '"></span>' + n.id + '</td>' +
  '<td>' + appName[n.app] + '</td><td class="num">' + n.entities + '</td><td class="num">' + n.files + '</td>' +
  '<td class="num">' + neighbors[n.id].length + '</td></tr>').join('');
document.getElementById('tablebox').innerHTML =
  '<table><thead><tr><th>Módulo</th><th>App</th><th class="num">Entidades</th>' +
  '<th class="num">Archivos</th><th class="num">Conexiones</th></tr></thead><tbody>' + rows + '</tbody></table>';
</script>
</body>
</html>
"""


def main():
    if not GRAPH_JSON.exists():
        raise SystemExit(
            f"No existe {GRAPH_JSON}. Corré primero /gsd:graphify build "
            "(o `graphify update .` en la raíz)."
        )

    groups, gedges = aggregate()
    pos = layout(groups, gedges)

    data = {
        "nodes": [
            {
                "id": label,
                "app": gm["app"],
                "entities": gm["count"],
                "files": len(gm["files"]),
                "x": round(pos[label][0], 4),
                "y": round(pos[label][1], 4),
            }
            for label, gm in sorted(groups.items(), key=lambda kv: -kv[1]["count"])
            if label in pos
        ],
        "edges": [
            {"s": a, "t": b, "w": w}
            for (a, b), w in sorted(gedges.items(), key=lambda kv: -kv[1])
            if a in pos and b in pos
        ],
    }

    try:
        commit = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True, text=True, cwd=ROOT, check=True,
        ).stdout.strip()
    except Exception:
        commit = "?"

    total = sum(n["entities"] for n in data["nodes"])
    sub = (
        f"{len(data['nodes'])} módulos · {len(data['edges'])} conexiones — agregado de "
        f"{total:,} entidades del knowledge graph (commit {commit}). "
        f"Tamaño del círculo = entidades; grosor de línea = referencias cruzadas."
    )
    apps_js = json.dumps(
        [{"key": k, "name": n, "light": l, "dark": d} for k, n, l, d in APPS],
        ensure_ascii=False,
    )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "graph-modulos.json").write_text(
        json.dumps(data, ensure_ascii=False), encoding="utf-8"
    )
    html = (
        HTML_TEMPLATE.replace("__DATA__", json.dumps(data, ensure_ascii=False))
        .replace("__APPS__", apps_js)
        .replace("__LABEL_MIN__", str(LABEL_MIN_ENTITIES))
        .replace("__SUBTITLE__", sub)
    )
    out = OUT_DIR / "graph-modulos.html"
    out.write_text(html, encoding="utf-8")
    print(f"OK: {out} ({len(data['nodes'])} modulos, {len(data['edges'])} conexiones)")


if __name__ == "__main__":
    main()
