// Visual effects: holograms, volumetric cones, particles, arcs, arrows, core plasma, screens
import * as THREE from 'three';

const NOISE3 = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;} vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);} vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){ const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
 vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx); vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
 vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy; i=mod289(i);
 vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
 float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx; vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
 vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y); vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
 vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0)); vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
 vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
 vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3))); p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
 vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
 return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3))); }
`;

export const fxTime = { value: 0 };

export function holoMaterial(color = 0x62e6ff, { opacity = 0.85, rim = 1.6, scan = 1, flicker = 0.08, intensity = 2.2, side = THREE.FrontSide } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: fxTime, uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uRim: { value: rim }, uScan: { value: scan }, uFlicker: { value: flicker }, uInt: { value: intensity }, uGlitch: { value: 0 } },
    vertexShader: /* glsl */`
      uniform float uTime; uniform float uGlitch; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){ vec4 w = modelMatrix * vec4(position,1.0);
        float band = step(0.985, fract(sin(floor(w.y*14.0+uTime*20.0)*43.7)*917.3)) * uGlitch;
        w.x += band*0.06; vW = w.xyz; vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec3 uColor; uniform float uOpacity; uniform float uRim; uniform float uScan; uniform float uFlicker; uniform float uInt;
      varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); float rim = pow(f, uRim);
        float sl = 0.65 + 0.35*sin(vW.y*120.0*uScan - uTime*8.0);
        float fl = 1.0 - uFlicker*step(0.93, fract(sin(floor(uTime*24.0)*12.9898)*43758.5));
        float a = (0.18 + rim*0.9) * sl * fl * uOpacity;
        gl_FragColor = vec4(uColor*uInt*(0.6+rim), a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side,
  });
}

export function coneLight(color = 0xffc070, { length = 6, radius = 2, intensity = 0.35 } = {}) {
  const g = new THREE.ConeGeometry(radius, length, 32, 1, true);
  g.translate(0, -length / 2, 0); // apex at origin, pointing -Y
  const m = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uInt: { value: intensity }, uLen: { value: length }, uTime: fxTime },
    vertexShader: /* glsl */`varying vec3 vN; varying vec3 vV; varying float vY; varying vec3 vW;
      void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW=w.xyz; vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition-w.xyz); vY = -position.y; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */`uniform vec3 uColor; uniform float uInt; uniform float uLen; uniform float uTime; varying vec3 vN; varying vec3 vV; varying float vY; varying vec3 vW;
      ${NOISE3}
      void main(){ float t = clamp(vY/uLen,0.0,1.0); float edge = pow(abs(dot(normalize(vN),normalize(vV))), 1.6);
        float n = 0.75 + 0.25*snoise(vW*0.6 + vec3(0.0, uTime*0.15, 0.0));
        float a = edge * (1.0-t) * smoothstep(0.0,0.08,t) * uInt * n;
        gl_FragColor = vec4(uColor*a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 5; mesh.userData.noShadow = true;
  return mesh;
}

export function coreMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: fxTime, uStab: { value: 0.0 }, uHeat: { value: 1.0 }, uColA: { value: new THREE.Color(1.0, 0.45, 0.12) }, uColB: { value: new THREE.Color(1.0, 0.92, 0.75) } },
    vertexShader: /* glsl */`varying vec3 vP; varying vec3 vN; varying vec3 vV; void main(){ vP = position; vec4 w = modelMatrix*vec4(position,1.0); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition-w.xyz); gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */`uniform float uTime; uniform float uStab; uniform float uHeat; uniform vec3 uColA; uniform vec3 uColB; varying vec3 vP; varying vec3 vN; varying vec3 vV;
      ${NOISE3}
      void main(){ vec3 p = normalize(vP)*2.2; float t = uTime*(0.25 + (1.0-uStab)*0.5);
        float n = snoise(p + vec3(0.0,t,0.0))*0.5 + snoise(p*2.3 - vec3(t*1.3))*0.3 + snoise(p*5.1 + t*2.0)*0.2;
        float cells = smoothstep(0.05, 0.0, abs(n)) ; float f = pow(1.0 - abs(dot(normalize(vN),normalize(vV))), 2.0);
        vec3 c = mix(uColA*0.6, uColB, smoothstep(-0.2,0.7,n)) * (1.5 + 2.5*uHeat);
        c += uColB*cells*6.0*uHeat; c += uColA*f*4.0;
        c = mix(c, vec3(0.25,0.85,1.0)*(2.0+cells*5.0), uStab);
        gl_FragColor = vec4(c,1.0); }`,
  });
}

let _spriteTex = null;
function spriteTex() {
  if (_spriteTex) return _spriteTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); _spriteTex = new THREE.CanvasTexture(c); return _spriteTex;
}

// CPU-simulated particle system rendered as points
export class Particles {
  constructor(max = 500, { additive = true, size = 0.1, color = 0xffffff, texture = null, opacity = 1, gravity = 0, drag = 0, sizeGrow = 0, fadeIn = 0.1 } = {}) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.sizeArr = new Float32Array(max); this.alpha = new Float32Array(max); this.baseSize = new Float32Array(max); this.col = new Float32Array(max * 3);
    const g = this.geo = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.sizeArr, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: texture || spriteTex() }, uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uScale: { value: innerHeight / 2 } },
      vertexShader: /* glsl */`attribute float aSize; attribute float aAlpha; attribute vec3 aColor; varying float vA; varying vec3 vC; uniform float uScale;
        void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = aSize * uScale / max(0.1,-mv.z) * projectionMatrix[1][1]; vA = aAlpha; vC = aColor; }`,
      fragmentShader: /* glsl */`uniform sampler2D uTex; uniform vec3 uColor; uniform float uOpacity; varying float vA; varying vec3 vC;
        void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(uColor*vC*t.rgb, t.a*vA*uOpacity); }`,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 6;
    Object.assign(this, { gravity, drag, sizeGrow, fadeIn });
  }
  spawn(x, y, z, vx, vy, vz, life, size, r = 1, gr = 1, b = 1) {
    let i = this.n < this.max ? this.n++ : Math.floor(Math.random() * this.max);
    this.pos.set([x, y, z], i * 3); this.vel.set([vx, vy, vz], i * 3); this.life[i] = life; this.maxLife[i] = life; this.baseSize[i] = size; this.col.set([r, gr, b], i * 3);
  }
  update(dt) {
    const p = this.pos, v = this.vel; let j = 0;
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) continue;
      if (j !== i) { p[j * 3] = p[i * 3]; p[j * 3 + 1] = p[i * 3 + 1]; p[j * 3 + 2] = p[i * 3 + 2]; v[j * 3] = v[i * 3]; v[j * 3 + 1] = v[i * 3 + 1]; v[j * 3 + 2] = v[i * 3 + 2]; this.life[j] = this.life[i]; this.maxLife[j] = this.maxLife[i]; this.baseSize[j] = this.baseSize[i]; this.col[j * 3] = this.col[i * 3]; this.col[j * 3 + 1] = this.col[i * 3 + 1]; this.col[j * 3 + 2] = this.col[i * 3 + 2]; }
      const k = 1 - this.drag * dt;
      v[j * 3] *= k; v[j * 3 + 1] = v[j * 3 + 1] * k - this.gravity * dt; v[j * 3 + 2] *= k;
      p[j * 3] += v[j * 3] * dt; p[j * 3 + 1] += v[j * 3 + 1] * dt; p[j * 3 + 2] += v[j * 3 + 2] * dt;
      const t = 1 - this.life[j] / this.maxLife[j];
      this.alpha[j] = Math.min(1, t / Math.max(0.001, this.fadeIn)) * (1 - t);
      this.sizeArr[j] = this.baseSize[j] * (1 + this.sizeGrow * t);
      j++;
    }
    this.n = j;
    this.geo.setDrawRange(0, this.n);
    for (const a of ['position', 'aSize', 'aAlpha', 'aColor']) this.geo.attributes[a].needsUpdate = true;
    this.mat.uniforms.uScale.value = Particles.scaleH || innerHeight / 2;
  }
}
Particles.scaleH = 0;

// jagged electric arc between two points
export class Arc {
  constructor(color = 0x9fd8ff, segs = 18) {
    this.segs = segs; this.geo = new THREE.BufferGeometry(); this.arr = new Float32Array((segs + 1) * 3);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.arr, 3));
    this.line = new THREE.Line(this.geo, new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(8), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.line.frustumCulled = false; this.a = new THREE.Vector3(); this.b = new THREE.Vector3(); this.t = 0;
  }
  set(a, b, jitter = 0.3) {
    this.a.copy(a); this.b.copy(b); const d = new THREE.Vector3().subVectors(b, a);
    for (let i = 0; i <= this.segs; i++) { const t = i / this.segs; const j = (i === 0 || i === this.segs) ? 0 : jitter * Math.sin(t * Math.PI); this.arr.set([a.x + d.x * t + (Math.random() - .5) * j, a.y + d.y * t + (Math.random() - .5) * j, a.z + d.z * t + (Math.random() - .5) * j], i * 3); }
    this.geo.attributes.position.needsUpdate = true;
  }
}

// Vector arrow with glow
export class Arrow extends THREE.Group {
  constructor(color = 0xffb547, radius = 0.025) {
    super();
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(3), transparent: true, opacity: 0.95, depthTest: false, depthWrite: false });
    this.shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 8), m); this.shaft.geometry.translate(0, 0.5, 0);
    this.head = new THREE.Mesh(new THREE.ConeGeometry(radius * 3, radius * 8, 12), m); this.head.geometry.translate(0, radius * 4, 0);
    this.add(this.shaft, this.head); this.renderOrder = 20; this.shaft.renderOrder = 20; this.head.renderOrder = 20; this.mat = m; this.rad = radius;
  }
  setVec(origin, vec) {
    const L = vec.length(); this.position.copy(origin); this.visible = L > 1e-4; if (!this.visible) return;
    const hl = this.rad * 8; const sl = Math.max(0.001, L - hl);
    this.shaft.scale.set(1, sl, 1); this.head.position.set(0, sl, 0);
    this.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vec.clone().normalize());
  }
}

// Canvas-driven screen texture (retro terminal look)
export class Screen {
  constructor(w = 512, h = 320, draw = null) {
    this.c = document.createElement('canvas'); this.c.width = w; this.c.height = h; this.x = this.c.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.c); this.tex.colorSpace = THREE.SRGBColorSpace; this.draw = draw; this.t = 0; this.acc = 0;
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, color: new THREE.Color(1.6, 1.6, 1.6) });
    if (draw) { draw(this.x, w, h, 0); this.tex.needsUpdate = true; }
  }
  update(dt, every = 0.15) { this.t += dt; this.acc += dt; if (this.acc < every || !this.draw) return; this.acc = 0; this.draw(this.x, this.c.width, this.c.height, this.t); this.tex.needsUpdate = true; }
}

export function drawTerminal(x, w, h, t, { title = 'КОНСТАНТА', lines = [], color = '#7cf3ff', bg = '#03121a', glitch = 0, warn = false } = {}) {
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  x.fillStyle = warn ? 'rgba(255,60,40,.12)' : 'rgba(98,230,255,.06)';
  for (let y = 0; y < h; y += 4) x.fillRect(0, y, w, 1);
  x.fillStyle = warn ? '#ff7060' : color; x.font = `bold ${Math.round(h * 0.09)}px 'JetBrains Mono'`; x.textBaseline = 'top';
  x.fillText(title, w * 0.05, h * 0.06);
  x.fillRect(w * 0.05, h * 0.18, w * 0.9, 2);
  x.font = `${Math.round(h * 0.068)}px 'JetBrains Mono'`;
  lines.forEach((L, i) => { let s = typeof L === 'function' ? L(t) : L; if (glitch && Math.random() < glitch) s = s.split('').map(c => Math.random() < 0.3 ? '▒' : c).join(''); x.fillStyle = (s.startsWith('!') ? '#ffb547' : (warn ? '#ffb0a5' : color)); x.fillText(s.replace(/^!/, ''), w * 0.05, h * (0.24 + i * 0.1)); });
  if (Math.floor(t * 2) % 2) { x.fillStyle = warn ? '#ff7060' : color; x.fillRect(w * 0.05, h * 0.9, w * 0.03, h * 0.05); }
}
