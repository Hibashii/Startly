import { expect, test, type Page } from '@playwright/test'
import { freshApp, mockAssistant } from './helpers'

// Chromium's fake microphone (a beep): the recording is real, the transcription is mocked.
test.use({
  permissions: ['microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
})

const DUMP = 'What do you need to get done today or this week?'

async function mockTranscribe(page: Page, reply: { status?: number; json: unknown } = { json: { text: 'gym at 6 and groceries' } }) {
  const uploads: { type: string | null; size: number }[] = []
  await page.route('**/api/transcribe', async (route) => {
    uploads.push({ type: route.request().headers()['content-type'] ?? null, size: route.request().postDataBuffer()?.length ?? 0 })
    await route.fulfill({ status: reply.status ?? 200, json: reply.json })
  })
  return uploads
}

/** Tap the mic and talk for a moment: the box turns into the recording bar. */
async function talk(page: Page) {
  await page.getByRole('button', { name: 'Speak' }).click()
  await expect(page.getByRole('button', { name: 'Cancel recording' })).toBeVisible()
  await expect(page.getByLabel(DUMP)).toBeHidden()
  await page.clock.runFor(1500) // past the "just a tap" minimum
  await page.waitForTimeout(800) // real audio frames
}

test('■ → the words land in the box after what was typed, ready to check', async ({ page }) => {
  await freshApp(page)
  const uploads = await mockTranscribe(page)
  await page.getByLabel(DUMP).fill('essay')
  await talk(page)
  await page.getByRole('button', { name: 'Stop recording' }).click()

  const box = page.getByLabel(DUMP)
  await expect(box).toHaveValue('essay gym at 6 and groceries')
  await expect(box).toBeFocused()
  expect(uploads).toHaveLength(1)
  expect(uploads[0].type).toMatch(/^audio\/webm/)
  expect(uploads[0].size).toBeGreaterThan(0)
})

test('✕ → nothing is sent, the box is back as it was', async ({ page }) => {
  await freshApp(page)
  const uploads = await mockTranscribe(page)
  await page.getByLabel(DUMP).fill('essay')
  await talk(page)
  await page.getByRole('button', { name: 'Cancel recording' }).click()
  await expect(page.getByLabel(DUMP)).toHaveValue('essay')
  // Escape cancels too
  await talk(page)
  await page.keyboard.press('Escape')
  await expect(page.getByLabel(DUMP)).toHaveValue('essay')
  expect(uploads).toHaveLength(0)
})

test('↑ in the chat → the words go straight to Startly', async ({ page }) => {
  await freshApp(page)
  await mockTranscribe(page)
  const sent = await mockAssistant(page, { body: { reply: 'What time works?', actions: [], suggestions: ['Now', 'Later'] } })
  await page.getByLabel(DUMP).fill('plan my day')
  await page.getByRole('button', { name: 'Plan it for me →' }).click()
  await expect(page.locator('[data-role=assistant]')).toContainText('What time works?')

  await page.getByRole('button', { name: 'Speak' }).click()
  await page.clock.runFor(1500)
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: 'Send' }).click()
  await expect.poll(() => sent.length).toBe(2)
  expect((sent[1] as { message: string }).message).toBe('gym at 6 and groceries')
  await expect(page.getByLabel('Message Startly')).toHaveValue('')
})

test('a failed transcription says so and keeps what was typed', async ({ page }) => {
  await freshApp(page)
  await mockTranscribe(page, { status: 502, json: { error: 'transcribe_unavailable' } })
  await page.getByLabel(DUMP).fill('essay')
  await talk(page)
  await page.getByRole('button', { name: 'Stop recording' }).click()
  await expect(page.getByText("I couldn't hear that. Try again, or type it?")).toBeVisible()
  await expect(page.getByLabel(DUMP)).toHaveValue('essay')
})
