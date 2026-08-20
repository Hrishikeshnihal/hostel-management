#version 460 core
#include <flutter/runtime_effect.glsl>

out vec4 fragColor;

uniform vec2 uResolution;
uniform float uProgress;
uniform float uDir;
uniform float uMode;
uniform float uIntensity;
uniform float uScale;
uniform float uAberration;
uniform float uDrift;
uniform float uTime;
uniform float uReduce;
uniform vec2 uPointer;
uniform vec3 uOverlay;
uniform sampler2D tCurrent;
uniform sampler2D tNext;

const float PI = 3.14159265359;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

vec2 rot(vec2 p, float a) {
  float s = sin(a);
  float c = cos(a);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

void main() {
  float pVal = clamp(uProgress, 0.0, 1.0);
  float env = sin(pVal * PI);

  vec2 uv = flutter_FragCoord().xy / uResolution;

  // Add subtle drift/breathing
  uv += vec2(sin(uTime * 0.25 + uv.y * 4.0), cos(uTime * 0.22 + uv.x * 4.0)) * uDrift * 0.008;
  uv = (uv - 0.5) * (1.0 - uDrift * 0.02 * sin(uTime * 0.4)) + 0.5;

  vec2 uvC = uv;
  vec2 uvN = uv;
  float m = smoothstep(0.0, 1.0, pVal);

  if (uReduce < 0.5) {
    if (uMode > 2.5) { // swirl
      vec2 c = uv - 0.5;
      float r = length(c);
      float ang = env * uIntensity * 3.5 * (1.0 - r);
      uvC = rot(c, ang) + 0.5;
      uvN = rot(c, -ang) + 0.5;
      m = smoothstep(0.0, 1.0, pVal);
    } else if (uMode > 1.5) { // shear (slices)
      float slices = 14.0;
      float row = floor(uv.y * slices);
      float rnd = hash11(row);
      vec2 disp = vec2((rnd - 0.5) * env * uIntensity * 0.6, 0.0);
      uvC = uv + disp;
      uvN = uv + disp;
      float localX = uDir > 0.0 ? uv.x : 1.0 - uv.x;
      float th = pVal * 1.5 - 0.25 + (rnd - 0.5) * 0.25;
      m = 1.0 - smoothstep(th - 0.06, th + 0.06, localX);
    } else if (uMode > 0.5) { // ripple
      float d = distance(uv, uPointer);
      float ring = pVal * 1.6;
      float wave = sin((d - ring) * 30.0) * env;
      vec2 dir = normalize(uv - uPointer + 1e-4);
      vec2 disp = dir * wave * uIntensity * 0.25;
      uvC = uv + disp;
      uvN = uv + disp * 0.6;
      m = 1.0 - smoothstep(ring - 0.03, ring + 0.03, d);
    } else { // melt
      float nn = fbm(uv * uScale + uTime * 0.03);
      float warp = fbm(uv * uScale * 1.7 - uTime * 0.02);
      vec2 g = vec2(nn, warp) - 0.5;
      uvC = uv + g * uIntensity * 0.5 * pVal;
      uvN = uv - g * uIntensity * 0.5 * (1.0 - pVal);
      m = smoothstep(nn - 0.15, nn + 0.15, pVal);
    }
  }

  float ca = uReduce < 0.5 ? uAberration * env * 0.03 : 0.0;

  // Perform texture color sampling with optional chromatic aberration
  vec3 colC = vec3(
    texture(tCurrent, uvC + vec2(ca, 0.0)).r,
    texture(tCurrent, uvC).g,
    texture(tCurrent, uvC - vec2(ca, 0.0)).b
  );
  vec3 colN = vec3(
    texture(tNext, uvN + vec2(ca, 0.0)).r,
    texture(tNext, uvN).g,
    texture(tNext, uvN - vec2(ca, 0.0)).b
  );

  vec3 col = mix(colC, colN, m);

  // Subtle vignette / overlay tint bleed
  float vig = smoothstep(1.25, 0.25, length(uv - 0.5));
  col = mix(col, uOverlay, (1.0 - vig) * 0.28);

  fragColor = vec4(col, 1.0);
}
