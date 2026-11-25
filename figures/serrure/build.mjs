import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const SKILL = "../../.claude/skills/anatomy";
const k = await import(`${SKILL}/kit/iso-kit.mjs`);
const G = await import(`${SKILL}/kit/lathe.mjs`);
const { kitScript } = await import(`${SKILL}/scripts/inline-kit.mjs`);
import { makeGeo } from "./geo.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const WIDTH = 640;
const HEIGHT = 300;
const AZ = 60;

const probe = makeGeo(k, G, { origin: [0, 0], scale: 1, azimuth: AZ, elevation: 30 });
const P = k.fitProjection(probe.extremes, WIDTH, HEIGHT, { pad: 20, azimuth: AZ });
const GEO = makeGeo(k, G, P);

const start = GEO.stateOf(GEO.GOOD, 0, 0);
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Une serrure à goupilles coupée en deux sur un banc. Dans le stator, cinq ressorts poussent cinq contre-goupilles sur cinq goupilles posées dans le rotor. Un chariot enfonce une clé dans le rotor : la bonne clé soulève chaque goupille jusqu'à la ligne de cisaillement et le rotor peut tourner ; la mauvaise laisse des goupilles en travers de la ligne et le rotor reste bloqué.",
  body: [GEO.base(), GEO.rails(), GEO.cradles(), GEO.housing(), `<g data-part="moving">${GEO.dynamic(start)}</g>`],
});

const CSS = `<style>
.lk-cav{--anatomy-shade-0:#070707;--anatomy-shade-1:#0a0a0a;--anatomy-shade-2:#0c0c0c;--anatomy-shade-3:#0f0f0f;--anatomy-top:#111111}
.lk-mouth{fill:#070707}
.iso[data-theme="light"] .lk-cav{--anatomy-shade-0:#c2c2be;--anatomy-shade-1:#cbcbc7;--anatomy-shade-2:#d3d3cf;--anatomy-shade-3:#dbdbd7;--anatomy-top:#e2e2de}
.iso[data-theme="light"] .lk-mouth{fill:#c2c2be}
.iso-stage{cursor:ew-resize;outline:none}
.iso-stage:focus-visible{box-shadow:0 0 0 2px var(--anatomy-mid);border-radius:6px}
</style>`;

const exportsOf = (file) => [...readFileSync(join(HERE, SKILL, "kit", file), "utf8").matchAll(/^export (?:function|const|let) ([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
const latheSource = readFileSync(join(HERE, SKILL, "kit", "lathe.mjs"), "utf8").replace(/^import .*$/m, "").replace(/^export /gm, "");

const live = `
const k = { ${exportsOf("iso-kit.mjs").join(", ")} };
const G = (() => {
${latheSource}
return { ${exportsOf("lathe.mjs").join(", ")} };
})();
const makeGeo = ${makeGeo.toString()};
const P = ${JSON.stringify(P)};
const GEO = makeGeo(k, G, P);
const KEYS = { good: GEO.GOOD, bad: GEO.BAD };
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const layer = svg.querySelector('[data-part="moving"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const QUARTER = Math.PI / 2;

let key = "good", o = 0, tau = 0, drop = GEO.pinState(KEYS.good, 0, true);
let wantKey = "good", wantO = 0, dwell = 0;
let touring = !still.matches, clock = 0, step = 0, idle = 0, frame = 0, last = 0, visible = false, sig = "";

// idle tour: the wrong key goes in and sticks, comes out; the right key goes in and turns
const TOUR = [
  { key: "bad", o: GEO.OUT, t: 0.6 },
  { key: "bad", o: 0, t: 3.0 },
  { key: "bad", o: 0, t: 1.6 },
  { key: "bad", o: GEO.OUT, t: 2.2 },
  { key: "good", o: GEO.OUT, t: 0.6 },
  { key: "good", o: 0, t: 3.0 },
  { key: "good", o: 0, t: 3.4 },
  { key: "good", o: GEO.OUT, t: 2.4 },
];

function say() {
  const st = GEO.stateOf(KEYS[key], o, tau);
  const ok = GEO.aligned(st.bottoms).filter(Boolean).length;
  const inPct = Math.round((1 - o / GEO.OUT) * 100);
  let tail;
  if (tau > 0.01) tail = "rotor " + Math.round((tau * 180) / Math.PI) + "°";
  else if (o < 0.05) tail = ok === 5 ? "rotor libre" : "rotor bloqué";
  else tail = "rotor bloqué";
  const text = (key === "good" ? "bonne clé" : "mauvaise clé") + " · " + inPct + " % · " + ok + "/5 à la ligne · " + tail;
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(inPct));
  stage.setAttribute("aria-valuetext", text);
}

function draw() {
  const st = GEO.stateOf(KEYS[key], o, tau);
  st.bottoms = st.bottoms.map((b, i) => Math.max(b, drop[i]));
  if (tau <= 0.004) st.drivers = st.bottoms.map((b, i) => GEO.Zc + b + GEO.PIN[i]);
  const next = key + o.toFixed(2) + tau.toFixed(3) + st.bottoms.map((b) => b.toFixed(2)).join();
  if (next !== sig) { sig = next; layer.innerHTML = GEO.dynamic(st); }
  say();
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) {
    clock += dt;
    if (clock > TOUR[step].t) { clock = 0; step = (step + 1) % TOUR.length; }
    wantKey = TOUR[step].key; wantO = TOUR[step].o;
  }
  // a different key only goes on once this one is out
  let targetO = wantKey !== key ? GEO.OUT : wantO;
  if (wantKey !== key && o > GEO.OUT - 0.05) { key = wantKey; drop = GEO.pinState(KEYS[key], o, true); }
  // a turned plug holds the key: turn back before it can move
  const fullIn = o < 0.05;
  const open = fullIn && GEO.aligned(GEO.pinState(KEYS[key], 0, true)).every(Boolean);
  dwell = open && targetO < 0.05 ? dwell + dt : 0;
  const tauTarget = open && targetO < 0.05 && dwell > 0.5 ? QUARTER : 0;
  tau = calm ? tauTarget : tau + (tauTarget - tau) * (1 - Math.exp(-dt / 0.38));
  if (Math.abs(tauTarget - tau) < 0.002) tau = tauTarget;
  if (tau < 0.004) {
    const stepO = clamp((targetO - o) * (1 - Math.exp(-dt / 0.22)), -34 * dt, 34 * dt);
    const next = calm ? targetO : o + stepO;
    o = Math.abs(targetO - next) < 0.02 ? targetO : next;
  }
  // pins ride up the key at once and fall back under their springs
  const want = GEO.pinState(KEYS[key], o, true);
  drop = drop.map((d, i) => (want[i] >= d ? want[i] : calm ? want[i] : d + (want[i] - d) * (1 - Math.exp(-dt / 0.05))));
  draw();
  const settled = !touring && (dwell === 0 || tau === QUARTER) && tau === tauTarget && o === targetO && key === wantKey && drop.every((d, i) => Math.abs(d - want[i]) < 0.01);
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const hold = () => { touring = false; clearTimeout(idle); idle = setTimeout(() => { touring = !still.matches; clock = 0; step = 0; run(); }, 6000); run(); };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  const share = clamp(((event.clientX - box.left) / box.width - 0.42) / 0.4, 0, 1);
  wantO = share * GEO.OUT; hold();
});
stage.addEventListener("click", () => { wantKey = wantKey === "good" ? "bad" : "good"; hold(); });
stage.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") wantO = clamp(wantO - 6, 0, GEO.OUT);
  else if (event.key === "ArrowRight") wantO = clamp(wantO + 6, 0, GEO.OUT);
  else if (event.key === "Home") wantO = 0;
  else if (event.key === "End") wantO = GEO.OUT;
  else if (event.key === " " || event.key === "Enter") wantKey = wantKey === "good" ? "bad" : "good";
  else return;
  event.preventDefault(); hold();
});
if (still.matches) touring = false;
draw();
`;

const body =
  CSS +
  k.plateHtml({
    fig: "Fig 1",
    title: "Serrure à goupilles",
    hint: "Survol : clé · clic : autre clé",
    readout: "bonne clé · 100 % · 5/5 à la ligne · rotor libre",
    keys: [
      { mark: "lit", label: "Ligne de cisaillement : la frontière entre le rotor et le stator" },
      { mark: "raised", label: "Goupilles (dans le rotor) et contre-goupilles (dans le stator, sous leurs ressorts)" },
    ],
    caption:
      "Coupe d'un cylindre à cinq goupilles. Chaque goupille a la longueur qui complète une entaille de la bonne clé : enfoncée à fond, la clé met le haut des cinq goupilles exactement sur la ligne de cisaillement, et le rotor tourne en emportant goupilles et clé tandis que les contre-goupilles restent dans le stator. La mauvaise clé, entaillée pour une autre serrure, n'en aligne que deux sur cinq : les autres restent à cheval sur la ligne et bloquent le rotor.",
    body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Serrure à goupilles : flèches pour enfoncer ou retirer la clé, Espace pour changer de clé" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100">${svg}</div>`,
  });

const name = theme === "light" ? "serrure-light.html" : "serrure.html";
writeFileSync(join(HERE, name), k.pageHtml({ title: "Serrure à goupilles", theme, body, script: kitScript() + live }).replace('<html lang="en">', '<html lang="fr">'));
console.log("wrote", name);
