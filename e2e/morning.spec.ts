import { expect, test, type Page } from '@playwright/test'
import { freshApp, mockAssistant, rows, task } from './helpers'

const SUN = '2026-10-18'
async function yesterdayWithLeftovers(page: Page) {
  await freshApp(page, '14:00')
  await mockAssistant(page, { body: { reply: 'Here you go.', order: null, actions: [task('Hackathon', 60), task('Groceries', 45), task('Job application #3', 45)] } })
  await page.getByLabel('Tell me everything you have to do').fill('x')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await page.getByRole('checkbox', { name: 'Done: Hackathon' }).click()
  // The next morning.
  await page.clock.setFixedTime(new Date(`${SUN}T08:30:00`))
  await page.reload()
}
const startly = (page: Page) => page.locator('[data-role=assistant]')

test('a new day: the chat is fresh with a greeting, the plan is kept, and yesterday\'s unchecked tasks are asked about', async ({ page }) => {
  await yesterdayWithLeftovers(page)
  await expect(page.getByRole('list', { name: 'Chat messages' }).or(page.getByLabel('Chat with Startly'))).toBeVisible()
  await expect(startly(page)).toHaveCount(1)
  await expect(startly(page)).toContainText(/Good morning/)
  await expect(startly(page)).toContainText("2 things from yesterday weren't checked: Groceries and Job application #3. Add them to today?")
  await expect(page.getByText('x', { exact: true })).toHaveCount(0) // yesterday's messages are gone
  expect(await rows(page)).toEqual([]) // nothing silently carried over

  await page.getByRole('button', { name: 'Add both' }).click()
  await expect.poll(() => rows(page)).toEqual(expect.arrayContaining([expect.stringMatching(/Groceries/), expect.stringMatching(/Job application #3/)]))
  await expect(page.getByText('You chose: Add both')).toBeVisible()
})

test('Choose: a checkbox per task; the picked ones are added, the rest dropped', async ({ page }) => {
  await yesterdayWithLeftovers(page)
  await page.getByRole('button', { name: 'Choose' }).click()
  await page.getByRole('checkbox', { name: 'Job application #3' }).uncheck()
  await page.getByRole('button', { name: 'Add selected · drop the rest' }).click()
  await expect.poll(() => rows(page)).toContainEqual(expect.stringMatching(/Groceries/))
  expect((await rows(page)).some((r) => r.includes('Job application'))).toBe(false)
})

test('Drop them: gone, and the day starts empty', async ({ page }) => {
  await yesterdayWithLeftovers(page)
  await page.getByRole('button', { name: 'Drop them' }).click()
  await expect(page.getByText('Removed: Groceries and Job application #3.')).toBeVisible()
})

test('the same day again: no new greeting', async ({ page }) => {
  await yesterdayWithLeftovers(page)
  await page.reload()
  await expect(startly(page)).toHaveCount(1)
})

test('your first message of the day does not make the morning question go away', async ({ page }) => {
  await yesterdayWithLeftovers(page)
  await page.route('**/api/assistant', (r) => r.fulfill({ json: { reply: 'Added the gym.', order: null, actions: [task('Gym', 60)] } }))
  await page.getByLabel('Message Startly').fill('gym today')
  await page.getByLabel('Message Startly').press('Enter')
  await expect.poll(() => rows(page)).toContainEqual(expect.stringMatching(/Gym/))
  await expect(page.getByRole('button', { name: 'Add both' })).toBeEnabled()
  await page.getByRole('button', { name: 'Add both' }).click()
  await expect.poll(() => rows(page)).toContainEqual(expect.stringMatching(/Groceries/))
})

test('a day that runs until 1 am is still the same day at 00:30 (no reset, tasks still there)', async ({ page }) => {
  await freshApp(page, '22:00')
  await mockAssistant(page, { body: { reply: 'ok', order: null, actions: [{ type: 'set_end_of_day', time: '01:00' }, task('Hackathon', 150)] } })
  await page.getByLabel('Tell me everything you have to do').fill('hackathon 2h30, I can stay until 1 am')
  await page.keyboard.press('Enter')
  await expect.poll(() => rows(page)).toContainEqual(expect.stringMatching(/^task 22:00–00:30 Hackathon/))
  await page.clock.setFixedTime(new Date('2026-10-18T00:20:00'))
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  expect(await rows(page)).toContainEqual(expect.stringMatching(/^task 22:00–00:30 Hackathon/))
  await expect(page.locator('li[data-now]')).toContainText(/Now · 10m left/i)
  await expect(page.locator('[data-role=assistant]').filter({ hasText: /Good morning/ })).toHaveCount(0)
})
