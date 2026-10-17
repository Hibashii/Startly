import { expect, test, type Page } from '@playwright/test'
import { TODAY, freshApp, mockAssistant, rows, task } from './helpers'

const plan = { body: { reply: "Here's your Saturday.", actions: [task('Hackathon', 120), task('Gym', 60), task('Review notes', 60), { type: 'add_fixed', title: 'Call with mentor', date: TODAY, start: '20:00', end: '20:30' }] } }

async function planDay(page: Page, ...then: { status?: number; body: unknown }[]) {
  await freshApp(page, '14:00')
  const sent = await mockAssistant(page, plan, ...then)
  await page.getByLabel('Tell me everything you have to do').fill('hackathon, gym, review notes, mentor call at 20:00')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  return sent
}
const say = async (page: Page, text: string) => {
  await page.getByLabel('Message Startly').fill(text)
  await page.getByLabel('Message Startly').press('Enter')
}

test('started late → the day reshuffles, a toast appears then goes, and the chat lists what moved', async ({ page }) => {
  const sent = await planDay(page, { body: { reply: 'Got it, I moved things so nothing overlaps.', actions: [{ type: 'started_at', id: 't1', start: '16:00', remainingMin: 120 }] } })
  expect(await rows(page)).toContain('task 14:00–16:00 Hackathon 2h')

  await page.clock.setFixedTime(new Date(`${TODAY}T16:05:00`))
  await say(page, 'I only started the hackathon at 16:00, it needs 2h')

  await expect.poll(() => rows(page)).toContain('task 16:00–18:00 Hackathon 2h')
  const after = await rows(page)
  expect(after).toContain('fixed 20:00–20:30 Call with mentor 30m')
  expect(after.some((r) => /task 1[89]:\d\d–\d\d:\d\d Gym/.test(r))).toBe(true)

  const toast = page.getByText(/↻ Reshuffled \d tasks/)
  await expect(toast).toBeVisible()
  const moved = page.getByRole('list', { name: 'What moved' }).last()
  await expect(moved).toContainText('Hackathon')
  await expect(moved).toContainText('Gym')
  await expect(moved).toContainText('14:00 → 16:00')
  await page.clock.runFor(4000)
  await expect(toast).toBeHidden()

  // The context sent to the AI carries the plan and the conversation.
  const ctx = (sent[1] as { context: { tasks: { id: string }[]; recentMessages: unknown[] } }).context
  expect(ctx.tasks.map((t) => t.id)).toEqual(['t1', 't2', 't3', 't4'])
  expect(ctx.recentMessages.length).toBeGreaterThanOrEqual(2)
})

test('delete a task → it disappears and the day closes the gap', async ({ page }) => {
  await planDay(page, { body: { reply: 'Removed.', actions: [{ type: 'remove_task', id: 't1' }] } })
  await say(page, 'delete the hackathon')
  await expect.poll(() => rows(page)).toContain('task 14:00–15:00 Gym 1h')
  expect((await rows(page)).some((r) => r.includes('Hackathon'))).toBe(false)
  await expect(page.locator('[data-role=assistant]').last()).toContainText('Removed: Hackathon.')
})

test('assistant down → error with Retry, plan untouched; Retry works', async ({ page }) => {
  await planDay(page,
    { status: 502, body: { error: 'assistant_unavailable' } },
    { body: { reply: 'Added.', actions: [task('Call the bank', 30)] } })
  const before = await rows(page)
  await say(page, 'add call the bank 30 min')
  await expect(page.getByText("I couldn't reach my brain just now. Try again?")).toBeVisible()
  expect(await rows(page)).toEqual(before)

  await page.getByRole('button', { name: 'Retry' }).click()
  await expect.poll(() => rows(page)).toContainEqual(expect.stringContaining('Call the bank'))
  await expect(page.getByRole('button', { name: 'Retry' })).toBeHidden()
})

test('rate limited → the friendly 429 message', async ({ page }) => {
  await planDay(page, { status: 429, body: { error: 'rate_limited' } })
  await say(page, 'add laundry')
  await expect(page.getByText("That's a lot of messages for one hour. Give me a few minutes.")).toBeVisible()
})

test('Ask Startly toggles the drawer', async ({ page }) => {
  await planDay(page)
  const pill = page.getByRole('button', { name: 'Ask Startly' })
  await expect(pill).toHaveAttribute('aria-pressed', 'true')
  await pill.click()
  await expect(pill).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByLabel('Message Startly')).toBeHidden()
  await pill.click()
  await expect(page.getByLabel('Message Startly')).toBeVisible()
})

test('a task that does not fit is listed under the timetable, never invisible', async ({ page }) => {
  await freshApp(page, '21:00')
  const sent = await mockAssistant(page, { body: { reply: 'Here you go.', actions: [task('Hackathon', 90), task('Groceries', 45)] } }, { body: { reply: 'It does not fit today.', actions: [] } })
  await page.getByLabel('Tell me everything you have to do').fill('hackathon 1h30, groceries')
  await page.keyboard.press('Enter')
  const notFit = page.getByRole('list', { name: "Doesn't fit today" })
  await expect(notFit).toContainText('Groceries')
  await expect(page.getByText("Doesn't fit before 23:00")).toBeVisible()
  // Startly is told it's not on the timetable.
  await page.getByLabel('Message Startly').fill("you didn't add groceries")
  await page.getByLabel('Message Startly').press('Enter')
  await expect.poll(() => sent.length).toBe(2)
  const tasks = (sent[1] as { context: { tasks: { title: string; onTimetable: boolean }[] } }).context.tasks
  expect(tasks.find((t) => t.title === 'Groceries')?.onTimetable).toBe(false)
  expect(tasks.find((t) => t.title === 'Hackathon')?.onTimetable).toBe(true)
})
