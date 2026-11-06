import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/OrbitControls.js';

const stage = document.getElementById('stage');
const status = document.getElementById('status');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x241512);
scene.fog = new THREE.FogExp2(0x2a1712, 0.012);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
camera.position.set(66, 54, 72);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(stage.clientWidth, stage.clientHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
stage.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.target.set(0, 1.5, 0);
controls.minDistance = 38;
controls.maxDistance = 150;
controls.maxPolarAngle = Math.PI * 0.48;
controls.minPolarAngle = Math.PI * 0.13;

const hemi = new THREE.HemisphereLight(0xe8b68a, 0x271b19, 1.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffc08f, 3.25);
sun.position.set(-35, 58, 24);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -70;
sun.shadow.camera.right = 70;
sun.shadow.camera.top = 70;
sun.shadow.camera.bottom = -70;
sun.shadow.bias = -0.0006;
scene.add(sun);
const fill = new THREE.DirectionalLight(0x6e86a8, 0.45);
fill.position.set(45, 18, -35);
scene.add(fill);

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
function rectMask(x, z, x1, x2, z1, z2, feather = 2.5) {
  const mx = smoothstep(x1 - feather, x1, x) * (1 - smoothstep(x2, x2 + feather, x));
  const mz = smoothstep(z1 - feather, z1, z) * (1 - smoothstep(z2, z2 + feather, z));
  return mx * mz;
}
function hash(x, z) {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453123;
  return s - Math.floor(s);
}
function noise(x, z) {
  return Math.sin(x * 0.34) * 0.48 + Math.cos(z * 0.27) * 0.44 + Math.sin((x + z) * 0.18) * 0.32 + (hash(Math.floor(x), Math.floor(z)) - 0.5) * 0.25;
}
function terrainHeight(x, z) {
  let y = noise(x, z) * 0.8;
  const plateau = rectMask(x, z, -17, 4, -25, -7, 2.2);
  y += plateau * 6.2;
  const northWall = rectMask(x, z, 1.5, 7.5, -31, -10, 1.2);
  const southWall = rectMask(x, z, 1.5, 7.5, 10, 28, 1.2);
  y += (northWall + southWall) * 8.5;
  const industrial = rectMask(x, z, -30, 16, -11, 12, 1.2);
  y = THREE.MathUtils.lerp(y, 0.55, industrial * 0.82);
  const dx = x + 17;
  const dz = z - 19;
  const d = Math.hypot(dx, dz);
  if (d < 10.5) {
    const bowl = Math.pow(1 - d / 10.5, 1.6);
    y -= bowl * 5.4;
  }
  const reservoir = rectMask(x, z, 14, 28, -7, 14, 0.9);
  y = THREE.MathUtils.lerp(y, -2.5, reservoir);
  return y;
}

const palette = {
  dust: new THREE.Color(0x9a5033),
  dustDark: new THREE.Color(0x643225),
  ridge: new THREE.Color(0x7b4630),
  industrial: new THREE.Color(0x5a5954),
  crater: new THREE.Color(0x673526),
  terra: new THREE.Color(0x5d683b)
};

function vertexColor(x, z, y) {
  const c = palette.dust.clone();
  const industrial = rectMask(x, z, -30, 16, -11, 12, 1.6);
  const terra = rectMask(x, z, 27, 39, -24, -10, 2.2);
  const crater = clamp(1 - Math.hypot(x + 17, z - 19) / 11, 0, 1);
  const ridge = clamp((y - 2.2) / 7, 0, 1);
  c.lerp(palette.dustDark, clamp((noise(x * 1.7, z * 1.4) + 1) * 0.12, 0, 0.28));
  c.lerp(palette.crater, crater * 0.62);
  c.lerp(palette.ridge, ridge * 0.55);
  c.lerp(palette.industrial, industrial * 0.92);
  c.lerp(palette.terra, terra * 0.78);
  return c;
}

function createTerrain() {
  const sx = 180, sz = 136, width = 82, depth = 62;
  const positions = [], colors = [], indices = [];
  for (let iz = 0; iz <= sz; iz++) {
    const z = -depth / 2 + (iz / sz) * depth;
    for (let ix = 0; ix <= sx; ix++) {
      const x = -width / 2 + (ix / sx) * width;
      const y = terrainHeight(x, z);
      positions.push(x, y, z);
      const c = vertexColor(x, z, y);
      colors.push(c.r, c.g, c.b);
    }
  }
  for (let iz = 0; iz < sz; iz++) {
    for (let ix = 0; ix < sx; ix++) {
      const a = iz * (sx + 1) + ix, b = a + 1, c = a + (sx + 1), d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0.02 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  scene.add(mesh);
}
createTerrain();

function material(color, roughness = 0.75, metalness = 0.08) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
const concrete = material(0x63615b, 0.92, 0.04);
const concreteDark = material(0x3c3a37, 0.92, 0.02);
const metal = material(0x4c5050, 0.62, 0.48);
const hazard = material(0xc68a37, 0.75, 0.22);
const pipeMat = material(0x6d4936, 0.72, 0.38);
const terranAccent = material(0x7cc5c8, 0.5, 0.3);

function addBox(x, y, z, w, h, d, mat, cast = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}
function addCylinder(x, y, z, r, h, mat, radial = 24) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, radial), mat);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function addIndustrialDistrict() {
  const slabY = 0.9;
  addBox(-17, slabY, 0, 23, 0.3, 15, concrete);
  addBox(2.5, slabY, 0, 13, 0.3, 15, concreteDark);
  addBox(-22, slabY + 0.35, -5.2, 6.4, 0.5, 3.2, concreteDark);
  addBox(-22, slabY + 0.6, -5.2, 3.5, 1.2, 2.2, metal);
  addBox(-13, slabY + 0.2, 5.3, 5, 0.45, 2.2, concreteDark);
  addBox(-6, slabY + 0.2, 5.3, 4.5, 0.45, 2.2, concreteDark);
  for (let x = -27; x < 11; x += 5.5) addBox(x, slabY + 0.36, -7.1, 2.2, 0.12, 0.55, hazard, false);
  const debris = new THREE.Group();
  for (let i = 0; i < 22; i++) {
    const piece = new THREE.Mesh(new THREE.BoxGeometry(0.35 + hash(i, 2) * 1.2, 0.2 + hash(i, 4) * 0.5, 0.35 + hash(i, 6) * 1.1), hash(i, 7) > 0.5 ? metal : concreteDark);
    piece.position.set(-27 + hash(i, 9) * 38, 1.1 + hash(i, 11) * 0.3, -9 + hash(i, 13) * 18);
    piece.rotation.set(hash(i, 14) * 0.6, hash(i, 15) * Math.PI, hash(i, 16) * 0.5);
    piece.castShadow = true;
    debris.add(piece);
  }
  scene.add(debris);
}
addIndustrialDistrict();

function addPipe(x1, z1, x2, z2, y = 1.45, radius = 0.32) {
  const a = new THREE.Vector3(x1, y, z1), b = new THREE.Vector3(x2, y, z2);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const len = a.distanceTo(b);
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 16), pipeMat);
  cyl.position.copy(mid);
  cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  cyl.castShadow = true;
  scene.add(cyl);
}
addPipe(-18, 7, -6, 7);
addPipe(-18, 8.1, -6, 8.1, 1.45, 0.22);
addPipe(-3, -8, 9, -8);
addPipe(-3, -9, 9, -9, 1.35, 0.24);

function addTank(x, z, r = 1.7, h = 4.4) {
  const y = Math.max(0.75, terrainHeight(x, z) + 0.15);
  addCylinder(x, y, z, r, h, material(0x69685f, 0.76, 0.28), 32);
  const top = new THREE.Mesh(new THREE.TorusGeometry(r * 0.82, 0.08, 8, 32), hazard);
  top.rotation.x = Math.PI / 2;
  top.position.set(x, y + h + 0.04, z);
  scene.add(top);
}
addTank(20.2, -11.4);
addTank(24.1, -11.1, 1.45, 3.8);
addTank(20.2, 14.8, 1.6, 4.0);
addTank(24.2, 14.5, 1.45, 3.6);

function createWater() {
  const geo = new THREE.PlaneGeometry(14, 21, 24, 36);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshPhysicalMaterial({ color: 0x276c73, roughness: 0.22, metalness: 0.06, transmission: 0.08, transparent: true, opacity: 0.92, clearcoat: 0.5, clearcoatRoughness: 0.18 });
  const water = new THREE.Mesh(geo, mat);
  water.position.set(21, -1.55, 3.5);
  water.receiveShadow = true;
  scene.add(water);
  return water;
}
const water = createWater();

function addBridge() {
  addBox(21, -0.8, 3.3, 15.5, 0.65, 4.5, concrete);
  addBox(14.1, -0.3, 3.3, 0.8, 1.6, 4.5, concreteDark);
  addBox(27.9, -0.3, 3.3, 0.8, 1.6, 4.5, concreteDark);
  for (let x = 14.6; x < 28; x += 2.4) {
    addBox(x, -0.15, 1.35, 0.85, 0.14, 0.5, hazard, false);
    addBox(x, -0.15, 5.25, 0.85, 0.14, 0.5, hazard, false);
  }
}
addBridge();

function addOutpost() {
  const y = terrainHeight(-29, 1) + 0.2;
  addBox(-29, y, 1, 7, 1.2, 6, material(0x56605c, 0.7, 0.3));
  addBox(-30, y + 1.2, 0, 3.7, 2.8, 3.2, material(0x808174, 0.78, 0.16));
  addBox(-26.2, y + 1.2, 2.2, 2, 2.1, 2, metal);
  addBox(-32.7, y + 0.3, 2.2, 1.4, 4.3, 1.4, concreteDark);
  addCylinder(-32.7, y + 4.4, 2.2, 0.15, 4.8, metal, 10);
  const lamp = new THREE.PointLight(0x7ce3e7, 3.2, 11, 2);
  lamp.position.set(-32.7, y + 9.3, 2.2);
  scene.add(lamp);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), terranAccent);
  beacon.position.copy(lamp.position);
  scene.add(beacon);
}
addOutpost();

function addTerraformPocket() {
  const plantMat = material(0x52673b, 1.0, 0), rockMat = material(0x6c503b, 0.95, 0.02);
  for (let i = 0; i < 55; i++) {
    const x = 27.5 + hash(i, 31) * 11, z = -23.5 + hash(i, 47) * 13, y = terrainHeight(x, z);
    const clump = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22 + hash(i, 53) * 0.35, 0), hash(i, 61) > 0.3 ? plantMat : rockMat);
    clump.scale.y = 0.4 + hash(i, 67) * 0.7;
    clump.position.set(x, y + 0.22, z);
    clump.castShadow = true;
    scene.add(clump);
  }
}
addTerraformPocket();

function addCrystals() {
  const glowMat = new THREE.MeshStandardMaterial({ color: 0xb777e4, emissive: 0x6a2691, emissiveIntensity: 2.2, roughness: 0.28, metalness: 0.16 });
  const core = new THREE.PointLight(0xb667ff, 7, 20, 2);
  core.position.set(34, 4.5, -18);
  scene.add(core);
  const coords = [[31.2,-20.2,2.6],[33.4,-18.8,4.6],[35.4,-21.2,3.3],[36.8,-17.1,5.3],[32.2,-15.8,3.9],[38,-20.2,2.4]];
  for (const [x,z,h] of coords) {
    const y = terrainHeight(x, z);
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.72, h, 5), glowMat);
    c.position.set(x, y + h / 2, z);
    c.rotation.y = hash(x,z) * Math.PI;
    c.castShadow = true;
    scene.add(c);
    const shard = new THREE.Mesh(new THREE.ConeGeometry(0.35, h * 0.58, 5), glowMat);
    shard.position.set(x + 0.7, y + h * 0.28, z + 0.3);
    shard.rotation.z = 0.32;
    scene.add(shard);
  }
}
addCrystals();

function addRockField() {
  const geo = new THREE.DodecahedronGeometry(0.55, 0), mat = material(0x6b3a2b, 0.98, 0.01);
  const count = 180, inst = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let placed = 0;
  for (let i = 0; i < count * 3 && placed < count; i++) {
    const x = -39 + hash(i, 101) * 78, z = -29 + hash(i, 103) * 58;
    if (rectMask(x, z, -31, 17, -12, 13, 1.5) > 0.2 || rectMask(x, z, 13, 29, -8, 15, 1.2) > 0.2 || rectMask(x, z, 26, 40, -25, -9, 1.5) > 0.2) continue;
    const y = terrainHeight(x, z);
    p.set(x, y + 0.28, z);
    q.setFromEuler(new THREE.Euler(hash(i,106), hash(i,107) * Math.PI, hash(i,108)));
    const sc = 0.35 + hash(i,109) * 1.2;
    s.set(sc, sc * (0.65 + hash(i,111) * 0.9), sc);
    m.compose(p, q, s);
    inst.setMatrixAt(placed++, m);
  }
  inst.count = placed;
  inst.castShadow = true;
  inst.receiveShadow = true;
  scene.add(inst);
}
addRockField();

function addDistantRidge() {
  const mat = material(0x4b2a24, 1, 0);
  for (let i = 0; i < 26; i++) {
    const w = 3 + hash(i, 201) * 8, h = 4 + hash(i, 202) * 14, d = 5 + hash(i, 203) * 7;
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(w, h, 5), mat);
    mesh.position.set(-55 + i * 4.5, h / 2 - 4, -53 - hash(i,204) * 15);
    mesh.scale.z = d / w;
    scene.add(mesh);
  }
}
addDistantRidge();

const dustGeo = new THREE.BufferGeometry(), dustPos = [];
for (let i = 0; i < 500; i++) dustPos.push(-55 + Math.random() * 110, 2 + Math.random() * 32, -48 + Math.random() * 96);
dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(dustPos, 3));
scene.add(new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xd08b62, size: 0.11, transparent: true, opacity: 0.18, depthWrite: false })));

function setCinematic() {
  camera.position.set(66, 54, 72);
  controls.target.set(0, 1.5, 0);
  controls.update();
  status.textContent = 'Cinematic view · drag to orbit · wheel to zoom';
}
function setTactical() {
  camera.position.set(0, 88, 72);
  controls.target.set(0, 0, 0);
  controls.update();
  status.textContent = 'Tactical view · visual terrain shell only';
}
document.getElementById('cinematic').addEventListener('click', setCinematic);
document.getElementById('tactical').addEventListener('click', setTactical);

let t = 0;
function animate() {
  requestAnimationFrame(animate);
  t += 0.016;
  const pos = water.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, Math.sin(t * 1.7 + x * 0.65 + z * 0.32) * 0.07 + Math.cos(t * 1.1 + z * 0.8) * 0.035);
  }
  pos.needsUpdate = true;
  water.geometry.computeVertexNormals();
  controls.update();
  renderer.render(scene, camera);
}
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', resize);
resize();
setCinematic();
animate();
