import type { Page } from '@playwright/test'

export const TODAY = '2026-10-17'

/** Freeze the browser clock (Saturday 17 Oct 2026) and start from an empty localStorage. */
export async function freshApp(page: Page, time = '10:00') {
  await page.clock.install({ time: new Date(`${TODAY}T${time}:00`) })
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
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

export const task = (title: string, durationMin: number) => ({
  type: 'add_task', title, durationMin, priority: 'medium', deadline: null, preferredStart: null, date: null,
})

export const rows = (page: Page) =>
  page.getByRole('list', { name: "Today's timetable" }).locator('li')
    .evaluateAll((els) => els.map((e) => `${(e as HTMLElement).dataset.type} ${(e as HTMLElement).innerText.replace(/\s+/g, ' ').trim()}`))
