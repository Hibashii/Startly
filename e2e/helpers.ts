import type { Page } from '@playwright/test'

export const TODAY = '2026-10-17'

/**
 * Freeze the browser clock (Saturday 17 Oct 2026) and start from an empty localStorage.
 * The first-time questions count as skipped, unless `askFirst` (the test for those questions),
 * and the timer kind as chosen (one countdown), unless `chooseTimer` (the test for the first Start).
 */
export async function freshApp(page: Page, time = '10:00', { askFirst = false, chooseTimer = false } = {}) {
  await page.clock.install({ time: new Date(`${TODAY}T${time}:00`) })
  await page.goto('/')
  await page.evaluate(({ askFirst, chooseTimer }) => {
    localStorage.clear()
    if (askFirst) return
    const settings = { lang: 'en', accent: 'iris', theme: null, endOfDay: '23:00', profile: { focusBest: null, habits: '' }, ...(!chooseTimer && { timerMode: 'normal' }) }
    localStorage.setItem('startly-v1', JSON.stringify({ state: { settings }, version: 2 }))
  }, { askFirst, chooseTimer })
  await page.reload()
}

/** Answer /api/assistant with canned responses, in order (the last one repeats). */
export async function mockAssistant(page: Page, ...responses: { status?: number; body: unknown }[]) {
  const sent: unknown[] = []
  let i = 0
  await page.route('**/api/assistant', async (route) => {
    sent.push(route.request().postDataJSON())
    const r = responses[Math.min(i++, responses.length - 1)]
    await route.fulfill({ status: r.status ?? 200, json: r.body })
  })
  return sent
}

export const task = (title: string, durationMin: number, focus = true) => ({
  type: 'add_task', title, durationMin, priority: 'medium', deadline: null, preferredStart: null, endBy: null, date: null, focus,
})

/** Each timetable row as "type time name duration" (only the row's own parts, not its buttons or Now tag). */
export const rows = (page: Page) =>
  page.getByRole('list', { name: "Today's timetable" }).locator(':scope > li')
    .evaluateAll((els) => els.map((e) => {
      const parts = [...e.querySelectorAll('[data-part]')].map((p) => (p as HTMLElement).innerText.trim()).filter(Boolean)
      return `${(e as HTMLElement).dataset.type} ${parts.join(' ')}`
    }))
