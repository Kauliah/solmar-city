// Cameras: on-foot over-shoulder orbit, driving chase-cam with lag and speed FOV kick,
// smooth transitions on enter/exit, trauma-based shake.
import * as THREE from 'three';
import { angleLerp, clamp, lerp } from './random.js';

export function createCamera(G) {
  return {
    yaw: 0,
    pitch: 0.32,
    dist: 7.5,
    target: new THREE.Vector3(),
    current: new THREE.Vector3(0, 6, -10),
    fov: 62,
    shake: 0,
  };
}

export function stepCamera(G, input, dt) {
  const cam = G.camera;
  const delta = input.takeMouseDelta();
  cam.yaw -= delta.x * 0.0032;
  cam.pitch = clamp(cam.pitch + delta.y * 0.0022, 0.08, 1.1);
  const p = G.player;
  let desired;
  let lookAt;
  if (p.inCar) {
    const car = p.inCar;
    const back = car.heading + Math.PI;
    const speed01 = Math.abs(car.speed) / car.def.topSpeed;
    const dist = 9 + speed01 * 4;
    desired = new THREE.Vector3(
      car.mesh.position.x + Math.sin(back) * dist,
      4.2 + speed01 * 0.8,
      car.mesh.position.z + Math.cos(back) * dist,
    );
    lookAt = new THREE.Vector3(
      car.mesh.position.x + Math.sin(car.heading) * 6,
      1.6,
      car.mesh.position.z + Math.cos(car.heading) * 6,
    );
    cam.yaw = angleLerp(cam.yaw, car.heading + Math.PI, Math.min(1, dt * 2.2));
    const targetFov = 62 + speed01 * 16;
    cam.fov = lerp(cam.fov, targetFov, Math.min(1, dt * 3));
  } else {
    const dist = 7.5;
    desired = new THREE.Vector3(
      p.mesh.position.x - Math.sin(cam.yaw) * Math.cos(cam.pitch) * dist,
      p.mesh.position.y + 2.2 + Math.sin(cam.pitch) * dist,
      p.mesh.position.z - Math.cos(cam.yaw) * Math.cos(cam.pitch) * dist,
    );
    lookAt = new THREE.Vector3(p.mesh.position.x, p.mesh.position.y + 1.6, p.mesh.position.z);
    cam.fov = lerp(cam.fov, 62, Math.min(1, dt * 3));
  }
  // Keep the camera out of buildings and above the ground.
  desired.y = Math.max(desired.y, 1.2);
  const lag = p.inCar ? 1 - Math.exp(-dt * 4.5) : 1 - Math.exp(-dt * 9);
  cam.current.lerp(desired, lag);
  cam.target.lerp(lookAt, 1 - Math.exp(-dt * 10));
  // Shake decays; applied as a small random offset.
  cam.shake = Math.max(0, cam.shake - dt * 1.8);
  G.cameraShake = cam.shake;
  const s = cam.shake * cam.shake;
  const ox = (Math.random() - 0.5) * s * 0.9;
  const oy = (Math.random() - 0.5) * s * 0.7;
  G.three.camera.position.set(cam.current.x + ox, cam.current.y + oy, cam.current.z);
  G.three.camera.lookAt(cam.target.x + ox, cam.target.y + oy, cam.target.z);
  if (Math.abs(G.three.camera.fov - cam.fov) > 0.05) {
    G.three.camera.fov = cam.fov;
    G.three.camera.updateProjectionMatrix();
  }
}

export function addShake(G, amount) {
  G.camera.shake = Math.min(1, G.camera.shake + amount);
}
