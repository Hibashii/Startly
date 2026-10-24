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

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Too much to do,\s*not sure where to start\?/)
  const go = page.getByRole('button', { name: 'Plan it for me →' })
  await expect(go).toBeDisabled()
  await page.getByLabel('What do you need to get done today or this week?').fill('apply to 3 jobs, hackathon, gym, groceries, dentist 15:00-15:30')
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

test('unclear dump → Startly asks in the middle of the screen; the main screen comes with the plan', async ({ page }) => {
  await freshApp(page)
  await mockAssistant(
    page,
    { body: { reply: 'What do you need to get done today?', actions: [] } },
    { body: { reply: 'Here you go.', order: null, actions: [task('Essay', 60)] } },
  )
  await page.getByLabel('What do you need to get done today or this week?').fill('hmm')
  await page.keyboard.press('Enter')
  const talk = page.getByRole('region', { name: 'Chat with Startly' })
  await expect(talk.locator('[data-role=assistant]')).toContainText('What do you need to get done today?')
  await expect(page.getByText('Nothing planned yet')).toHaveCount(0) // no empty main screen behind the question
  await expect(page.getByRole('complementary', { name: 'Chat with Startly' })).toHaveCount(0)

  await talk.getByLabel('Message Startly').fill('an essay, 1 hour')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  const chat = page.getByRole('complementary', { name: 'Chat with Startly' })
  await expect(chat).toContainText('What do you need to get done today?') // the same conversation, now on the side
  await expect(chat).toContainText('Here you go.')
  await expect(chat).toHaveClass(/chat-arrive/)
})

test('assistant down → friendly error, still on the first screen', async ({ page }) => {
  await freshApp(page)
  await mockAssistant(page, { status: 502, body: { error: 'assistant_unavailable' } })
  await page.getByLabel('What do you need to get done today or this week?').fill('gym')
  await page.getByRole('button', { name: 'Plan it for me →' }).click()
  await expect(page.getByRole('alert')).toHaveText("I couldn't reach my brain just now. Try again?")
  await expect(page.getByLabel('What do you need to get done today or this week?')).toHaveValue('gym')
})
