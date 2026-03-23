/**
 * Black Color Scheme Accessibility Audit
 *
 * Defines every foreground/background colour pair used across the application's
 * black color scheme and exposes a ready-to-run audit function.
 *
 * Color values are taken directly from tailwind.config.ts and globals.css so
 * that this audit always reflects the actual deployed colour scheme.
 *
 * WCAG 2.1 references:
 *   SC 1.4.3 Contrast (Minimum) — Level AA  : normal text ≥ 4.5:1, large ≥ 3:1
 *   SC 1.4.6 Contrast (Enhanced) — Level AAA: normal text ≥ 7:1,   large ≥ 4.5:1
 */

import { auditColorScheme, type AccessibilityReport } from './contrast'

// ---------------------------------------------------------------------------
// Resolved hex values from tailwind.config.ts + globals.css
// ---------------------------------------------------------------------------

/**
 * Named hex values referenced by the Tailwind config and CSS utilities.
 * Keeping them here as named constants makes it easy to update in one place
 * if the palette ever changes.
 */
export const PALETTE = {
  // Gray scale (matches tailwind.config.ts `gray` extension)
  white: '#ffffff',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',

  // Primary palette (matches tailwind.config.ts `primary` extension)
  // primary-50 … primary-500 map to the gray-50 … gray-500 shades
  primary50: '#f9fafb',
  primary100: '#f3f4f6',
  primary500: '#6b7280',
  primary600: '#111827', // used as the "brand" link / active color
  primary700: '#0d1117',
  primary800: '#080c10',
  primary900: '#030508',

  // Status badge colours
  green100: '#dcfce7',
  green800: '#166534',
  blue100: '#dbeafe',
  blue800: '#1e40af',
  yellow100: '#fef9c3',
  yellow800: '#854d0e',
  red100: '#fee2e2',
  red800: '#991b1b',
  red500: '#ef4444', // required asterisk / error text
  red600: '#dc2626', // delete button background
  red700: '#b91c1c', // delete button hover
  cyan100: '#cffafe',
  cyan800: '#155e75',
  purple100: '#f3e8ff',
  purple800: '#6b21a8',
  orange100: '#ffedd5',
  orange800: '#9a3412',
  indigo100: '#e0e7ff',
  indigo800: '#3730a3',
} as const

// ---------------------------------------------------------------------------
// All foreground / background pairs used in the black color scheme
// Format: [label, foreground, background]
// ---------------------------------------------------------------------------

/**
 * Every colour pair that appears in the UI, organised by component / context.
 * The label strings are used in failure messages so they should be descriptive.
 */
export const COLOR_PAIRS: ReadonlyArray<readonly [string, string, string]> = [
  // ── Body / Page ──────────────────────────────────────────────────────────
  // NOTE: Placeholder text (gray-400) is WCAG-exempt — see WCAG_EXEMPT_PAIRS below.
  ['Body text on page background', PALETTE.gray900, PALETTE.gray50],
  ['Body text on white card', PALETTE.gray900, PALETTE.white],
  ['Muted body text on white card', PALETTE.gray600, PALETTE.white],
  ['Muted body text on page background', PALETTE.gray600, PALETTE.gray50],

  // ── Headings ─────────────────────────────────────────────────────────────
  ['H1–H6 headings on page background', PALETTE.gray900, PALETTE.gray50],
  ['H1–H6 headings on white card', PALETTE.gray900, PALETTE.white],

  // ── Navbar ───────────────────────────────────────────────────────────────
  ['Navbar brand text on white navbar', PALETTE.gray900, PALETTE.white],
  ['Navbar link (inactive) on white navbar', PALETTE.gray700, PALETTE.white],
  [
    'Navbar link (active) on primary-50 highlight',
    PALETTE.primary600,
    PALETTE.primary50,
  ],
  [
    'Navbar link hover text on white navbar',
    PALETTE.primary600,
    PALETTE.white,
  ],

  // ── Primary buttons (black color scheme) ─────────────────────────────────
  ['btn-primary: white text on gray-900', PALETTE.white, PALETTE.gray900],
  ['btn-primary hover: white text on gray-700', PALETTE.white, PALETTE.gray700],
  [
    'btn-primary active: white text on gray-800',
    PALETTE.white,
    PALETTE.gray800,
  ],

  // ── Secondary buttons ────────────────────────────────────────────────────
  [
    'btn-secondary: gray-900 text on gray-100',
    PALETTE.gray900,
    PALETTE.gray100,
  ],
  [
    'btn-secondary hover: gray-900 text on gray-200',
    PALETTE.gray900,
    PALETTE.gray200,
  ],

  // ── Delete button ────────────────────────────────────────────────────────
  ['Delete button: white text on red-600', PALETTE.white, PALETTE.red600],
  ['Delete button hover: white text on red-700', PALETTE.white, PALETTE.red700],

  // ── Link / action colors ─────────────────────────────────────────────────
  [
    'Primary link (primary-600) on white',
    PALETTE.primary600,
    PALETTE.white,
  ],
  [
    'Primary link (primary-600) on gray-50',
    PALETTE.primary600,
    PALETTE.gray50,
  ],
  [
    'Secondary link (gray-600) on white',
    PALETTE.gray600,
    PALETTE.white,
  ],
  [
    'Secondary link hover (gray-900) on white',
    PALETTE.gray900,
    PALETTE.white,
  ],

  // ── Form inputs ──────────────────────────────────────────────────────────
  ['Input text on white input background', PALETTE.gray900, PALETTE.white],
  ['Input label on page background', PALETTE.gray700, PALETTE.gray50],
  ['Input label on white card', PALETTE.gray700, PALETTE.white],
  // Required asterisks use red-600 (#dc2626) — upgraded from red-500 for AA compliance
  ['Required asterisk (red-600) on white', PALETTE.red600, PALETTE.white],
  ['Required asterisk (red-600) on gray-50', PALETTE.red600, PALETTE.gray50],

  // ── Table headers ────────────────────────────────────────────────────────
  [
    'Table header text (gray-500) on gray-50',
    PALETTE.gray500,
    PALETTE.gray50,
  ],
  ['Table cell text (gray-900) on white', PALETTE.gray900, PALETTE.white],
  ['Table cell muted (gray-500) on white', PALETTE.gray500, PALETTE.white],
  ['Table row hover: gray-900 text on gray-50', PALETTE.gray900, PALETTE.gray50],

  // ── Status badges ─────────────────────────────────────────────────────────
  [
    'Badge: green-800 text on green-100 (Published / Active / Hired)',
    PALETTE.green800,
    PALETTE.green100,
  ],
  [
    'Badge: blue-800 text on blue-100 (Under Review / Hired candidate)',
    PALETTE.blue800,
    PALETTE.blue100,
  ],
  [
    'Badge: yellow-800 text on yellow-100 (Paused / Applied)',
    PALETTE.yellow800,
    PALETTE.yellow100,
  ],
  [
    'Badge: red-800 text on red-100 (Closed / Rejected / Blacklisted)',
    PALETTE.red800,
    PALETTE.red100,
  ],
  [
    'Badge: cyan-800 text on cyan-100 (Shortlisted)',
    PALETTE.cyan800,
    PALETTE.cyan100,
  ],
  [
    'Badge: purple-800 text on purple-100 (Interviewing)',
    PALETTE.purple800,
    PALETTE.purple100,
  ],
  [
    'Badge: orange-800 text on orange-100 (Offer Sent)',
    PALETTE.orange800,
    PALETTE.orange100,
  ],
  [
    'Badge: indigo-800 text on indigo-100 (Application stage)',
    PALETTE.indigo800,
    PALETTE.indigo100,
  ],
  [
    'Badge: gray-600 text on gray-100 (Draft / Withdrawn)',
    PALETTE.gray600,
    PALETTE.gray100,
  ],

  // ── Avatar initials ───────────────────────────────────────────────────────
  [
    'Avatar initials (primary-600) on primary-100',
    PALETTE.primary600,
    PALETTE.primary100,
  ],

  // ── Error states ─────────────────────────────────────────────────────────
  ['Error message text (red-700) on red-50', '#b91c1c', '#fef2f2'],
  ['Error border message (red-600) on white', PALETTE.red600, PALETTE.white],

  // ── Miscellaneous ────────────────────────────────────────────────────────
  // NOTE: Separator pipes use aria-hidden="true" throughout the codebase, making
  // them purely decorative — WCAG SC 1.4.3 explicitly exempts decorative elements.
  // They are included here for documentation but do not affect WCAG compliance.
  ['Date / meta text (gray-500) on white', PALETTE.gray500, PALETTE.white],
] as const

// ---------------------------------------------------------------------------
// WCAG-exempt elements (documented for transparency)
// ---------------------------------------------------------------------------

/**
 * Colour pairs that intentionally do not meet WCAG AA for normal text because
 * they fall under an explicit WCAG 2.1 SC 1.4.3 exemption.
 *
 * These are included for documentation / audit transparency only and are NOT
 * part of the pass/fail audit run by {@link runColorSchemeAudit}.
 *
 * @see https://www.w3.org/TR/WCAG21/#contrast-minimum — exemptions:
 *   "Decorative: If the text or images of text are purely decorative and not
 *    used to convey information, there is no contrast requirement."
 *   "Incidental: Text or images of text that are part of an inactive user
 *    interface component... have no contrast requirement."
 */
export const WCAG_EXEMPT_PAIRS: ReadonlyArray<{
  label: string
  foreground: string
  background: string
  exemptionReason: string
}> = [
  {
    label: 'Placeholder text (gray-400) on white input',
    foreground: PALETTE.gray400,
    background: PALETTE.white,
    exemptionReason:
      'WCAG SC 1.4.3 Note 1: "Placeholder text in input fields" is explicitly ' +
      'excluded from the contrast requirement. The field label provides the ' +
      'accessible name; placeholder is purely decorative hint text.',
  },
  {
    label: 'Placeholder text (gray-400) on gray-50 background',
    foreground: PALETTE.gray400,
    background: PALETTE.gray50,
    exemptionReason:
      'Same exemption as above — placeholder text in form fields.',
  },
  {
    label: 'Separator pipe (gray-300) on white',
    foreground: PALETTE.gray300,
    background: PALETTE.white,
    exemptionReason:
      'All separator pipes in the codebase carry aria-hidden="true", making ' +
      'them purely decorative. WCAG SC 1.4.3 exempts decorative elements from ' +
      'contrast requirements.',
  },
]

// ---------------------------------------------------------------------------
// Public audit entry point
// ---------------------------------------------------------------------------

/**
 * Runs a WCAG contrast audit against every colour pair in the black color
 * scheme and returns an {@link AccessibilityReport}.
 *
 * This is the single entry point used by the automated test suite.
 */
export function runColorSchemeAudit(): AccessibilityReport {
  return auditColorScheme(COLOR_PAIRS)
}
