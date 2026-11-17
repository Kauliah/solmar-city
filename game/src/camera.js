// Camera: third-person chase cam with lag and a speed FOV kick while driving,
// over-shoulder orbit on foot, smooth transitions on enter/exit, and shake.
import * as THREE from 'three';

export function createCameraRig(camera) {
  const pos = new THREE.Vector3(0, 8, 140);
  const look = new THREE.Vector3(0, 1.5, 130);
  let fov = 62;
  return {
    update(G, dt) {
      const p = G.player;
      let targetPos;
      let targetLook;
      let targetFov = 62;
      if (p.car) {
        const car = p.car;
        const back = new THREE.Vector3(-Math.sin(car.heading), 0, -Math.cos(car.heading));
        targetPos = new THREE.Vector3(car.x, 0, car.z)
          .add(back.multiplyScalar(10.5))
          .add(new THREE.Vector3(0, 4.2, 0));
        targetLook = new THREE.Vector3(
          car.x + Math.sin(car.heading) * 10,
          1.4,
          car.z + Math.cos(car.heading) * 10,
        );
        targetFov = 62 + Math.min(16, Math.abs(car.speed) * 0.4);
      } else {
        const fwd = new THREE.Vector3(Math.sin(p.camYaw), 0, Math.cos(p.camYaw));
        targetPos = new THREE.Vector3(p.x, p.y, p.z)
          .add(fwd.clone().multiplyScalar(-7.5))
          .add(new THREE.Vector3(0, 3.4 + p.camPitch * 1.6, 0));
        targetLook = new THREE.Vector3(p.x, p.y + 1.6, p.z).add(fwd.clone().multiplyScalar(5));
      }
      const lag = p.car ? 1 - Math.exp(-dt * 5) : 1 - Math.exp(-dt * 10);
      pos.lerp(targetPos, lag);
      look.lerp(targetLook, 1 - Math.exp(-dt * 12));
      // Shake: decaying random offset.
      const shake = G.cameraShake ?? 0;
      const sx = (Math.random() - 0.5) * shake * 0.9;
      const sy = (Math.random() - 0.5) * shake * 0.9;
      camera.position.set(pos.x + sx, pos.y + sy, pos.z);
      camera.lookAt(look.x + sx, look.y + sy, look.z);
      fov += (targetFov - fov) * Math.min(1, dt * 4);
      if (Math.abs(camera.fov - fov) > 0.05) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      G.cameraShake = Math.max(0, shake - dt * 1.4);
    },
    snap(G) {
      // Jump the camera to its target (used when staging screenshots).
      const p = G.player;
      if (p.car) {
        pos.set(
          p.car.x - Math.sin(p.car.heading) * 10.5,
          4.2,
          p.car.z - Math.cos(p.car.heading) * 10.5,
        );
        look.set(p.car.x + Math.sin(p.car.heading) * 10, 1.4, p.car.z + Math.cos(p.car.heading) * 10);
      } else {
        const fwd = new THREE.Vector3(Math.sin(p.camYaw), 0, Math.cos(p.camYaw));
        pos.set(p.x - fwd.x * 7.5, p.y + 3.4 + p.camPitch * 1.6, p.z - fwd.z * 7.5);
        look.set(p.x + fwd.x * 5, p.y + 1.6, p.z + fwd.z * 5);
      }
      // Apply the snapped pose to the real camera now. In shot mode the loop
      // never runs update(), so without this the render keeps the boot camera
      // wherever the player staged — every screenshot from the same spot.
      camera.position.set(pos.x, pos.y, pos.z);
      camera.lookAt(look.x, look.y, look.z);
    },
  };
}
