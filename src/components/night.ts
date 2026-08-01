/**
 * "TalkDrill Night" surface kit — the website's signature dark treatment
 * (books/games heroes), ported from `src/sections/books/book-style.js` via
 * `components/marketing/night-style.js`. Deliberately mode-invariant: night
 * surfaces stay night in light mode too.
 */

export const INK = {
  night: '#0C1022',
  amber: '#F5A623',
  amberHover: '#FFB84D',
  amberText: '#231703',
  line: 'rgba(255,255,255,0.14)',
  soft: 'rgba(255,255,255,0.85)',
  muted: 'rgba(255,255,255,0.68)',
  faint: 'rgba(255,255,255,0.55)',
} as const;

/** 4-layer mesh: indigo + amber top blobs, bottom bloom, base linear. */
export const NIGHT_SKY = [
  'radial-gradient(58% 76% at 14% 0%, rgba(76,63,226,0.45) 0%, transparent 62%)',
  'radial-gradient(42% 54% at 86% 6%, rgba(245,166,35,0.14) 0%, transparent 58%)',
  'radial-gradient(80% 100% at 50% 118%, rgba(36,27,122,0.6) 0%, transparent 68%)',
  'linear-gradient(178deg, #131834 0%, #0C1022 58%, #0A0D1D 100%)',
].join(', ');

/** Dot-grid starfield for a ::before, masked to fade out downward. */
export const STARFIELD = {
  content: '""',
  position: 'absolute',
  inset: 0,
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1.4px)',
  backgroundSize: '26px 26px',
  maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.9), transparent 78%)',
  WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.9), transparent 78%)',
  pointerEvents: 'none',
} as const;

/** 1px amber hairline for a ::after along a night band's bottom edge. */
export const AMBER_HAIRLINE = {
  content: '""',
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  height: '1px',
  background: 'linear-gradient(90deg, transparent, rgba(245,166,35,0.55), transparent)',
} as const;

/** Uppercase kicker above night headlines. */
export const EYEBROW = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
} as const;

export const AMBER_BTN_SX = {
  px: 4,
  py: 1.4,
  borderRadius: 99,
  bgcolor: INK.amber,
  color: INK.amberText,
  fontWeight: 800,
  boxShadow: '0 12px 30px rgba(245,166,35,0.3)',
  '&:hover': {
    bgcolor: INK.amberHover,
    transform: 'translateY(-2px)',
    boxShadow: '0 16px 36px rgba(245,166,35,0.4)',
  },
} as const;

export const NIGHT_GHOST_BTN_SX = {
  px: 4,
  py: 1.4,
  borderRadius: 99,
  color: '#fff',
  fontWeight: 700,
  border: '1px solid rgba(255,255,255,0.28)',
  bgcolor: 'rgba(255,255,255,0.04)',
  '&:hover': {
    borderColor: 'rgba(255,255,255,0.5)',
    bgcolor: 'rgba(255,255,255,0.08)',
    transform: 'translateY(-2px)',
  },
} as const;

/** Frosted stat pill for night surfaces. */
export const NIGHT_PILL_SX = {
  px: 1.75,
  py: 0.75,
  borderRadius: 99,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0.75,
  border: `1px solid ${INK.line}`,
  bgcolor: 'rgba(255,255,255,0.04)',
  color: INK.soft,
  fontSize: 13,
  fontWeight: 600,
} as const;

/** Glassmorphism pill on gradient/violet surfaces (dashboard welcome banner). */
export const GLASS_PILL_SX = {
  px: 1.75,
  py: 0.75,
  borderRadius: 99,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0.75,
  bgcolor: 'rgba(245,156,26,0.15)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(245,156,26,0.25)',
  color: '#F5A623',
  fontWeight: 700,
  fontSize: '0.8rem',
} as const;
