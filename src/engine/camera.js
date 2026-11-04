// The camera, on the CPU: its frame, and where a point on the screen lands on the sheet.
const hit = new Float32Array(2);

export function cameraFrame(pitch, yaw, roll, F = new Float32Array(9)) {
  const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw), cr = Math.cos(roll), sr = Math.sin(roll);
  const right = [cy, sy, 0], up = [-sy * cp, cy * cp, sp], back = [sy * sp, -cy * sp, cp];
  for (let i = 0; i < 3; i++) { F[i] = right[i] * cr + up[i] * sr; F[3 + i] = up[i] * cr - right[i] * sr; F[6 + i] = back[i]; }
  return F;
}

// v: this frame's values; (u, w): the point on screen, as the shader's uv (height-normalised, centred);
// z: the height of the plane to land on. The same ray the shader marches, for any tilt, turn and lens.
const F = new Float32Array(9);
export function rayOnSheet(v, u, w, z = 0) {
  cameraFrame(v.pitch, v.yaw, v.roll, F);
  const dist = 2 * v.frame * v.focal - (v.fly || 0);
  const ox = v.tx + F[6] * dist, oy = v.ty + F[7] * dist, oz = F[8] * dist;
  const dx = F[0] * u + F[3] * w - F[6] * v.focal, dy = F[1] * u + F[4] * w - F[7] * v.focal, dz = F[2] * u + F[5] * w - F[8] * v.focal;
  let t = dz < -1e-3 ? (z - oz) / dz : Infinity;
  const far = (Math.abs(dist) + 2) * 4 / Math.max(Math.hypot(dx, dy, dz), 1e-3);   // up in the sky: as far as it goes along the ground
  if (!(t > 0) || t > far) t = far;
  hit[0] = ox + dx * t; hit[1] = oy + dy * t;
  return hit;
}
