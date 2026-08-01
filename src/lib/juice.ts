/**
 * Feedback "juice" — sound, haptics, confetti. Ported from the website's
 * `src/utils/games/juice.js` so celebrations feel identical across TalkDrill.
 *
 * Zero dependencies: sounds are Web-Audio oscillator tones, confetti is a
 * self-contained <canvas> burst, haptics use the Vibration API. Every export is
 * SSR-safe and never throws — feedback must never break a screen.
 *
 * Respects the user:
 *   - prefers-reduced-motion → confetti is skipped entirely.
 *   - localStorage 'td_internship_muted' → all sfx + haptics skipped.
 */

const MUTE_KEY = 'td_internship_muted';
const CELEBRATED_KEY = 'td_internship_celebrated';

let audioCtx: AudioContext | null = null;

function hasWindow(): boolean {
  return typeof window !== 'undefined';
}

function prefersReducedMotion(): boolean {
  if (!hasWindow() || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  if (!hasWindow()) return false;
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean): void {
  if (!hasWindow()) return;
  try {
    if (muted) localStorage.setItem(MUTE_KEY, '1');
    else localStorage.removeItem(MUTE_KEY);
  } catch {
    /* non-critical */
  }
}

function getAudioCtx(): AudioContext | null {
  if (!hasWindow()) return null;
  try {
    type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };
    const Ctx = window.AudioContext || (window as AudioWindow).webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  } catch {
    return null;
  }
}

type SfxType = 'correct' | 'wrong' | 'win' | 'tick';

const SFX: Record<
  SfxType,
  { type: OscillatorType; gain: number; notes: { freq: number; start: number; duration: number }[] }
> = {
  correct: {
    type: 'sine',
    gain: 0.18,
    notes: [
      { freq: 660, start: 0, duration: 0.09 },
      { freq: 990, start: 0.09, duration: 0.12 },
    ],
  },
  wrong: {
    type: 'sawtooth',
    gain: 0.14,
    notes: [
      { freq: 220, start: 0, duration: 0.16 },
      { freq: 160, start: 0.12, duration: 0.16 },
    ],
  },
  win: {
    type: 'triangle',
    gain: 0.2,
    notes: [
      { freq: 523, start: 0, duration: 0.12 },
      { freq: 659, start: 0.12, duration: 0.12 },
      { freq: 784, start: 0.24, duration: 0.16 },
      { freq: 1047, start: 0.38, duration: 0.22 },
    ],
  },
  tick: { type: 'square', gain: 0.08, notes: [{ freq: 880, start: 0, duration: 0.04 }] },
};

/** Play a short UI sound. Call from a user gesture (autoplay policy). */
export function playSfx(type: SfxType): void {
  if (!hasWindow() || isMuted()) return;
  const recipe = SFX[type];
  const ctx = getAudioCtx();
  if (!recipe || !ctx) return;

  try {
    const now = ctx.currentTime;
    recipe.notes.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = recipe.type;
      osc.frequency.setValueAtTime(freq, now + start);
      const t0 = now + start;
      const t1 = t0 + duration;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(recipe.gain, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t1 + 0.02);
    });
  } catch {
    /* non-critical */
  }
}

export function haptic(ms: number | number[] = 20): void {
  if (!hasWindow() || isMuted() || prefersReducedMotion()) return;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms);
    }
  } catch {
    /* non-critical */
  }
}

/** TalkDrill confetti palette (website `ConfettiBurst.jsx`). */
const CONFETTI_COLORS = ['#4C3FE2', '#7B68EE', '#F59C1A', '#22C55E', '#5B2C87', '#4834D4'];

export interface ConfettiOptions {
  count?: number;
  duration?: number;
  originX?: number;
  originY?: number;
  colors?: string[];
}

/** One-shot full-screen confetti burst on a click-through fixed canvas. */
export function burstConfetti(opts: ConfettiOptions = {}): void {
  if (!hasWindow() || prefersReducedMotion()) return;
  if (typeof document === 'undefined' || typeof requestAnimationFrame !== 'function') return;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null;
  try {
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d');
    if (!ctx) return;
  } catch {
    return;
  }

  try {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth;
    const H = window.innerHeight;
    const {
      count = 80,
      duration = 1400,
      originX = W / 2,
      originY = H / 3,
      colors = CONFETTI_COLORS,
    } = opts;

    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    Object.assign(canvas.style, {
      position: 'fixed',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '2147483647',
    });
    canvas.setAttribute('aria-hidden', 'true');
    ctx.scale(dpr, dpr);
    document.body.appendChild(canvas);

    const GRAVITY = 0.0009;
    const DRAG = 0.0016;

    const particles = Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.18 + Math.random() * 0.42;
      return {
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.25,
        size: 5 + Math.random() * 6,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 0.02,
        color: colors[Math.floor(Math.random() * colors.length)],
      };
    });

    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let prev = start;
    let rafId = 0;

    const cleanup = () => {
      try {
        if (rafId) cancelAnimationFrame(rafId);
      } catch {
        /* ignore */
      }
      try {
        canvas.parentNode?.removeChild(canvas);
      } catch {
        /* ignore */
      }
    };

    const frame = (nowTs: number) => {
      try {
        const elapsed = nowTs - start;
        const dt = Math.min(nowTs - prev, 48);
        prev = nowTs;
        if (elapsed >= duration) {
          cleanup();
          return;
        }
        const fade = Math.max(0, 1 - elapsed / duration);
        ctx!.clearRect(0, 0, W, H);
        for (const p of particles) {
          const decay = Math.max(0, 1 - DRAG * dt);
          p.vx *= decay;
          p.vy = p.vy * decay + GRAVITY * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.vrot * dt;
          ctx!.save();
          ctx!.globalAlpha = fade;
          ctx!.translate(p.x, p.y);
          ctx!.rotate(p.rot);
          ctx!.fillStyle = p.color;
          ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          ctx!.restore();
        }
        rafId = requestAnimationFrame(frame);
      } catch {
        cleanup();
      }
    };

    rafId = requestAnimationFrame(frame);
    setTimeout(cleanup, duration + 400);
  } catch {
    try {
      canvas.parentNode?.removeChild(canvas);
    } catch {
      /* ignore */
    }
  }
}

/** The standard "you did it" moment: confetti + win sound + haptic. */
export function celebrate(opts: ConfettiOptions = {}): void {
  burstConfetti({ count: 120, ...opts });
  playSfx('win');
  haptic([20, 40, 20]);
}

/**
 * Fire `celebrate` at most once per `key` (persisted) — approvals and streak
 * milestones should pop the first time they are seen, not on every revisit.
 * (Website pattern: `talkdrill_quest_celebrated`.)
 */
export function celebrateOnce(key: string, opts: ConfettiOptions = {}): boolean {
  if (!hasWindow()) return false;
  try {
    const seen: string[] = JSON.parse(localStorage.getItem(CELEBRATED_KEY) || '[]');
    if (seen.includes(key)) return false;
    // Keep the list bounded; old keys are never celebrated again anyway.
    localStorage.setItem(CELEBRATED_KEY, JSON.stringify([...seen.slice(-49), key]));
  } catch {
    /* storage unavailable → celebrate anyway, just unguarded */
  }
  celebrate(opts);
  return true;
}
