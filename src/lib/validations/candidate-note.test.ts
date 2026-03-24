/**
 * Tests — Candidate Note Validation
 *
 * Verifies that:
 * 1. validateCreateCandidateNote accepts valid payloads and rejects invalid ones.
 * 2. validateUpdateCandidateNote applies the same full-replace rules.
 * 3. Error messages are human-readable and accurate.
 * 4. Content is correctly trimmed before returning.
 *
 * Run via:
 *   npx tsx src/lib/validations/candidate-note.test.ts
 *
 * Exit code 0 = all tests pass.
 * Exit code 1 = one or more tests fail.
 */

import assert from 'node:assert/strict'
import {
  validateCreateCandidateNote,
  validateUpdateCandidateNote,
  type CreateCandidateNoteInput,
  type UpdateCandidateNoteInput,
  type ValidationResult,
} from './candidate-note'

// ---------------------------------------------------------------------------
// Minimal test runner (matches project convention from contrast.test.ts)
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
// Helpers
// ---------------------------------------------------------------------------

const MAX_CONTENT_LENGTH = 10_000

function makeContent(length: number): string {
  return 'a'.repeat(length)
}

// ---------------------------------------------------------------------------
// 1. validateCreateCandidateNote — happy path
// ---------------------------------------------------------------------------

describe('validateCreateCandidateNote — valid inputs', () => {
  test('accepts a simple non-empty string', () => {
    const result = validateCreateCandidateNote({ content: 'Great candidate.' })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.content, 'Great candidate.')
    }
  })

  test('accepts content at exactly the maximum length', () => {
    const content = makeContent(MAX_CONTENT_LENGTH)
    const result = validateCreateCandidateNote({ content })
    assert.equal(result.success, true)
  })

  test('accepts content with leading/trailing whitespace and trims it', () => {
    const result = validateCreateCandidateNote({ content: '  trimmed note  ' })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.content, 'trimmed note')
    }
  })

  test('accepts multi-line content', () => {
    const content = 'Line one.\nLine two.\nLine three.'
    const result = validateCreateCandidateNote({ content })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.content, content)
    }
  })

  test('accepts content that is exactly 1 character long', () => {
    const result = validateCreateCandidateNote({ content: 'x' })
    assert.equal(result.success, true)
  })

  test('accepts content with special characters', () => {
    const content = 'Strong C++ background & 5+ years exp. <Great>'
    const result = validateCreateCandidateNote({ content })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.content, content)
    }
  })

  test('accepts content with unicode characters', () => {
    const content = 'Excellent résumé — très bien 🎉'
    const result = validateCreateCandidateNote({ content })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.content, content)
    }
  })

  test('returns success: true with a data property on valid input', () => {
    const result = validateCreateCandidateNote({ content: 'Valid note' })
    assert.equal(result.success, true)
    assert.ok('data' in result, 'Result should have a data property')
    assert.ok(!('errors' in result), 'Result should not have an errors property')
  })
})

// ---------------------------------------------------------------------------
// 2. validateCreateCandidateNote — content field validation
// ---------------------------------------------------------------------------

describe('validateCreateCandidateNote — missing or empty content', () => {
  test('rejects when content is missing entirely', () => {
    const result = validateCreateCandidateNote({})
    assert.equal(result.success, false)
    if (!result.success) {
      assert.ok(result.errors.length > 0, 'Should have at least one error')
    }
  })

  test('rejects when content is an empty string', () => {
    const result = validateCreateCandidateNote({ content: '' })
    assert.equal(result.success, false)
    if (!result.success) {
      assert.ok(result.errors.some((e) => e.toLowerCase().includes('required')))
    }
  })

  test('rejects when content is whitespace-only', () => {
    const result = validateCreateCandidateNote({ content: '   ' })
    assert.equal(result.success, false)
    if (!result.success) {
      assert.ok(result.errors.some((e) => e.toLowerCase().includes('required')))
    }
  })

  test('rejects when content is null', () => {
    const result = validateCreateCandidateNote({ content: null })
    assert.equal(result.success, false)
  })

  test('rejects when content is undefined', () => {
    const result = validateCreateCandidateNote({ content: undefined })
    assert.equal(result.success, false)
  })

  test('rejects when content is a number', () => {
    const result = validateCreateCandidateNote({ content: 42 })
    assert.equal(result.success, false)
  })

  test('rejects when content is a boolean', () => {
    const result = validateCreateCandidateNote({ content: true })
    assert.equal(result.success, false)
  })

  test('rejects when content is an array', () => {
    const result = validateCreateCandidateNote({ content: [] })
    assert.equal(result.success, false)
  })

  test('rejects when content is an object', () => {
    const result = validateCreateCandidateNote({ content: {} })
    assert.equal(result.success, false)
  })
})

describe('validateCreateCandidateNote — content length validation', () => {
  test('rejects content that exceeds the maximum length by 1 character', () => {
    const content = makeContent(MAX_CONTENT_LENGTH + 1)
    const result = validateCreateCandidateNote({ content })
    assert.equal(result.success, false)
    if (!result.success) {
      assert.ok(
        result.errors.some((e) => e.includes(String(MAX_CONTENT_LENGTH))),
        `Error should mention the ${MAX_CONTENT_LENGTH} character limit`
      )
    }
  })

  test('rejects content that exceeds the maximum length by 1000 characters', () => {
    const content = makeContent(MAX_CONTENT_LENGTH + 1000)
    const result = validateCreateCandidateNote({ content })
    assert.equal(result.success, false)
  })

  test('accepts content at exactly MAX_CONTENT_LENGTH characters (boundary)', () => {
    const content = makeContent(MAX_CONTENT_LENGTH)
    const result = validateCreateCandidateNote({ content })
    assert.equal(result.success, true)
  })

  test('accepts content at MAX_CONTENT_LENGTH - 1 characters', () => {
    const content = makeContent(MAX_CONTENT_LENGTH - 1)
    const result = validateCreateCandidateNote({ content })
    assert.equal(result.success, true)
  })

  test('length check applies to trimmed content', () => {
    // Content itself is at max length, so even after trim it is exactly at the boundary
    const content = makeContent(MAX_CONTENT_LENGTH)
    const result = validateCreateCandidateNote({ content: `  ${content}  ` })
    // After trimming, the content is MAX_CONTENT_LENGTH chars — must still be accepted
    // (the validation trims before checking length, as per the implementation)
    assert.equal(result.success, true)
  })
})

describe('validateCreateCandidateNote — error message quality', () => {
  test('error message for missing content mentions "required"', () => {
    const result = validateCreateCandidateNote({})
    assert.equal(result.success, false)
    if (!result.success) {
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes('required')),
        `Expected an error about required content, got: ${result.errors.join(', ')}`
      )
    }
  })

  test('error message for oversized content mentions the character limit', () => {
    const result = validateCreateCandidateNote({ content: makeContent(MAX_CONTENT_LENGTH + 1) })
    assert.equal(result.success, false)
    if (!result.success) {
      const errorText = result.errors.join(' ')
      assert.ok(
        errorText.includes(String(MAX_CONTENT_LENGTH)),
        `Error should include the max length: ${errorText}`
      )
    }
  })

  test('returns errors as an array (never as a string)', () => {
    const result = validateCreateCandidateNote({ content: '' })
    assert.equal(result.success, false)
    if (!result.success) {
      assert.ok(Array.isArray(result.errors), 'errors should be an array')
    }
  })

  test('success result does not contain errors property', () => {
    const result = validateCreateCandidateNote({ content: 'Valid' }) as ValidationResult<CreateCandidateNoteInput>
    assert.equal(result.success, true)
    assert.ok(!('errors' in result))
  })
})

// ---------------------------------------------------------------------------
// 3. validateUpdateCandidateNote — happy path (full-replace semantics)
// ---------------------------------------------------------------------------

describe('validateUpdateCandidateNote — valid inputs', () => {
  test('accepts a valid content string', () => {
    const result = validateUpdateCandidateNote({ content: 'Updated note content.' })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.content, 'Updated note content.')
    }
  })

  test('accepts content at exactly the maximum length', () => {
    const content = makeContent(MAX_CONTENT_LENGTH)
    const result = validateUpdateCandidateNote({ content })
    assert.equal(result.success, true)
  })

  test('trims whitespace from content on update', () => {
    const result = validateUpdateCandidateNote({ content: '  updated note  ' })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.content, 'updated note')
    }
  })

  test('preserves multi-line content', () => {
    const content = 'First impression:\n- Strong technical skills\n- Good communication'
    const result = validateUpdateCandidateNote({ content })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.content, content)
    }
  })

  test('returns success: true with a data property', () => {
    const result = validateUpdateCandidateNote({ content: 'Updated' })
    assert.equal(result.success, true)
    assert.ok('data' in result)
  })
})

// ---------------------------------------------------------------------------
// 4. validateUpdateCandidateNote — same rejection rules as create
// ---------------------------------------------------------------------------

describe('validateUpdateCandidateNote — invalid inputs (mirrors create rules)', () => {
  test('rejects when content is missing', () => {
    const result = validateUpdateCandidateNote({})
    assert.equal(result.success, false)
  })

  test('rejects empty string content', () => {
    const result = validateUpdateCandidateNote({ content: '' })
    assert.equal(result.success, false)
    if (!result.success) {
      assert.ok(result.errors.some((e) => e.toLowerCase().includes('required')))
    }
  })

  test('rejects whitespace-only content', () => {
    const result = validateUpdateCandidateNote({ content: '\t\n  ' })
    assert.equal(result.success, false)
  })

  test('rejects content exceeding max length', () => {
    const result = validateUpdateCandidateNote({ content: makeContent(MAX_CONTENT_LENGTH + 1) })
    assert.equal(result.success, false)
    if (!result.success) {
      assert.ok(result.errors.some((e) => e.includes(String(MAX_CONTENT_LENGTH))))
    }
  })

  test('rejects null content', () => {
    const result = validateUpdateCandidateNote({ content: null })
    assert.equal(result.success, false)
  })

  test('rejects non-string content', () => {
    const result = validateUpdateCandidateNote({ content: 123 })
    assert.equal(result.success, false)
  })
})

// ---------------------------------------------------------------------------
// 5. Return type shape — discriminated union contract
// ---------------------------------------------------------------------------

describe('Validation result — discriminated union shape', () => {
  test('successful create result has { success: true, data: { content } }', () => {
    const result = validateCreateCandidateNote({ content: 'Hello' })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(typeof result.data, 'object')
      assert.equal(typeof result.data.content, 'string')
    }
  })

  test('failed create result has { success: false, errors: string[] }', () => {
    const result = validateCreateCandidateNote({ content: '' })
    assert.equal(result.success, false)
    if (!result.success) {
      assert.ok(Array.isArray(result.errors))
      assert.ok(result.errors.every((e) => typeof e === 'string'))
    }
  })

  test('successful update result has { success: true, data: { content } }', () => {
    const result = validateUpdateCandidateNote({ content: 'Updated' })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(typeof result.data.content, 'string')
    }
  })

  test('failed update result has { success: false, errors: string[] }', () => {
    const result = validateUpdateCandidateNote({ content: '' })
    assert.equal(result.success, false)
    if (!result.success) {
      assert.ok(Array.isArray(result.errors))
    }
  })

  test('create data.content equals the trimmed input', () => {
    const result = validateCreateCandidateNote({ content: '  padded  ' })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.content, 'padded')
    }
  })

  test('update data.content equals the trimmed input', () => {
    const result = validateUpdateCandidateNote({ content: '  padded  ' })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.content, 'padded')
    }
  })
})

// ---------------------------------------------------------------------------
// 6. Create vs Update — semantic equivalence
// ---------------------------------------------------------------------------

describe('validateCreateCandidateNote vs validateUpdateCandidateNote — equivalent rules', () => {
  const validCases = ['Short note', makeContent(100), 'Multi\nLine\nNote', 'Unicode ✓']
  const invalidCases: Array<{ label: string; input: Record<string, unknown> }> = [
    { label: 'empty string', input: { content: '' } },
    { label: 'whitespace only', input: { content: '   ' } },
    { label: 'missing content', input: {} },
    { label: 'null content', input: { content: null } },
    { label: 'content too long', input: { content: makeContent(MAX_CONTENT_LENGTH + 1) } },
  ]

  for (const content of validCases) {
    test(`both accept: "${content.slice(0, 30)}${content.length > 30 ? '…' : ''}"`, () => {
      const create = validateCreateCandidateNote({ content })
      const update = validateUpdateCandidateNote({ content })
      assert.equal(create.success, true, `create should succeed`)
      assert.equal(update.success, true, `update should succeed`)
      if (create.success && update.success) {
        assert.equal(
          create.data.content,
          update.data.content,
          'Both should produce identical trimmed content'
        )
      }
    })
  }

  for (const { label, input } of invalidCases) {
    test(`both reject: ${label}`, () => {
      const create = validateCreateCandidateNote(input)
      const update = validateUpdateCandidateNote(input)
      assert.equal(create.success, false, `create should fail for: ${label}`)
      assert.equal(update.success, false, `update should fail for: ${label}`)
    })
  }
})

// ---------------------------------------------------------------------------
// 7. Edge cases
// ---------------------------------------------------------------------------

describe('Edge cases', () => {
  test('content with only newlines is rejected (trimmed to empty)', () => {
    const result = validateCreateCandidateNote({ content: '\n\n\n' })
    assert.equal(result.success, false)
  })

  test('content with only tabs is rejected', () => {
    const result = validateCreateCandidateNote({ content: '\t\t\t' })
    assert.equal(result.success, false)
  })

  test('ignores extra unexpected fields in the raw object', () => {
    const result = validateCreateCandidateNote({
      content: 'Valid note',
      candidateId: 'should-be-ignored',
      id: 'also-ignored',
    })
    assert.equal(result.success, true)
    if (result.success) {
      // data should only contain content
      assert.equal(Object.keys(result.data).length, 1)
      assert.equal(result.data.content, 'Valid note')
    }
  })

  test('zero-length validation result errors array on valid input', () => {
    // On success, no errors property exists
    const result = validateCreateCandidateNote({ content: 'Valid' })
    assert.equal(result.success, true)
    assert.ok(!('errors' in result))
  })

  test('content exactly at boundary (MAX_CONTENT_LENGTH chars) succeeds for both create and update', () => {
    const content = makeContent(MAX_CONTENT_LENGTH)
    assert.equal(validateCreateCandidateNote({ content }).success, true)
    assert.equal(validateUpdateCandidateNote({ content }).success, true)
  })

  test('content one character over boundary fails for both create and update', () => {
    const content = makeContent(MAX_CONTENT_LENGTH + 1)
    assert.equal(validateCreateCandidateNote({ content }).success, false)
    assert.equal(validateUpdateCandidateNote({ content }).success, false)
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
  console.log('\n✓ All candidate note validation tests passed.')
}
