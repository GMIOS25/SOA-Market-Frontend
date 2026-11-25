import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({
  env: { apiBaseUrl: 'http://api.test', demoMode: false, mediaBaseUrl: 'http://media.test/public-products/' },
}))

import { env } from '@/lib/env'
import { productImageUrl } from './media'

const mockedEnv = env as unknown as { mediaBaseUrl: string }

describe('productImageUrl', () => {
  afterEach(() => {
    mockedEnv.mediaBaseUrl = 'http://media.test/public-products/'
  })

  it('joins the media base URL with the object key (trailing and leading slashes tolerated)', () => {
    expect(productImageUrl('products/shop-1/a.jpg')).toBe('http://media.test/public-products/products/shop-1/a.jpg')
    expect(productImageUrl('/products/shop-1/a.jpg')).toBe('http://media.test/public-products/products/shop-1/a.jpg')
  })

  it('returns undefined without an image or without a configured media base URL', () => {
    expect(productImageUrl(null)).toBeUndefined()
    expect(productImageUrl(undefined)).toBeUndefined()
    expect(productImageUrl('   ')).toBeUndefined()
    mockedEnv.mediaBaseUrl = ''
    expect(productImageUrl('products/shop-1/a.jpg')).toBeUndefined()
  })

  it('keeps a value that is already an absolute URL', () => {
    expect(productImageUrl('https://cdn.example/a.jpg')).toBe('https://cdn.example/a.jpg')
  })
})
