uniform sampler2D u_image;
uniform vec2 u_mouse;
uniform float u_intensity;
uniform float u_scrollSpeed;

varying vec2 vUv;

void main() {
  float dist = distance(vUv, u_mouse);
  float sm = smoothstep(.6,.0, dist);
  vec2 offset = vec2(.02) * u_intensity * sm;

  float r = texture2D(u_image, vUv + offset).r;
  float g = texture2D(u_image, vUv).g;
  float b = texture2D(u_image, vUv - offset).b;
  
  gl_FragColor = vec4(r,g,b,1.0);
}