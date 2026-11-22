import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import status from '@/locales/vi/status.json'
import { STATUS_TONES, type StatusTone } from '@/lib/status'

// Đọc trực tiếp src/index.css để test luôn khớp nguồn chuẩn của token (không nhân bản bảng màu).
const css = readFileSync(path.resolve(__dirname, '../index.css'), 'utf8')
const rootBlock = /:root\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? ''
const tokens = Object.fromEntries(
  [...rootBlock.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map(([, name, hex]) => [name, hex]),
) as Record<string, string>

function token(name: string): string {
  const value = tokens[name]
  if (!value) throw new Error(`Missing CSS token --${name} in src/index.css`)
  return value
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2.1 contrast ratio. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

const AA_NORMAL = 4.5
const AA_LARGE_OR_UI = 3

describe('WCAG 2.1 AA contrast (NFR-USA-004)', () => {
  const tones: StatusTone[] = ['neutral', 'info', 'warning', 'success', 'danger']

  it.each(tones)('status badge "%s" text on its background ≥ 4.5:1', (tone) => {
    expect(contrast(token(`status-${tone}-foreground`), token(`status-${tone}`))).toBeGreaterThanOrEqual(AA_NORMAL)
  })

  it.each([
    ['foreground', 'background'],
    ['foreground', 'card'],
    ['muted-foreground', 'background'],
    ['muted-foreground', 'card'],
    ['primary-foreground', 'primary'],
    ['primary-foreground', 'primary-hover'],
    ['primary', 'card'],
    ['primary', 'primary-soft'],
    ['cta-foreground', 'cta'],
    ['cta-foreground', 'cta-hover'],
    ['destructive-foreground', 'destructive'],
    ['accent-foreground', 'accent'],
    ['secondary-foreground', 'secondary'],
    ['sla-normal', 'card'],
    ['sla-warning', 'card'],
    ['sla-overdue', 'card'],
    ['fallback-foreground', 'fallback'],
  ])('--%s on --%s ≥ 4.5:1', (fg, bg) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(AA_NORMAL)
  })

  it('--price is only allowed for large text (≥ 3:1 on card)', () => {
    expect(contrast(token('price'), token('card'))).toBeGreaterThanOrEqual(AA_LARGE_OR_UI)
  })

  it('focus ring is visible against page background (≥ 3:1 UI component)', () => {
    expect(contrast(token('ring'), token('background'))).toBeGreaterThanOrEqual(AA_LARGE_OR_UI)
  })
})

describe('status catalogue', () => {
  it('every mapped status has a Vietnamese label', () => {
    expect(Object.keys(status).sort()).toEqual(Object.keys(STATUS_TONES).sort())
  })
})
