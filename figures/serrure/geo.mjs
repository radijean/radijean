// Geometry of the pin-tumbler lock. Everything lives inside makeGeo so the same
// source runs in the Node build and, inlined as text, in the page.
export function makeGeo(k, G, P) {
  // ---------- model (world units ≈ 1 px; x along the lock, z up) ----------
  const Zc = 34; // axis of the plug (rotor)
  const R = 10; // plug radius: the shear line is the plug surface, w = R
  const HR = 15; // housing body radius
  const TW = 6; // half width of the tower
  const HX = 60; // housing length (x from 0 to HX)
  const NOSE = 63; // plug face
  const TT = Zc + 36; // tower top
  const CH = Zc + 33; // chamber ceiling
  const PX = [12, 21, 30, 39, 48]; // pin stacks
  const PR = 2.2; // pin radius
  const CR = 2.6; // chamber radius
  const DL = 8; // driver pin length
  const KW = { top: 3.5, bot: -6.5, depth: 1.4, x0: 3 }; // keyway slot in the plug
  const KT = 1.2; // half thickness of the key
  const REST = -3; // where a key pin falls with no key under it
  const GOOD = [-2.5, 1, -1, 2, -0.5]; // bitting of the right key (height of each cut)
  const BAD = [-1, 1, 1.5, 2, -2.5]; // a key cut for another lock
  const PIN = GOOD.map((cut) => R - cut); // key pin lengths: cut + length = shear line
  const TOL = 0.25; // a pin top within this of the shear line clears it
  const OUT = 62; // key travel when withdrawn
  const BASE = { x: -16, y: -34, w: 206, d: 70, r: 6 };
  const CAR0 = 96; // carriage left edge at full insertion

  // ---------- small helpers ----------
  const V = G.viewOf(P);
  const L = G.lightOf(P);
  const at = (p) => k.iso(p, P);
  const pth = (pts, closed = false) => k.pathOf(pts.map(at), closed);
  const dot = G.dot3;
  const area = (poly) => poly.reduce((sum, [x, y], i) => { const [x1, y1] = poly[(i + 1) % poly.length]; return sum + x * y1 - x1 * y; }, 0) / 2;
  const ccw = (poly) => (area(poly) < 0 ? [...poly].reverse() : poly);
  const S = (paths, style) => k.solidSvg(paths, style);
  const Ln = (d, style) => k.lineSvg(d, style);
  let uid = 0;
  const clipOf = (paths) => { const id = `lk${uid++}`; return { id, def: `<clipPath id="${id}">${paths.map((d) => `<path d="${d}"/>`).join("")}</clipPath>` }; };

  // Sutherland–Hodgman against one half plane f(p) <= 0 (f linear).
  function keep(poly, f) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const fa = f(a), fb = f(b);
      if (fa <= 0) out.push(a);
      if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    return out.length > 2 && Math.abs(area(out)) > 0.05 ? out : [];
  }

  // A prism of any simple polygon (convex or not) in the frame's u, v plane, extruded along F.a.
  // Faces are painted back to front, each with its own edges, so a concave outline hides correctly.
  function prismAny(F, polygon, s0, s1, { tone = "mid", crease = "faint", lit = false, inner = "", cut = null } = {}) {
    if (!polygon.length) return "";
    const ring = ccw(polygon);
    const n = ring.length;
    const P3 = (s, [x, y]) => [F.o[0] + F.a[0] * s + F.u[0] * x + F.v[0] * y, F.o[1] + F.a[1] * s + F.u[1] * x + F.v[1] * y, F.o[2] + F.a[2] * s + F.u[2] * x + F.v[2] * y];
    const lo = ring.map((p) => P3(s0, p));
    const hi = ring.map((p) => P3(s1, p));
    const normals = ring.map(([x0, y0], j) => { const [x1, y1] = ring[(j + 1) % n]; return G.unit3(G.add3(G.mul3(F.u, y1 - y0), G.mul3(F.v, -(x1 - x0)))); });
    // edges lying on a cut line (where a piece was split off) are neither drawn nor outlined
    const cutEdge = ring.map((p, j) => Boolean(cut && cut(p) && cut(ring[(j + 1) % n])));
    const seen = normals.map((nm, j) => cutEdge[j] || dot(nm, V) > 1e-6);
    const caps = [{ pts: lo, nm: G.mul3(F.a, -1) }, { pts: hi, nm: F.a }].map((c) => ({ ...c, seen: dot(c.nm, V) > 1e-6 }));
    const sharp = (j) => { const p = (j - 1 + n) % n; const a = [ring[j][0] - ring[p][0], ring[j][1] - ring[p][1]]; const b = [ring[(j + 1) % n][0] - ring[j][0], ring[(j + 1) % n][1] - ring[j][1]]; return (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b) || 1) < Math.cos(0.35); };
    const faces = [];
    for (let j = 0; j < n; j++) {
      if (!seen[j] || cutEdge[j]) continue;
      const j1 = (j + 1) % n;
      const quad = [lo[j], lo[j1], hi[j1], hi[j]];
      const mid = G.mul3(quad.reduce((s, p) => G.add3(s, p), [0, 0, 0]), 0.25);
      const edges = [];
      caps.forEach((c) => { if (!c.seen) edges.push([c.pts[j], c.pts[j1], "edge"]); });
      const prev = (j - 1 + n) % n;
      if (!seen[prev]) edges.push([lo[j], hi[j], "edge"]);
      if (!seen[j1]) edges.push([lo[j1], hi[j1], "edge"]);
      else if (sharp(j1)) edges.push([lo[j1], hi[j1], "crease"]);
      if (seen[prev] && sharp(j)) edges.push([lo[j], hi[j], "crease"]);
      faces.push({ quad, band: G.bandOf(dot(normals[j], L)), depth: dot(mid, V), edges });
    }
    faces.sort((a, b) => a.depth - b.depth);
    const out = [];
    const shade = (band, d) => (band >= 4 ? `<path class="iso-top" d="${d}"/>` : `<path class="iso-shade" data-shade="${band}" d="${d}"/>`);
    const edgeSvg = (list) => {
      const e = list.filter(([, , kind]) => kind === "edge").map(([a, b]) => pth([a, b])).join("");
      const c = list.filter(([, , kind]) => kind === "crease").map(([a, b]) => pth([a, b])).join("");
      return (c && crease !== "none" ? `<path class="iso-line iso-crease" data-tone="${crease}" d="${c}"/>` : "") + (e ? `<path class="iso-line iso-edge" data-tone="${tone}" d="${e}"/>` : "");
    };
    for (const f of faces) {
      const d = pth(f.quad, true);
      out.push(`<path class="iso-fill" d="${d}"/>`, shade(f.band, d), edgeSvg(f.edges));
    }
    for (const c of caps) {
      if (!c.seen) continue;
      const d = pth(c.pts, true);
      const list = [];
      for (let j = 0; j < n; j++) if (!cutEdge[j]) list.push([c.pts[j], c.pts[(j + 1) % n], seen[j] ? "crease" : "edge"]);
      out.push(`<path class="iso-fill" d="${d}"/>`, shade(G.bandOf(dot(c.nm, L)), d), inner, edgeSvg(list));
    }
    return `<g class="iso-solid" data-seamless=""${lit ? ' data-lit=""' : ""}>${out.join("")}</g>`;
  }

  // The visible inside of a cavity cut into a face: walls given as quads with inward normals,
  // clipped to the opening (a polygon in the face plane), on a dark ground, with the rim drawn.
  function cavity(opening, walls, { rim = "lo", open = -1 } = {}) {
    const clip = clipOf([pth(opening, true)]);
    const vis = walls
      .filter((w) => dot(w.nm, V) > 1e-6)
      .map((w) => ({ ...w, depth: dot(G.mul3(w.quad.reduce((s, p) => G.add3(s, p), [0, 0, 0]), 1 / w.quad.length), V) }))
      .sort((a, b) => a.depth - b.depth)
      .map((w) => { const d = pth(w.quad, true); const b = G.bandOf(dot(w.nm, L)); return b >= 4 ? `<path class="iso-top" d="${d}"/>` : `<path class="iso-shade" data-shade="${b}" d="${d}"/>`; });
    return `${clip.def}<g class="lk-cav" clip-path="url(#${clip.id})"><path class="iso-shade" data-shade="0" d="${pth(opening, true)}"/><g class="iso-solid" data-seamless="">${vis.join("")}</g></g>` + (rim ? Ln(open < 0 ? pth(opening, true) : pth([...opening.slice(open + 1), ...opening.slice(0, open + 1)]), { tone: rim }) : "");
  }

  // Half-cylinder groove: axis o + A s, opening in the plane spanned by A and B, cut into -N.
  function groove(o, A, B, N, r, s0, s1, steps = 14) {
    const pt = (phi, s) => G.add3(G.add3(o, G.mul3(A, s)), G.add3(G.mul3(B, r * Math.cos(phi)), G.mul3(N, -r * Math.sin(phi))));
    const walls = [];
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI, b = ((i + 1) / steps) * Math.PI, m = (a + b) / 2;
      walls.push({ quad: [pt(a, s0), pt(b, s0), pt(b, s1), pt(a, s1)], nm: G.mul3(G.add3(G.mul3(B, Math.cos(m)), G.mul3(N, -Math.sin(m))), -1) });
    }
    return { opening: [pt(0, s0), pt(0, s1), pt(Math.PI, s1), pt(Math.PI, s0)], walls };
  }

  // ---------- the plug frame ----------
  // tau turns the plug away from the viewer: its cut face rolls up and back.
  const frame = (tau) => ({ up: [0, -Math.sin(tau), Math.cos(tau)], nv: [0, Math.cos(tau), Math.sin(tau)] });
  const plugPt = (tau, x, n, w) => { const { up, nv } = frame(tau); return [x, n * nv[1] + w * up[1], Zc + n * nv[2] + w * up[2]]; };
  const yOf = (tau, n, w) => { const { up, nv } = frame(tau); return n * nv[1] + w * up[1]; };
  const halfDisc = (r, steps = 40) => Array.from({ length: steps + 1 }, (_, i) => { const a = Math.PI / 2 + (i / steps) * Math.PI; return [r * Math.cos(a), r * Math.sin(a)]; });

  // ---------- the key ----------
  const keyTop = (cuts, X) => {
    let w = Math.min(3, -4 + (X - 5) * 2);
    cuts.forEach((c, i) => { w = Math.min(w, c + Math.max(0, Math.abs(X - PX[i]) - 0.8)); });
    return w;
  };
  // Key outline in (x, w) at full insertion; shift by the travel o.
  function keyOutline(cuts, o) {
    const top = [];
    for (let X = 5; X <= 63.001; X += 0.5) top.push([X, keyTop(cuts, X)]);
    const bow = [];
    const cx = 80, rb = 12.5, a0 = Math.asin(6 / rb);
    for (let i = 0; i <= 40; i++) { const a = Math.PI - a0 - (i / 40) * (2 * Math.PI - 2 * a0); bow.push([cx + rb * Math.cos(a), rb * Math.sin(a)]); }
    const pts = [[5, -4], ...top, [63, 6], [cx - Math.sqrt(rb * rb - 36), 6], ...bow.slice(1, -1), [cx - Math.sqrt(rb * rb - 36), -6], [63.5, -6], [6.5, -6]];
    return pts.map(([x, w]) => [x + o, w]);
  }

  // ---------- pins ----------
  function pinState(cuts, o, inKey) {
    return PX.map((x, i) => {
      const X = x - o;
      const bottom = inKey && X >= 5 ? Math.max(REST, keyTop(cuts, X)) : REST;
      return bottom;
    });
  }
  const aligned = (bottoms) => bottoms.map((b, i) => Math.abs(b + PIN[i] - R) <= TOL);

  // ---------- static art ----------
  const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
  function base() {
    const out = [`<path class="iso-halo" d="${k.haloOf(BASE, -15, 10, P)}"/>`];
    for (const [x, y] of byDepth(k.corners(BASE, 14))) {
      out.push(S(k.cylinder(x, y, 6.4, -15, 1.6, P, 28), { tone: "lo" }));
      out.push(S(k.cylinder(x, y, 5, -13.4, 3.4, P, 28), { tone: "mid" }));
    }
    out.push(S(k.slabOf(BASE, -10, 10, P, 8, 1.4), { tone: "mid" }));
    out.push(Ln(k.planOutline(k.insetPlan(BASE, 4.5), 0, P), { tone: "lo" }));
    const screws = k.corners(BASE, 8.5);
    out.push(Ln(screws.map(([x, y]) => k.ring(x, y, 2, 0, P, 16)).join(""), { tone: "lo" }));
    out.push(k.dotsSvg(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
    // ruler under the key travel: 0 at full insertion
    const strip = { x: CAR0 - 4, y: 22, w: 84, d: 7, r: 1 };
    out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
    const t = k.topTicks(strip.x + 4 + 0, strip.x + 4 + 72, 3, 5, strip.y + 0.8, 0.6, [1.8, 3.4], P);
    out.push(Ln(t.minor, { tone: "lo" }), Ln(t.major, { tone: "mid" }));
    out.push(k.dotsSvg([at([strip.x + 1.6, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 1.6, strip.y + 3.5, 0.6])], { size: 0.45 }));
    // label plate
    const label = { x: -10, y: 16, w: 46, d: 12, r: 1.2 };
    out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "mid", crease: "none" }));
    out.push(Ln(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 4), { tone: "faint" }));
    out.push(k.faceTextSvg(k.topMatrix([label.x + 4, label.y + 5.6], 0.8, P, "x"), "5 GOUPILLES", { size: 2.6, tone: "mid" }));
    out.push(Ln(k.lineOnTop([label.x + 4, label.y + 8.4], [label.x + 30, label.y + 8.4], 0.8, P), { tone: "lo", free: true }));
    out.push(Ln(k.lineOnTop([label.x + 4, label.y + 10], [label.x + 22, label.y + 10], 0.8, P), { tone: "lo", free: true }));
    out.push(k.dotsSvg([at([label.x + label.w - 3, label.y + 3, 0.8]), at([label.x + label.w - 3, label.y + label.d - 3, 0.8])], { size: 0.45 }));
    return out.join("");
  }

  function rails() {
    const out = [];
    for (const y of [-14, 10]) {
      out.push(S(k.slabOf({ x: 88, y, w: 96, d: 4, r: 1 }, 0, 3, P, 3, 0.4), { tone: "mid" }));
      out.push(k.dotsSvg([92, 136, 180].map((x) => at([x, y + 2, 3])), { size: 0.4 }));
    }
    for (const x of [83, 184]) {
      out.push(S(k.slabOf({ x, y: -17, w: 5, d: 34, r: 1.2 }, 0, 7, P, 3, 0.5), { tone: "mid" }));
      out.push(k.dotsSvg([at([x + 2.5, -13, 7]), at([x + 2.5, 13, 7])], { size: 0.45 }));
    }
    return out.join("");
  }

  // Cradles under the housing: their tops follow the housing's round body.
  function cradles() {
    const out = [];
    const top = Array.from({ length: 17 }, (_, i) => { const a = -Math.PI + (i / 16) * (Math.PI / 2); return [HR * Math.cos(a), Zc + HR * Math.sin(a)]; });
    // section in (y, z): cut face, floor, back, shoulder, then the arc the housing rests in
    const sec = [[0, 0], [-21, 0], [-21, Zc], ...top];
    for (const x0 of [6, 42]) {
      const F = G.frameOf([x0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
      out.push(`<path class="iso-halo" d="${k.haloOf({ x: x0 - 1, y: -22, w: 14, d: 23, r: 2 }, 0, 0.1, P)}" style="filter:blur(3px)"/>`);
      out.push(prismAny(F, sec, 0, 12, { tone: "mid" }));
      out.push(k.dotsSvg([at([x0 + 3, -19, Zc]), at([x0 + 9, -19, Zc])], { size: 0.45 }));
    }
    return out.join("");
  }

  // Housing (stator) cut flush on the plane y = 0.
  const HOUSING = (() => {
    const j = Math.sqrt(HR * HR - TW * TW);
    const arc = [];
    const a0 = Math.atan2(j, -TW); // angle of the tower joint
    const a1 = -Math.PI / 2; // bottom, on the cut face
    for (let i = 0; i <= 40; i++) { const a = a0 + (i / 40) * (a1 + 2 * Math.PI - a0); arc.push([HR * Math.cos(a), HR * Math.sin(a)]); }
    return [[0, TT - Zc], [-TW, TT - Zc], ...arc, [0, -HR]];
  })();
  const FX = G.frameOf([0, 0, Zc], [1, 0, 0], [0, 1, 0], [0, 0, 1]);

  // opening of the bore on the cut face, and on the end face
  const boreFace = [[0, 0, Zc - R], [HX, 0, Zc - R], [HX, 0, Zc + R], [0, 0, Zc + R]];
  const boreEnd = halfDisc(R).map(([n, w]) => [HX, n, Zc + w]);
  const chamberOf = (x) => groove([x, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0], CR, Zc + R, CH);

  function housing() {
    const out = [];
    // ticks round the bore on the end face: 0° and 90°
    const ticks = [];
    for (let i = 0; i <= 18; i++) {
      const a = -(i / 18) * (Math.PI / 2); // from straight up, turning back (-y)
      const len = i % 9 === 0 ? 2.6 : 1.4;
      const c = Math.cos(Math.PI / 2 + a), s = Math.sin(Math.PI / 2 + a);
      // n along -y side only: these lie on the half that exists (y <= 0)
      ticks.push(pth([[HX, (R + 1.2) * -Math.abs(c), Zc + (R + 1.2) * s], [HX, (R + 1.2 + len) * -Math.abs(c), Zc + (R + 1.2 + len) * s]]));
    }
    const endRing = halfDisc(R + 1.2, 40).map(([n, w]) => [HX, n, Zc + w]);
    const inner = Ln(pth(endRing), { tone: "faint" }) + Ln(ticks.filter((_, i) => i % 9).join(""), { tone: "lo" }) + Ln(ticks.filter((_, i) => i % 9 === 0).join(""), { tone: "mid" });
    out.push(prismAny(FX, HOUSING, 0, HX, { tone: "mid", inner }));
    // seam where the tower meets the round body, on the cut face: none (one piece). Chambers:
    for (const x of PX) { const c = chamberOf(x); out.push(cavity(c.opening, c.walls)); }
    // cap strip over the chambers
    const strip = { x: 4, y: -TW + 0.6, w: 52, d: TW - 0.6, r: 0.8 };
    out.push(S(k.slabOf(strip, TT, 1.4, P, 3, 0.3), { tone: "mid" }));
    out.push(k.dotsSvg(PX.map((x) => at([x, -TW / 2 + 0.3, TT + 1.4])), { size: 0.5 }));
    out.push(k.dotsSvg([at([8, -TW / 2 + 0.3, TT + 1.4]), at([52, -TW / 2 + 0.3, TT + 1.4])], { size: 0.35, tone: "lo" }));
    return out.join("");
  }

  // shear line on the cut face: lit, broken at each chamber
  function shearLine() {
    const xs = [0, ...PX.flatMap((x) => [x - CR, x + CR]), HX];
    const segs = [];
    for (let i = 0; i < xs.length; i += 2) segs.push(pth([[xs[i], 0, Zc + R], [xs[i + 1], 0, Zc + R]]));
    return `<path class="iso-line" data-tone="lit" d="${segs.join("")}" style="stroke-width:1"/>`;
  }

  // ---------- dynamic art ----------
  function spring(x, z0, z1, r = 1.9, turns = 7) {
    const back = [], front = [];
    const N = turns * 24;
    let run = [], runFront = null;
    const flush = () => { if (run.length > 1) (runFront ? front : back).push(k.pathOf(run, false)); run = []; };
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * turns * 2 * Math.PI;
      const zz = z0 + 0.5 + ((z1 - z0 - 1) * i) / N;
      const p = [x + r * Math.cos(t), r * Math.sin(t), zz];
      const facing = Math.cos(t) * V[0] + Math.sin(t) * V[1] > 0;
      if (runFront !== null && facing !== runFront) { const last = run[run.length - 1]; flush(); run.push(last); }
      runFront = facing;
      run.push(at(p));
    }
    flush();
    return { back: back.join(""), front: front.join("") };
  }

  function keyPin(tau, i, bottom) {
    const F = G.frameOf(plugPt(tau, PX[i], 0, bottom), frame(tau).up, [1, 0, 0], frame(tau).nv);
    const len = PIN[i];
    return S(G.solidOf([[0, 0.5], [1.6, PR], [len - 0.3, PR], [len, PR - 0.3]], F, P, { steps: 28 }), { tone: "hi", crease: "lo" });
  }
  function driver(i, z) {
    const F = G.frameOf([PX[i], 0, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    return S(G.solidOf([[0, PR - 0.35], [0.35, PR], [DL - 0.35, PR], [DL, PR - 0.35]], F, P, { steps: 28 }), { tone: "mid" });
  }

  // key pieces: x <= HX inside the housing, split by w at 0 (behind / in front of the cut plane once turned)
  function keyPieces(cuts, o, tau, split) {
    const outline = keyOutline(cuts, o);
    const { nv, up } = frame(tau);
    const F = G.frameOf([0, 0, Zc], nv, [1, 0, 0], up);
    const inside = keep(outline, ([x]) => x - HX);
    const outside = keep(outline, ([x]) => HX - x);
    const onX = ([x]) => Math.abs(x - HX) < 1e-6;
    const onW = ([, w]) => Math.abs(w) < 1e-6;
    const style = { tone: "hi", crease: "lo" };
    const pieces = split ? [keep(inside, ([, w]) => -w), keep(inside, ([, w]) => w)] : [inside, []];
    return {
      upper: prismAny(F, pieces[0], -KT, KT, { ...style, cut: (p) => onX(p) || onW(p) }),
      lower: prismAny(F, pieces[1], -KT, KT, { ...style, cut: (p) => onX(p) || onW(p) }),
      outside: prismAny(F, outside, -KT, KT, {
        ...style,
        cut: onX,
        inner:
          Ln(pth(Array.from({ length: 41 }, (_, i) => { const a = (i / 40) * 2 * Math.PI; return plugPt(tau, 85 + o + 3.4 * Math.cos(a), KT, 3.4 * Math.sin(a)); }), true), { tone: "lo" }),
      }),
    };
  }

  // carriage, pillow block, spindle, knob and the fork that holds the key bow
  function driverRig(o, tau) {
    const out = [];
    const x0 = CAR0 + o;
    const { nv, up } = frame(tau);
    // carriage on the rails
    const car = { x: x0, y: -17, w: 26, d: 32, r: 2.5 };
    out.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(car, 2), 3, 0.1, P)}" style="filter:blur(3px)"/>`);
    for (const [x, y] of byDepth([[x0 + 4, -12], [x0 + 22, -12], [x0 + 4, 12], [x0 + 22, 12]])) out.push(S(k.slabOf({ x: x - 3, y: y - 3, w: 6, d: 6, r: 1 }, 3, 3, P, 3, 0.3), { tone: "mid" }));
    out.push(S(k.slabOf(car, 6, 4, P, 5, 0.6), { tone: "mid" }));
    out.push(k.dotsSvg([x0 + 3, x0 + 23].flatMap((x) => [at([x, -14, 10]), at([x, 12, 10])]), { size: 0.45 }));
    // pointer reaching over the ruler
    out.push(S(k.slabOf({ x: x0 + 1, y: 15, w: 4, d: 9.5, r: 0.8 }, 7, 1.2, P, 2, 0.2), { tone: "mid" }));
    out.push(Ln(k.lineOnTop([x0 + 3, 15], [x0 + 3, 24.5], 8.2, P), { tone: "hi" }));
    // pillow block
    const blk = { x: x0 + 6, y: -9, w: 12, d: 18, r: 1.5 };
    out.push(S(k.slabOf(blk, 10, Zc - 10 + 4, P, 4, 0.6), { tone: "mid", inner: Ln(k.sideSeam(blk, 16, P, 4), { tone: "faint" }) }));
    const FB = G.frameAlong([x0 + 6, 0, Zc], [1, 0, 0]);
    out.push(S(G.ringBand(12, 12.6, 4.2, 7.2, FB, P), { tone: "mid" }));
    out.push(k.dotsSvg([at([x0 + 9, -6, Zc + 4]), at([x0 + 15, -6, Zc + 4]), at([x0 + 9, 6, Zc + 4]), at([x0 + 15, 6, Zc + 4])], { size: 0.45 }));
    // fork cheeks gripping the bow (behind the bow is hidden; the near cheek covers its end)
    const FK = G.frameOf([0, 0, Zc], nv, [1, 0, 0], up);
    const cheek = [[87 + o, -8], [97 + o, -8], [99 + o, -6], [99 + o, 6], [97 + o, 8], [87 + o, 8], [86 + o, 6], [86 + o, -6]];
    const backCheek = prismAny(FK, cheek, -KT - 2, -KT, { tone: "mid" });
    const frontCheek = prismAny(FK, cheek, KT, KT + 2, { tone: "mid", inner: Ln(pth(Array.from({ length: 25 }, (_, i) => { const a = (i / 24) * 2 * Math.PI; return plugPt(tau, 92.5 + o + 1.6 * Math.cos(a), KT + 2, 1.6 * Math.sin(a)); }), true), { tone: "lo" }) });
    const hub = S(G.disc(99 + o, x0 + 6 - 0.01, 4.6, G.frameAlong([0, 0, Zc], [1, 0, 0]), P), { tone: "mid" });
    // spindle out of the block, knob with knurl turning with the key
    const FS = G.frameOf([0, 0, Zc], [1, 0, 0], nv, up);
    const spindle = S(G.disc(x0 + 18, x0 + 22, 3.4, FS, P), { tone: "mid" });
    const knob = S(G.disc(x0 + 22, x0 + 30, 7, FS, P, {}), {
      tone: "mid",
      inner: Ln(G.ribsOf(FS, x0 + 22.6, x0 + 29.4, 7, 36, P, { phase: -tau, least: 0.15 }), { tone: "lo" }) + Ln(G.arcOf(FS, x0 + 22.6, 7, P), { tone: "faint" }) + Ln(G.arcOf(FS, x0 + 29.4, 7, P), { tone: "faint" }),
    });
    const flag = Ln(pth([plugPt(tau, x0 + 30, 0, 0), plugPt(tau, x0 + 30, 0, 7)]), { tone: "hi" });
    const flagDot = k.dotsSvg([at(plugPt(tau, x0 + 30, 0, 0))], { size: 0.6, tone: "hi" });
    return { car: out.join(""), backCheek, frontCheek, hub, spindle, knob: knob + flag + flagDot };
  }

  // The whole moving layer for a state.
  function dynamic({ cuts, o, tau, bottoms, drivers }) {
    uid = 500;
    const out = [];
    const { nv, up } = frame(tau);
    const FP = G.frameOf([0, 0, Zc], [1, 0, 0], nv, up);
    const half = halfDisc(R);
    const back = keep(half, ([n, w]) => yOf(tau, n, w));
    const front = keep(half, ([n, w]) => -yOf(tau, n, w));
    const behind = clipOf([pth(boreFace, true), pth(boreEnd, true)]);
    const ins = [];
    // bore, seen only once the plug has turned
    if (tau > 0.004) {
      const bore = groove([0, 0, Zc], [1, 0, 0], [0, 0, 1], [0, 1, 0], R, 0, HX, 36);
      ins.push(`<g class="lk-cav">${bore.walls.filter((w) => dot(w.nm, V) > 0).map((w) => { const b = G.bandOf(dot(w.nm, L)); const d = pth(w.quad, true); return `<path class="iso-shade" data-shade="${Math.min(3, b)}" d="${d}"/>`; }).join("")}</g>`);
    }
    ins.push(prismAny(FP, back, 0, HX, { tone: "mid", crease: "faint" }));
    // cut face details on the plug: keyway (upper half) and the pin holes
    const P3 = (x, n, w) => plugPt(tau, x, n, w);
    const slot = (w0, w1, x1) => {
      const opening = [P3(KW.x0, 0, w0), P3(x1, 0, w0), P3(x1, 0, w1), P3(KW.x0, 0, w1)];
      const d = -KW.depth;
      const walls = [
        { quad: [P3(KW.x0, d, w0), P3(x1, d, w0), P3(x1, d, w1), P3(KW.x0, d, w1)], nm: nv },
        { quad: [P3(KW.x0, 0, w1), P3(x1, 0, w1), P3(x1, d, w1), P3(KW.x0, d, w1)], nm: G.mul3(up, w1 === KW.top ? -1 : 1) },
        { quad: [P3(KW.x0, 0, w0), P3(x1, 0, w0), P3(x1, d, w0), P3(KW.x0, d, w0)], nm: G.mul3(up, w0 === KW.bot ? 1 : -1) },
        { quad: [P3(KW.x0, 0, w0), P3(KW.x0, d, w0), P3(KW.x0, d, w1), P3(KW.x0, 0, w1)], nm: [1, 0, 0] },
      ].filter((_, i) => !((i === 1 && w1 === 0) || (i === 2 && w0 === 0)));
      return cavity(opening, walls, { rim: "lo", open: w0 === 0 ? 0 : w1 === 0 ? 2 : -1 });
    };
    const turned = tau > 0.004;
    ins.push(turned ? slot(0, KW.top, HX) : slot(KW.bot, KW.top, HX));
    PX.forEach((x) => { const h = groove(P3(x, 0, 0), up, [1, 0, 0], nv, CR, KW.top, R); ins.push(cavity(h.opening, h.walls)); });
    const key = cuts ? keyPieces(cuts, o, tau, turned) : null;
    // at rest the key and its pins stand in front of the face (and of the shear line); once turned they lie behind it
    const pins = [];
    if (key) pins.push(key.upper);
    bottoms.forEach((b, i) => pins.push(keyPin(tau, i, b)));
    const again = clipOf([pth(boreFace, true), pth(boreEnd, true)]);
    if (turned) out.push(`${behind.def}<g clip-path="url(#${behind.id})">${ins.join("")}${pins.join("")}</g>`, shearLine());
    else out.push(`${behind.def}<g clip-path="url(#${behind.id})">${ins.join("")}</g>`, shearLine(), `${again.def}<g clip-path="url(#${again.id})">${pins.join("")}</g>`);
    // springs and driver pins in the chambers (they never turn)
    drivers.forEach((z, i) => {
      const sp = spring(PX[i], z + DL, CH);
      const ch = chamberOf(PX[i]);
      const c = clipOf([pth(ch.opening, true)]);
      out.push(`${c.def}<g clip-path="url(#${c.id})">${Ln(sp.back, { tone: "lo" })}</g>`);
      out.push(driver(i, z));
      out.push(`<g style="stroke-width:.8">${Ln(sp.front, { tone: "mid" })}</g>`);
    });
    // what has turned toward us: the lower front of the plug, the lower keyway, the key's lower edge
    if (turned) {
      out.push(prismAny(FP, front, 0, HX, { tone: "mid", crease: "faint" }));
      out.push(slot(KW.bot, 0, HX));
      if (key) out.push(key.lower);
    }
    // the nose of the plug in front of the housing, with the keyway mouth
    const noseInner = cavityMouth(tau);
    out.push(prismAny(FP, half, HX, NOSE, { tone: "mid", crease: "faint", inner: noseInner }));
    const rig = driverRig(o, tau);
    out.push(rig.car);
    out.push(rig.backCheek);
    if (key) out.push(key.outside);
    out.push(rig.frontCheek, rig.hub, rig.spindle, rig.knob);
    return out.join("");
  }

  // keyway mouth on the nose face (the plug's end at x = NOSE), plus the turning index mark
  function cavityMouth(tau) {
    const P3 = (n, w) => plugPt(tau, NOSE, n, w);
    const mouth = [P3(0, KW.bot), P3(-KW.depth, KW.bot), P3(-KW.depth, KW.top), P3(0, KW.top)];
    return `<path class="iso-shade lk-mouth" data-shade="0" d="${pth(mouth, true)}"/>` + Ln(pth(mouth, true), { tone: "lo" }) + Ln(pth([P3(-2.6, R - 0.6), P3(-2.6, R - 3.4)]), { tone: "hi" });
  }

  // Live state from the model: travel o (0 = fully in), turn tau.
  function stateOf(cuts, o, tau) {
    const bottoms = pinState(cuts, o, Boolean(cuts));
    const drivers = bottoms.map((b, i) => (tau > 0.004 ? Zc + R : Zc + b + PIN[i]));
    return { cuts, o, tau, bottoms, drivers };
  }

  const extremes = [...k.boxCorners(BASE, -15, 0), [0, -TW, TT + 2], [HX, 0, TT + 2], [CAR0 + OUT + 30, 0, Zc + 8], [CAR0 + OUT + 30, 0, Zc - 8]];

  return { Zc, R, PX, PIN, GOOD, BAD, OUT, TOL, CH, DL, keyTop, pinState, aligned, stateOf, dynamic, base, rails, cradles, housing, extremes };
}
