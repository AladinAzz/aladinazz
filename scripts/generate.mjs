// Generates solar-system.svg for a GitHub profile README.
// Sun = the user, planets = most used languages (closest = most used),
// comets = the 5 most recently pushed repos.
//
// Usage:
//   GITHUB_TOKEN=... node scripts/generate.mjs [out.svg]
//   node scripts/generate.mjs out.svg --sample      (offline test data)

import { writeFileSync } from "node:fs";

const USER = process.env.GITHUB_USER || "AladinAzz";
const TOKEN = process.env.GITHUB_TOKEN;
const OUT = process.argv.find((a, i) => i >= 2 && !a.startsWith("--")) || "solar-system.svg";
const SAMPLE = process.argv.includes("--sample");
const INCLUDE_FORKS = process.env.INCLUDE_FORKS === "true";

const W = 900, H = 460, CX = W / 2, CY = H / 2;
const N_COMETS = 5, N_PLANETS = 5;

const LANG_COLORS = {
  JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572A5", "C#": "#178600",
  "C++": "#f34b7d", C: "#8a8a8a", Java: "#b07219", HTML: "#e34c26", CSS: "#7a5bbf",
  Shell: "#89e051", Go: "#00ADD8", Rust: "#dea584", Lua: "#51a0cf", GLSL: "#5686a5",
  ShaderLab: "#5f7a99", HLSL: "#aace60", "Jupyter Notebook": "#DA5B0B", Dart: "#00B4AB",
  Kotlin: "#A97BFF", PHP: "#8892bf", Ruby: "#cc342d", Swift: "#F05138", Vue: "#41b883",
  SCSS: "#c6538c", PowerShell: "#5391d1", Batchfile: "#C1F12E", Makefile: "#6fa83a",
};

// ---------- data ----------

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "solar-system-readme",
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status} on ${path}`);
  return res.json();
}

async function loadData() {
  if (SAMPLE) {
    const now = Date.now();
    const h = 3600e3;
    return {
      repos: [
        { name: "OpenRA-LLM-Bridge", pushed: now - 3 * h },
        { name: "algeria-news-map", pushed: now - 30 * h },
        { name: "imr-research-assistant", pushed: now - 4 * 24 * h },
        { name: "unity-gis-terrain", pushed: now - 12 * 24 * h },
        { name: "pos", pushed: now - 40 * 24 * h },
      ],
      langs: { Python: 420000, "C#": 310000, TypeScript: 150000, JavaScript: 90000, HLSL: 30000, Shell: 9000 },
    };
  }
  const all = await gh(`/users/${USER}/repos?type=owner&sort=pushed&direction=desc&per_page=100`);
  const own = all.filter((r) => r.name.toLowerCase() !== USER.toLowerCase() && (INCLUDE_FORKS || !r.fork) && !r.archived);
  const repos = own.slice(0, N_COMETS).map((r) => ({ name: r.name, pushed: Date.parse(r.pushed_at) }));

  const langs = {};
  for (const r of own) {
    try {
      const l = await gh(`/repos/${USER}/${r.name}/languages`);
      for (const [k, v] of Object.entries(l)) langs[k] = (langs[k] || 0) + v;
    } catch (e) {
      console.warn(`languages skipped for ${r.name}: ${e.message}`);
    }
  }
  return { repos, langs };
}

// ---------- helpers ----------

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
const f = (n) => Number(n.toFixed(2));
const rad = (d) => (d * Math.PI) / 180;

function ago(ms) {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 14) return `${Math.round(s / 86400)}d ago`;
  if (s < 86400 * 70) return `${Math.round(s / 86400 / 7)}w ago`;
  return `${Math.round(s / 86400 / 30)}mo ago`;
}

function colorFor(lang) {
  let c = LANG_COLORS[lang];
  if (!c) {
    let h = 0;
    for (const ch of lang) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return `hsl(${h} 65% 62%)`;
  }
  return c;
}

// deterministic pseudo random so the picture is stable between runs
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

// closed ellipse path (two arcs). center (cx,cy), radii, rotation in degrees
function ellipsePath(cx, cy, rx, ry, rotDeg) {
  const t = rad(rotDeg);
  const dx = rx * Math.cos(t), dy = rx * Math.sin(t);
  const p1 = [cx + dx, cy + dy], p2 = [cx - dx, cy - dy];
  return `M${f(p1[0])},${f(p1[1])} A${f(rx)},${f(ry)} ${rotDeg} 1 1 ${f(p2[0])},${f(p2[1])} A${f(rx)},${f(ry)} ${rotDeg} 1 1 ${f(p1[0])},${f(p1[1])} Z`;
}

// ---------- scene ----------

function stars() {
  const r = rng(42);
  let out = "";
  for (let i = 0; i < 90; i++) {
    const x = f(r() * W), y = f(r() * H), s = f(0.4 + r() * 1.1);
    const dur = f(2 + r() * 4), begin = f(-r() * 6);
    out += `<circle cx="${x}" cy="${y}" r="${s}" fill="#fff" opacity="0.5"><animate attributeName="opacity" values="0.15;0.9;0.15" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/></circle>`;
  }
  return out;
}

function planets(langs) {
  const entries = Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, N_PLANETS);
  if (!entries.length) return { svg: "", orbits: "" };
  const total = Object.values(langs).reduce((a, b) => a + b, 0);
  const max = entries[0][1];
  let orbits = "", svg = "";
  entries.forEach(([name, bytes], i) => {
    const rx = 112 + i * 54, ry = rx * 0.42, tilt = -8;
    const pct = Math.round((bytes / total) * 100);
    const r = f(3 + 19 * Math.sqrt(bytes / max)); // area ~ share of code
    const dur = f(26 + i * 14);
    const begin = f(-dur * [0.05, 0.42, 0.7, 0.2, 0.88][i]);
    const path = ellipsePath(CX, CY, rx, ry, tilt);
    const color = colorFor(name);
    orbits += `<path d="${path}" fill="none" stroke="#8b9bb4" stroke-opacity="0.22" stroke-width="0.8" stroke-dasharray="2 4"/>`;
    svg += `<g><g><circle r="${r + 3}" fill="${color}" opacity="0.18"/><circle r="${r}" fill="${color}"/></g>
<text y="${f(r + 12)}" text-anchor="middle" class="pl">${esc(name)} ${pct}%</text>
<animateMotion dur="${dur}s" begin="${begin}s" repeatCount="indefinite" path="${path}"/></g>`;
  });
  return { svg, orbits };
}

function comets(repos) {
  // each comet crosses the whole canvas on a straight line, left to right
  const lines = [[70, 300], [390, 120], [150, 250], [310, 70], [225, 410]];
  const cols = ["#9be7ff", "#b6f0c8", "#ffd9a0", "#f2b6ff", "#a9c4ff"];
  let svg = "";
  repos.slice(0, N_COMETS).forEach((repo, i) => {
    const [y0, y1] = lines[i % lines.length];
    const path = `M${-90},${y0} L${W + 90},${y1}`;
    const dur = f(20 + i * 3);
    const begin = f(-(i * 5.5 + 3));
    const col = cols[i % cols.length];
    const name = repo.name.length > 22 ? repo.name.slice(0, 21) + "…" : repo.name;
    // fly for 85% of the cycle, then wait off-screen so comets don't arrive in a stream
    const kp = `calcMode="linear" keyPoints="0;1;1" keyTimes="0;0.85;1"`;
    svg += `<path d="M0,${y0} L${W},${y1}" fill="none" stroke="${col}" stroke-opacity="0.08" stroke-width="0.8" stroke-dasharray="1 5"/>
<g>
  <path d="M0,-2.6 L-90,0 L0,2.6 Z" fill="url(#tail${i})"/>
  <circle r="7" fill="${col}" opacity="0.25"/><circle r="3.4" fill="#fff"/>
  <animateMotion dur="${dur}s" begin="${begin}s" repeatCount="indefinite" rotate="auto" ${kp} path="${path}"/>
</g>
<g>
  <text y="-13" text-anchor="middle" class="cm">${esc(name)}</text>
  <text y="-3.5" text-anchor="middle" class="ct">${esc(ago(repo.pushed))}</text>
  <animateMotion dur="${dur}s" begin="${begin}s" repeatCount="indefinite" ${kp} path="${path}"/>
</g>`;
  });
  const defs = repos.slice(0, N_COMETS).map((_, i) => `<linearGradient id="tail${i}" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="${cols[i % cols.length]}" stop-opacity="0.95"/><stop offset="1" stop-color="${cols[i % cols.length]}" stop-opacity="0"/></linearGradient>`).join("");
  return { svg, defs };
}

function build({ repos, langs }) {
  const p = planets(langs);
  const c = comets(repos);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Solar system: planets are ${esc(USER)}'s top languages, comets are the latest pushed repositories">
<defs>
  <radialGradient id="bg" cx="50%" cy="50%" r="75%"><stop offset="0" stop-color="#101a33"/><stop offset="1" stop-color="#05070f"/></radialGradient>
  <radialGradient id="sun" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#fff2b0"/><stop offset="0.6" stop-color="#ffb531"/><stop offset="1" stop-color="#ff7a18"/></radialGradient>
  <radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffb531" stop-opacity="0.45"/><stop offset="1" stop-color="#ffb531" stop-opacity="0"/></radialGradient>
  ${c.defs}
  <style>
    text{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace}
    .pl{font-size:10px;fill:#c9d1d9;opacity:.85}
    .cm{font-size:11px;font-weight:600;fill:#fff}
    .ct{font-size:9px;fill:#9fb0c8}
    .sn{font-size:11px;font-weight:700;fill:#3b1d00}
  </style>
</defs>
<rect width="${W}" height="${H}" rx="10" fill="url(#bg)"/>
${stars()}
${p.orbits}
<circle cx="${CX}" cy="${CY}" r="78" fill="url(#glow)"><animate attributeName="r" values="70;86;70" dur="6s" repeatCount="indefinite"/></circle>
<circle cx="${CX}" cy="${CY}" r="36" fill="url(#sun)"/>
<text x="${CX}" y="${CY + 4}" text-anchor="middle" class="sn">${esc(USER)}</text>
${p.svg}
${c.svg}
</svg>
`;
}

const data = await loadData();
if (!data.repos.length) throw new Error("No repositories found");
writeFileSync(OUT, build(data));
console.log(`wrote ${OUT}: ${data.repos.length} comets, ${Object.keys(data.langs).length} languages seen`);
