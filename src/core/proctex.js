// GPU procedural PBR textures (tileable). Each recipe outputs albedo, normal (from height) and ORM (ao, rough, metal).
import * as THREE from 'three';

const COMMON = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform float uMode; uniform float uTexel; uniform vec3 uColor; uniform vec3 uColor2; uniform float uSeed; uniform float uNormal;
vec2 h2(vec2 p){ p = vec2(dot(p,vec2(127.1,311.7)+uSeed), dot(p,vec2(269.5,183.3)-uSeed)); return fract(sin(p)*43758.5453); }
float h1(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233))+uSeed*1.7)*43758.5453); }
float pn(vec2 p, vec2 per){
  vec2 i=floor(p), f=fract(p); vec2 u=f*f*f*(f*(f*6.0-15.0)+10.0);
  vec2 a=h2(mod(i,per))*2.-1., b=h2(mod(i+vec2(1,0),per))*2.-1., c=h2(mod(i+vec2(0,1),per))*2.-1., d=h2(mod(i+vec2(1,1),per))*2.-1.;
  return mix(mix(dot(a,f),dot(b,f-vec2(1,0)),u.x), mix(dot(c,f-vec2(0,1)),dot(d,f-vec2(1,1)),u.x), u.y);
}
float fbm(vec2 uv, float base, int oct){ float s=0., a=.5, f=base; for(int i=0;i<9;i++){ if(i>=oct) break; s+=a*pn(uv*f, vec2(f)); f*=2.; a*=.5; } return s; }
float fbmA(vec2 uv, vec2 base, int oct){ float s=0., a=.5; vec2 f=base; for(int i=0;i<9;i++){ if(i>=oct) break; s+=a*pn(uv*f, f); f*=2.; a*=.5; } return s; }
// periodic voronoi: returns (F1, cell id hash)
vec2 vor(vec2 uv, float n){
  vec2 p=uv*n; vec2 i=floor(p), f=fract(p); float md=8.; float id=0.;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(x,y); vec2 c=mod(i+g,vec2(n)); vec2 o=h2(c); vec2 r=g+o-f; float d=dot(r,r); if(d<md){md=d; id=h1(c);} }
  return vec2(sqrt(md), id);
}
float line(float x, float w){ return smoothstep(w, 0.0, abs(x)); }
float grid(float x, float n, float w){ float g = fract(x*n); return max(line(g, w*n), line(1.0-g, w*n)); }
`;

const RECIPES = {
  concrete: `
    float H(vec2 uv){ float n=fbm(uv,6.,6)*.5; float seam=max(grid(uv.y,2.,.004),grid(uv.x,1.,.003));
      vec2 hp=fract(uv*vec2(4.,4.))-.5; float hole=smoothstep(.035,.02,length(hp*vec2(1.,1.)));
      float pits=smoothstep(.06,.0,vor(uv,40.).x)*.5;
      return n - seam*.6 - hole*.8 - pits*.3; }
    vec3 A(vec2 uv){ float n=fbm(uv,4.,6); float st=fbmA(uv,vec2(14.,1.5),5); float b=fbm(uv+3.1,1.,3);
      vec3 c=uColor*(0.86+n*.35) ; c*=1.0-smoothstep(.0,.6,st+.1)*.25; c=mix(c,c*vec3(.95,.9,.82),smoothstep(-.1,.4,b));
      float seam=max(grid(uv.y,2.,.004),grid(uv.x,1.,.003)); c*=1.-seam*.35;
      vec2 hp=fract(uv*vec2(4.,4.))-.5; c*=1.-smoothstep(.04,.02,length(hp))*.55; return c; }
    float R(vec2 uv){ return .82+fbm(uv,8.,4)*.25; } float M(vec2 uv){ return 0.; }`,
  floor: `
    float H(vec2 uv){ vec2 v=vor(uv,70.); float agg=smoothstep(.25,.0,v.x)*.3; float jt=max(grid(uv.x,2.,.0025),grid(uv.y,2.,.0025));
      return fbm(uv,8.,5)*.25 + agg*.3 - jt; }
    vec3 A(vec2 uv){ vec2 v=vor(uv,70.); float n=fbm(uv,3.,6); float scuff=fbmA(uv,vec2(30.,3.),4);
      vec3 c=uColor*(.85+n*.4); c=mix(c, c*(.75+.5*v.y), .35*smoothstep(.3,.0,v.x));
      c*=1.-smoothstep(.15,.45,scuff)*.18; float jt=max(grid(uv.x,2.,.0025),grid(uv.y,2.,.0025)); c*=1.-jt*.5; return c; }
    float R(vec2 uv){ float p=fbm(uv,2.,4); return clamp(.62+p*.5+fbm(uv,20.,3)*.15,.3,.95); } float M(vec2 uv){ return 0.; }`,
  panel: `
    float seamF(vec2 uv){ return max(grid(uv.x,2.,.003),grid(uv.y,2.,.003)); }
    float rivet(vec2 uv){ vec2 g=fract(uv*vec2(2.,2.)); vec2 q=fract(uv*vec2(16.,2.))-.5; float onH=line(g.y-.06,.02)+line(g.y-.94,.02); vec2 q2=vec2(q.x,(g.y<.5?g.y-.06:g.y-.94)*8.); return clamp(onH,0.,1.)*smoothstep(.22,.12,length(q2)); }
    float chip(vec2 uv){ float s=seamF(uv); float n=fbm(uv,12.,5); float e=smoothstep(.0,.5,s+fbm(uv,40.,3)*.4); return smoothstep(.55,.62,n*.8+e*.6+ fbm(uv,3.,3)*.3); }
    float H(vec2 uv){ return -seamF(uv)*.9 + rivet(uv)*.8 - chip(uv)*.25 + fbm(uv,30.,3)*.05; }
    vec3 A(vec2 uv){ float n=fbm(uv,5.,5); vec3 c=uColor*(.9+n*.25); float ch=chip(uv); c=mix(c, vec3(.42,.42,.44)*(.8+n), ch);
      c*=1.-seamF(uv)*.5; float grime=smoothstep(.1,.6,fbmA(uv,vec2(2.,12.),4)); c*=1.-grime*.22; c=mix(c,vec3(.6),rivet(uv)*.3); return c; }
    float R(vec2 uv){ return mix(.5+fbm(uv,10.,3)*.2, .35, chip(uv)); } float M(vec2 uv){ return chip(uv)*.9+rivet(uv)*.3; }`,
  steel: `
    float H(vec2 uv){ return fbmA(uv,vec2(2.,90.),5)*.15 + fbm(uv,6.,3)*.05; }
    vec3 A(vec2 uv){ float s=fbmA(uv,vec2(2.,120.),5); float d=fbm(uv,4.,5); return uColor*(.85+s*.35)*(1.-smoothstep(.1,.5,d)*.15); }
    float R(vec2 uv){ return clamp(.3+fbmA(uv,vec2(3.,80.),4)*.25+smoothstep(.2,.6,fbm(uv,3.,4))*.2,.12,.8); } float M(vec2 uv){ return 1.; }`,
  brass: `
    float pat(vec2 uv){ return smoothstep(.15,.45,fbm(uv,4.,6)+fbm(uv,25.,3)*.3); }
    float H(vec2 uv){ return fbm(uv,20.,4)*.1 + pat(uv)*.15; }
    vec3 A(vec2 uv){ float n=fbmA(uv,vec2(3.,40.),5); vec3 c=uColor*(.9+n*.25); return mix(c, uColor2*(.8+n*.3), pat(uv)); }
    float R(vec2 uv){ return mix(.26+fbm(uv,30.,3)*.15, .7, pat(uv)); } float M(vec2 uv){ return mix(1., .25, pat(uv)); }`,
  darkmetal: `
    float wear(vec2 uv){ return smoothstep(.45,.6,fbm(uv,8.,6)+fbm(uv,50.,3)*.25); }
    float H(vec2 uv){ return fbm(uv,40.,4)*.1 - wear(uv)*.1; }
    vec3 A(vec2 uv){ float n=fbm(uv,6.,5); vec3 c=uColor*(.85+n*.4); return mix(c, vec3(.55,.55,.57), wear(uv)); }
    float R(vec2 uv){ return mix(.55+fbm(uv,12.,3)*.25, .3, wear(uv)); } float M(vec2 uv){ return mix(.7,1.,wear(uv)); }`,
  tiles: `
    vec2 tid(vec2 uv){ return floor(uv*8.); }
    float gr(vec2 uv){ vec2 f=fract(uv*8.); float w=.035; return max(max(smoothstep(w,.0,f.x),smoothstep(1.-w,1.,f.x)),max(smoothstep(w,.0,f.y),smoothstep(1.-w,1.,f.y))); }
    float crack(vec2 uv){ vec2 v=vor(uv,10.); return smoothstep(.02,.0,abs(v.x-.42))*step(.8,h1(tid(uv))); }
    float H(vec2 uv){ return -gr(uv)*.8 - crack(uv)*.4 + fbm(uv,64.,2)*.03; }
    vec3 A(vec2 uv){ float t=h1(tid(uv)); vec3 c=mix(uColor, uColor2, step(.86,t)) * (.93+t*.1); c*=.92+fbm(uv,6.,4)*.12; c=mix(c, vec3(.38,.37,.34), gr(uv)); c*=1.-crack(uv)*.5;
      c*=1.-smoothstep(.2,.7,fbm(uv,2.,4))*.18; return c; }
    float R(vec2 uv){ return mix(.12+fbm(uv,20.,3)*.1, .9, gr(uv)); } float M(vec2 uv){ return 0.; }`,
  plate: `
    float dia(vec2 uv){ vec2 q=fract(uv*12.)-.5; vec2 r=mat2(.707,-.707,.707,.707)*q; float a=smoothstep(.09,.05,abs(r.x))*smoothstep(.38,.3,abs(r.y));
      vec2 q2=fract(uv*12.+.5)-.5; vec2 r2=mat2(.707,.707,-.707,.707)*q2; float b=smoothstep(.09,.05,abs(r2.x))*smoothstep(.38,.3,abs(r2.y)); return max(a,b); }
    float H(vec2 uv){ return dia(uv)*.9 + fbm(uv,20.,3)*.06; }
    vec3 A(vec2 uv){ float n=fbm(uv,5.,5); vec3 c=uColor*(.8+n*.5); float dirt=smoothstep(-.1,.4,fbm(uv,3.,5)); c=mix(c, c*.45, dirt*(1.-dia(uv))*.8); return c*(1.+dia(uv)*.25); }
    float R(vec2 uv){ return mix(.55, .28, dia(uv)) + fbm(uv,8.,3)*.15; } float M(vec2 uv){ return .95; }`,
  hazard: `
    float st(vec2 uv){ return step(.5, fract((uv.x+uv.y)*4.)); }
    float wr(vec2 uv){ return smoothstep(.5,.62,fbm(uv,10.,5)+fbm(uv,60.,3)*.3); }
    float H(vec2 uv){ return -wr(uv)*.2 + fbm(uv,40.,3)*.05; }
    vec3 A(vec2 uv){ vec3 c=mix(vec3(.02), uColor, st(uv)); float n=fbm(uv,6.,4); c*= .85+n*.3; return mix(c, vec3(.35,.34,.33), wr(uv)); }
    float R(vec2 uv){ return mix(.55,.4,wr(uv)); } float M(vec2 uv){ return wr(uv)*.8; }`,
  rubber: `
    float H(vec2 uv){ return fbm(uv,40.,4)*.2; }
    vec3 A(vec2 uv){ return uColor*(.9+fbm(uv,10.,4)*.3); }
    float R(vec2 uv){ return .85+fbm(uv,10.,3)*.1; } float M(vec2 uv){ return 0.; }`,
  wood: `
    float H(vec2 uv){ return fbmA(uv,vec2(3.,40.),5)*.12; }
    vec3 A(vec2 uv){ float g=fbmA(uv,vec2(2.,24.),6); float ring=sin((uv.y*30.+g*6.)*3.1415)*.5+.5; vec3 c=mix(uColor, uColor2, ring*.6+g*.4); return c*(.9+fbm(uv,8.,3)*.2); }
    float R(vec2 uv){ return .45+fbm(uv,10.,3)*.15; } float M(vec2 uv){ return 0.; }`,
  paint: `
    float rust(vec2 uv){ return smoothstep(.5,.65,fbm(uv,6.,6)+fbm(uv,40.,3)*.25); }
    float H(vec2 uv){ return -rust(uv)*.25 + fbm(uv,50.,3)*.06; }
    vec3 A(vec2 uv){ float n=fbm(uv,5.,4); vec3 c=uColor*(.9+n*.2); vec3 r=mix(vec3(.35,.16,.07),vec3(.55,.3,.12),fbm(uv,30.,3)+.5); return mix(c, r, rust(uv)); }
    float R(vec2 uv){ return mix(.42+fbm(uv,12.,3)*.15,.85,rust(uv)); } float M(vec2 uv){ return mix(.15,.3,rust(uv)); }`,
};

const MAIN = /* glsl */`
void main(){
  vec2 uv = vUv;
  if (uMode < 0.5) { gl_FragColor = vec4(clamp(A(uv),0.,1.), 1.0); }
  else if (uMode < 1.5) {
    float e = uTexel;
    float hl=H(fract(uv-vec2(e,0.))), hr=H(fract(uv+vec2(e,0.))), hd=H(fract(uv-vec2(0.,e))), hu=H(fract(uv+vec2(0.,e)));
    vec3 n = normalize(vec3((hl-hr)*uNormal, (hd-hu)*uNormal, 1.0));
    gl_FragColor = vec4(n*0.5+0.5, 1.0);
  } else {
    float h = H(uv); float hb = 0.25*(H(fract(uv+vec2(uTexel*4.,0.)))+H(fract(uv-vec2(uTexel*4.,0.)))+H(fract(uv+vec2(0.,uTexel*4.)))+H(fract(uv-vec2(0.,uTexel*4.))));
    float ao = clamp(1.0 - max(0.0, hb - h)*3.0, 0.35, 1.0);
    gl_FragColor = vec4(ao, clamp(R(uv),0.04,1.0), clamp(M(uv),0.,1.), 1.0);
  }
}`;

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export class TexFactory {
  constructor(renderer) {
    this.r = renderer;
    this.scene = new THREE.Scene();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.mats = {};
    this.cache = {};
    this.aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }
  material(recipe) {
    if (!this.mats[recipe]) {
      this.mats[recipe] = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: COMMON + RECIPES[recipe] + MAIN,
        uniforms: { uMode: { value: 0 }, uTexel: { value: 1 / 512 }, uColor: { value: new THREE.Color() }, uColor2: { value: new THREE.Color() }, uSeed: { value: 0 }, uNormal: { value: 4 } },
        depthTest: false, depthWrite: false,
      });
    }
    return this.mats[recipe];
  }
  // returns { map, normalMap, orm }
  make(recipe, { size = 1024, color = 0x888888, color2 = 0x444444, seed = 1, normal = 4 } = {}) {
    const key = `${recipe}|${size}|${color}|${color2}|${seed}|${normal}`;
    if (this.cache[key]) return this.cache[key];
    const m = this.material(recipe);
    m.uniforms.uTexel.value = 1 / size; m.uniforms.uColor.value.set(color); m.uniforms.uColor2.value.set(color2); m.uniforms.uSeed.value = seed; m.uniforms.uNormal.value = normal;
    this.quad.material = m;
    const out = {};
    const prevTarget = this.r.getRenderTarget();
    for (const [mode, name, cs] of [[0, 'map', THREE.SRGBColorSpace], [1, 'normalMap', THREE.NoColorSpace], [2, 'orm', THREE.NoColorSpace]]) {
      const rt = new THREE.WebGLRenderTarget(size, size, { colorSpace: cs, depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, type: THREE.UnsignedByteType });
      m.uniforms.uMode.value = mode;
      this.r.setRenderTarget(rt);
      this.r.render(this.scene, this.cam);
      const t = rt.texture; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = this.aniso; t.colorSpace = cs;
      out[name] = t;
    }
    this.r.setRenderTarget(prevTarget);
    this.cache[key] = out;
    return out;
  }
}
