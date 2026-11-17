// Solmar City — camera: chase-cam for driving with lag and a speed FOV kick,
// over-shoulder for walking, and smooth transitions when entering/exiting a
// car, plus screen shake.

export function createCamera(G) {
  G.cameraYaw = Math.PI; // looking north (down -z) at start
  G.cameraPitch = 0.32;
  G.cameraDist = 9;
  G.shake = 0;
  G.camPos = { x: 0, y: 8, z: 140 };
  G.camLook = { x: 0, y: 2, z: 120 };
}

export function updateCamera(G, dt) {
  if (G.freezeCam) {
    // Staged screenshot vista: hold the camera exactly where the shot put it.
    G.camera.position.set(G.camPos.x, G.camPos.y, G.camPos.z);
    G.camera.lookAt(G.camLook.x, G.camLook.y, G.camLook.z);
    return;
  }
  const p = G.player;
  const look = G.input.takeLook();
  G.cameraYaw -= look.dx * 0.0032;
  G.cameraPitch = Math.max(-0.15, Math.min(0.9, G.cameraPitch + look.dy * 0.0022));

  let tx;
  let ty;
  let tz;
  let lx;
  let ly;
  let lz;
  let dist = G.cameraDist;
  if (p.car) {
    const car = p.car;
    const speedFrac = Math.min(1, Math.abs(car.speed) / car.def.topSpeed);
    dist = 9 + speedFrac * 4;
    // Chase cam: behind the car, easing toward the car's heading.
    const back = car.heading + Math.PI;
    const wantYaw = Math.atan2(-Math.sin(back), -Math.cos(back));
    // Blend camera yaw toward the car's rear; mouse-look nudges it.
    let dy = wantYaw - G.cameraYaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    G.cameraYaw += dy * Math.min(1, dt * 2.2);
    const pitch = 0.28 + speedFrac * 0.06;
    tx = car.x - Math.sin(G.cameraYaw) * dist * Math.cos(pitch);
    ty = 3.5 + Math.sin(pitch) * dist;
    tz = car.z - Math.cos(G.cameraYaw) * dist * Math.cos(pitch);
    lx = car.x + Math.sin(car.heading) * 6;
    ly = 1.6;
    lz = car.z + Math.cos(car.heading) * 6;
    G.camera.fov = 62 + speedFrac * 10;
    G.camera.updateProjectionMatrix();
  } else {
    dist = 8;
    tx = p.x - Math.sin(G.cameraYaw) * dist * Math.cos(G.cameraPitch);
    ty = 2.2 + Math.sin(G.cameraPitch) * dist;
    tz = p.z - Math.cos(G.cameraYaw) * dist * Math.cos(G.cameraPitch);
    lx = p.x;
    ly = 1.7 + p.y;
    lz = p.z;
    G.camera.fov = 62;
    G.camera.updateProjectionMatrix();
  }
  // Ease the camera toward its target so enter/exit feels smooth.
  const k = Math.min(1, dt * 7);
  G.camPos.x += (tx - G.camPos.x) * k;
  G.camPos.y += (ty - G.camPos.y) * k;
  G.camPos.z += (tz - G.camPos.z) * k;
  G.camLook.x += (lx - G.camLook.x) * k;
  G.camLook.y += (ly - G.camLook.y) * k;
  G.camLook.z += (lz - G.camLook.z) * k;
  // Screen shake decays and jitters the camera a little.
  G.shake = Math.max(0, G.shake - dt * 1.8);
  const sh = G.shake * G.shake * 0.9;
  const jx = (Math.random() - 0.5) * sh;
  const jy = (Math.random() - 0.5) * sh;
  G.camera.position.set(G.camPos.x + jx, G.camPos.y + jy, G.camPos.z);
  G.camera.lookAt(G.camLook.x + jx, G.camLook.y + jy, G.camLook.z);
}
