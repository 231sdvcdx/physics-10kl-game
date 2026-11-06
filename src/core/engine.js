import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect, SMAAEffect, SMAAPreset,
  DepthOfFieldEffect, ChromaticAberrationEffect, NoiseEffect, BlendFunction, OutlineEffect, Effect, KernelSize, Pass, CopyMaterial } from 'postprocessing';
import { N8AOPostPass } from 'n8ao';

export const QUALITY = {
  low:    { label: 'Низко',   pr: 0.75, maxPr: 1,   shadows: false, shadowSize: 512,  ao: false, smaa: false, bloomScale: 0.5, particles: 0.35, texSize: 512,  dofCut: false, lights: 0.6 },
  medium: { label: 'Средне',  pr: 1,    maxPr: 1,   shadows: true,  shadowSize: 1024, ao: false, smaa: true,  bloomScale: 0.75, particles: 0.65, texSize: 1024, dofCut: true,  lights: 0.8 },
  high:   { label: 'Высоко',  pr: 1,    maxPr: 1.5, shadows: true,  shadowSize: 2048, ao: 'Medium', smaa: true, bloomScale: 1, particles: 1, texSize: 1024, dofCut: true, lights: 1 },
  ultra:  { label: 'Ультра',  pr: 1,    maxPr: 2,   shadows: true,  shadowSize: 2048, ao: 'High', smaa: true,  bloomScale: 1, particles: 1.4, texSize: 2048, dofCut: true, lights: 1 },
};

class VisionEffect extends Effect {
  constructor() {
    super('VisionEffect', /* glsl */`
      uniform float amount; uniform float time;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
        vec3 c = inputColor.rgb;
        float l = dot(c, vec3(0.2126,0.7152,0.0722));
        vec3 tint = mix(vec3(0.02,0.07,0.10), vec3(0.55,0.95,1.1), smoothstep(0.0,1.0,l));
        vec3 g = mix(c, tint*0.75 + c*0.35, amount*0.85);
        float scan = 0.94 + 0.06*sin(uv.y*900.0 + time*6.0);
        vec2 d = uv-0.5; float r = dot(d,d);
        g *= mix(1.0, scan, amount);
        g += amount * vec3(0.05,0.25,0.35) * smoothstep(0.12,0.36,r);
        outputColor = vec4(g, inputColor.a);
      }`, { uniforms: new Map([['amount', new THREE.Uniform(0)], ['time', new THREE.Uniform(0)]]) });
  }
}

// copies input → output and swaps: after the AO pass the frame must leave the buffer that carries the depth texture,
// otherwise the next depth-reading pass (DOF/outline) would render into its own depth source (feedback loop → black/garbage frame)
class BlitPass extends Pass {
  constructor() { super('BlitPass'); this.fullscreenMaterial = new CopyMaterial(); this.needsSwap = true; }
  render(renderer, inputBuffer, outputBuffer) {
    this.fullscreenMaterial.inputBuffer = inputBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer);
    renderer.render(this.scene, this.camera);
  }
}

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, depth: false, alpha: false });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.setClearColor(0x000000, 1);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 600);
    this.scene.add(this.camera);
    this.quality = 'high';
    this.q = QUALITY.high;
    this.time = 0;
    this.exposure = 1;
    this.dofActive = false;
    this.buildComposer();
    addEventListener('resize', () => this.resize());
    this.resize();
  }
  buildComposer() {
    const r = this.renderer;
    if (this.composer) this.composer.dispose();
    const composer = this.composer = new EffectComposer(r, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
    this.renderPass = new RenderPass(this.scene, this.camera);
    composer.addPass(this.renderPass);
    const q = this.q;
    this.aoPass = null;
    if (q.ao) {
      try {
        const ao = new N8AOPostPass(this.scene, this.camera, innerWidth, innerHeight);
        ao.configuration.aoRadius = 1.6; ao.configuration.distanceFalloff = 1.0; ao.configuration.intensity = 2.6;
        ao.configuration.gammaCorrection = false; ao.configuration.halfRes = q.ao !== 'High';
        ao.setQualityMode(q.ao);
        composer.addPass(ao); this.aoPass = ao;
        composer.addPass(new BlitPass());
      } catch (e) { console.warn('AO disabled', e); }
    }
    this.bloom = new BloomEffect({ intensity: 1.15, luminanceThreshold: 0.72, luminanceSmoothing: 0.28, mipmapBlur: true, radius: 0.72, levels: q.bloomScale < 1 ? 6 : 8 });
    this.outline = new OutlineEffect(this.scene, this.camera, { blendFunction: BlendFunction.SCREEN, edgeStrength: 4, pulseSpeed: 0.55, visibleEdgeColor: 0x62e6ff, hiddenEdgeColor: 0x0a2a33, xRay: false, kernelSize: KernelSize.VERY_SMALL, blur: true, resolutionScale: 0.6 });
    this.dof = new DepthOfFieldEffect(this.camera, { worldFocusDistance: 3, worldFocusRange: 3, bokehScale: 0, resolutionScale: 0.5 });
    this.vignette = new VignetteEffect({ offset: 0.28, darkness: 0.62 });
    this.noise = new NoiseEffect({ premultiply: true, blendFunction: BlendFunction.SOFT_LIGHT });
    this.noise.blendMode.opacity.value = 0.18;
    this.vision = new VisionEffect();
    this.tonemap = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    this.mainPass = new EffectPass(this.camera, this.outline, this.bloom, this.dof, this.vignette, this.noise, this.tonemap, this.vision);
    composer.addPass(this.mainPass);
    this.ca = new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0, 0.0), radialModulation: true, modulationOffset: 0.15 });
    this.caPass = new EffectPass(this.camera, this.ca);
    this.caPass.enabled = false;
    composer.addPass(this.caPass);
    this.smaaPass = null;
    if (q.smaa) { this.smaaPass = new EffectPass(this.camera, new SMAAEffect({ preset: SMAAPreset.MEDIUM })); composer.addPass(this.smaaPass); }
    this.routeOutput();
    this.resize();
  }
  setQuality(name) {
    if (!QUALITY[name]) name = 'high';
    const changed = this.quality !== name;
    this.quality = name; this.q = QUALITY[name];
    this.renderer.shadowMap.enabled = this.q.shadows;
    this.scene.traverse(o => { if (o.isLight && o.shadow && o.userData.shadowCandidate) { o.castShadow = this.q.shadows && (o.userData.shadowCandidate !== 'high' || this.quality === 'high' || this.quality === 'ultra'); o.shadow.mapSize.set(this.q.shadowSize, this.q.shadowSize); if (o.shadow.map) { o.shadow.map.dispose(); o.shadow.map = null; } } if (o.material) { const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach(mm => mm.needsUpdate = true); } });
    if (changed || !this.composer) this.buildComposer();
    this.resize();
  }
  setFov(f) { this.baseFov = f; this.camera.fov = f; this.camera.updateProjectionMatrix(); }
  // the last *enabled* pass must render to the screen: without SMAA the chromatic pass is usually off
  routeOutput() {
    if (this.smaaPass) { this.mainPass.renderToScreen = false; this.caPass.renderToScreen = false; this.smaaPass.renderToScreen = true; return; }
    this.caPass.renderToScreen = this.caPass.enabled; this.mainPass.renderToScreen = !this.caPass.enabled;
  }
  setChromatic(v) {
    this.ca.offset.set(v * 0.6, v * 0.4);
    const on = v > 0.0002;
    if (on !== this.caPass.enabled) { this.caPass.enabled = on; this.routeOutput(); }
  }
  setDof(on, dist = 2, range = 1.5, bokeh = 3) {
    if (!this.q.dofCut) on = false;
    this.dofActive = on;
    this.dof.cocMaterial.worldFocusDistance = dist;
    this.dof.cocMaterial.worldFocusRange = range;
    this.dof.bokehScale = on ? bokeh : 0;
  }
  resize() {
    const w = innerWidth, h = innerHeight;
    const pr = Math.min(devicePixelRatio || 1, this.q.maxPr) * this.q.pr;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (this.composer) this.composer.setSize(w, h, false);
    this.onResize && this.onResize(h * pr / 2);
  }
  render(dt) {
    this.time += dt;
    this.vision.uniforms.get('time').value = this.time;
    this.composer.render(dt);
  }
}
