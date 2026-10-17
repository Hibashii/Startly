import { describe, expect, it } from 'vitest'
import { LANGS, detectLang, dirOf, msg, translate, type Key, type ParamsOf, type Text } from './index'
import { VARIANTS, type CheerStage, type DayPart } from './shared'

// One sample per message. The type makes it exhaustive: a new message without a sample won't compile.
type Samples = { [K in Key]: ParamsOf<K> extends never ? null : ParamsOf<K> }
const D = '2026-10-18'
const SAMPLES: Samples = {
  hookQuestion: null, hookAnswer: null, step1: null, step2: null, step3: null, stepArrow: null, dumpLabel: null, dumpPlaceholder: null,
  planMyDay: null, planning1: null, planning2: null, planning3: null, planning4: null, planning5: null,
  askStartly: null, weekToggle: { date: D, open: true }, settings: null, color: null, accent: { accent: 'coral' },
  remembers: { name: 'Coral' }, darkMode: null, language: null, startFresh: null, startFreshTitle: null, startFreshBody: null,
  cancel: null, deleteEverything: null, thisWeek: null, today: null, tomorrow: null, weekDay: { date: D, planned: '2h30', pinned: true },
  dayComplete: null, plannedUntil: { planned: '6h', until: '21:15' }, nothingPlanned: null, freeTime: { windows: ['18:00–23:00'] },
  freeUnknown: null, planned: { planned: '1h30' }, view: null, viewList: null, viewGrid: null, timetableOf: { day: 'X' },
  todaysTimetable: null, tasksOf: { day: 'X' }, laterDayHint: null, laterDayEmpty: null, noFitBefore: { end: '23:00' },
  noFitToday: null, noFitOn: { day: 'X' }, lunch: null, break: null, hourGrid: null, now: null, fixedAppointment: null,
  doneLabel: { title: 'Gym' }, nowLeft: { left: '1h40' }, didYouFinish: null, btnDone: null, needMoreTime: null, notStarted: null,
  toTomorrow: null, skipToTomorrow: null, clickToRename: null, renameLabel: { title: 'Gym' }, continued: { title: 'Gym' },
  chatWithStartly: null, clearChat: null, clearChatHint: null, closeChat: null, rearranging: null, messageLabel: null,
  messagePlaceholder: null, send: null, retry: null, whatMoved: null, notToday: null, errRateLimited: null, errUnavailable: null,
  didntGet: null, answerWithButtons: null, youChose: { answer: 'Keep it' }, questionExpired: null, questionSkipped: null,
  questionLater: null, nAdded: { n: 2 }, chooseLegend: null, addSelected: null, backToEarlier: null,
  noteRemoved: { items: ['Gym', { cont: 'Groceries' }] }, notePutOn: { title: 'Report', date: D, due: '2026-10-19' },
  noteWhenFree: { date: D, waiting: ['Report'] }, notePlanned: { dates: [D] }, noteNoFitToday: { end: '23:00', items: ['Gym'] },
  noteNoFitOn: { date: D, items: ['Gym'] }, qUntil: { until: '23:40', title: 'Review notes', date: D }, keepIt: null, moveIt: null,
  qNoFit: { items: ['RAG project', 'Apply for jobs'], end: '23:00', stay: '01:35', date: D }, stayUntil: { until: '01:35' },
  dayOption: { date: D }, dropIt: null, dropThem: null, greeting: { part: 'morning', i: 1, hasPlan: true },
  leftoverOne: { title: 'Groceries', yesterday: true }, leftoverMany: { items: ['Groceries', 'Gym'], yesterday: true },
  addIt: null, addBoth: null, addAll: null, choose: null, addedMore: { title: 'Gym' }, startsNow: { title: 'Gym' },
  movedTo: { title: 'Gym', date: D }, addedToToday: null, droppedThem: null, toastReshuffled: { n: 3 },
  toastRemoved: { items: ['Gym'] }, toastAdded: { n: 1 }, toastRenamed: null, toastChatCleared: null,
  cheer: { stage: 'half', i: 2 }, dayCompleteTitle: null, celebrationMessage: { i: 3 }, celebrationQuote: { i: 3 }, restWell: null,
}
const texts = (Object.keys(SAMPLES) as Key[]).map((k) => (SAMPLES[k] === null ? { k } : { k, p: SAMPLES[k] }) as Text)
// Words that are the same in some languages (e.g. "Lunch" in Dutch, "Iris" everywhere): not a missing translation.
const SAME_OK = new Set<Key>(['stepArrow', 'accent', 'lunch', 'color', 'continued', 'freeTime', 'dayOption'])

describe('i18n', () => {
  it('every message renders in every language, with no holes', () => {
    for (const { id } of LANGS) {
      for (const text of texts) {
        const s = translate(id, text)
        expect(s, `${id}.${text.k}`).toBeTruthy()
        expect(s, `${id}.${text.k}`).not.toMatch(/undefined|NaN|\[object/)
      }
    }
  })

  it('every language is really translated (not English left behind)', () => {
    for (const { id } of LANGS.filter((l) => l.id !== 'en')) {
      const same = texts.filter((t) => !SAME_OK.has(t.k) && translate(id, t) === translate('en', t)).map((t) => t.k)
      // A few short words can legitimately match (e.g. "Pause" in German and French), but never many.
      expect(same.length, `${id}: ${same.join(', ')}`).toBeLessThan(5)
    }
  })

  it('Arabic is right-to-left and written in Arabic; times keep Latin digits', () => {
    expect(dirOf('ar')).toBe('rtl')
    expect(dirOf('fr')).toBe('ltr')
    expect(translate('ar', msg('hookAnswer'))).toMatch(/[؀-ۿ]/)
    expect(translate('ar', msg('plannedUntil', { planned: '6h', until: '21:15' }))).toContain('21:15')
    expect(translate('ar', msg('dayOption', { date: D }))).toMatch(/[؀-ۿ]/)
  })

  it('dates and lists follow the language', () => {
    expect(translate('en', msg('dayOption', { date: D }))).toBe('Sunday')
    expect(translate('fr', msg('dayOption', { date: D }))).toBe('Dimanche')
    expect(translate('de', msg('dayOption', { date: D }))).toBe('Sonntag')
    expect(translate('en', msg('noteRemoved', { items: ['A', 'B', 'C'] }))).toBe('Removed: A, B and C.')
    expect(translate('fr', msg('noteRemoved', { items: ['A', 'B'] }))).toBe('Retiré : A et B.')
  })

  it('picks the browser language when Startly speaks it, else English', () => {
    expect(detectLang(['fr-FR', 'en'])).toBe('fr')
    expect(detectLang(['pt-BR', 'nl-NL'])).toBe('nl')
    expect(detectLang(['ja'])).toBe('en')
    expect(detectLang([])).toBe('en')
  })

  it('every language writes exactly the shared number of variants (so a slot means the same in all)', () => {
    for (const { id } of LANGS) {
      const all = (render: (i: number) => string, count: number) => {
        const seen = new Set(Array.from({ length: count }, (_, i) => render(i)))
        expect(seen.size, id).toBe(count) // all distinct...
        expect(render(count), id).toBe(render(0)) // ...and exactly `count` of them (it wraps)
      }
      for (const stage of Object.keys(VARIANTS.cheer) as CheerStage[]) all((i) => translate(id, msg('cheer', { stage, i })), VARIANTS.cheer[stage])
      for (const part of Object.keys(VARIANTS.greeting) as DayPart[])
        all((i) => translate(id, msg('greeting', { part, i, hasPlan: true })), VARIANTS.greeting[part])
      all((i) => translate(id, msg('celebrationMessage', { i })), VARIANTS.celebration)
    }
  })

  it('the rest of a split task is named as such in every language', () => {
    const note = msg('noteNoFitToday', { end: '23:00', items: [{ cont: 'Work' }] })
    expect(translate('en', note)).toBe("These don't fit before 23:00 today: Work (cont.).")
    expect(translate('fr', note)).toContain('Work (suite)')
    expect(translate('de', note)).toContain('Work (Forts.)')
  })

  it('never crashes on odd saved data: unknown language or message', () => {
    expect(translate('xx' as never, msg('hookAnswer'))).toBe('Start here.')
    expect(translate('fr', { k: 'gone' } as never)).toBe('')
  })
})
