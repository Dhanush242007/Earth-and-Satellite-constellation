const EARTH_R = 2;
const EARTH_RADIUS_KM = 6371;
const MU_EARTH = 398600; // km^3/s^2
const AXIAL_TILT_DEG = 23.5;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.set(0, 3.5, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ---------------------------------------------------------------------
   EARTH — UNCHANGED
   --------------------------------------------------------------------- */

const textureLoader = new THREE.TextureLoader();
const TEX_BASE = 'https://threejs.org/examples/textures/planets/';

const earthGroup = new THREE.Group();
earthGroup.rotation.z = THREE.MathUtils.degToRad(AXIAL_TILT_DEG);
scene.add(earthGroup);

const earthMaterial = new THREE.MeshPhongMaterial({
  map: textureLoader.load(TEX_BASE + 'earth_atmos_2048.jpg'),
  specularMap: textureLoader.load(TEX_BASE + 'earth_specular_2048.jpg'),
  normalMap: textureLoader.load(TEX_BASE + 'earth_normal_2048.jpg'),
  normalScale: new THREE.Vector2(0.85, 0.85),
  specular: new THREE.Color(0x333333),
  shininess: 14,
});

const earth = new THREE.Mesh(
  new THREE.SphereGeometry(EARTH_R, 96, 96),
  earthMaterial,
);
earthGroup.add(earth);

const cloudMaterial = new THREE.MeshLambertMaterial({
  map: textureLoader.load(TEX_BASE + 'earth_clouds_1024.png'),
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
});
const clouds = new THREE.Mesh(
  new THREE.SphereGeometry(EARTH_R + 0.015, 96, 96),
  cloudMaterial,
);
earthGroup.add(clouds);

const atmosphereMaterial = new THREE.ShaderMaterial({
  uniforms: { glowColor: { value: new THREE.Color(0x4fa8e8) } },
  vertexShader: `
    varying float intensity;
    void main() {
      vec3 vNormal = normalize(normalMatrix * normal);
      vec3 vViewDir = normalize(-(modelViewMatrix * vec4(position,1.0)).xyz);
      intensity = pow(0.65 - dot(vNormal, vViewDir), 2.5);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform vec3 glowColor;
    varying float intensity;
    void main() {
      gl_FragColor = vec4(glowColor, intensity * 0.9);
    }`,
  side: THREE.BackSide,
  blending: THREE.AdditiveBlending,
  transparent: true,
  depthWrite: false,
});
const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(EARTH_R + 0.15, 64, 64),
  atmosphereMaterial,
);
earthGroup.add(atmosphere);

const sun = new THREE.DirectionalLight(0xffffff, 1.3);
sun.position.set(6, 3, 5);
scene.add(sun);
scene.add(new THREE.AmbientLight(0x3a4658, 0.55));

const starPos = [];
for (let i = 0; i < 1200; i++) {
  starPos.push(
    (Math.random() - 0.5) * 120,
    (Math.random() - 0.5) * 120,
    (Math.random() - 0.5) * 120,
  );
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
scene.add(
  new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ color: 0xffffff, size: 0.12 }),
  ),
);

/* ---------------------------------------------------------------------
   ORBIT CONTROLS — UNCHANGED
   --------------------------------------------------------------------- */

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 4;
controls.maxDistance = 40;
controls.rotateSpeed = 0.6;

/* ---------------------------------------------------------------------
   SATELLITES — refined proportions & materials (tighter bus, thinner
   panels, clearer dish). Still a lightweight procedural mesh, no cones.
   --------------------------------------------------------------------- */

function makeSolarPanelTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 32;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0c2050';
  ctx.fillRect(0, 0, 64, 32);
  ctx.strokeStyle = 'rgba(150,190,235,0.5)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= 64; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 32);
    ctx.stroke();
  }
  for (let y = 0; y <= 32; y += 8) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(64, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
const solarPanelTexture = makeSolarPanelTexture();

function buildSatelliteMesh() {
  const group = new THREE.Group();

  // Tighter, more proportionate metallic bus
  const bus = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.16),
    new THREE.MeshStandardMaterial({
      color: 0xc7cfdb,
      metalness: 0.85,
      roughness: 0.22,
    }),
  );
  group.add(bus);

  // Thinner panels relative to the smaller bus
  const panelGeo = new THREE.BoxGeometry(0.5, 0.008, 0.16);
  const panelMat = new THREE.MeshStandardMaterial({
    map: solarPanelTexture,
    metalness: 0.15,
    roughness: 0.55,
  });
  const panelL = new THREE.Mesh(panelGeo, panelMat);
  panelL.position.x = -0.3;
  const panelR = new THREE.Mesh(panelGeo, panelMat);
  panelR.position.x = 0.3;
  group.add(panelL, panelR);

  const strutGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.1, 6);
  const strutMat = new THREE.MeshStandardMaterial({
    color: 0x8a939e,
    metalness: 0.7,
    roughness: 0.35,
  });
  const strutL = new THREE.Mesh(strutGeo, strutMat);
  strutL.rotation.z = Math.PI / 2;
  strutL.position.x = -0.1;
  const strutR = new THREE.Mesh(strutGeo, strutMat);
  strutR.rotation.z = Math.PI / 2;
  strutR.position.x = 0.1;
  group.add(strutL, strutR);

  // Larger, clearer dish so it reads at typical camera distance
  const dish = new THREE.Mesh(
    new THREE.ConeGeometry(0.045, 0.075, 16, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0xf4d576,
      metalness: 0.25,
      roughness: 0.35,
      side: THREE.DoubleSide,
    }),
  );
  dish.rotation.x = -Math.PI / 2;
  dish.position.z = 0.12;
  group.add(dish);

  // Small feed horn at the dish center for extra detail at close zoom
  const feed = new THREE.Mesh(
    new THREE.SphereGeometry(0.012, 8, 8),
    new THREE.MeshStandardMaterial({
      color: 0x555c66,
      metalness: 0.6,
      roughness: 0.4,
    }),
  );
  feed.position.z = 0.09;
  group.add(feed);

  return group;
}

const satGroup = new THREE.Group();
scene.add(satGroup);
let satellites = [];
let selectedSat = null;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

/* ---- Details panel wiring ---- */

const detailsPanel = document.getElementById('details-panel');
const detailsContent = document.getElementById('details-content');
document.getElementById('closeDetails').addEventListener('click', () => {
  selectedSat = null;
  hideDetailsPanel();
});

function hideDetailsPanel() {
  detailsPanel.classList.add('hidden');
}

function computePeriodMinutes(orbitRadiusUnits) {
  const rKm = (orbitRadiusUnits / EARTH_R) * EARTH_RADIUS_KM;
  const tSeconds = 2 * Math.PI * Math.sqrt(Math.pow(rKm, 3) / MU_EARTH);
  return tSeconds / 60;
}

function computeLatLon(worldPos) {
  const r = worldPos.length();
  const lat = (Math.asin(worldPos.y / r) * 180) / Math.PI;
  const lon = (Math.atan2(worldPos.z, worldPos.x) * 180) / Math.PI;
  return { lat, lon };
}

function updateDetailsPanel(sat) {
  const worldPos = new THREE.Vector3();
  sat.mesh.getWorldPosition(worldPos);
  const { lat, lon } = computeLatLon(worldPos);
  const periodMin = computePeriodMinutes(sat.orbitRadius);
  const altKm = ((sat.orbitRadius - EARTH_R) / EARTH_R) * EARTH_RADIUS_KM;
  const phaseDeg = ((((sat.phase * 180) / Math.PI) % 360) + 360) % 360;
  const speedKmS =
    (2 * Math.PI * (sat.orbitRadius / EARTH_R) * EARTH_RADIUS_KM) /
    (periodMin * 60);

  detailsContent.innerHTML = `
    <div class="detail-id">SAT-${String(sat.id).padStart(2, '0')}</div>
    <div class="detail-sub">Plane ${sat.plane} / ${sat.planeCount}</div>
    <div class="detail-row"><span>Altitude</span><span>${altKm.toFixed(0)} km</span></div>
    <div class="detail-row"><span>Inclination</span><span>${sat.inclDeg}°</span></div>
    <div class="detail-row"><span>Period</span><span>${periodMin.toFixed(1)} min</span></div>
    <div class="detail-row"><span>Speed</span><span>${speedKmS.toFixed(2)} km/s</span></div>
    <div class="detail-row"><span>Latitude</span><span>${lat.toFixed(2)}°</span></div>
    <div class="detail-row"><span>Longitude</span><span>${lon.toFixed(2)}°</span></div>
    <div class="detail-row"><span>Phase</span><span>${phaseDeg.toFixed(0)}°</span></div>
  `;
  detailsPanel.classList.remove('hidden');
}

/* ---- Constellation builder — params/logic unchanged ---- */

function buildConstellation() {
  while (satGroup.children.length) satGroup.remove(satGroup.children[0]);
  satellites = [];
  selectedSat = null;
  hideDetailsPanel();

  const numSats = parseInt(document.getElementById('sats').value);
  const numPlanes = parseInt(document.getElementById('planes').value);
  const altitude = parseFloat(document.getElementById('alt').value);
  const inclDeg = parseFloat(document.getElementById('incl').value);
  const incl = THREE.MathUtils.degToRad(inclDeg);
  const orbitRadius = EARTH_R + altitude;
  const perPlane = Math.ceil(numSats / numPlanes);

  syncDisplay('alt', altitude.toFixed(1));
  syncDisplay('sats', numSats);
  syncDisplay('planes', numPlanes);
  syncDisplay('incl', inclDeg + '°');

  let placed = 0;
  for (let p = 0; p < numPlanes; p++) {
    const raan = (p / numPlanes) * Math.PI * 2;
    const euler = new THREE.Euler(incl, raan, 0, 'YXZ');
    const quat = new THREE.Quaternion().setFromEuler(euler);

    const curve = new THREE.EllipseCurve(
      0,
      0,
      orbitRadius,
      orbitRadius,
      0,
      Math.PI * 2,
      false,
      0,
    );
    const pts = curve
      .getPoints(96)
      .map((pt) => new THREE.Vector3(pt.x, 0, pt.y));
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({
        color: 0x2f8fd6,
        transparent: true,
        opacity: 0.4,
      }),
    );
    line.quaternion.copy(quat);
    satGroup.add(line);

    for (let s = 0; s < perPlane && placed < numSats; s++, placed++) {
      const mesh = buildSatelliteMesh();
      satGroup.add(mesh);

      satellites.push({
        id: placed + 1,
        plane: p + 1,
        planeCount: numPlanes,
        altitude,
        inclDeg,
        orbitRadius,
        mesh,
        quat,
        phase: (s / perPlane) * Math.PI * 2,
      });
    }
  }
}

function syncDisplay(id, text) {
  document.getElementById(id + 'Val').textContent = text;
}

['alt', 'sats', 'planes', 'incl'].forEach((id) => {
  const range = document.getElementById(id);
  const num = document.getElementById(id + 'Num');
  range.addEventListener('input', () => {
    num.value = range.value;
    buildConstellation();
  });
  num.addEventListener('input', () => {
    range.value = num.value;
    buildConstellation();
  });
});

buildConstellation();

/* ---- Earth rotation speed control — UNCHANGED ---- */

const DEFAULT_EARTH_SPIN = 0.0009;
const DEFAULT_CLOUD_SPIN = 0.0013;
let earthSpinMultiplier = 1;

const rotSpeedRange = document.getElementById('rotSpeed');
const rotSpeedNum = document.getElementById('rotSpeedNum');
function applyRotSpeed(val) {
  earthSpinMultiplier = parseFloat(val);
  document.getElementById('rotSpeedVal').textContent =
    earthSpinMultiplier.toFixed(2) + '×';
}
rotSpeedRange.addEventListener('input', () => {
  rotSpeedNum.value = rotSpeedRange.value;
  applyRotSpeed(rotSpeedRange.value);
});
rotSpeedNum.addEventListener('input', () => {
  rotSpeedRange.value = rotSpeedNum.value;
  applyRotSpeed(rotSpeedNum.value);
});
applyRotSpeed(rotSpeedRange.value);

/* ---- Click-to-inspect, disambiguated from OrbitControls drag — UNCHANGED ---- */

let pointerDownPos = null;
const CLICK_DRAG_THRESHOLD = 6;

renderer.domElement.addEventListener('pointerdown', (event) => {
  pointerDownPos = { x: event.clientX, y: event.clientY };
});

renderer.domElement.addEventListener('pointerup', (event) => {
  if (!pointerDownPos) return;
  const dx = event.clientX - pointerDownPos.x;
  const dy = event.clientY - pointerDownPos.y;
  const moved = Math.sqrt(dx * dx + dy * dy);
  pointerDownPos = null;

  if (moved > CLICK_DRAG_THRESHOLD) return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const meshes = satellites.map((s) => s.mesh);
  const hits = raycaster.intersectObjects(meshes, true);

  if (hits.length > 0) {
    let hitMesh = hits[0].object;
    while (hitMesh.parent && !satellites.find((s) => s.mesh === hitMesh))
      hitMesh = hitMesh.parent;
    const sat = satellites.find((s) => s.mesh === hitMesh);
    if (sat) {
      selectedSat = sat;
      updateDetailsPanel(sat);
    }
  }
});

/* ---------------------------------------------------------------------
   ANIMATION LOOP — only the orbital speed increment changed (slower)
   --------------------------------------------------------------------- */

const tmp = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
let t = 0;
const ORBIT_SPEED = 0.004; // was 0.01 — calmer, slower revolution

function animate() {
  requestAnimationFrame(animate);
  t += ORBIT_SPEED;

  earth.rotation.y += DEFAULT_EARTH_SPIN * earthSpinMultiplier;
  clouds.rotation.y += DEFAULT_CLOUD_SPIN * earthSpinMultiplier;

  satellites.forEach((sat) => {
    const angle = t + sat.phase;
    tmp.set(
      Math.cos(angle) * sat.orbitRadius,
      0,
      Math.sin(angle) * sat.orbitRadius,
    );
    tmp.applyQuaternion(sat.quat);
    sat.mesh.position.copy(tmp);
    sat.mesh.lookAt(0, 0, 0);
  });

  satGroup.rotation.y += 0.0004;

  if (selectedSat) updateDetailsPanel(selectedSat);

  controls.update();
  renderer.render(scene, camera);
}
animate();
