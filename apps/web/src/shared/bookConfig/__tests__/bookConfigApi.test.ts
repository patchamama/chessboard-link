import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getBookConfig, saveBookConfig } from '../bookConfigApi'
import { DEFAULT_BOOK_CONFIG } from '../bookConfig'
import * as http from '../../api/httpClient'

describe('bookConfigApi', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('getBookConfig GETs the book config endpoint', async () => {
    const spy = vi.spyOn(http, 'httpClient').mockResolvedValue(DEFAULT_BOOK_CONFIG)
    const cfg = await getBookConfig(42)
    expect(spy).toHaveBeenCalledWith('/api/library/books/42/config')
    expect(cfg.barClass.name).toBe('barra')
  })

  it('saveBookConfig PUTs the config as JSON', async () => {
    const spy = vi.spyOn(http, 'httpClient').mockResolvedValue({ ok: true, config: DEFAULT_BOOK_CONFIG })
    await saveBookConfig(7, DEFAULT_BOOK_CONFIG)
    expect(spy).toHaveBeenCalledWith('/api/library/books/7/config', {
      method: 'PUT',
      body: JSON.stringify(DEFAULT_BOOK_CONFIG),
    })
  })
})
