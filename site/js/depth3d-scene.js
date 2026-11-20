// three.js scene for the depth view: a box from the surface down to the deepest event, coastlines and plate
// boundaries on the surface, hypocentres as screen-sized discs coloured by depth class, Slab2 depth contours, and
// HTML labels for the depth axis. Orbit with the mouse, touch or keyboard; renders on demand only.

import * as THREE from '../vendor/three-0.170.0/three.module.min.js';

const DEG = 111.195;
const U = 1 / 100; // scene unit = 100 km

const VERT = `
attribute float size;
attribute vec3 color;
varying vec3 vColor;
uniform float dpr;
void main() {
  vColor = color;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = size * dpr;
}`;
const FRAG = `
precision mediump float;
varying vec3 vColor;
uniform vec3 ring;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  if (r > 1.0) discard;
  vec3 col = r > 0.72 ? mix(vColor, ring, 0.55) : vColor;
  gl_FragColor = vec4(col, 1.0);
}`;

export function createScene(stage, canvas, { t }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
  const world = new THREE.Group();
  scene.add(world);
  const labels = document.createElement('div');
  labels.className = 'd3-labels';
  labels.setAttribute('aria-hidden', 'true');
  stage.append(labels);
  const tip = document.createElement('div');
  tip.className = 'tooltip d3-tip';
  tip.hidden = true;
  stage.append(tip);

  let data = null;
  let geo = null; // {W, D, H, lon0, lat0}
  let points = null; // {obj, xyz: Float32Array}
  let labelEls = [];
  const orbit = { az: -0.55, el: 0.42, dist: 10, target: new THREE.Vector3() };
  let home = null;
  let raf = 0;
  let surfCache = null; // {key: bbox, lines: Map(featureCollection -> positions)}
  let disposed = false;

  const requestRender = () => { if (!raf && !disposed) raf = requestAnimationFrame(render); };

  function toXZ(lon, lat) {
    return [(lon - geo.lon0) * DEG * Math.cos((geo.lat0 * Math.PI) / 180) * U, -(lat - geo.lat0) * DEG * U];
  }
  const Y = (depth) => -depth * data.ex * U;
  const col = (hex) => new THREE.Color(hex);

  function clear() {
    for (const o of [...world.children]) {
      world.remove(o);
      o.geometry?.dispose();
      o.material?.dispose();
    }
    labels.replaceChildren();
    labelEls = [];
  }

  function lineObj(pos, color, opacity = 1, dashed = false) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const m = dashed
      ? new THREE.LineDashedMaterial({ color, transparent: opacity < 1, opacity, dashSize: 0.12, gapSize: 0.08 })
      : new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
    const o = new THREE.LineSegments(g, m);
    if (dashed) o.computeLineDistances();
    return o;
  }

  function addLabel(text, cls, pos) {
    const el = document.createElement('span');
    el.className = `d3-label ${cls || ''}`;
    el.textContent = text;
    labels.append(el);
    labelEls.push({ el, pos });
    return el;
  }

  async function setData(d) {
    data = d;
    const [w, s, e, n] = d.bbox;
    geo = { lon0: (w + e) / 2, lat0: (s + n) / 2 };
    const [x0, z0] = toXZ(w, n), [x1, z1] = toXZ(e, s);
    geo.W = x1 - x0; geo.D = z1 - z0; geo.H = d.maxDepth * d.ex * U;
    geo.box = { x0, x1, z0, z1 };
    clear();
    const th = d.theme;

    // surface plane
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(geo.W, geo.D), new THREE.MeshBasicMaterial({ color: col(th.ocean), transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    plane.rotation.x = -Math.PI / 2;
    world.add(plane);

    // box frame: surface rectangle, bottom rectangle, vertical edges
    const yb = -geo.H;
    const corners = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    const frame = [];
    for (let i = 0; i < 4; i++) {
      const [a, b] = [corners[i], corners[(i + 1) % 4]];
      frame.push(a[0], 0, a[1], b[0], 0, b[1], a[0], yb, a[1], b[0], yb, b[1], a[0], 0, a[1], a[0], yb, a[1]);
    }
    world.add(lineObj(frame, col(th.ink3), 0.7));
    // depth ticks: rings around the box at each tick depth (faint), 70 km split dashed
    const rings = [];
    for (const dk of d.ticks) {
      if (dk === 0 || dk >= d.maxDepth) continue;
      const y = Y(dk);
      for (let i = 0; i < 4; i++) { const [a, b] = [corners[i], corners[(i + 1) % 4]]; rings.push(a[0], y, a[1], b[0], y, b[1]); }
    }
    if (rings.length) world.add(lineObj(rings, col(th.rule), 0.6));
    if (d.maxDepth > 70) {
      const y = Y(70), split = [];
      for (let i = 0; i < 4; i++) { const [a, b] = [corners[i], corners[(i + 1) % 4]]; split.push(a[0], y, a[1], b[0], y, b[1]); }
      world.add(lineObj(split, col(th.ink3), 0.9, true));
    }

    // depth labels on all four vertical edges; only the left-most edge is shown each frame
    geo.edges = corners.map(([x, z]) => ({
      mid: new THREE.Vector3(x, -geo.H / 2, z),
      els: [...d.ticks.filter((dk) => dk <= d.maxDepth).map((dk) => addLabel(`${dk}`, 'tick', new THREE.Vector3(x, Y(dk), z))),
        addLabel(t('d3.kmDepth'), 'unit', new THREE.Vector3(x, yb, z))],
    }));
    if (d.maxDepth > 70) geo.splitEl = addLabel(d.labels.split, 'split', new THREE.Vector3(x1, Y(70), z1));
    addLabel(d.labels.north, 'north', new THREE.Vector3((x0 + x1) / 2, 0, z0));

    // events
    const ev = d.events;
    const pos = new Float32Array(ev.n * 3), colr = new Float32Array(ev.n * 3), size = new Float32Array(ev.n);
    const cols = d.colors.map((c) => col(c));
    for (let i = 0; i < ev.n; i++) {
      const [x, z] = toXZ(ev.lon[i], ev.lat[i]);
      pos[3 * i] = x; pos[3 * i + 1] = Y(ev.depth[i]); pos[3 * i + 2] = z;
      const c = cols[d.depthClass(ev.depth[i])];
      colr[3 * i] = c.r; colr[3 * i + 1] = c.g; colr[3 * i + 2] = c.b;
      size[i] = Math.max(2.5, 2.5 + (ev.mag[i] - 5) * 2.6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colr, 3));
    g.setAttribute('size', new THREE.BufferAttribute(size, 1));
    const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { dpr: { value: renderer.getPixelRatio() }, ring: { value: col(th.surface) } } });
    const pts = new THREE.Points(g, m);
    world.add(pts);
    points = { obj: pts, xyz: pos };

    // Slab2 contours, coloured by the same depth classes, every 20 km (100 km steps stronger)
    if (d.slab) {
      for (const strong of [false, true]) {
        const lp = [], lc = [];
        for (const sl of d.slab.slabs) for (const c of sl.contours) {
          if ((c.d % 100 === 0) !== strong) continue;
          const cc = cols[d.depthClass(c.d)];
          for (const ln of c.lines) {
            for (let k = 0; k + 3 < ln.length; k += 2) {
              const a = toXZ(wrap(ln[k], geo.lon0), ln[k + 1]), b = toXZ(wrap(ln[k + 2], geo.lon0), ln[k + 3]);
              lp.push(a[0], Y(c.d), a[1], b[0], Y(c.d), b[1]);
              lc.push(cc.r, cc.g, cc.b, cc.r, cc.g, cc.b);
            }
          }
        }
        if (!lp.length) continue;
        const sg = new THREE.BufferGeometry();
        sg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
        sg.setAttribute('color', new THREE.Float32BufferAttribute(lc, 3));
        world.add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: strong ? 0.95 : 0.5 })));
      }
    }

    // coastlines and plate boundaries on the surface
    const box = geo.box;
    const inBox = (x, z) => x >= box.x0 - 1e-6 && x <= box.x1 + 1e-6 && z >= box.z0 - 1e-6 && z <= box.z1 + 1e-6;
    const my = data;
    d.getBase().then(([coast, plates]) => {
      if (data !== my) return;
      // the surface lines depend on the box only: keep them while the exaggeration or the colours change
      const bkey = keyOf(d);
      if (!surfCache || surfCache.key !== bkey) surfCache = { key: bkey, lines: new Map() };
      const surf = (fc, color, opacity, dashed) => {
        const cached = surfCache.lines.get(fc);
        if (cached) { if (cached.length) world.add(lineObj(cached, col(color), opacity, dashed)); return; }
        const lp = [];
        for (const ft of fc.features) {
          const gm = ft.geometry;
          if (!gm) continue;
          const lines = gm.type === 'LineString' ? [gm.coordinates] : gm.type === 'MultiLineString' ? gm.coordinates : gm.type === 'Polygon' ? gm.coordinates : gm.type === 'MultiPolygon' ? gm.coordinates.flat() : [];
          for (const ln of lines) for (let k = 0; k + 1 < ln.length; k++) {
            const a = toXZ(wrap(ln[k][0], geo.lon0), ln[k][1]), b = toXZ(wrap(ln[k + 1][0], geo.lon0), ln[k + 1][1]);
            if (Math.abs(a[0] - b[0]) > geo.W / 2) continue;
            if (inBox(...a) && inBox(...b)) lp.push(a[0], 0.002, a[1], b[0], 0.002, b[1]);
          }
        }
        surfCache.lines.set(fc, lp);
        if (lp.length) world.add(lineObj(lp, col(color), opacity, dashed));
      };
      surf(coast, th.ink3, 0.9, false);
      surf(plates, th.plate, 0.8, true);
      requestRender();
    }).catch(() => {});

    home = { az: -0.55, el: 0.42, dist: fitDistance(), target: new THREE.Vector3(0, -geo.H / 2, 0) };
    resize();
    if (!setData.kept || setData.kept !== keyOf(d)) reset();
    setData.kept = keyOf(d);
    requestRender();
  }
  const keyOf = (d) => d.bbox.join(',');

  function wrap(lon, lon0) { return ((((lon - lon0 + 180) % 360) + 360) % 360) - 180 + lon0; }

  /** Camera distance at which the whole box (its bounding sphere) fits the narrower field of view. */
  function fitDistance() {
    const r = 0.5 * Math.hypot(geo.W, geo.D, geo.H);
    const v = (camera.fov * Math.PI) / 180;
    const hz = 2 * Math.atan(Math.tan(v / 2) * (camera.aspect || 1));
    // a little tighter than the sphere on wide screens (the box rarely fills it), a margin on narrow ones
    return (r / Math.sin(Math.min(v, hz) / 2)) * ((camera.aspect || 1) < 1 ? 1.05 : 0.92);
  }

  function reset() {
    if (!home) return;
    home.dist = fitDistance();
    orbit.az = home.az; orbit.el = home.el; orbit.dist = home.dist; orbit.target.copy(home.target);
    requestRender();
  }

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (home && orbit.dist === home.dist) { home.dist = fitDistance(); orbit.dist = home.dist; } // not zoomed: refit
    requestRender();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(stage);

  function render() {
    raf = 0;
    if (!data) return;
    const ce = Math.cos(orbit.el);
    camera.position.set(orbit.target.x + orbit.dist * ce * Math.sin(orbit.az), orbit.target.y + orbit.dist * Math.sin(orbit.el), orbit.target.z + orbit.dist * ce * Math.cos(orbit.az));
    camera.lookAt(orbit.target);
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
    placeLabels();
  }

  const v = new THREE.Vector3();
  function project(p) {
    v.copy(p).project(camera);
    return [(v.x + 1) / 2 * stage.clientWidth, (1 - v.y) / 2 * stage.clientHeight, v.z];
  }
  function placeLabels() {
    for (const { el, pos } of labelEls) {
      const [x, y, z] = project(pos);
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      el.hidden = z > 1;
    }
    // depth ticks only on the vertical edge that is left-most on screen
    if (geo.edges) {
      // the left one of the two vertical edges nearest the camera: long on screen, never hidden behind the box
      const pr = geo.edges.map((e, i) => { const [x, , z] = project(e.mid); return { i, x, z }; });
      const near = pr.sort((a, b) => a.z - b.z).slice(0, 2);
      const left = (near[0].x < near[1].x ? near[0] : near[1]).i;
      geo.edges.forEach((e, i) => e.els.forEach((el) => { el.hidden = el.hidden || i !== left; }));
      // thin out tick labels closer than 15 px on screen (short edges on phones)
      let lastY = -Infinity;
      for (const el of geo.edges[left].els) {
        if (el.hidden || el.classList.contains('unit')) continue;
        const y = parseFloat(el.style.transform.split(',')[1]);
        if (y - lastY < 15) el.hidden = true; else lastY = y;
      }
    }
    canvas.dataset.view = `${orbit.az.toFixed(3)},${orbit.el.toFixed(3)},${orbit.dist.toFixed(3)}`;
  }

  // ---------------------------------------------------------------- interaction
  const pointers = new Map();
  let drag = null;
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    drag = { pan: e.shiftKey || e.button === 2, x: e.clientX, y: e.clientY };
    tip.hidden = true;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) { hover(e); return; }
    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2) {
      const [p, q] = [...pointers.values()];
      const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)[1];
      const d0 = Math.hypot(prev[0] - other[0], prev[1] - other[1]), d1 = Math.hypot(p[0] - q[0], p[1] - q[1]);
      if (d0 > 0) zoom(d0 / d1);
      return;
    }
    const dx = e.clientX - prev[0], dy = e.clientY - prev[1];
    if (drag && drag.pan) pan(dx, dy); else rotate(dx * 0.008, dy * 0.008);
  });
  const up = (e) => { pointers.delete(e.pointerId); if (!pointers.size) drag = null; };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', () => { tip.hidden = true; });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoom(Math.exp(e.deltaY * 0.0015)); }, { passive: false });
  canvas.addEventListener('keydown', (e) => {
    const k = e.key;
    const step = 0.12;
    if (k === 'ArrowLeft') e.shiftKey ? pan(40, 0) : rotate(-step, 0);
    else if (k === 'ArrowRight') e.shiftKey ? pan(-40, 0) : rotate(step, 0);
    else if (k === 'ArrowUp') e.shiftKey ? pan(0, 40) : rotate(0, -step);
    else if (k === 'ArrowDown') e.shiftKey ? pan(0, -40) : rotate(0, step);
    else if (k === '+' || k === '=') zoom(0.85);
    else if (k === '-' || k === '_') zoom(1 / 0.85);
    else if (k === '0' || k === 'Home') reset();
    else return;
    e.preventDefault();
  });

  function rotate(daz, del) {
    orbit.az -= daz;
    orbit.el = Math.max(-0.2, Math.min(1.5, orbit.el + del));
    requestRender();
  }
  function zoom(k) {
    orbit.dist = Math.max(home.dist * 0.15, Math.min(home.dist * 4, orbit.dist * k));
    requestRender();
  }
  function pan(dx, dy) {
    const s = orbit.dist / stage.clientHeight * 0.8;
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const upv = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    orbit.target.addScaledVector(right, -dx * s).addScaledVector(upv, dy * s);
    requestRender();
  }

  let hoverRaf = 0;
  function hover(e) {
    if (hoverRaf || !points) return;
    hoverRaf = requestAnimationFrame(() => {
      hoverRaf = 0;
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const xyz = points.xyz, n = xyz.length / 3;
      const m = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      const W = stage.clientWidth, H = stage.clientHeight, el = m.elements;
      let best = -1, bd = 64, bz = Infinity;
      for (let i = 0; i < n; i++) {
        const x = xyz[3 * i], y = xyz[3 * i + 1], z = xyz[3 * i + 2];
        const w = el[3] * x + el[7] * y + el[11] * z + el[15];
        if (w <= 0) continue;
        const sx = ((el[0] * x + el[4] * y + el[8] * z + el[12]) / w + 1) / 2 * W;
        const sy = (1 - (el[1] * x + el[5] * y + el[9] * z + el[13]) / w) / 2 * H;
        const d2 = (sx - mx) ** 2 + (sy - my) ** 2;
        if (d2 < bd || (d2 === bd && w < bz)) { bd = d2; best = i; bz = w; }
      }
      if (best < 0) { tip.hidden = true; canvas.style.cursor = ''; return; }
      const txt = data.fmtTip(data.events, best);
      tip.replaceChildren();
      const a = document.createElement('div'); a.className = 'tt-main';
      const b = document.createElement('strong'); b.textContent = txt.main; a.append(b);
      const c = document.createElement('div'); c.className = 'tt-sub'; c.textContent = txt.sub;
      tip.append(a, c);
      tip.hidden = false;
      tip.style.left = `${Math.min(mx + 14, W - tip.offsetWidth - 6)}px`;
      tip.style.top = `${Math.min(my + 14, H - tip.offsetHeight - 6)}px`;
      canvas.style.cursor = 'crosshair';
    });
  }

  return {
    setData,
    reset,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf); raf = 0;
      cancelAnimationFrame(hoverRaf); hoverRaf = 0;
      ro.disconnect();
      clear();
      renderer.dispose();
      // release the WebGL context now rather than when the garbage collector gets to it (browsers allow only a few)
      renderer.forceContextLoss();
      labels.remove();
      tip.remove();
      data = null;
    },
    // test and debugging aid: the camera state and the number of drawn events
    info: () => ({ az: orbit.az, el: orbit.el, dist: orbit.dist, n: points ? points.xyz.length / 3 : 0, home: home && home.dist }),
  };
}
