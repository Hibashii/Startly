import { expect, test, type Page } from '@playwright/test'
import { TODAY, freshApp, mockAssistant, rows, task } from './helpers'

const SUN = '2026-10-18'
const say = async (page: Page, text: string) => {
  await page.getByLabel('Message Startly').fill(text)
  await page.getByLabel('Message Startly').press('Enter')
}
async function dump(page: Page, time: string, ...responses: { status?: number; body: unknown }[]) {
  await freshApp(page, time)
  const sent = await mockAssistant(page, ...responses)
  await page.getByLabel('Tell me everything you have to do').fill('my day')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  return sent
}

test('a change that would run late asks first; nothing moves until you answer; Keep it / Move it work', async ({ page }) => {
  const sent = await dump(page, '19:30',
    { body: { reply: 'Here you go.', order: null, actions: [task('Hack', 120), task('Review notes', 60)] } },
    { body: { reply: 'Got it.', order: null, actions: [{ type: 'extend_task', id: 't1', extraMin: 60 }] } },
    { body: { reply: 'Got it.', order: null, actions: [{ type: 'extend_task', id: 't1', extraMin: 60 }] } },
  )
  const before = await rows(page)
  await say(page, 'I need one more hour on the hack')
  await expect(page.getByText("That puts you until 23:45. OK, or should I move 'Review notes' to Sunday?")).toBeVisible()
  expect(await rows(page)).toEqual(before) // nothing changed yet

  // The AI is told about the open question.
  await page.getByRole('button', { name: 'Keep it' }).click()
  await expect.poll(() => rows(page)).toContainEqual(expect.stringMatching(/Review notes/))
  await expect(page.getByText('Today', { exact: true }).locator('..')).toContainText('until 23:45')
  await expect(page.getByText('You chose: Keep it')).toBeVisible()

  // Same question again, this time "Move it" → it goes to Sunday, visible in the week strip.
  await page.clock.setFixedTime(new Date(`${TODAY}T19:31:00`))
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('startly-v1')!)
    s.state.dayEnds = {}
    localStorage.setItem('startly-v1', JSON.stringify(s))
  })
  await page.reload()
  await page.getByRole('button', { name: 'Ask Startly' }).click()
  await say(page, 'one more hour on the hack')
  await page.getByRole('button', { name: 'Move it' }).click()
  await expect.poll(() => rows(page)).not.toContainEqual(expect.stringMatching(/Review notes/))
  expect((sent[2] as { context: { pending: unknown } }).context.pending).toBeNull()

  await page.getByRole('button', { name: /show the week/ }).click()
  await page.getByRole('button', { name: /Sunday 18 October/ }).click()
  await expect(page.getByRole('heading', { name: 'Tomorrow' })).toBeVisible()
  await expect(page.getByRole('list', { name: "Tomorrow's tasks" })).toContainText('Review notes')
  await expect(page.getByText('Free time unknown')).toBeVisible()
})

test("first dump: a new task that doesn't fit → the plan still appears, Startly asks Sunday / Drop it", async ({ page }) => {
  await dump(page, '20:00', { body: { reply: 'Here you go.', order: null, actions: [task('Hack', 150), task('Groceries', 45)] } })
  expect(await rows(page)).toContainEqual(expect.stringMatching(/Hack/))
  await expect(page.getByText("'Groceries' doesn't fit today. Sunday, or drop it?")).toBeVisible()
  await expect(page.getByRole('list', { name: "Doesn't fit today" })).toContainText('Groceries')
  await page.getByRole('button', { name: 'Drop it' }).click()
  await expect(page.getByRole('list', { name: "Doesn't fit today" })).toBeHidden()
})

test('the week strip: hidden by default, 7 days from today, planned hours and 📌', async ({ page }) => {
  await dump(page, '10:00', { body: { reply: 'ok', order: null, actions: [
    task('Gym', 60),
    { type: 'add_fixed', title: 'Interview', date: '2026-10-21', start: '11:30', end: '12:00' },
    { ...task('Revise', 90), date: SUN },
  ] } })
  await expect(page.getByRole('navigation', { name: 'This week' })).toBeHidden()
  await page.getByRole('button', { name: /show the week/ }).click()
  const days = page.getByRole('navigation', { name: 'This week' }).getByRole('button')
  await expect(days).toHaveCount(7)
  await expect(days.first()).toContainText('Today')
  await expect(page.getByRole('button', { name: /Sunday 18 October: 1h30 planned/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Wednesday 21 October: 30m planned, fixed appointment/ })).toContainText('📌')
  await page.getByRole('button', { name: /Wednesday 21 October/ }).click()
  await expect(page.getByRole('heading', { name: 'Wednesday' })).toBeVisible()
  await expect(page.getByRole('list', { name: "Wednesday's tasks" })).toContainText('11:30Interview')
  await page.getByRole('button', { name: /hide the week/ }).click()
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
})

test('a reply that does not answer keeps the question open; a question from yesterday expires', async ({ page }) => {
  await dump(page, '19:30',
    { body: { reply: 'Here you go.', order: null, actions: [task('Hack', 120), task('Review notes', 60)] } },
    { body: { reply: 'Got it.', order: null, actions: [{ type: 'extend_task', id: 't1', extraMin: 60 }] } },
    { body: { reply: 'Until about 23:45.', order: null, actions: [] } },
  )
  await say(page, 'one more hour on the hack')
  await expect(page.getByRole('button', { name: 'Keep it' })).toBeEnabled()
  await say(page, 'how late is that?')
  await expect(page.getByText('Until about 23:45.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Keep it' })).toBeEnabled()

  // Next morning: the question no longer applies.
  await page.clock.setFixedTime(new Date('2026-10-18T09:00:00'))
  await page.reload()
  await page.getByRole('button', { name: 'Ask Startly' }).click()
  await expect(page.getByRole('button', { name: 'Keep it' })).toBeDisabled()
})
