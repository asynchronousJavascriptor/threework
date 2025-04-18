varying vec2 vUv;
uniform float u_scrollSpeed;
uniform float u_scrollDirection;

vec3 deformationCurve(vec3 position, vec2 uv) {
  float wave = sin(uv.x * 3.14) * sign(u_scrollDirection) * (u_scrollSpeed*.04);
  position.y += wave;
  return position;
}

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(deformationCurve(position, vUv), 1.0);
}