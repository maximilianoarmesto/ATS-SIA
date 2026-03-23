/**
 * WCAG 2.1 Color Contrast Accessibility Utilities
 *
 * Implements the WCAG 2.1 contrast ratio algorithm as defined in:
 * https://www.w3.org/TR/WCAG21/#contrast-minimum (Success Criterion 1.4.3)
 * https://www.w3.org/TR/WCAG21/#contrast-enhanced (Success Criterion 1.4.6)
 *
 * WCAG thresholds:
 *   Level AA  — normal text: ≥ 4.5:1 | large text (≥ 18pt/14pt bold): ≥ 3:1
 *   Level AAA — normal text: ≥ 7:1   | large text: ≥ 4.5:1
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** RGB channel values in the range [0, 255]. */
export interface RgbColor {
  r: number
  g: number
  b: number
}

/** WCAG conformance level for a specific text size category. */
export type WcagLevel = 'AA' | 'AAA'

/** Text size category as defined by WCAG 2.1. */
export type TextSize = 'normal' | 'large'

/**
 * Result of a single color-pair contrast check.
 *
 * "large text" per WCAG = ≥ 18pt regular (≈ 24 px) or ≥ 14pt bold (≈ 18.67 px).
 */
export interface ContrastResult {
  /** Human-readable label identifying this color pair. */
  label: string
  /** Foreground (text) hex color. */
  foreground: string
  /** Background hex color. */
  background: string
  /** Computed contrast ratio rounded to 2 decimal places. */
  ratio: number
  /** Whether this pair passes WCAG AA for normal text (≥ 4.5:1). */
  passesAA: boolean
  /** Whether this pair passes WCAG AA for large text (≥ 3:1). */
  passesAALarge: boolean
  /** Whether this pair passes WCAG AAA for normal text (≥ 7:1). */
  passesAAA: boolean
  /** Whether this pair passes WCAG AAA for large text (≥ 4.5:1). */
  passesAAALarge: boolean
}

/** Aggregated report produced by {@link auditColorScheme}. */
export interface AccessibilityReport {
  /** All individual contrast check results. */
  results: ContrastResult[]
  /** Pairs that fail WCAG AA for normal text. */
  failures: ContrastResult[]
  /** Whether every pair passes WCAG AA for normal text. */
  allPassAA: boolean
  /** Whether every pair passes WCAG AAA for normal text. */
  allPassAAA: boolean
  /** Total number of pairs audited. */
  total: number
  /** Number of pairs that pass WCAG AA for normal text. */
  passCount: number
  /** Number of pairs that fail WCAG AA for normal text. */
  failCount: number
  /** Summary string suitable for logging. */
  summary: string
}

// ---------------------------------------------------------------------------
// WCAG minimum thresholds
// ---------------------------------------------------------------------------

export const WCAG_THRESHOLDS = {
  AA_NORMAL: 4.5,
  AA_LARGE: 3.0,
  AAA_NORMAL: 7.0,
  AAA_LARGE: 4.5,
} as const

// ---------------------------------------------------------------------------
// Core WCAG algorithm
// ---------------------------------------------------------------------------

/**
 * Converts a single 8-bit RGB channel value (0–255) to its linearised form
 * as required by the WCAG relative luminance formula.
 *
 * @see https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function lineariseChannel(value: number): number {
  const sRGB = value / 255
  return sRGB <= 0.04045 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4)
}

/**
 * Computes the relative luminance of an RGB colour in the range [0, 1].
 *
 * @see https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function relativeLuminance({ r, g, b }: RgbColor): number {
  return (
    0.2126 * lineariseChannel(r) +
    0.7152 * lineariseChannel(g) +
    0.0722 * lineariseChannel(b)
  )
}

/**
 * Computes the WCAG contrast ratio between two colours.
 * The ratio is always ≥ 1 (lighter colour is always the numerator).
 *
 * @see https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */
export function contrastRatio(color1: RgbColor, color2: RgbColor): number {
  const L1 = relativeLuminance(color1)
  const L2 = relativeLuminance(color2)
  const lighter = Math.max(L1, L2)
  const darker = Math.min(L1, L2)
  return (lighter + 0.05) / (darker + 0.05)
}

// ---------------------------------------------------------------------------
// Hex parsing
// ---------------------------------------------------------------------------

/**
 * Parses a 3- or 6-digit hex colour string (with or without leading `#`)
 * into an {@link RgbColor}.
 *
 * @throws {Error} when the string is not a valid hex colour.
 */
export function hexToRgb(hex: string): RgbColor {
  const sanitised = hex.replace(/^#/, '')

  let expanded = sanitised
  if (sanitised.length === 3) {
    expanded = sanitised
      .split('')
      .map((c) => c + c)
      .join('')
  }

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    throw new Error(`Invalid hex colour: "${hex}"`)
  }

  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  }
}

// ---------------------------------------------------------------------------
// High-level check helper
// ---------------------------------------------------------------------------

/**
 * Checks a foreground / background colour pair and returns a
 * {@link ContrastResult} with all WCAG AA and AAA verdicts populated.
 */
export function checkContrast(
  label: string,
  foregroundHex: string,
  backgroundHex: string
): ContrastResult {
  const fg = hexToRgb(foregroundHex)
  const bg = hexToRgb(backgroundHex)
  const ratio = Math.round(contrastRatio(fg, bg) * 100) / 100

  return {
    label,
    foreground: foregroundHex,
    background: backgroundHex,
    ratio,
    passesAA: ratio >= WCAG_THRESHOLDS.AA_NORMAL,
    passesAALarge: ratio >= WCAG_THRESHOLDS.AA_LARGE,
    passesAAA: ratio >= WCAG_THRESHOLDS.AAA_NORMAL,
    passesAAALarge: ratio >= WCAG_THRESHOLDS.AAA_LARGE,
  }
}

// ---------------------------------------------------------------------------
// Scheme-level audit
// ---------------------------------------------------------------------------

/**
 * Audits an array of colour pairs and returns an {@link AccessibilityReport}.
 *
 * Each entry is `[label, foregroundHex, backgroundHex]`.
 */
export function auditColorScheme(
  pairs: ReadonlyArray<readonly [string, string, string]>
): AccessibilityReport {
  const results = pairs.map(([label, fg, bg]) => checkContrast(label, fg, bg))
  const failures = results.filter((r) => !r.passesAA)
  const passCount = results.length - failures.length
  const allPassAA = failures.length === 0
  const allPassAAA = results.every((r) => r.passesAAA)

  const summary = allPassAA
    ? `All ${results.length} colour pair(s) pass WCAG AA (normal text ≥ 4.5:1).`
    : `${failures.length} of ${results.length} pair(s) fail WCAG AA: ${failures.map((f) => f.label).join(', ')}.`

  return {
    results,
    failures,
    allPassAA,
    allPassAAA,
    total: results.length,
    passCount,
    failCount: failures.length,
    summary,
  }
}
