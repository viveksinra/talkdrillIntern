'use client';

import { alpha, createTheme } from '@mui/material/styles';

/**
 * TalkDrill design tokens, ported from the marketing site's theme
 * (UserWebSiteTalkCode/src/theme/theme-config.js + core/typography.js) so the
 * internship portal is visibly the same product: same ramps, same type scale,
 * same 20px card with the two-layer shadow and the -2px hover lift.
 *
 * Ported rather than imported because that theme is built on the paid
 * `minimal-shared` package this standalone app does not depend on.
 */

export const brand = {
  primary: {
    lighter: '#E8E4FE',
    light: '#9A8AFB',
    main: '#4C3FE2',
    dark: '#3529B7',
    darker: '#241B7A',
    contrastText: '#FFFFFF',
  },
  secondary: {
    lighter: '#FEF4E4',
    light: '#FBCC7A',
    main: '#F5A623',
    dark: '#CC8815',
    darker: '#8A5A0B',
    contrastText: '#FFFFFF',
  },
  success: {
    lighter: '#D3FCD2',
    light: '#77ED8B',
    main: '#22C55E',
    dark: '#118D57',
    darker: '#065E49',
    contrastText: '#FFFFFF',
  },
  warning: {
    lighter: '#FFF5CC',
    light: '#FFD666',
    main: '#FFAB00',
    dark: '#B76E00',
    darker: '#7A4100',
    contrastText: '#1C252E',
  },
  error: {
    lighter: '#FFE9D5',
    light: '#FFAC82',
    main: '#FF5630',
    dark: '#B71D18',
    darker: '#7A0916',
    contrastText: '#FFFFFF',
  },
  info: {
    lighter: '#CAFDF5',
    light: '#61F3F3',
    main: '#00B8D9',
    dark: '#006C9C',
    darker: '#003768',
    contrastText: '#FFFFFF',
  },
  grey: {
    50: '#FCFDFD',
    100: '#F9FAFB',
    200: '#F4F6F8',
    300: '#DFE3E8',
    400: '#C4CDD5',
    500: '#919EAB',
    600: '#637381',
    700: '#454F5B',
    800: '#1C252E',
    900: '#141A21',
  },
} as const;

// TalkDrill ramps carry two stops beyond MUI's light/main/dark, and the site's
// layered shadows ride on the theme as customShadows (same name as the site).
declare module '@mui/material/styles' {
  interface PaletteColor {
    lighter: string;
    darker: string;
  }
  interface SimplePaletteColorOptions {
    lighter?: string;
    darker?: string;
  }
  interface Theme {
    customShadows: typeof customShadows;
  }
  interface ThemeOptions {
    customShadows?: typeof customShadows;
  }
}

const GREY_CHANNEL = '145, 158, 171'; // grey.500, for the layered shadows

/** Display face for hero numerals and headline moments (Fraunces, loaded in layout.tsx). */
export const FONT_DISPLAY = 'var(--font-display), "Iowan Old Style", Georgia, serif';

/** Website `core/design-tokens.js` gradients, verbatim. */
export const gradientTokens = {
  primary: 'linear-gradient(135deg, #6950E8 0%, #A78BFA 100%)',
  secondary: 'linear-gradient(135deg, #F5A623 0%, #FBCC7A 100%)',
  success: 'linear-gradient(135deg, #22C55E 0%, #77ED8B 100%)',
  info: 'linear-gradient(135deg, #00B8D9 0%, #61F3F3 100%)',
  warning: 'linear-gradient(135deg, #FFAB00 0%, #FFD666 100%)',
  error: 'linear-gradient(135deg, #FF5630 0%, #FFAC82 100%)',
  brandPanel: 'linear-gradient(135deg, #5B2C87 0%, #4834D4 50%, #7B68EE 100%)',
  violet: 'linear-gradient(135deg, #4C3FE2 0%, #7B68EE 100%)',
} as const;

/** Website motion vocabulary: durations + easings (incl. the signature reveal ease). */
export const animationTokens = {
  durations: { fastest: '100ms', fast: '150ms', normal: '250ms', slow: '350ms', slowest: '500ms' },
  easings: {
    sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    /** The hero/stagger reveal ease used across the website's framer variants. */
    reveal: 'cubic-bezier(0.22, 1, 0.36, 1)',
  },
} as const;

/** Gradient-filled text (website `core/mixins/text.js`). Spread into sx. */
export function textGradient(gradient: string) {
  return {
    background: gradient,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    color: 'transparent',
  } as const;
}

/** Card hover language from the website's FeatureCard: lift + colored glow. */
export function hoverLift(glowColor = brand.primary.main) {
  return {
    transition: 'transform .3s ease, box-shadow .3s ease, border-color .3s ease',
    '&:hover': {
      transform: 'translateY(-6px)',
      boxShadow: `0 24px 48px -26px ${glowColor}99`,
      borderColor: glowColor,
    },
  } as const;
}

/** The site's customShadows.card / .z8 / .z16, plus a primary-tinted glow. */
export const customShadows = {
  card: `0 0 2px 0 ${alpha('#919EAB', 0.08)}, 0 12px 24px -4px ${alpha('#919EAB', 0.1)}`,
  cardHover: `0 0 2px 0 ${alpha('#919EAB', 0.12)}, 0 16px 32px -4px ${alpha('#919EAB', 0.16)}`,
  z1: `0 1px 2px 0 ${alpha('#919EAB', 0.16)}`,
  z8: `0 8px 16px 0 ${alpha('#919EAB', 0.16)}`,
  z16: `0 16px 32px -4px ${alpha('#919EAB', 0.16)}`,
  z20: `0 20px 40px -4px ${alpha('#919EAB', 0.16)}`,
  dialog: `0 24px 48px -8px ${alpha('#000000', 0.2)}`,
  primary: `0 8px 16px 0 ${alpha(brand.primary.main, 0.24)}`,
};

/** Fluid type, same idea as the site's fluidFontSize(min, max). */
const fluid = (min: number, max: number) =>
  `clamp(${min / 16}rem, ${min / 16}rem + ${((max - min) / 16) * 0.5}vw, ${max / 16}rem)`;

const theme = createTheme({
  cssVariables: true,
  customShadows,
  palette: {
    primary: brand.primary,
    secondary: brand.secondary,
    success: brand.success,
    warning: brand.warning,
    error: brand.error,
    info: brand.info,
    grey: brand.grey,
    text: {
      primary: brand.grey[800],
      secondary: brand.grey[600],
      disabled: brand.grey[500],
    },
    background: {
      default: brand.grey[100],
      paper: '#FFFFFF',
    },
    divider: alpha('#919EAB', 0.2),
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'var(--font-body), Roboto, "Helvetica Neue", Arial, sans-serif',
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    h1: { fontWeight: 800, lineHeight: 1.25, letterSpacing: '-0.025em', fontSize: fluid(40, 64) },
    h2: { fontWeight: 800, lineHeight: 1.33, letterSpacing: '-0.025em', fontSize: fluid(32, 48) },
    h3: { fontWeight: 700, lineHeight: 1.5, letterSpacing: '-0.02em', fontSize: fluid(24, 32) },
    h4: { fontWeight: 700, lineHeight: 1.5, letterSpacing: '-0.017em', fontSize: fluid(20, 24) },
    h5: { fontWeight: 600, lineHeight: 1.5, letterSpacing: '-0.014em', fontSize: '1.125rem' },
    h6: { fontWeight: 600, lineHeight: 1.55, letterSpacing: '-0.011em', fontSize: '1.0625rem' },
    subtitle1: { fontWeight: 600, lineHeight: 1.5, fontSize: '1rem' },
    subtitle2: { fontWeight: 600, lineHeight: 1.57, fontSize: '0.875rem' },
    body1: { lineHeight: 1.6, fontSize: '1rem' },
    body2: { lineHeight: 1.57, fontSize: '0.875rem' },
    caption: { lineHeight: 1.5, letterSpacing: '0.02em', fontSize: '0.75rem' },
    overline: {
      fontWeight: 700,
      lineHeight: 1.5,
      letterSpacing: '0.08em',
      fontSize: '0.75rem',
      textTransform: 'uppercase',
    },
    button: {
      fontWeight: 600,
      lineHeight: 1.71,
      letterSpacing: '0.01em',
      fontSize: '0.875rem',
      textTransform: 'none',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { WebkitFontSmoothing: 'antialiased' },
        // Long numbers (points, views) should never reflow the layout.
        '.tnum': { fontVariantNumeric: 'tabular-nums' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          position: 'relative',
          borderRadius: 20,
          border: `1px solid ${alpha('#919EAB', 0.12)}`,
          boxShadow: customShadows.card,
          zIndex: 0, // Safari: overflow hidden + border radius
        },
      },
    },
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 10, minHeight: 44, paddingInline: 16 },
        sizeLarge: { minHeight: 50, fontSize: '0.9375rem' },
        sizeSmall: { minHeight: 34 },
        containedPrimary: {
          boxShadow: customShadows.primary,
          '&:hover': { boxShadow: customShadows.primary },
        },
      },
    },
    MuiTextField: { defaultProps: { fullWidth: true } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: '#FFFFFF',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha('#919EAB', 0.24) },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: brand.grey[500] },
        },
        input: { minHeight: 24 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, borderRadius: 8 },
        sizeSmall: { height: 24, fontSize: '0.75rem' },
      },
    },
    MuiAlert: { styleOverrides: { root: { borderRadius: 12 } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 20, boxShadow: customShadows.dialog } } },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600, minHeight: 48 } } },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 99, backgroundColor: alpha(`rgb(${GREY_CHANNEL})`, 0.16) },
        bar: { borderRadius: 99 },
      },
    },
    MuiTooltip: { styleOverrides: { tooltip: { borderRadius: 8, fontSize: '0.75rem' } } },
  },
});

export default theme;
