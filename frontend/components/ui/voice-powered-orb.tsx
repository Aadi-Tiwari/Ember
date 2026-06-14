"use client";

import React, { useEffect, useRef, FC } from "react";
import { Renderer, Program, Mesh, Triangle, Vec3 } from "ogl";
import { cn } from "../../lib/utils";

interface VoicePoweredOrbProps {
  className?: string;
  hue?: number;
  enableVoiceControl?: boolean;
  voiceSensitivity?: number;
  maxRotationSpeed?: number;
  maxHoverIntensity?: number;
  onVoiceDetected?: (detected: boolean) => void;
}

export const VoicePoweredOrb: FC<VoicePoweredOrbProps> = ({
  className,
  hue = 0,
  enableVoiceControl = true,
  voiceSensitivity = 1.5,
  maxRotationSpeed = 1.2,
  maxHoverIntensity = 0.8,
  onVoiceDetected,
}) => {
  const ctnDom = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const vert = `
    precision highp float;
    attribute vec2 position;
    attribute vec2 uv;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const frag = `
    precision highp float;
    uniform float iTime;
    uniform vec3 iResolution;
    uniform float hue;
    uniform float hover;
    uniform float rot;
    uniform float hoverIntensity;
    varying vec2 vUv;

    vec3 rgb2yiq(vec3 c) {
      return vec3(
        dot(c, vec3(0.299, 0.587, 0.114)),
        dot(c, vec3(0.596, -0.274, -0.322)),
        dot(c, vec3(0.211, -0.523, 0.312))
      );
    }
    vec3 yiq2rgb(vec3 c) {
      return vec3(
        c.x + 0.956 * c.y + 0.621 * c.z,
        c.x - 0.272 * c.y - 0.647 * c.z,
        c.x - 1.106 * c.y + 1.703 * c.z
      );
    }
    vec3 adjustHue(vec3 color, float hueDeg) {
      float hueRad = hueDeg * 3.14159265 / 180.0;
      vec3 yiq = rgb2yiq(color);
      float cosA = cos(hueRad), sinA = sin(hueRad);
      yiq.y = yiq.y * cosA - yiq.z * sinA;
      yiq.z = yiq.y * sinA + yiq.z * cosA;
      return yiq2rgb(yiq);
    }
    vec3 hash33(vec3 p3) {
      p3 = fract(p3 * vec3(0.1031, 0.11369, 0.13787));
      p3 += dot(p3, p3.yxz + 19.19);
      return -1.0 + 2.0 * fract(vec3(p3.x + p3.y, p3.x + p3.z, p3.y + p3.z) * p3.zyx);
    }
    float snoise3(vec3 p) {
      const float K1 = 0.333333333, K2 = 0.166666667;
      vec3 i = floor(p + (p.x + p.y + p.z) * K1);
      vec3 d0 = p - (i - (i.x + i.y + i.z) * K2);
      vec3 e = step(vec3(0.0), d0 - d0.yzx);
      vec3 i1 = e * (1.0 - e.zxy);
      vec3 i2 = 1.0 - e.zxy * (1.0 - e);
      vec3 d1 = d0 - (i1 - K2), d2 = d0 - (i2 - K1), d3 = d0 - 0.5;
      vec4 h = max(0.6 - vec4(dot(d0,d0), dot(d1,d1), dot(d2,d2), dot(d3,d3)), 0.0);
      vec4 n = h*h*h*h * vec4(dot(d0,hash33(i)), dot(d1,hash33(i+i1)), dot(d2,hash33(i+i2)), dot(d3,hash33(i+1.0)));
      return dot(vec4(31.316), n);
    }
    vec4 extractAlpha(vec3 colorIn) {
      float a = max(max(colorIn.r, colorIn.g), colorIn.b);
      return vec4(colorIn.rgb / (a + 1e-5), a);
    }
    const vec3 baseColor1 = vec3(0.611765, 0.262745, 0.996078);
    const vec3 baseColor2 = vec3(0.298039, 0.760784, 0.913725);
    const vec3 baseColor3 = vec3(0.062745, 0.078431, 0.600000);
    const float innerRadius = 0.6, noiseScale = 0.65;
    float light1(float i, float a, float d) { return i / (1.0 + d * a); }
    float light2(float i, float a, float d) { return i / (1.0 + d * d * a); }
    vec4 draw(vec2 uv) {
      vec3 c1 = adjustHue(baseColor1, hue), c2 = adjustHue(baseColor2, hue), c3 = adjustHue(baseColor3, hue);
      float ang = atan(uv.y, uv.x), len = length(uv), invLen = len > 0.0 ? 1.0 / len : 0.0;
      float n0 = snoise3(vec3(uv * noiseScale, iTime * 0.5)) * 0.5 + 0.5;
      float r0 = mix(mix(innerRadius, 1.0, 0.4), mix(innerRadius, 1.0, 0.6), n0);
      float d0 = distance(uv, (r0 * invLen) * uv);
      float v0 = light1(1.0, 10.0, d0) * smoothstep(r0 * 1.05, r0, len);
      float cl = cos(ang + iTime * 2.0) * 0.5 + 0.5;
      float a2 = iTime * -1.0;
      vec2 pos = vec2(cos(a2), sin(a2)) * r0;
      float d2 = distance(uv, pos);
      float v1 = light2(1.5, 5.0, d2) * light1(1.0, 50.0, d0);
      float v2 = smoothstep(1.0, mix(innerRadius, 1.0, n0 * 0.5), len);
      float v3 = smoothstep(innerRadius, mix(innerRadius, 1.0, 0.5), len);
      vec3 col = clamp((mix(c3, mix(c1, c2, cl), v0) + v1) * v2 * v3, 0.0, 1.0);
      return extractAlpha(col);
    }
    vec4 mainImage(vec2 fragCoord) {
      vec2 center = iResolution.xy * 0.5;
      float size = min(iResolution.x, iResolution.y);
      vec2 uv = (fragCoord - center) / size * 2.0;
      float s = sin(rot), c = cos(rot);
      uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);
      uv.x += hover * hoverIntensity * 0.1 * sin(uv.y * 10.0 + iTime);
      uv.y += hover * hoverIntensity * 0.1 * sin(uv.x * 10.0 + iTime);
      return draw(uv);
    }
    void main() {
      vec4 col = mainImage(vUv * iResolution.xy);
      gl_FragColor = vec4(col.rgb * col.a, col.a);
    }
  `;

  const analyzeAudio = () => {
    if (!analyserRef.current || !dataArrayRef.current) return 0;
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    let sum = 0;
    for (let i = 0; i < dataArrayRef.current.length; i++) {
      const v = dataArrayRef.current[i] / 255;
      sum += v * v;
    }
    return Math.min(Math.sqrt(sum / dataArrayRef.current.length) * voiceSensitivity * 3.0, 1);
  };

  const stopMicrophone = () => {
    try {
      mediaStreamRef.current?.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
      microphoneRef.current?.disconnect();
      microphoneRef.current = null;
      analyserRef.current?.disconnect();
      analyserRef.current = null;
      if (audioContextRef.current?.state !== "closed") audioContextRef.current?.close();
      audioContextRef.current = null;
      dataArrayRef.current = null;
    } catch {}
  };

  const initMicrophone = async () => {
    try {
      stopMicrophone();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      mediaStreamRef.current = stream;
      audioContextRef.current = new AudioContext();
      if (audioContextRef.current.state === "suspended") await audioContextRef.current.resume();
      analyserRef.current = audioContextRef.current.createAnalyser();
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current.fftSize = 512;
      analyserRef.current.smoothingTimeConstant = 0.3;
      analyserRef.current.minDecibels = -90;
      analyserRef.current.maxDecibels = -10;
      microphoneRef.current.connect(analyserRef.current);
      dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount) as Uint8Array<ArrayBuffer>;
      return true;
    } catch { return false; }
  };

  useEffect(() => {
    const container = ctnDom.current;
    if (!container) return;

    let rafId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let renderer: Renderer | null = null, gl: any = null, program: Program | null = null;

    try {
      renderer = new Renderer({ alpha: true, premultipliedAlpha: false, antialias: true, dpr: window.devicePixelRatio || 1 });
      gl = renderer.gl;
      gl.clearColor(0, 0, 0, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      while (container.firstChild) container.removeChild(container.firstChild);
      container.appendChild(gl.canvas as HTMLCanvasElement);

      const geometry = new Triangle(gl);
      program = new Program(gl, {
        vertex: vert, fragment: frag,
        uniforms: {
          iTime: { value: 0 },
          iResolution: { value: new Vec3(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height) },
          hue: { value: hue }, hover: { value: 0 }, rot: { value: 0 }, hoverIntensity: { value: 0 },
        },
      });
      const mesh = new Mesh(gl, { geometry, program });

      const resize = () => {
        if (!container || !renderer || !gl) return;
        const dpr = window.devicePixelRatio || 1;
        const w = container.clientWidth, h = container.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w * dpr, h * dpr);
        (gl.canvas as HTMLCanvasElement).style.width = w + "px";
        (gl.canvas as HTMLCanvasElement).style.height = h + "px";
        if (program) program.uniforms.iResolution.value.set(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height);
      };
      window.addEventListener("resize", resize);
      resize();

      let lastTime = 0, currentRot = 0, micInitialized = false;
      if (enableVoiceControl) initMicrophone().then(ok => { micInitialized = ok; });

      const update = (t: number) => {
        rafId = requestAnimationFrame(update);
        if (!program || !renderer || !gl) return;
        const dt = (t - lastTime) * 0.001;
        lastTime = t;
        program.uniforms.iTime.value = t * 0.001;
        program.uniforms.hue.value = hue;

        if (enableVoiceControl && micInitialized) {
          const level = analyzeAudio();
          onVoiceDetected?.(level > 0.1);
          if (level > 0.05) currentRot += dt * (0.3 + level * maxRotationSpeed * 2.0);
          program.uniforms.hover.value = Math.min(level * 2.0, 1.0);
          program.uniforms.hoverIntensity.value = Math.min(level * maxHoverIntensity * 0.8, maxHoverIntensity);
        } else {
          // Still animate with slow rotation when no voice
          currentRot += dt * 0.25;
          program.uniforms.hover.value = 0;
          program.uniforms.hoverIntensity.value = 0;
          onVoiceDetected?.(false);
        }
        program.uniforms.rot.value = currentRot;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        renderer.render({ scene: mesh });
      };
      rafId = requestAnimationFrame(update);

      return () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener("resize", resize);
        try { if (container.contains(gl!.canvas)) container.removeChild(gl!.canvas); } catch {}
        stopMicrophone();
        gl?.getExtension("WEBGL_lose_context")?.loseContext();
      };
    } catch (e) {
      console.error("VoicePoweredOrb error:", e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hue, enableVoiceControl, voiceSensitivity, maxRotationSpeed, maxHoverIntensity]);

  return <div ref={ctnDom} className={cn("w-full h-full relative", className)} />;
};
