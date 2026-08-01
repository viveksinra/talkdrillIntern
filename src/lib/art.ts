/**
 * Typed registry of every illustration the portal ships, so screens reference
 * `ART.mascot.wave` instead of a string path (typos die at compile time and
 * renames are one-line changes).
 *
 * `gen/`  — TalkDrill-brand clay set generated for this portal (WebP, alpha).
 * `site/` — assets copied from UserWebSiteTalkCode so the portal shares the
 *           website's illustration language.
 */

const g = (name: string) => `/art/${name}.webp` as const;
const s = (name: string) => `/art/site/${name}` as const;

export const ART = {
  /** The TalkDrill mascot (purple hoodie + headphones) in portal poses. */
  mascot: {
    wave: g('mascot-wave'),
    thumbsUp: g('mascot-thumbs-up'),
    trophy: g('mascot-trophy'),
    certificate: g('mascot-certificate'),
    oops: g('mascot-oops'),
    thinking: g('mascot-thinking'),
    megaphone: g('mascot-megaphone'),
    filming: g('mascot-filming'),
    laptop: g('mascot-laptop'),
    coins: g('mascot-coins'),
    sleeping: g('mascot-sleeping'),
    rocket: g('mascot-rocket'),
  },

  /** Clay art for the actual reward catalog items (card fallbacks by keyword). */
  reward: {
    mic: g('reward-mic'),
    lapelMic: g('reward-lapel-mic'),
    ringLight: g('reward-ring-light'),
    tshirt: g('reward-tshirt'),
    smartphone: g('reward-smartphone'),
    voucher: g('reward-voucher'),
    cash: g('reward-cash'),
    stipend: g('reward-stipend'),
    headphones: g('reward-headphones'),
    goodies: g('reward-goodies'),
    certificate: g('certificate'),
    giftBox: g('gift-box'),
    pointsCoin: g('points-coin'),
    trophy: g('trophy'),
  },

  /** Video-view tier medallions, ascending prestige (10K → 1M views). */
  tier: [
    g('tier-1-spark'),
    g('tier-2-flame'),
    g('tier-3-star'),
    g('tier-4-rocket'),
    g('tier-5-crown'),
  ] as const,

  medal: { gold: g('medal-gold'), silver: g('medal-silver'), bronze: g('medal-bronze') },
  crown: g('crown'),

  streak: {
    flame: g('streak-flame'),
    flameBig: g('streak-flame-big'),
    calendar: g('streak-calendar'),
  },

  points: {
    coin: g('points-coin'),
    stack: g('coin-stack'),
    burst: g('coin-burst'),
    target: g('target-goal'),
  },

  empty: {
    allDone: g('all-done'),
    inbox: g('empty-inbox'),
    search: g('empty-search'),
    rewards: g('empty-rewards'),
    videos: g('empty-videos'),
    ledger: g('empty-ledger'),
    error: g('error-broken'),
    inboxZero: g('inbox-zero'),
  },

  lock: { locked: g('locked'), unlocked: g('unlocked') },

  proof: {
    screenshot: g('proof-screenshot'),
    link: g('proof-link'),
    username: g('proof-username'),
    text: g('proof-text'),
    video: g('proof-video'),
    poster: g('proof-poster'),
  },

  eligibility: {
    shield: g('shield-check'),
    hourglass: g('hourglass'),
    handshake: g('handshake'),
    calendarMonth: g('calendar-month'),
    certificateFrame: g('certificate-frame'),
  },

  track: {
    campus: g('track-campus'),
    content: g('track-content'),
    marketing: g('track-marketing'),
  },

  scene: {
    loginNight: g('hero-login-night'),
    campus: g('hero-campus'),
    content: g('hero-content'),
    marketing: g('hero-marketing'),
    onboardingWelcome: g('onboarding-welcome'),
    celebration: g('celebration-scene'),
  },

  video: {
    youtube: g('video-youtube'),
    instagram: g('video-instagram'),
    generic: g('video-placeholder'),
  },

  garnish: { sparkles: g('sparkles'), confettiOverlay: g('confetti-overlay') },

  /** Website's Minimal-UI clay characters (shared visual language). */
  character: {
    happyJump: s('character-happy-jump.webp'),
    present: s('character-present.webp'),
    question: s('character-question.webp'),
    study: s('character-study.webp'),
    maintenance: s('character-maintenance.webp'),
    reject: s('character-reject.webp'),
    notification: s('character-notification.webp'),
    fly: s('character-fly.webp'),
    rocket: s('illustration-rocket-large.webp'),
    receipt: s('illustration-receipt.webp'),
    mascotClassic: s('mascot-pricing.png'),
  },
} as const;

/** Best-effort clay art for a reward the admin uploaded no image for. */
export function rewardFallbackArt(name: string, type?: string): string {
  const n = name.toLowerCase();
  if (n.includes('lapel') || n.includes('collar')) return ART.reward.lapelMic;
  if (n.includes('mic')) return ART.reward.mic;
  if (n.includes('ring') || n.includes('light')) return ART.reward.ringLight;
  if (n.includes('shirt') || n.includes('tee') || n.includes('hoodie')) return ART.reward.tshirt;
  if (n.includes('phone')) return ART.reward.smartphone;
  if (n.includes('voucher') || n.includes('gift card') || n.includes('coupon'))
    return ART.reward.voucher;
  if (n.includes('headphone')) return ART.reward.headphones;
  if (n.includes('stipend')) return ART.reward.stipend;
  if (n.includes('certificate')) return ART.reward.certificate;
  if (n.includes('trophy')) return ART.reward.trophy;
  if (type === 'cash') return ART.reward.cash;
  if (type === 'certificate') return ART.reward.certificate;
  return ART.reward.giftBox;
}

/** Platform placeholder for a video card without a real thumbnail. */
export function videoPlaceholderArt(platform?: string): string {
  if (platform === 'youtube') return ART.video.youtube;
  if (platform === 'instagram') return ART.video.instagram;
  return ART.video.generic;
}

/**
 * YouTube exposes predictable thumbnail URLs; derive one client-side so video
 * cards show the real video. Returns null for anything that is not YouTube.
 */
export function youtubeThumbnail(videoUrl: string): string | null {
  try {
    const url = new URL(videoUrl);
    let id: string | null = null;
    if (url.hostname === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
    else if (url.hostname.endsWith('youtube.com')) {
      if (url.pathname === '/watch') id = url.searchParams.get('v');
      else if (url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/embed/'))
        id = url.pathname.split('/')[2];
    }
    if (!id || !/^[\w-]{6,}$/.test(id)) return null;
    return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  } catch {
    return null;
  }
}
