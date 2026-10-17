import { expect, test } from '@playwright/test'
import { TODAY, freshApp, mockAssistant, rows, task } from './helpers'

test('dump → timetable with lunch, a break and the appointment at its time; survives reload', async ({ page }) => {
  await freshApp(page)
  const sent = await mockAssistant(page, {
    body: {
      reply: "Here's your Saturday.",
      actions: [
        task('Apply to 3 jobs', 135), task('Hackathon', 120), task('Gym', 60), task('Groceries', 45),
        { type: 'add_fixed', title: 'Dentist', date: TODAY, start: '15:00', end: '15:30' },
      ],
    },
  })

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Don't know where to start\?\s*Start here\./)
  const go = page.getByRole('button', { name: 'Plan my day →' })
  await expect(go).toBeDisabled()
  await page.getByLabel('Tell me everything you have to do').fill('apply to 3 jobs, hackathon, gym, groceries, dentist 15:00-15:30')
  await go.click()

  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  const plan = await rows(page)
  expect(plan.filter((r) => r.startsWith('task'))).toHaveLength(4)
  expect(plan).toContain('fixed 15:00–15:30 Dentist 30m')
  expect(plan.some((r) => r.startsWith('lunch'))).toBe(true)
  expect(plan.some((r) => r.startsWith('break'))).toBe(true)
  await expect(page.locator('[data-role=assistant]')).toContainText("Here's your Saturday.")
  expect((sent[0] as { context: { today: string; now: string } }).context).toMatchObject({ today: TODAY, now: `${TODAY}T10:00` })

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  expect(await rows(page)).toEqual(plan)
})

test('unclear dump → main screen with nothing planned and Startly asking', async ({ page }) => {
  await freshApp(page)
  await mockAssistant(page, { body: { reply: 'What do you need to get done today?', actions: [] } })
  await page.getByLabel('Tell me everything you have to do').fill('hmm')
  await page.keyboard.press('Enter')
  await expect(page.getByText('Nothing planned yet')).toBeVisible()
  await expect(page.locator('[data-role=assistant]')).toContainText('What do you need to get done today?')
})

test('assistant down → friendly error, still on the first screen', async ({ page }) => {
  await freshApp(page)
  await mockAssistant(page, { status: 502, body: { error: 'assistant_unavailable' } })
  await page.getByLabel('Tell me everything you have to do').fill('gym')
  await page.getByRole('button', { name: 'Plan my day →' }).click()
  await expect(page.getByRole('alert')).toHaveText("I couldn't reach my brain just now. Try again?")
  await expect(page.getByLabel('Tell me everything you have to do')).toHaveValue('gym')
})
