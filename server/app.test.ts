import { describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from './app'

const context = {
  now: '2026-10-17T12:30', weekday: 'Saturday', today: '2026-10-17', tasks: [], availability: {},
  endOfDay: '23:00', pending: null, recentMessages: [], timetable: [], breaks: { afterMin: 60, lengthMin: 15 }, language: 'en',
}
const good = { reply: 'Done.', order: null, actions: [{ type: 'add_fixed', title: 'Interview', date: '2026-10-21', start: '11:30', end: '12:00' }] }

describe('POST /api/assistant', () => {
  it('returns the reply and actions for a valid body', async () => {
    const call = vi.fn().mockResolvedValue(good)
    const res = await request(createApp(call)).post('/api/assistant').send({ message: 'interview wed 11:30', context })
    expect(res.status).toBe(200)
    expect(res.body).toEqual(good)
    expect(call).toHaveBeenCalledWith('interview wed 11:30', context)
  })

  it('rejects a bad body with 400 without calling OpenAI', async () => {
    const call = vi.fn()
    const res = await request(createApp(call)).post('/api/assistant').send({ message: '', context: {} })
    expect(res.status).toBe(400)
    expect(call).not.toHaveBeenCalled()
  })

  it('answers malformed JSON with a JSON 400', async () => {
    const res = await request(createApp(vi.fn())).post('/api/assistant').set('Content-Type', 'application/json').send('{oops')
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'bad_request' })
  })

  it('returns 502 when OpenAI fails', async () => {
    const call = vi.fn().mockRejectedValue(new Error('timeout'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await request(createApp(call)).post('/api/assistant').send({ message: 'hi', context })
    expect(res.status).toBe(502)
    expect(res.body).toEqual({ error: 'assistant_unavailable' })
  })

  it('returns 502 when OpenAI returns something outside the schema', async () => {
    const call = vi.fn().mockResolvedValue({ reply: 'x', order: null, actions: [{ type: 'teleport' }] })
    const res = await request(createApp(call)).post('/api/assistant').send({ message: 'hi', context })
    expect(res.status).toBe(502)
  })

  it('rate limits to RATE_LIMIT_PER_HOUR with 429', async () => {
    process.env.RATE_LIMIT_PER_HOUR = '2'
    const app = createApp(vi.fn().mockResolvedValue(good))
    delete process.env.RATE_LIMIT_PER_HOUR
    const send = () => request(app).post('/api/assistant').send({ message: 'hi', context })
    expect((await send()).status).toBe(200)
    expect((await send()).status).toBe(200)
    const third = await send()
    expect(third.status).toBe(429)
    expect(third.body).toEqual({ error: 'rate_limited' })
  })
})
