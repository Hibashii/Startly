import { expect, test, type Page } from '@playwright/test'
import { freshApp, mockAssistant, rows, task } from './helpers'

const plan = { body: { reply: "Here's your Saturday.", actions: [task('Hackathon', 120), task('Gym', 60, false), task('Review notes', 60)] } }
const moveGym = { body: { reply: 'Got it: the gym tomorrow.', actions: [{ type: 'move_to_day', id: 't2', date: '2026-10-18' }] } }

async function planDay(page: Page, ...then: { status?: number; body: unknown }[]) {
  await freshApp(page, '14:00')
  const sent = await mockAssistant(page, plan, ...then)
  await page.getByLabel('What do you need to get done today or this week?').fill('hackathon, gym, review notes')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  return sent
}
const say = async (page: Page, text: string) => {
  await page.getByLabel('Message Startly').fill(text)
  await page.getByLabel('Message Startly').press('Enter')
}
const lastReply = (page: Page) => page.locator('[data-role=assistant]').last()

test('Undo on the change puts the plan back and says what came back; then nothing is left to undo', async ({ page }) => {
  const sent = await planDay(page, moveGym)
  const before = await rows(page)
  const gym = before.find((r) => r.includes('Gym'))!
  const at = gym.match(/(\d\d:\d\d)–/)![1]

  await say(page, 'gym tomorrow')
  await expect.poll(() => rows(page)).not.toContainEqual(expect.stringMatching(/Gym/))
  // What moved: the old time crossed out, then where it went.
  const moved = page.getByRole('list', { name: 'What moved' }).last()
  await expect(moved.locator('li', { hasText: 'Gym' }).locator('s')).toHaveText(at)
  await expect(moved.locator('li', { hasText: 'Gym' })).toContainText('Sun, time not set')

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect.poll(() => rows(page)).toEqual(before)
  await expect(lastReply(page).locator('p').first()).toHaveText(`Undone: 'Gym' is back at ${at}.`)
  await expect(lastReply(page).getByRole('list', { name: 'What moved' })).toContainText('Review notes') // it had moved up
  await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0)

  // Typed "undo" is handled at once, without the AI.
  const calls = sent.length
  await say(page, 'undo')
  await expect(lastReply(page)).toHaveText("There's nothing left to undo.")
  expect(sent.length).toBe(calls)
})

test('"put it back" in words: the AI knows what changed and asks the app to undo it', async ({ page }) => {
  const sent = await planDay(page, moveGym, { body: { reply: 'Sure.', actions: [{ type: 'undo' }] } })
  const before = await rows(page)

  await say(page, 'gym tomorrow')
  await expect.poll(() => rows(page)).not.toContainEqual(expect.stringMatching(/Gym/))
  await say(page, 'hmm no, put it back please')
  await expect.poll(() => rows(page)).toEqual(before)
  await expect(lastReply(page)).toContainText("Undone: 'Gym' is back at")

  const ctx = (sent[2] as { context: { canUndo: boolean; recentMessages: { text: string }[] } }).context
  expect(ctx.canUndo).toBe(true)
  expect(ctx.recentMessages.at(-1)!.text).toContain('[moved] Gym:')
})

test('undo keeps what you checked since', async ({ page }) => {
  await planDay(page, moveGym)
  await say(page, 'gym tomorrow')
  await expect.poll(() => rows(page)).not.toContainEqual(expect.stringMatching(/Gym/))
  await page.getByRole('checkbox', { name: 'Done: Hackathon' }).click()

  await say(page, 'undo')
  await expect.poll(() => rows(page)).toContainEqual(expect.stringMatching(/Gym/))
  await expect(page.getByRole('checkbox', { name: 'Done: Hackathon' })).toHaveAttribute('aria-checked', 'true')
})
