import { expect, test, type Page } from '@playwright/test'
import { TODAY, freshApp, mockAssistant, rows, task } from './helpers'

async function day(page: Page, time = '14:10', hackMin = 60) {
  await freshApp(page, '14:00')
  await mockAssistant(page, { body: { reply: 'Here you go.', order: null, actions: [task('Hackathon', hackMin), task('Gym', 60), task('Review notes', 30)] } })
  await page.getByLabel('What do you need to get done today or this week?').fill('my day')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await page.clock.setFixedTime(new Date(`${TODAY}T${time}:00`))
  await page.reload()
}
const nowCard = (page: Page) => page.locator('li[data-now]')

test('exactly one Now card, with the time left; quick buttons on hover', async ({ page }) => {
  await day(page, '14:20')
  await expect(nowCard(page)).toHaveCount(1)
  await expect(nowCard(page)).toContainText('Hackathon')
  await expect(nowCard(page)).toContainText(/Now · 40m left/i)
  await expect(page.getByRole('button', { name: 'Need more time' })).toBeHidden()
  await nowCard(page).hover()
  await page.getByRole('button', { name: 'Need more time' }).click()
  await expect.poll(() => rows(page)).toContain('task 14:00–15:30 Hackathon')
  await expect(page.getByText(/↻ Reshuffled/)).toBeVisible()
  await expect(page.locator('[data-role=assistant]').last()).toContainText("Added 30 min to 'Hackathon'.")
})

test('"Not started" starts it now; "→ Tomorrow" moves it to tomorrow', async ({ page }) => {
  await day(page, '14:20')
  await nowCard(page).hover()
  await page.getByRole('button', { name: 'Not started' }).click()
  await expect.poll(() => rows(page)).toContainEqual(expect.stringMatching(/^task 14:20–15:20 Hackathon/))
  await nowCard(page).hover()
  await page.getByRole('button', { name: '→ Tomorrow' }).click()
  await expect.poll(() => rows(page)).not.toContainEqual(expect.stringMatching(/Hackathon/))
  await page.getByRole('button', { name: /show the week/ }).click()
  await expect(page.getByRole('button', { name: /Sunday 18 October: 1h planned/ })).toBeVisible()
})

// Hackathon 14:00–15:30, then a break: during the break it asks.
test('"Did you finish …?" after the time is over; Done checks it, nothing changes if ignored', async ({ page }) => {
  await day(page, '15:35', 90)
  await expect(nowCard(page)).toContainText(/Hackathon.*Did you finish\?/i)
  const before = await rows(page)
  await page.clock.setFixedTime(new Date(`${TODAY}T15:40:00`))
  await page.reload()
  expect(await rows(page)).toEqual(before) // ignoring it changes nothing
  await page.getByRole('button', { name: '✓ Done' }).click()
  await expect(page.getByRole('checkbox', { name: 'Done: Hackathon' })).toHaveAttribute('aria-checked', 'true')
  await expect(nowCard(page)).toHaveCount(0)
})

test('"Did you finish…?" → Need more time continues from now', async ({ page }) => {
  await day(page, '15:35', 90)
  await page.getByRole('button', { name: 'Need more time' }).click()
  await expect.poll(() => rows(page)).toContainEqual(expect.stringMatching(/^task 15:35–16:05 Hackathon \(cont\.\)/))
  expect(await rows(page)).toContainEqual(expect.stringMatching(/^task 14:00–15:30 Hackathon/)) // the past block stays
})

test('check off with a pop-up, uncheck undoes; last one → confetti dialog; Rest well closes it', async ({ page }) => {
  await day(page, '14:10')
  const box = (name: string) => page.getByRole('checkbox', { name: `Done: ${name}` })
  await box('Hackathon').click()
  await expect(box('Hackathon')).toHaveAttribute('aria-checked', 'true')
  // The cheer: a line that follows your progress (no count).
  await expect(page.getByRole('status').filter({ hasText: /Great start|First one down|And we're off|Momentum/ })).toBeVisible()
  await expect(page.getByText(/of 3 done/)).toHaveCount(0)
  await box('Hackathon').click()
  await expect(box('Hackathon')).toHaveAttribute('aria-checked', 'false')
  for (const n of ['Hackathon', 'Gym', 'Review notes']) await box(n).click()
  const dialog = page.getByRole('dialog', { name: 'Day complete' })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('blockquote')).not.toBeEmpty()
  await dialog.getByRole('button', { name: 'Rest well' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Day complete ✓')).toBeVisible()
  // Uncheck and finish again: the finale plays again.
  await box('Gym').click()
  await box('Gym').click()
  await expect(dialog).toBeVisible()
})

test('rename in place: Enter saves, a toast confirms, and it stays renamed after reload', async ({ page }) => {
  await day(page, '14:10')
  await page.getByRole('button', { name: 'Gym', exact: true }).click()
  const input = page.getByLabel('Rename Gym')
  await input.fill('Leg day')
  await input.press('Enter')
  await expect(page.getByText('✓ Renamed')).toBeVisible()
  await page.reload()
  expect(await rows(page)).toContainEqual(expect.stringMatching(/Leg day/))
})

test('finishing early: the task ends when checked and the next ones move up', async ({ page }) => {
  await day(page, '14:20')
  await page.getByRole('checkbox', { name: 'Done: Hackathon' }).click()
  await expect.poll(() => rows(page)).toContainEqual(expect.stringMatching(/^task 14:00–14:20 Hackathon/))
  expect(await rows(page)).toContainEqual(expect.stringMatching(/^task 14:20–15:20 Gym/))
})

test('"Not started" at 14:23 keeps the Now card (starts on the current 5-minute mark)', async ({ page }) => {
  await day(page, '14:23')
  await nowCard(page).hover()
  await page.getByRole('button', { name: 'Not started' }).click()
  await expect.poll(() => rows(page)).toContainEqual(expect.stringMatching(/^task 14:20–15:20 Hackathon/))
  await expect(nowCard(page)).toContainText(/Hackathon.*Now/i)
})

test('checking a part of a split task finishes it all', async ({ page }) => {
  await freshApp(page, '14:00')
  await mockAssistant(page,
    { body: { reply: 'ok', order: null, actions: [task('Hackathon', 60), task('Gym', 60)] } },
    { body: { reply: 'ok', order: null, actions: [{ type: 'add_fixed', title: 'Call', date: TODAY, start: '14:30', end: '15:00' }] } })
  await page.getByLabel('What do you need to get done today or this week?').fill('x')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await page.clock.setFixedTime(new Date(`${TODAY}T14:10:00`))
  await page.getByLabel('Message Startly').fill('call at 14:30')
  await page.getByLabel('Message Startly').press('Enter')
  await expect.poll(() => rows(page)).toContainEqual(expect.stringMatching(/Hackathon \(cont\.\)/))
  await page.getByRole('checkbox', { name: 'Done: Hackathon', exact: true }).click()
  await expect.poll(() => rows(page)).not.toContainEqual(expect.stringMatching(/Hackathon \(cont\.\)/))
})

test('the cheer follows your progress: "One more to go" before the last one', async ({ page }) => {
  await day(page, '14:10')
  await page.getByRole('checkbox', { name: 'Done: Hackathon' }).click()
  await page.getByRole('checkbox', { name: 'Done: Gym' }).click()
  await expect(page.getByRole('status').filter({ hasText: /One more to go|Last one|Final stretch/ })).toBeVisible()
})
