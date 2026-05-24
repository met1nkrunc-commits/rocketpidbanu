import "./styles.css";
import * as THREE from "three";

type CameraMode = "orbit" | "side" | "top";

type SimState = {
  time: number;
  altitude: number;
  velocity: number;
  lateral: number;
  lateralVelocity: number;
  angle: number;
  angularVelocity: number;
  fuel: number;
  throttle: number;
  gimbal: number;
  targetVelocity: number;
  altitudeError: number;
  lateralError: number;
  angleError: number;
  acceleration: number;
  landed: boolean;
  crashed: boolean;
};

const GRAVITY = 9.81;
const START_ALTITUDE = 280;
const START_LATERAL = -36;
const START_FUEL = 100;
const FUEL_MASS = 650;
const MAX_THRUST = 35_000;
const MAX_GIMBAL = 0.24;
const LANDING_PAD_X = 0;
const LANDING_PAD_Y = 0;

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("App root not found");
}

app.innerHTML = `
  <div class="shell">
    <header class="topbar">
      <div class="brand">
        <h1>PID Kontrollü Roket İniş Simülasyonu</h1>
        <span>İrtifa, yatay hata ve açı stabilizasyonu için üç katmanlı PID denetleyici</span>
      </div>
      <div class="top-actions">
        <button id="reset" class="secondary" type="button">Sıfırla</button>
        <button id="startStop" type="button">Başlat</button>
      </div>
    </header>
    <main>
      <aside class="controls">
        <section class="control-group">
          <h2>Görev</h2>
          <div class="grid-2">
            <div class="field">
              <label for="targetAltitude"><span>Başlangıç irtifası</span><output id="vTargetAltitude">280 m</output></label>
              <input id="targetAltitude" type="range" min="80" max="500" step="10" value="280" />
            </div>
            <div class="field">
              <label for="wind"><span>Yatay rüzgar</span><output id="vWind">0.7 m/s²</output></label>
              <input id="wind" type="range" min="-5" max="5" step="0.1" value="0.7" />
            </div>
            <div class="field">
              <label for="mass"><span>Kuru kütle</span><output id="vMass">1550 kg</output></label>
              <input id="mass" type="range" min="800" max="4000" step="50" value="1550" />
            </div>
            <div class="field">
              <label for="fuel"><span>Yakıt</span><output id="vFuel">100%</output></label>
              <input id="fuel" type="range" min="10" max="100" step="5" value="100" />
            </div>
          </div>
          <div id="status" class="status">Hazır. PID iniş denemesi için Başlat'a basın.</div>
        </section>

        <section class="control-group">
          <h2>İrtifa PID</h2>
          <div class="grid-3">
            <div class="field"><label for="altKp"><span>Kp</span><output id="vAltKp">0.82</output></label><input id="altKp" type="range" min="0" max="2" step="0.01" value="0.82" /></div>
            <div class="field"><label for="altKi"><span>Ki</span><output id="vAltKi">0.035</output></label><input id="altKi" type="range" min="0" max="0.2" step="0.005" value="0.035" /></div>
            <div class="field"><label for="altKd"><span>Kd</span><output id="vAltKd">1.25</output></label><input id="altKd" type="range" min="0" max="3" step="0.01" value="1.25" /></div>
          </div>
        </section>

        <section class="control-group">
          <h2>Yatay Konum PID</h2>
          <div class="grid-3">
            <div class="field"><label for="latKp"><span>Kp</span><output id="vLatKp">0.11</output></label><input id="latKp" type="range" min="0" max="1" step="0.01" value="0.11" /></div>
            <div class="field"><label for="latKi"><span>Ki</span><output id="vLatKi">0.006</output></label><input id="latKi" type="range" min="0" max="0.1" step="0.002" value="0.006" /></div>
            <div class="field"><label for="latKd"><span>Kd</span><output id="vLatKd">0.48</output></label><input id="latKd" type="range" min="0" max="2" step="0.01" value="0.48" /></div>
          </div>
        </section>

        <section class="control-group">
          <h2>Açı Stabilizasyon PID</h2>
          <div class="grid-3">
            <div class="field"><label for="angKp"><span>Kp</span><output id="vAngKp">5.6</output></label><input id="angKp" type="range" min="0" max="12" step="0.1" value="5.6" /></div>
            <div class="field"><label for="angKi"><span>Ki</span><output id="vAngKi">0.12</output></label><input id="angKi" type="range" min="0" max="1" step="0.01" value="0.12" /></div>
            <div class="field"><label for="angKd"><span>Kd</span><output id="vAngKd">3.2</output></label><input id="angKd" type="range" min="0" max="8" step="0.1" value="3.2" /></div>
          </div>
        </section>

        <section class="dashboard">
          <div class="metric"><span>İrtifa</span><strong id="mAltitude">280 m</strong></div>
          <div class="metric"><span>Düşey hız</span><strong id="mVelocity">0.0 m/s</strong></div>
          <div class="metric"><span>İtki</span><strong id="mThrottle">0%</strong></div>
          <div class="metric"><span>Yakıt</span><strong id="mFuel">100%</strong></div>
          <div class="diagnostics">
            <div class="diagnostic"><span>Hedef düşey hız</span><strong id="dTargetVelocity">0.0 m/s</strong></div>
            <div class="diagnostic"><span>Yatay hata</span><strong id="dLateral">0.0 m</strong></div>
            <div class="diagnostic"><span>Açı / gimbal</span><strong id="dAngle">0.0° / 0.0°</strong></div>
            <div class="diagnostic"><span>Net ivme</span><strong id="dAccel">0.0 m/s²</strong></div>
          </div>
          <div class="chart-panel">
            <div class="chart-title">
              <span>İrtifa ve Hız</span>
              <div class="legend">
                <span><i class="dot blue"></i>İrtifa</span>
                <span><i class="dot red"></i>Düşey hız</span>
              </div>
            </div>
            <canvas id="altitudeChart" width="720" height="220"></canvas>
          </div>
          <div class="chart-panel">
            <div class="chart-title">
              <span>PID Çıkışları</span>
              <div class="legend">
                <span><i class="dot green"></i>İtki</span>
                <span><i class="dot amber"></i>Gimbal</span>
              </div>
            </div>
            <canvas id="controlChart" width="720" height="220"></canvas>
          </div>
        </section>
      </aside>

      <section class="stage">
        <div class="visual-stage">
          <div id="scene3d"></div>
          <div class="pid-overlay">
            <div class="pid-title">PID Telemetri</div>
            <div class="pid-row blue"><span>İrtifa</span><data id="oAltitude">280 m</data></div>
            <div class="pid-row"><span>Hız</span><data id="oVelocity">0.0 m/s</data></div>
            <div class="pid-row green"><span>İtki</span><data id="oThrottle">0%</data></div>
            <div class="pid-sep"></div>
            <div class="pid-row"><span>Yatay</span><data id="oLateral">-36.0 m</data></div>
            <div class="pid-row amber"><span>Açı</span><data id="oAngle">0.0°</data></div>
            <div class="pid-row red"><span>Yakıt</span><data id="oFuel">100%</data></div>
          </div>
          <div class="camera-controls">
            <button id="camOrbit" type="button">ORBIT</button>
            <button id="camSide" type="button" class="secondary">YAN</button>
            <button id="camTop" type="button" class="secondary">ÜST</button>
          </div>
        </div>
      </section>
    </main>
  </div>
`;

const elements = {
  startStop: document.querySelector<HTMLButtonElement>("#startStop")!,
  reset: document.querySelector<HTMLButtonElement>("#reset")!,
  status: document.querySelector<HTMLDivElement>("#status")!,
  targetAltitude: document.querySelector<HTMLInputElement>("#targetAltitude")!,
  wind: document.querySelector<HTMLInputElement>("#wind")!,
  mass: document.querySelector<HTMLInputElement>("#mass")!,
  fuel: document.querySelector<HTMLInputElement>("#fuel")!,
  vTargetAltitude: document.querySelector<HTMLOutputElement>("#vTargetAltitude")!,
  vWind: document.querySelector<HTMLOutputElement>("#vWind")!,
  vMass: document.querySelector<HTMLOutputElement>("#vMass")!,
  vFuel: document.querySelector<HTMLOutputElement>("#vFuel")!,
  altKp: document.querySelector<HTMLInputElement>("#altKp")!,
  altKi: document.querySelector<HTMLInputElement>("#altKi")!,
  altKd: document.querySelector<HTMLInputElement>("#altKd")!,
  vAltKp: document.querySelector<HTMLOutputElement>("#vAltKp")!,
  vAltKi: document.querySelector<HTMLOutputElement>("#vAltKi")!,
  vAltKd: document.querySelector<HTMLOutputElement>("#vAltKd")!,
  latKp: document.querySelector<HTMLInputElement>("#latKp")!,
  latKi: document.querySelector<HTMLInputElement>("#latKi")!,
  latKd: document.querySelector<HTMLInputElement>("#latKd")!,
  vLatKp: document.querySelector<HTMLOutputElement>("#vLatKp")!,
  vLatKi: document.querySelector<HTMLOutputElement>("#vLatKi")!,
  vLatKd: document.querySelector<HTMLOutputElement>("#vLatKd")!,
  angKp: document.querySelector<HTMLInputElement>("#angKp")!,
  angKi: document.querySelector<HTMLInputElement>("#angKi")!,
  angKd: document.querySelector<HTMLInputElement>("#angKd")!,
  vAngKp: document.querySelector<HTMLOutputElement>("#vAngKp")!,
  vAngKi: document.querySelector<HTMLOutputElement>("#vAngKi")!,
  vAngKd: document.querySelector<HTMLOutputElement>("#vAngKd")!,
  mAltitude: document.querySelector<HTMLElement>("#mAltitude")!,
  mVelocity: document.querySelector<HTMLElement>("#mVelocity")!,
  mThrottle: document.querySelector<HTMLElement>("#mThrottle")!,
  mFuel: document.querySelector<HTMLElement>("#mFuel")!,
  dTargetVelocity: document.querySelector<HTMLElement>("#dTargetVelocity")!,
  dLateral: document.querySelector<HTMLElement>("#dLateral")!,
  dAngle: document.querySelector<HTMLElement>("#dAngle")!,
  dAccel: document.querySelector<HTMLElement>("#dAccel")!,
  oAltitude: document.querySelector<HTMLElement>("#oAltitude")!,
  oVelocity: document.querySelector<HTMLElement>("#oVelocity")!,
  oThrottle: document.querySelector<HTMLElement>("#oThrottle")!,
  oLateral: document.querySelector<HTMLElement>("#oLateral")!,
  oAngle: document.querySelector<HTMLElement>("#oAngle")!,
  oFuel: document.querySelector<HTMLElement>("#oFuel")!,
  camOrbit: document.querySelector<HTMLButtonElement>("#camOrbit")!,
  camSide: document.querySelector<HTMLButtonElement>("#camSide")!,
  camTop: document.querySelector<HTMLButtonElement>("#camTop")!,
  scene3d: document.querySelector<HTMLDivElement>("#scene3d")!,
  altitudeChart: document.querySelector<HTMLCanvasElement>("#altitudeChart")!,
  controlChart: document.querySelector<HTMLCanvasElement>("#controlChart")!
};

let renderer: THREE.WebGLRenderer;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let rocket: THREE.Group;
let flame: THREE.Group;
let landingLegs: THREE.Group;
let cameraMode: CameraMode = "orbit";
let running = false;
let animationId = 0;
let lastFrame = performance.now();
let state = initialState();
let history: SimState[] = [];

const altPid = createPid();
const latPid = createPid();
const angPid = createPid();

initThreeScene();
resetSimulation();
bindEvents();
drawCharts();
animate();

function bindEvents() {
  elements.startStop.addEventListener("click", () => {
    if (running) {
      running = false;
      elements.startStop.textContent = "Başlat";
      setStatus("Simülasyon duraklatıldı.");
      return;
    }

    if (state.time === 0 || state.landed || state.crashed) {
      prepareDescentScenario();
    }

    running = true;
    elements.startStop.textContent = "Durdur";
  });

  elements.reset.addEventListener("click", resetSimulation);
  const sliders = [
    elements.targetAltitude,
    elements.wind,
    elements.mass,
    elements.fuel,
    elements.altKp,
    elements.altKi,
    elements.altKd,
    elements.latKp,
    elements.latKi,
    elements.latKd,
    elements.angKp,
    elements.angKi,
    elements.angKd
  ];
  for (const slider of sliders) {
    slider.addEventListener("input", () => {
      updateControlReadouts();
      if (!running && state.time === 0 && state.altitude <= 0.05) {
        state.fuel = readNumber(elements.fuel);
        updateUi();
      }
    });
  }
  elements.camOrbit.addEventListener("click", () => setCameraMode("orbit"));
  elements.camSide.addEventListener("click", () => setCameraMode("side"));
  elements.camTop.addEventListener("click", () => setCameraMode("top"));
}

function initialState(): SimState {
  return {
    time: 0,
    altitude: START_ALTITUDE,
    velocity: 0,
    lateral: START_LATERAL,
    lateralVelocity: 1.2,
    angle: 0,
    angularVelocity: 0,
    fuel: START_FUEL,
    throttle: 0,
    gimbal: 0,
    targetVelocity: 0,
    altitudeError: 0,
    lateralError: 0,
    angleError: 0,
    acceleration: 0,
    landed: false,
    crashed: false
  };
}

function resetSimulation() {
  running = false;
  elements.startStop.textContent = "Başlat";
  state = {
    ...initialState(),
    altitude: 0,
    fuel: readNumber(elements.fuel),
    lateral: 0,
    lateralVelocity: 0
  };
  history = [state];
  resetPid(altPid);
  resetPid(latPid);
  resetPid(angPid);
  updateControlReadouts();
  updateRocketVisual();
  updateUi();
  drawCharts();
  setStatus("Roket pistte hazır. Başlat, seçilen irtifadan iniş senaryosunu başlatır.");
}

function prepareDescentScenario() {
  state = {
    ...initialState(),
    altitude: readNumber(elements.targetAltitude),
    fuel: readNumber(elements.fuel),
    lateral: START_LATERAL,
    lateralVelocity: 1.2
  };
  history = [state];
  resetPid(altPid);
  resetPid(latPid);
  resetPid(angPid);
  updateUi();
  drawCharts();
  setStatus("İniş senaryosu başlatıldı: roket seçilen irtifadan piste dönmeye çalışıyor.");
}

function updateControlReadouts() {
  elements.vTargetAltitude.textContent = `${readNumber(elements.targetAltitude).toFixed(0)} m`;
  elements.vWind.textContent = `${readNumber(elements.wind).toFixed(1)} m/s²`;
  elements.vMass.textContent = `${readNumber(elements.mass).toFixed(0)} kg`;
  elements.vFuel.textContent = `${readNumber(elements.fuel).toFixed(0)}%`;
  elements.vAltKp.textContent = readNumber(elements.altKp).toFixed(2);
  elements.vAltKi.textContent = readNumber(elements.altKi).toFixed(3);
  elements.vAltKd.textContent = readNumber(elements.altKd).toFixed(2);
  elements.vLatKp.textContent = readNumber(elements.latKp).toFixed(2);
  elements.vLatKi.textContent = readNumber(elements.latKi).toFixed(3);
  elements.vLatKd.textContent = readNumber(elements.latKd).toFixed(2);
  elements.vAngKp.textContent = readNumber(elements.angKp).toFixed(1);
  elements.vAngKi.textContent = readNumber(elements.angKi).toFixed(2);
  elements.vAngKd.textContent = readNumber(elements.angKd).toFixed(1);
}

function initThreeScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07090f);
  scene.fog = new THREE.Fog(0x07090f, 260, 720);

  camera = new THREE.PerspectiveCamera(48, 1, 0.1, 1200);
  camera.position.set(96, 86, 150);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  elements.scene3d.append(renderer.domElement);

  const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x111722, 1.8);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-90, 180, 110);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  scene.add(key);

  const fill = new THREE.PointLight(0x00b8ff, 80, 260);
  fill.position.set(55, 64, 82);
  scene.add(fill);

  createLandingScene();
  rocket = createRocket();
  scene.add(rocket);

  window.addEventListener("resize", resizeScene);
  resizeScene();
}

function createLandingScene() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(340, 340, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x101820, roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(340, 34, 0x1b3448, 0x162433);
  grid.position.y = 0.03;
  scene.add(grid);

  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(22, 22, 1.2, 64),
    new THREE.MeshStandardMaterial({ color: 0x243241, roughness: 0.74, metalness: 0.08 })
  );
  pad.position.set(LANDING_PAD_X, 0.6, LANDING_PAD_Y);
  pad.receiveShadow = true;
  scene.add(pad);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(22.4, 0.55, 8, 80),
    new THREE.MeshStandardMaterial({ color: 0x00b8ff, emissive: 0x004466, roughness: 0.45 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.35;
  scene.add(ring);

  for (const x of [-80, -40, 40, 80]) {
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 42, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x26384a, roughness: 0.8 })
    );
    tower.position.set(x, 21, -72);
    scene.add(tower);
  }
}

function createRocket() {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(3.6, 4.4, 30, 32),
    new THREE.MeshStandardMaterial({ color: 0xd8e2e7, roughness: 0.33, metalness: 0.18 })
  );
  body.position.y = 17;
  body.castShadow = true;
  group.add(body);

  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(3.65, 9, 32),
    new THREE.MeshStandardMaterial({ color: 0xf2f5f7, roughness: 0.25, metalness: 0.12 })
  );
  nose.position.y = 36.5;
  nose.castShadow = true;
  group.add(nose);

  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(3.75, 4.55, 2.4, 32),
    new THREE.MeshStandardMaterial({ color: 0x00b8ff, emissive: 0x003047, roughness: 0.35 })
  );
  band.position.y = 24.8;
  group.add(band);

  landingLegs = new THREE.Group();
  const legMaterial = new THREE.MeshStandardMaterial({ color: 0x34495f, roughness: 0.55, metalness: 0.18 });
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.7, 12, 0.7), legMaterial);
    leg.position.set(side * 5.2, 5.6, 0);
    leg.rotation.z = side * -0.46;
    leg.castShadow = true;
    landingLegs.add(leg);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 2.2), legMaterial);
    foot.position.set(side * 8.2, 0.3, 0);
    foot.castShadow = true;
    landingLegs.add(foot);
  }
  group.add(landingLegs);

  const nozzle = new THREE.Mesh(
    new THREE.ConeGeometry(2.8, 5, 28),
    new THREE.MeshStandardMaterial({ color: 0x151a20, roughness: 0.46, metalness: 0.3 })
  );
  nozzle.position.y = -1.4;
  nozzle.rotation.x = Math.PI;
  group.add(nozzle);

  flame = new THREE.Group();
  const flameOuter = new THREE.Mesh(
    new THREE.ConeGeometry(2.4, 18, 28),
    new THREE.MeshBasicMaterial({ color: 0xff9d2e, transparent: true, opacity: 0.72 })
  );
  flameOuter.position.y = -11;
  flameOuter.rotation.x = Math.PI;
  flame.add(flameOuter);

  const flameInner = new THREE.Mesh(
    new THREE.ConeGeometry(1.15, 12, 22),
    new THREE.MeshBasicMaterial({ color: 0x9ee7ff, transparent: true, opacity: 0.75 })
  );
  flameInner.position.y = -8;
  flameInner.rotation.x = Math.PI;
  flame.add(flameInner);
  group.add(flame);

  return group;
}

function animate() {
  animationId = requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - lastFrame) / 1000, 0.04);
  lastFrame = now;

  if (running) {
    stepSimulation(dt);
  }

  updateRocketVisual();
  updateCamera();
  renderer.render(scene, camera);
}

function stepSimulation(dt: number) {
  if (state.landed || state.crashed) {
    running = false;
    elements.startStop.textContent = "Başlat";
    return;
  }

  const dryMass = readNumber(elements.mass);
  const mass = dryMass + (FUEL_MASS * state.fuel) / 100;
  const altitudeSetpoint = landingVelocityProfile(state.altitude);
  const altitudeError = altitudeSetpoint - state.velocity;
  const hoverThrottle = (mass * GRAVITY) / MAX_THRUST;
  const altitudePid = updatePid(altPid, altitudeError, dt, {
    kp: readNumber(elements.altKp),
    ki: readNumber(elements.altKi),
    kd: readNumber(elements.altKd),
    min: -0.55,
    max: 0.65
  });

  const targetAngle = clamp(
    updatePid(latPid, -state.lateral, dt, {
      kp: readNumber(elements.latKp),
      ki: readNumber(elements.latKi),
      kd: readNumber(elements.latKd),
      min: -0.32,
      max: 0.32
    }) - state.lateralVelocity * 0.018,
    -0.34,
    0.34
  );

  const angleError = targetAngle - state.angle;
  const gimbal = clamp(
    updatePid(angPid, angleError, dt, {
      kp: readNumber(elements.angKp),
      ki: readNumber(elements.angKi),
      kd: readNumber(elements.angKd),
      min: -MAX_GIMBAL,
      max: MAX_GIMBAL
    }),
    -MAX_GIMBAL,
    MAX_GIMBAL
  );

  const fuelAvailable = state.fuel > 0;
  const throttle = fuelAvailable ? clamp(hoverThrottle + altitudePid, 0, 1) : 0;
  const thrust = throttle * MAX_THRUST;
  const thrustAngle = state.angle + gimbal;
  const verticalAcceleration = (Math.cos(thrustAngle) * thrust) / mass - GRAVITY;
  const lateralAcceleration = (Math.sin(thrustAngle) * thrust) / mass + readNumber(elements.wind);
  const angularAcceleration = gimbal * 3.6 - state.angularVelocity * 1.15;

  state.velocity += verticalAcceleration * dt;
  state.altitude = Math.max(0, state.altitude + state.velocity * dt);
  state.lateralVelocity += lateralAcceleration * dt;
  state.lateral += state.lateralVelocity * dt;
  state.angularVelocity += angularAcceleration * dt;
  state.angle += state.angularVelocity * dt;
  state.fuel = Math.max(0, state.fuel - throttle * dt * 1.55);
  state.time += dt;
  state.throttle = throttle;
  state.gimbal = gimbal;
  state.targetVelocity = altitudeSetpoint;
  state.altitudeError = altitudeError;
  state.lateralError = -state.lateral;
  state.angleError = angleError;
  state.acceleration = verticalAcceleration;

  if (state.altitude <= 0.05) {
    const safeSpeed = Math.abs(state.velocity) <= 2.4;
    const safeTilt = Math.abs(radToDeg(state.angle)) <= 7;
    const safeLateral = Math.abs(state.lateral) <= 6;
    const safeDrift = Math.abs(state.lateralVelocity) <= 2.5;
    state.altitude = 0;
    state.landed = safeSpeed && safeTilt && safeLateral && safeDrift;
    state.crashed = !state.landed;
    running = false;
    elements.startStop.textContent = "Başlat";
    setStatus(state.landed ? "Başarılı iniş: hız, açı ve yatay hata limit içinde." : "Sert iniş: PID ayarları veya bozucu koşullar limit dışına çıktı.");
  }

  history.push({ ...state });
  if (history.length > 520) {
    history.shift();
  }
  updateUi();
  drawCharts();
}

function landingVelocityProfile(altitude: number) {
  if (altitude > 180) return -24;
  if (altitude > 90) return -16;
  if (altitude > 35) return -8;
  if (altitude > 10) return -3.4;
  return -1.1;
}

function updateRocketVisual() {
  const scale = 1.0;
  rocket.position.set(state.lateral, Math.max(state.altitude, 0) * 0.72 + 1, 0);
  rocket.rotation.z = -state.angle;
  rocket.scale.setScalar(scale);

  const flameScale = state.throttle > 0.02 && !state.landed && !state.crashed ? 0.35 + state.throttle * 1.15 : 0.001;
  flame.visible = flameScale > 0.01;
  flame.scale.set(1, flameScale, 1);
  flame.rotation.z = state.gimbal * 1.4;

  landingLegs.rotation.z = state.altitude < 45 ? 0 : Math.sin(state.time * 3) * 0.02;
}

function updateCamera() {
  const target = new THREE.Vector3(rocket.position.x, rocket.position.y + 18, rocket.position.z);
  const altitudeFactor = clamp(state.altitude / 280, 0, 1);
  const orbitOffset = new THREE.Vector3(86, 66 + altitudeFactor * 38, 138);
  const sideOffset = new THREE.Vector3(138, 42 + altitudeFactor * 25, 0);
  const topOffset = new THREE.Vector3(0.01, 190, 0.01);
  const offset = cameraMode === "top" ? topOffset : cameraMode === "side" ? sideOffset : orbitOffset;
  camera.position.lerp(target.clone().add(offset), 0.045);
  camera.lookAt(target);
}

function resizeScene() {
  const width = elements.scene3d.clientWidth;
  const height = elements.scene3d.clientHeight;
  if (!width || !height) {
    return;
  }
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function setCameraMode(mode: CameraMode) {
  cameraMode = mode;
  for (const button of [elements.camOrbit, elements.camSide, elements.camTop]) {
    button.classList.add("secondary");
  }
  const active = mode === "orbit" ? elements.camOrbit : mode === "side" ? elements.camSide : elements.camTop;
  active.classList.remove("secondary");
}

function updateUi() {
  const altitude = `${state.altitude.toFixed(0)} m`;
  const velocity = `${state.velocity.toFixed(1)} m/s`;
  const throttle = `${Math.round(state.throttle * 100)}%`;
  const fuel = `${state.fuel.toFixed(0)}%`;
  const angle = `${radToDeg(state.angle).toFixed(1)}°`;
  const gimbal = `${radToDeg(state.gimbal).toFixed(1)}°`;

  elements.mAltitude.textContent = altitude;
  elements.mVelocity.textContent = velocity;
  elements.mThrottle.textContent = throttle;
  elements.mFuel.textContent = fuel;
  elements.dTargetVelocity.textContent = `${state.targetVelocity.toFixed(1)} m/s`;
  elements.dLateral.textContent = `${state.lateral.toFixed(1)} m`;
  elements.dAngle.textContent = `${angle} / ${gimbal}`;
  elements.dAccel.textContent = `${state.acceleration.toFixed(1)} m/s²`;
  elements.oAltitude.textContent = altitude;
  elements.oVelocity.textContent = velocity;
  elements.oThrottle.textContent = throttle;
  elements.oLateral.textContent = `${state.lateral.toFixed(1)} m`;
  elements.oAngle.textContent = angle;
  elements.oFuel.textContent = fuel;

  if (!state.landed && !state.crashed && running) {
    setStatus("PID aktif: irtifa hızı, yatay sapma ve gövde açısı aynı anda denetleniyor.");
  }
}

function drawCharts() {
  drawAltitudeChart();
  drawControlChart();
}

function drawAltitudeChart() {
  const ctx = elements.altitudeChart.getContext("2d");
  if (!ctx) return;
  drawChartFrame(ctx, elements.altitudeChart);
  const maxAltitude = Math.max(1, ...history.map((item) => item.altitude));
  drawSeries(ctx, elements.altitudeChart, history.map((item) => item.altitude / maxAltitude), "#00b8ff");
  drawSeries(ctx, elements.altitudeChart, history.map((item) => (item.velocity + 30) / 42), "#ff4d6a");
}

function drawControlChart() {
  const ctx = elements.controlChart.getContext("2d");
  if (!ctx) return;
  drawChartFrame(ctx, elements.controlChart);
  drawSeries(ctx, elements.controlChart, history.map((item) => item.throttle), "#00e890");
  drawSeries(ctx, elements.controlChart, history.map((item) => (item.gimbal / MAX_GIMBAL + 1) / 2), "#f0aa3d");
}

function drawChartFrame(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#070b12";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i += 1) {
    const y = (height / 4) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawSeries(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, values: number[], color: string) {
  if (values.length < 2) return;
  const width = canvas.width;
  const height = canvas.height;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  values.forEach((raw, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * width;
    const y = height - clamp(raw, 0, 1) * height;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function createPid() {
  return { integral: 0, previousError: 0 };
}

function resetPid(pid: ReturnType<typeof createPid>) {
  pid.integral = 0;
  pid.previousError = 0;
}

function updatePid(
  pid: ReturnType<typeof createPid>,
  error: number,
  dt: number,
  config: { kp: number; ki: number; kd: number; min: number; max: number }
) {
  pid.integral = clamp(pid.integral + error * dt, -100, 100);
  const derivative = (error - pid.previousError) / Math.max(dt, 0.001);
  pid.previousError = error;
  return clamp(config.kp * error + config.ki * pid.integral + config.kd * derivative, config.min, config.max);
}

function readNumber(input: HTMLInputElement) {
  const value = Number(input.value.replace(",", "."));
  return Number.isFinite(value) ? value : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function radToDeg(value: number) {
  return (value * 180) / Math.PI;
}

function setStatus(message: string) {
  elements.status.textContent = message;
}

window.addEventListener("beforeunload", () => {
  cancelAnimationFrame(animationId);
});
