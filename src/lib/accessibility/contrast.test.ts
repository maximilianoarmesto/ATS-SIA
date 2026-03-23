/**
 * Accessibility Contrast Tests
 *
 * Verifies that:
 * 1. The WCAG contrast ratio algorithm is implemented correctly.
 * 2. Every colour pair in the black color scheme meets WCAG 2.1 Level AA.
 * 3. Readability-critical pairs (body text, headings, primary buttons) also
 *    meet the stricter WCAG 2.1 Level AAA standard.
 *
 * Run via:
 *   npm run test:accessibility
 *
 * Exit code 0 = all tests pass.
 * Exit code 1 = one or more tests fail (details printed to stdout).
 */

import assert from 'node:assert/strict'
import {
  hexToRgb,
  lineariseChannel,
  relativeLuminance,
  contrastRatio,
  checkContrast,
  auditColorScheme,
  WCAG_THRESHOLDS,
} from './contrast'

import {
  runColorSchemeAudit,
  COLOR_PAIRS,
  PALETTE,
  WCAG_EXEMPT_PAIRS,
} from './color-scheme-audit'

// ---------------------------------------------------------------------------
// Minimal test runner (no external dependencies required)
// ---------------------------------------------------------------------------

let passed = 0
let failed = 0
const failures: string[] = []

function test(description: string, fn: () => void): void {
  try {
    fn()
    passed++
    console.log(`  ✓ ${description}`)
  } catch (err) {
    failed++
    const message = err instanceof Error ? err.message : String(err)
    failures.push(`  ✗ ${description}\n      ${message}`)
    console.error(`  ✗ ${description}`)
    console.error(`      ${message}`)
  }
}

function describe(suite: string, fn: () => void): void {
  console.log(`\n${suite}`)
  fn()
}

// ---------------------------------------------------------------------------
// 1. Unit tests — WCAG algorithm correctness
// ---------------------------------------------------------------------------

describe('hexToRgb — hex colour parsing', () => {
  test('parses a 6-digit hex with # prefix', () => {
    assert.deepEqual(hexToRgb('#ffffff'), { r: 255, g: 255, b: 255 })
  })

  test('parses a 6-digit hex without # prefix', () => {
    assert.deepEqual(hexToRgb('000000'), { r: 0, g: 0, b: 0 })
  })

  test('parses black (#111827 — gray-900)', () => {
    assert.deepEqual(hexToRgb('#111827'), { r: 17, g: 24, b: 39 })
  })

  test('parses a 3-digit shorthand hex', () => {
    assert.deepEqual(hexToRgb('#fff'), { r: 255, g: 255, b: 255 })
  })

  test('parses a 3-digit shorthand without #', () => {
    assert.deepEqual(hexToRgb('000'), { r: 0, g: 0, b: 0 })
  })

  test('throws for an invalid hex string', () => {
    assert.throws(() => hexToRgb('xyz'), /Invalid hex colour/)
  })

  test('throws for an incomplete hex string', () => {
    assert.throws(() => hexToRgb('#12'), /Invalid hex colour/)
  })
})

describe('lineariseChannel — sRGB to linear conversion', () => {
  test('white channel (255) linearises to 1.0', () => {
    assert.equal(lineariseChannel(255), 1.0)
  })

  test('black channel (0) linearises to 0.0', () => {
    assert.equal(lineariseChannel(0), 0.0)
  })

  test('mid-range value uses the power-curve branch', () => {
    // 128 / 255 ≈ 0.502 > 0.04045 → power curve
    const result = lineariseChannel(128)
    assert.ok(result > 0.2 && result < 0.22, `Expected ~0.216, got ${result}`)
  })

  test('low value (≤ 0.04045 threshold) uses linear branch', () => {
    // 10 / 255 ≈ 0.039 ≤ 0.04045 → linear branch: 0.039 / 12.92 ≈ 0.003
    const result = lineariseChannel(10)
    assert.ok(result < 0.01, `Expected < 0.01, got ${result}`)
  })
})

describe('relativeLuminance — WCAG luminance formula', () => {
  test('white (#ffffff) has luminance 1.0', () => {
    assert.equal(relativeLuminance({ r: 255, g: 255, b: 255 }), 1.0)
  })

  test('black (#000000) has luminance 0.0', () => {
    assert.equal(relativeLuminance({ r: 0, g: 0, b: 0 }), 0.0)
  })

  test('luminance is always in [0, 1]', () => {
    const samples = [
      { r: 0, g: 0, b: 0 },
      { r: 128, g: 128, b: 128 },
      { r: 255, g: 255, b: 255 },
      { r: 17, g: 24, b: 39 },  // gray-900
      { r: 249, g: 250, b: 251 }, // gray-50
    ]
    for (const rgb of samples) {
      const l = relativeLuminance(rgb)
      assert.ok(l >= 0 && l <= 1, `Luminance out of range for ${JSON.stringify(rgb)}: ${l}`)
    }
  })
})

describe('contrastRatio — WCAG contrast computation', () => {
  test('black on white yields the maximum ratio of 21:1', () => {
    const ratio = contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })
    assert.ok(Math.abs(ratio - 21) < 0.01, `Expected ~21, got ${ratio}`)
  })

  test('same colour on itself yields ratio of 1:1', () => {
    const ratio = contrastRatio({ r: 128, g: 128, b: 128 }, { r: 128, g: 128, b: 128 })
    assert.equal(ratio, 1)
  })

  test('ratio is symmetric (fg/bg order does not matter)', () => {
    const white = { r: 255, g: 255, b: 255 }
    const dark = { r: 17, g: 24, b: 39 }
    assert.equal(contrastRatio(white, dark), contrastRatio(dark, white))
  })

  test('ratio is always ≥ 1', () => {
    const pairs: Array<[{ r: number; g: number; b: number }, { r: number; g: number; b: number }]> = [
      [{ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 }],
      [{ r: 128, g: 128, b: 128 }, { r: 200, g: 200, b: 200 }],
      [{ r: 17, g: 24, b: 39 }, { r: 249, g: 250, b: 251 }],
    ]
    for (const [c1, c2] of pairs) {
      const ratio = contrastRatio(c1, c2)
      assert.ok(ratio >= 1, `Ratio < 1 for ${JSON.stringify(c1)} vs ${JSON.stringify(c2)}: ${ratio}`)
    }
  })
})

describe('checkContrast — high-level pair check', () => {
  test('white on black passes all WCAG levels', () => {
    const result = checkContrast('test', '#ffffff', '#000000')
    assert.ok(result.passesAA, 'Should pass AA normal')
    assert.ok(result.passesAALarge, 'Should pass AA large')
    assert.ok(result.passesAAA, 'Should pass AAA normal')
    assert.ok(result.passesAAALarge, 'Should pass AAA large')
  })

  test('result contains the correct label, fg, bg, and ratio', () => {
    const result = checkContrast('my pair', '#ffffff', '#111827')
    assert.equal(result.label, 'my pair')
    assert.equal(result.foreground, '#ffffff')
    assert.equal(result.background, '#111827')
    assert.ok(result.ratio >= 4.5, `Expected ratio ≥ 4.5, got ${result.ratio}`)
  })

  test('ratio is rounded to 2 decimal places', () => {
    const result = checkContrast('rounding', '#ffffff', '#111827')
    const decimals = result.ratio.toString().split('.')[1]?.length ?? 0
    assert.ok(decimals <= 2, `Expected ≤ 2 decimal places, got ${decimals}`)
  })
})

describe('auditColorScheme — batch audit', () => {
  test('returns a result for each pair supplied', () => {
    const pairs = [
      ['pair A', '#ffffff', '#000000'],
      ['pair B', '#ffffff', '#111827'],
    ] as const
    const report = auditColorScheme(pairs)
    assert.equal(report.total, 2)
    assert.equal(report.results.length, 2)
  })

  test('allPassAA is true when all pairs pass', () => {
    const pairs = [['high contrast', '#ffffff', '#000000']] as const
    const report = auditColorScheme(pairs)
    assert.ok(report.allPassAA)
    assert.equal(report.failCount, 0)
  })

  test('allPassAA is false and failures is populated when a pair fails', () => {
    const pairs = [
      ['passes', '#ffffff', '#000000'],
      ['fails — low contrast', '#cccccc', '#ffffff'],
    ] as const
    const report = auditColorScheme(pairs)
    assert.ok(!report.allPassAA)
    assert.equal(report.failCount, 1)
    assert.equal(report.failures[0].label, 'fails — low contrast')
  })

  test('summary string mentions failure labels when audit fails', () => {
    const pairs = [['low contrast pair', '#dddddd', '#ffffff']] as const
    const report = auditColorScheme(pairs)
    assert.ok(report.summary.includes('low contrast pair'))
  })

  test('summary string confirms all pass when audit succeeds', () => {
    const pairs = [['good', '#000000', '#ffffff']] as const
    const report = auditColorScheme(pairs)
    assert.ok(report.summary.includes('pass WCAG AA'))
  })
})

describe('WCAG_THRESHOLDS — constant values', () => {
  test('AA normal threshold is 4.5', () => {
    assert.equal(WCAG_THRESHOLDS.AA_NORMAL, 4.5)
  })

  test('AA large threshold is 3.0', () => {
    assert.equal(WCAG_THRESHOLDS.AA_LARGE, 3.0)
  })

  test('AAA normal threshold is 7.0', () => {
    assert.equal(WCAG_THRESHOLDS.AAA_NORMAL, 7.0)
  })

  test('AAA large threshold is 4.5', () => {
    assert.equal(WCAG_THRESHOLDS.AAA_LARGE, 4.5)
  })
})

// ---------------------------------------------------------------------------
// 2. Black color scheme — individual critical pair checks
// ---------------------------------------------------------------------------

describe('Black color scheme — primary button readability', () => {
  test('btn-primary: white text (#fff) on gray-900 (#111827) passes WCAG AA', () => {
    const result = checkContrast('btn-primary', PALETTE.white, PALETTE.gray900)
    assert.ok(
      result.passesAA,
      `btn-primary contrast ${result.ratio}:1 must be ≥ ${WCAG_THRESHOLDS.AA_NORMAL}:1 (WCAG AA)`
    )
  })

  test('btn-primary: white text on gray-900 passes WCAG AAA', () => {
    const result = checkContrast('btn-primary AAA', PALETTE.white, PALETTE.gray900)
    assert.ok(
      result.passesAAA,
      `btn-primary contrast ${result.ratio}:1 must be ≥ ${WCAG_THRESHOLDS.AAA_NORMAL}:1 (WCAG AAA)`
    )
  })

  test('btn-primary hover: white text on gray-700 passes WCAG AA', () => {
    const result = checkContrast('btn-primary hover', PALETTE.white, PALETTE.gray700)
    assert.ok(
      result.passesAA,
      `btn-primary hover contrast ${result.ratio}:1 must be ≥ ${WCAG_THRESHOLDS.AA_NORMAL}:1 (WCAG AA)`
    )
  })

  test('btn-primary active: white text on gray-800 passes WCAG AA', () => {
    const result = checkContrast('btn-primary active', PALETTE.white, PALETTE.gray800)
    assert.ok(
      result.passesAA,
      `btn-primary active contrast ${result.ratio}:1 must be ≥ ${WCAG_THRESHOLDS.AA_NORMAL}:1 (WCAG AA)`
    )
  })

  test('btn-secondary: gray-900 on gray-100 passes WCAG AA', () => {
    const result = checkContrast('btn-secondary', PALETTE.gray900, PALETTE.gray100)
    assert.ok(
      result.passesAA,
      `btn-secondary contrast ${result.ratio}:1 must be ≥ ${WCAG_THRESHOLDS.AA_NORMAL}:1 (WCAG AA)`
    )
  })
})

describe('Black color scheme — navbar / header readability', () => {
  test('Navbar brand (gray-900) on white passes WCAG AA', () => {
    const result = checkContrast('navbar brand', PALETTE.gray900, PALETTE.white)
    assert.ok(
      result.passesAA,
      `Navbar brand contrast ${result.ratio}:1 must be ≥ ${WCAG_THRESHOLDS.AA_NORMAL}:1`
    )
  })

  test('Navbar brand (gray-900) on white passes WCAG AAA', () => {
    const result = checkContrast('navbar brand AAA', PALETTE.gray900, PALETTE.white)
    assert.ok(
      result.passesAAA,
      `Navbar brand contrast ${result.ratio}:1 must be ≥ ${WCAG_THRESHOLDS.AAA_NORMAL}:1 (AAA)`
    )
  })

  test('Navbar inactive link (gray-700) on white passes WCAG AA', () => {
    const result = checkContrast('navbar inactive', PALETTE.gray700, PALETTE.white)
    assert.ok(
      result.passesAA,
      `Navbar inactive link contrast ${result.ratio}:1 must be ≥ ${WCAG_THRESHOLDS.AA_NORMAL}:1`
    )
  })

  test('Navbar active link (primary-600 = #111827) on primary-50 passes WCAG AA', () => {
    const result = checkContrast('navbar active', PALETTE.primary600, PALETTE.primary50)
    assert.ok(
      result.passesAA,
      `Navbar active link contrast ${result.ratio}:1 must be ≥ ${WCAG_THRESHOLDS.AA_NORMAL}:1`
    )
  })
})

describe('Black color scheme — body text readability', () => {
  test('Body text (gray-900) on white passes WCAG AAA', () => {
    const result = checkContrast('body text', PALETTE.gray900, PALETTE.white)
    assert.ok(
      result.passesAAA,
      `Body text contrast ${result.ratio}:1 must be ≥ ${WCAG_THRESHOLDS.AAA_NORMAL}:1 (AAA)`
    )
  })

  test('Body text (gray-900) on page background (gray-50) passes WCAG AA', () => {
    const result = checkContrast('body on gray-50', PALETTE.gray900, PALETTE.gray50)
    assert.ok(
      result.passesAA,
      `Body on gray-50 contrast ${result.ratio}:1 must be ≥ ${WCAG_THRESHOLDS.AA_NORMAL}:1`
    )
  })

  test('H1–H6 headings (gray-900) on white pass WCAG AAA', () => {
    const result = checkContrast('headings', PALETTE.gray900, PALETTE.white)
    assert.ok(
      result.passesAAA,
      `Headings contrast ${result.ratio}:1 must be ≥ ${WCAG_THRESHOLDS.AAA_NORMAL}:1 (AAA)`
    )
  })

  test('Muted text (gray-600) on white passes WCAG AA', () => {
    const result = checkContrast('muted text', PALETTE.gray600, PALETTE.white)
    assert.ok(
      result.passesAA,
      `Muted text contrast ${result.ratio}:1 must be ≥ ${WCAG_THRESHOLDS.AA_NORMAL}:1`
    )
  })
})

describe('Black color scheme — status badges readability', () => {
  const badgePairs: ReadonlyArray<readonly [string, string, string]> = [
    ['Published/Active (green-800 on green-100)', PALETTE.green800, PALETTE.green100],
    ['Hired candidate (blue-800 on blue-100)', PALETTE.blue800, PALETTE.blue100],
    ['Applied/Paused (yellow-800 on yellow-100)', PALETTE.yellow800, PALETTE.yellow100],
    ['Rejected/Closed (red-800 on red-100)', PALETTE.red800, PALETTE.red100],
    ['Shortlisted (cyan-800 on cyan-100)', PALETTE.cyan800, PALETTE.cyan100],
    ['Interviewing (purple-800 on purple-100)', PALETTE.purple800, PALETTE.purple100],
    ['Offer Sent (orange-800 on orange-100)', PALETTE.orange800, PALETTE.orange100],
    ['Stage (indigo-800 on indigo-100)', PALETTE.indigo800, PALETTE.indigo100],
    ['Draft/Withdrawn (gray-600 on gray-100)', PALETTE.gray600, PALETTE.gray100],
  ]

  for (const [label, fg, bg] of badgePairs) {
    test(`Badge: ${label} passes WCAG AA`, () => {
      const result = checkContrast(label, fg, bg)
      assert.ok(
        result.passesAA,
        `Badge "${label}" contrast ${result.ratio}:1 must be ≥ ${WCAG_THRESHOLDS.AA_NORMAL}:1`
      )
    })
  }
})

describe('Black color scheme — form input readability', () => {
  test('Input label (gray-700) on white card passes WCAG AA', () => {
    const result = checkContrast('input label', PALETTE.gray700, PALETTE.white)
    assert.ok(
      result.passesAA,
      `Input label contrast ${result.ratio}:1 must be ≥ ${WCAG_THRESHOLDS.AA_NORMAL}:1`
    )
  })

  test('Input text (gray-900) on white background passes WCAG AAA', () => {
    const result = checkContrast('input text', PALETTE.gray900, PALETTE.white)
    assert.ok(
      result.passesAAA,
      `Input text contrast ${result.ratio}:1 must be ≥ ${WCAG_THRESHOLDS.AAA_NORMAL}:1 (AAA)`
    )
  })

  test('Required asterisk (red-600) on white passes WCAG AA', () => {
    const result = checkContrast('required asterisk', PALETTE.red600, PALETTE.white)
    assert.ok(
      result.passesAA,
      `Required asterisk contrast ${result.ratio}:1 must be ≥ ${WCAG_THRESHOLDS.AA_NORMAL}:1`
    )
  })

  test('Required asterisk (red-600) on gray-50 passes WCAG AA', () => {
    const result = checkContrast('required asterisk gray-50', PALETTE.red600, PALETTE.gray50)
    assert.ok(
      result.passesAA,
      `Required asterisk on gray-50 contrast ${result.ratio}:1 must be ≥ ${WCAG_THRESHOLDS.AA_NORMAL}:1`
    )
  })

  test('Delete button: white text on red-600 passes WCAG AA', () => {
    const result = checkContrast('delete btn', PALETTE.white, PALETTE.red600)
    assert.ok(
      result.passesAA,
      `Delete button contrast ${result.ratio}:1 must be ≥ ${WCAG_THRESHOLDS.AA_NORMAL}:1`
    )
  })
})

// ---------------------------------------------------------------------------
// 3. Full color-scheme audit — the primary acceptance-criterion test
// ---------------------------------------------------------------------------

describe('Full color scheme WCAG AA audit (acceptance criterion)', () => {
  const report = runColorSchemeAudit()

  test(`All ${report.total} color pairs in the black scheme pass WCAG AA (normal text ≥ 4.5:1)`, () => {
    if (!report.allPassAA) {
      const details = report.failures
        .map((f) => `  • ${f.label}: ${f.ratio}:1 (needs ${WCAG_THRESHOLDS.AA_NORMAL}:1)`)
        .join('\n')
      assert.fail(
        `${report.failCount} pair(s) fail WCAG AA:\n${details}`
      )
    }
  })

  test(`COLOR_PAIRS covers all ${COLOR_PAIRS.length} defined pairs`, () => {
    assert.ok(
      COLOR_PAIRS.length >= 40,
      `Expected at least 40 color pairs to be audited, found ${COLOR_PAIRS.length}`
    )
  })

  test('Audit report has correct structure', () => {
    assert.equal(typeof report.total, 'number')
    assert.equal(typeof report.passCount, 'number')
    assert.equal(typeof report.failCount, 'number')
    assert.equal(typeof report.summary, 'string')
    assert.ok(Array.isArray(report.results))
    assert.ok(Array.isArray(report.failures))
    assert.equal(report.passCount + report.failCount, report.total)
  })
})

describe('Full color scheme WCAG AAA audit (readability excellence)', () => {
  // Identify the critical readability pairs that must meet AAA
  const criticalPairs: ReadonlyArray<readonly [string, string, string]> = [
    ['Body text on white', PALETTE.gray900, PALETTE.white],
    ['Headings on white', PALETTE.gray900, PALETTE.white],
    ['btn-primary on gray-900', PALETTE.white, PALETTE.gray900],
    ['Input text on white', PALETTE.gray900, PALETTE.white],
    ['Body text on page background', PALETTE.gray900, PALETTE.gray50],
  ]

  for (const [label, fg, bg] of criticalPairs) {
    test(`Critical pair "${label}" passes WCAG AAA (≥ 7:1)`, () => {
      const result = checkContrast(label, fg, bg)
      assert.ok(
        result.passesAAA,
        `"${label}" contrast ${result.ratio}:1 must be ≥ ${WCAG_THRESHOLDS.AAA_NORMAL}:1 for AAA`
      )
    })
  }
})

describe('WCAG-exempt elements — documentation and transparency', () => {
  test('WCAG_EXEMPT_PAIRS array is non-empty and documented', () => {
    assert.ok(
      WCAG_EXEMPT_PAIRS.length > 0,
      'Expected at least one documented WCAG-exempt pair'
    )
  })

  test('Each exempt pair has a label, foreground, background, and exemptionReason', () => {
    for (const pair of WCAG_EXEMPT_PAIRS) {
      assert.ok(typeof pair.label === 'string' && pair.label.length > 0, 'label required')
      assert.ok(typeof pair.foreground === 'string' && pair.foreground.startsWith('#'), 'foreground required')
      assert.ok(typeof pair.background === 'string' && pair.background.startsWith('#'), 'background required')
      assert.ok(typeof pair.exemptionReason === 'string' && pair.exemptionReason.length > 0, 'exemptionReason required')
    }
  })

  test('Placeholder text (gray-400) exemption cites WCAG SC 1.4.3 Note 1', () => {
    const placeholderPair = WCAG_EXEMPT_PAIRS.find((p) => p.label.includes('Placeholder'))
    assert.ok(placeholderPair, 'Placeholder pair should be documented in WCAG_EXEMPT_PAIRS')
    assert.ok(
      placeholderPair.exemptionReason.includes('1.4.3'),
      'Exemption reason must cite WCAG SC 1.4.3'
    )
  })

  test('Separator pipe (gray-300) exemption cites aria-hidden', () => {
    const separatorPair = WCAG_EXEMPT_PAIRS.find((p) => p.label.includes('Separator'))
    assert.ok(separatorPair, 'Separator pair should be documented in WCAG_EXEMPT_PAIRS')
    assert.ok(
      separatorPair.exemptionReason.includes('aria-hidden'),
      'Exemption reason must mention aria-hidden'
    )
  })

  test('Exempt pairs are NOT included in the main COLOR_PAIRS audit', () => {
    const exemptLabels = new Set(WCAG_EXEMPT_PAIRS.map((p) => p.label))
    const auditLabels = COLOR_PAIRS.map(([label]) => label)
    for (const exemptLabel of exemptLabels) {
      assert.ok(
        !auditLabels.includes(exemptLabel),
        `Exempt pair "${exemptLabel}" must not appear in the main COLOR_PAIRS audit`
      )
    }
  })
})

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const total = passed + failed
console.log(`\n${'─'.repeat(60)}`)
console.log(`Test results: ${passed} passed, ${failed} failed, ${total} total`)

if (failures.length > 0) {
  console.log('\nFailures:')
  failures.forEach((f) => console.log(f))
}

if (failed > 0) {
  process.exit(1)
} else {
  console.log('\n✓ All accessibility tests passed.')
  console.log('  The black color scheme meets WCAG 2.1 Level AA requirements.')
  console.log('  Critical readability pairs meet WCAG 2.1 Level AAA requirements.')
}
