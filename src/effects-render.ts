/**
 * 触发词动画：canvas 粒子引擎与浏览器播放器
 *
 * 三个动画（烟花/撒花/下雪）各用一组粒子参数驱动一步一帧的引擎；
 * createEffectEngine 负责 MAX_MS 时长封顶，playEffectInBrowser 负责全屏 overlay 生命周期。
 * 粒子参数照抄存档 mockup（颜色/重力/扩散/拖尾/深色描边），形态不得走样。
 * 顶层不得触碰 window/document，保证 Node 环境导入安全。
 */
import type { EffectType } from './effects.ts';

/**
 * 粒子引擎：step 推进并绘制一帧，返回 true 表示本动画收尾完成（粒子散尽或触顶时长），收尾后保持返回 true
 */
export interface EffectEngine {
  step(ctx: CanvasRenderingContext2D, dt: number): boolean; // true = 本动画收尾完成
}

/** 烟花火箭 */
interface Rocket {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hue: number;
  trail: number[][];
}

/** 烟花火星 */
interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hue: number;
  life: number;
  decay: number;
  trail: number[][];
}

/** 撒花纸屑 */
interface Confetto {
  x: number;
  y: number;
  vy: number;
  swayA: number;
  swayF: number;
  ph: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
  round: boolean;
}

/** 雪花 */
interface Snowflake {
  x: number;
  y: number;
  r: number;
  vy: number;
  swayA: number;
  swayF: number;
  ph: number;
  alpha: number;
}

/* ---------- 烟花：火箭升空 + 炸开火星 ---------- */
function makeFireworks(w: number, h: number): EffectEngine {
  const g = 0.055 * Math.max(0.6, h / 380);
  const rockets: Rocket[] = [];
  const sparks: Spark[] = [];
  let burstsLeft = 3;
  function burst(x: number, y: number, hue: number): void {
    const n = 64 + (Math.random() * 36) | 0;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      const sp = (1.2 + Math.random() * (h * 0.014 + 2.2)) * (0.35 + Math.random() * 0.75);
      sparks.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, hue: hue + (Math.random() * 50 - 25), life: 1, decay: 0.010 + Math.random() * 0.013, trail: [] });
    }
  }
  return {
    step(ctx: CanvasRenderingContext2D, dt: number): boolean {
      const s = Math.min(dt / 16.7, 2.5);
      if (rockets.length === 0 && sparks.length < 30 && burstsLeft > 0) {
        burstsLeft--;
        rockets.push({ x: w * (0.2 + Math.random() * 0.6), y: h + 8, vx: (Math.random() - 0.5) * 1.4, vy: -(h * 0.0155 + Math.random() * h * 0.008), hue: Math.random() * 360, trail: [] });
      }
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.x += r.vx * s; r.y += r.vy * s; r.vy += g * 1.7 * s;
        r.trail.push([r.x, r.y]); if (r.trail.length > 12) r.trail.shift();
        if (r.vy >= -0.5 || r.y <= h * 0.18) { burst(r.x, r.y, r.hue); rockets.splice(i, 1); continue; }
        for (let j = 0; j < r.trail.length; j++) {
          const t = r.trail[j];
          ctx.beginPath();
          ctx.fillStyle = 'hsla(' + r.hue + ', 90%, 65%, ' + (0.15 + 0.6 * j / r.trail.length) + ')';
          ctx.arc(t[0], t[1], 1 + 2.2 * j / r.trail.length, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.fillStyle = 'hsla(' + r.hue + ', 100%, 82%, .95)';
        ctx.arc(r.x, r.y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.trail.push([p.x, p.y]); if (p.trail.length > 5) p.trail.shift();
        p.x += p.vx * s; p.y += p.vy * s;
        p.vy += g * s; p.vx *= Math.pow(0.982, s); p.vy *= Math.pow(0.982, s);
        p.life -= p.decay * s;
        if (p.life <= 0) { sparks.splice(i, 1); continue; }
        for (let j = 0; j < p.trail.length; j++) {
          const t = p.trail[j];
          ctx.beginPath();
          ctx.fillStyle = 'hsla(' + p.hue + ', 95%, 62%, ' + (0.45 * p.life * j / p.trail.length) + ')';
          ctx.arc(t[0], t[1], 1.6 * p.life, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.fillStyle = 'hsla(' + p.hue + ', 95%, 62%, ' + p.life + ')';
        ctx.arc(p.x, p.y, 1.4 + 1.6 * p.life, 0, Math.PI * 2);
        ctx.fill();
      }
      return burstsLeft === 0 && rockets.length === 0 && sparks.length === 0;
    }
  };
}

/* ---------- 撒花：纸屑打转飘落（深色细描边，浅色页面也看得清） ---------- */
function makeConfetti(w: number, h: number): EffectEngine {
  const colors = ['#ff5964', '#ffd166', '#06d6a0', '#4cc9f0', '#c77dff', '#f15bb5', '#ffffff'];
  const n = Math.min(220, Math.round(w * h / 2400) + 50);
  const ps: Confetto[] = [];
  for (let i = 0; i < n; i++) {
    ps.push({
      x: Math.random() * w, y: Math.random() * h * 1.1 - h * 0.1,
      vy: 1.0 + Math.random() * 2.3,
      swayA: 6 + Math.random() * 18, swayF: 0.012 + Math.random() * 0.022, ph: Math.random() * Math.PI * 2,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.22,
      size: 4 + Math.random() * 7,
      color: colors[i % colors.length],
      round: Math.random() < 0.35
    });
  }
  return {
    step(ctx: CanvasRenderingContext2D, dt: number): boolean {
      const s = Math.min(dt / 16.7, 2.5);
      let alive = false;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        p.y += p.vy * s;
        p.x += Math.sin(p.y * p.swayF + p.ph) * 0.9 * s;
        p.rot += p.vr * s;
        if (p.y > h + 16) continue;
        alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.92;
        ctx.strokeStyle = 'rgba(25, 40, 80, .38)';
        ctx.lineWidth = 1;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.45, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillRect(-p.size / 2, -p.size * 0.32, p.size, p.size * 0.64);
          ctx.strokeRect(-p.size / 2, -p.size * 0.32, p.size, p.size * 0.64);
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      return !alive;
    }
  };
}

/* ---------- 下雪：带深色底衬，浅色页面也能看清 ---------- */
function makeSnow(w: number, h: number): EffectEngine {
  const n = Math.min(260, Math.round(w * h / 1900) + 60);
  const ps: Snowflake[] = [];
  for (let i = 0; i < n; i++) {
    ps.push({
      x: Math.random() * w, y: Math.random() * h * 1.1 - h * 0.1,
      r: 0.9 + Math.random() * 2.6,
      vy: 0.45 + Math.random() * 1.15,
      swayA: 4 + Math.random() * 13, swayF: 0.008 + Math.random() * 0.016, ph: Math.random() * Math.PI * 2,
      alpha: 0.5 + Math.random() * 0.5
    });
  }
  return {
    step(ctx: CanvasRenderingContext2D, dt: number): boolean {
      const s = Math.min(dt / 16.7, 2.5);
      let alive = false;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        p.y += p.vy * s;
        p.x += Math.sin(p.y * p.swayF + p.ph) * 0.7 * s;
        if (p.y > h + 8) continue;
        alive = true;
        ctx.beginPath();
        ctx.fillStyle = 'rgba(35, 50, 90, ' + (p.alpha * 0.32) + ')';
        ctx.arc(p.x, p.y, p.r + 1.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = 'rgba(240, 246, 255, ' + p.alpha + ')';
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      return !alive;
    }
  };
}

/** 各效果时长上限（毫秒），与 mockup MAX_MS 一致：粒子提前散尽提前收，超时强收 */
const MAX_MS: Record<EffectType, number> = { fireworks: 7000, confetti: 6000, snow: 7000 };

/**
 * 按效果类型创建粒子引擎，step 内部累计 dt 并对照 MAX_MS 封顶
 */
export function createEffectEngine(type: EffectType, w: number, h: number): EffectEngine {
  const makers: Record<EffectType, (w: number, h: number) => EffectEngine> = {
    fireworks: makeFireworks,
    confetti: makeConfetti,
    snow: makeSnow,
  };
  const inner = makers[type](w, h);
  const cap = MAX_MS[type];
  let elapsed = 0;
  let finished = false;
  return {
    step(ctx: CanvasRenderingContext2D, dt: number): boolean {
      if (finished) return true;
      elapsed += dt;
      if (inner.step(ctx, dt) || elapsed >= cap) {
        finished = true;
        return true;
      }
      return false;
    }
  };
}

/**
 * 浏览器全屏播放一个动画，播完移除画布并调用 onEnd。
 * 每个分支都恰好调用一次 onEnd 且不抛错：
 * - 缺 window/document/requestAnimationFrame → 立即 onEnd；
 * - prefers-reduced-motion: reduce → 立即 onEnd（不建画布）；
 * - getContext('2d') 为 null → 移除画布并 onEnd；
 * - 正常分支 rAF 循环驱动 step，收尾后 canvas.remove() 再 onEnd()。
 */
export function playEffectInBrowser(type: EffectType, onEnd: () => void): void {
  let ended = false;
  const end = (): void => {
    if (ended) return;
    ended = true;
    onEnd();
  };
  try {
    const win: Window | undefined = typeof window === 'undefined' ? undefined : window;
    const doc: Document | undefined = typeof document === 'undefined' ? undefined : document;
    if (!win || !doc || typeof win.requestAnimationFrame !== 'function') {
      end();
      return;
    }
    if (typeof win.matchMedia === 'function' && win.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      end();
      return;
    }
    const canvas = doc.createElement('canvas');
    canvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:99999';
    doc.body.appendChild(canvas);
    const dpr = Math.min(win.devicePixelRatio || 1, 2);
    const w = win.innerWidth;
    const h = win.innerHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      canvas.remove();
      end();
      return;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const engine = createEffectEngine(type, w, h);
    let last = performance.now();
    const frame = (): void => {
      try {
        const now = performance.now();
        const dt = now - last;
        last = now;
        ctx.clearRect(0, 0, w, h);
        if (engine.step(ctx, dt)) {
          canvas.remove();
          end();
        } else {
          win.requestAnimationFrame(frame);
        }
      } catch {
        canvas.remove();
        end();
      }
    };
    frame();
  } catch {
    end();
  }
}
