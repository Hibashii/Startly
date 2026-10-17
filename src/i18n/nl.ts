import type { Dict } from './index'
import { variant, type CheerStage, type DayPart } from './shared'


const GREETINGS: Record<DayPart, string[]> = {
  morning: ['Goedemorgen ☀️', 'Goedemorgen! Nieuwe dag, nieuwe start.', 'Morgen! Klaar wanneer jij het bent.'],
  afternoon: ['Goedemiddag!', 'Hoi weer! Ik ben er voor de rest van je dag.'],
  evening: ['Goedenavond!', 'Goedenavond! Laten we het beste maken van wat er nog is.'],
}
const CHEERS: Record<CheerStage, string[]> = {
  first: ['Sterke start! 🚀', 'De eerste is binnen 🎯', 'We zijn vertrokken 🏁', 'Vaart: ontgrendeld ⚡️'],
  half: ['Halverwege 💪', 'De halve dag is klaar 🔥', 'Het zwaarste is achter de rug 🏔️'],
  lastOne: ['Nog één te gaan 🔥', 'De laatste. Jij kan dit 💪', 'Eindsprint 🏁'],
  any: ['Top! Eén minder 🎉', 'Die heb je geregeld 💪', 'Houd het tempo vast ✨', 'Klaar en afgevinkt ✅', 'Kijk jou eens gaan 🙌', 'Je bent op dreef 🔥', 'Zo doe je dat ⚡️'],
}
const CELEBRATIONS = [
  ['Je hebt vandaag alles gegeven. Alles afgevinkt. Ga rusten, je hebt het verdiend.', 'Discipline is kiezen tussen wat je nu wilt en wat je het liefst wilt.'],
  ['Alles gedaan. Je begon, en je maakte het af. Dat was het moeilijke deel.', 'Of jij leidt de dag, of de dag leidt jou.'],
  ['Wees trots op de versie van jezelf die vandaag kwam opdagen.', 'Kleine dagelijkse verbeteringen leiden tot grote resultaten.'],
  ['Alles klaar. Morgen bedank je de jij van vandaag.', 'We zijn wat we herhaaldelijk doen. Uitmuntendheid is dus geen daad, maar een gewoonte.'],
  ['Elk vakje afgevinkt. De avond is van jou.', 'Het geheim van vooruitkomen is beginnen.'],
]
const taak = (n: number) => (n === 1 ? 'taak' : 'taken')

export const nl: Dict = {
  hookQuestion: 'Weet je niet waar je moet beginnen?',
  hookAnswer: 'Begin hier.',
  step1: 'Gooi alles eruit',
  step2: 'Krijg je rooster',
  step3: 'Zeg het als er iets verandert',
  stepArrow: '→',
  dumpLabel: 'Vertel me alles wat je moet doen',
  dumpPlaceholder: 'Vertel me alles wat je moet doen…',
  planMyDay: 'Plan mijn dag →',
  planning1: 'Je lijst lezen…',
  planning2: 'Vaste tijden zoeken…',
  planning3: 'Een goede volgorde kiezen…',
  planning4: 'Lunch en pauzes toevoegen…',
  planning5: 'Je rooster bouwen…',

  askStartly: 'Vraag Startly',
  weekToggle: (p, f) => `${f.dayMonth(p.date)}: week ${p.open ? 'verbergen' : 'tonen'}`,
  settings: 'Instellingen',
  color: 'Kleur',
  accent: (p) => ({ iris: 'Iris', ocean: 'Oceaan', sage: 'Salie', plum: 'Pruim', coral: 'Koraal', ink: 'Inkt' })[p.accent],
  remembers: (p) => `${p.name} · Startly onthoudt je keuze.`,
  darkMode: 'Donkere modus',
  language: 'Taal',
  startFresh: 'Opnieuw beginnen…',
  startFreshTitle: 'Opnieuw beginnen?',
  startFreshBody:
    'Dit wist je planning, je chat en je vrije tijden, en brengt je terug naar het eerste scherm. Je voorkeuren blijven (kleur, modus, taal, einde van de dag, pauzes). Dit kan niet ongedaan worden.',
  cancel: 'Annuleren',
  deleteEverything: 'Alles wissen',

  thisWeek: 'Deze week',
  today: 'Vandaag',
  tomorrow: 'Morgen',
  weekDay: (p, f) => `${f.dayMonth(p.date)}: ${p.planned ? `${p.planned} gepland` : 'niets gepland'}${p.pinned ? ', vaste afspraak' : ''}`,

  dayComplete: 'Dag voltooid ✓',
  plannedUntil: (p) => `${p.planned} gepland · tot ${p.until}`,
  nothingPlanned: 'Nog niets gepland',
  freeTime: (p, f) => `Vrij ${f.list(p.windows)}`,
  freeUnknown: 'Vrije tijd onbekend',
  planned: (p) => `${p.planned} gepland`,
  view: 'Weergave',
  viewList: 'Lijst',
  viewGrid: 'Raster',
  timetableOf: (p) => `Rooster: ${p.day}`,
  todaysTimetable: 'Rooster van vandaag',
  tasksOf: (p) => `Taken: ${p.day}`,
  laterDayHint: 'Ik deel deze dag uur voor uur in als hij komt, of vraag me om hem nu te plannen.',
  laterDayEmpty: 'Nog niets gepland voor deze dag.',
  noFitBefore: (p) => `Past niet voor ${p.end}`,
  noFitToday: 'Past vandaag niet',
  noFitOn: (p) => `Past niet: ${p.day}`,
  lunch: 'Lunch',
  break: 'Pauze',
  hourGrid: 'Urenraster',
  now: 'Nu',
  fixedAppointment: 'vaste afspraak',

  doneLabel: (p) => `Klaar: ${p.title}`,
  nowLeft: (p) => `Nu · nog ${p.left}`,
  didYouFinish: 'Ben je klaar?',
  btnDone: '✓ Klaar',
  needMoreTime: 'Meer tijd',
  notStarted: 'Niet begonnen',
  toTomorrow: '→ Morgen',
  skipToTomorrow: 'Naar morgen',
  clickToRename: 'Klik om te hernoemen',
  renameLabel: (p) => `${p.title} hernoemen`,
  continued: (p) => `${p.title} (vervolg)`,

  chatWithStartly: 'Chat met Startly',
  clearChat: 'Chat wissen',
  clearChatHint: 'Chat wissen (je planning blijft)',
  closeChat: 'Chat sluiten',
  rearranging: 'Je dag opnieuw indelen…',
  messageLabel: 'Bericht aan Startly',
  messagePlaceholder: 'Bericht aan Startly…',
  send: 'Versturen',
  retry: 'Opnieuw',
  whatMoved: 'Wat er verschoof',
  notToday: 'niet vandaag',
  errRateLimited: 'Dat zijn veel berichten in een uur. Geef me een paar minuten.',
  errUnavailable: 'Ik kan nu even niet nadenken. Nog eens proberen?',
  didntGet: 'Sorry, dat begreep ik niet helemaal. Kun je het anders zeggen?',
  answerWithButtons: 'Je kunt antwoorden met de knoppen hierboven.',
  youChose: (p) => `Je koos: ${p.answer}`,
  questionExpired: 'Vraag verlopen.',
  questionSkipped: 'Vraag overgeslagen (je veranderde iets anders).',
  questionLater: 'Ik vraag het zo nog eens.',
  nAdded: (p) => `${p.n} toegevoegd`,
  chooseLegend: 'Kies wat je vandaag toevoegt',
  addSelected: 'Selectie toevoegen · rest schrappen',
  backToEarlier: 'Terug naar de vraag van daarnet:',

  noteRemoved: (p, f) => `Verwijderd: ${f.list(p.items.map(f.name))}.`,
  notePutOn: (p, f) => `${f.quote(f.name(p.title))} staat nu op ${f.weekday(p.date)}, want het moet ${f.weekday(p.due)} af zijn.`,
  noteWhenFree: (p, f) =>
    `Wanneer ben je ${f.weekday(p.date)} vrij?` +
    (p.waiting.length ? ` Ik wil ${f.list(p.waiting.map((x) => f.quote(f.name(x))))} graag voor de deadline inplannen.` : ' Zeg het en ik plan het.'),
  notePlanned: (p, f) => `${f.list(p.dates.map(f.weekday))} uur voor uur gepland.`,
  noteNoFitToday: (p, f) => `Dit past vandaag niet voor ${p.end}: ${f.list(p.items.map(f.name))}.`,
  noteNoFitOn: (p, f) => `Dit past ${f.weekday(p.date)} niet: ${f.list(p.items.map(f.name))}.`,

  qUntil: (p, f) => `Dan ben je bezig tot ${p.until}. Oké, of zal ik ${f.quote(f.name(p.title))} naar ${f.weekday(p.date)} verplaatsen?`,
  keepIt: 'Houden',
  moveIt: 'Verplaatsen',
  qNoFit: (p, f) => {
    const one = p.items.length === 1
    const ways = [p.stay ? `tot ${p.stay} doorgaan` : null, `naar ${f.weekday(p.date)} verplaatsen`, 'schrappen'].filter((x): x is string => !!x)
    const choice = ways.slice(0, -1).join(', ') + ' of ' + ways.at(-1)
    return `${f.list(p.items.map((x) => f.quote(f.name(x))))} ${one ? 'past' : 'passen'} niet voor ${p.end}. ${choice[0].toUpperCase()}${choice.slice(1)}?`
  },
  stayUntil: (p) => `Doorgaan tot ${p.until}`,
  dayOption: (p, f) => f.weekday(p.date).replace(/^./, (c) => c.toUpperCase()),
  dropIt: 'Schrappen',
  dropThem: 'Alles schrappen',

  greeting: (p) =>
    `${variant(GREETINGS[p.part], p.i)} ${p.hasPlan ? 'Je planning staat er nog.' : 'Wat staat er vandaag op het programma? Vertel me alles en ik plan het.'}`,
  leftoverOne: (p, f) => `${f.quote(f.name(p.title))} van ${p.yesterday ? 'gisteren' : 'eerder'} is niet afgevinkt. Aan vandaag toevoegen?`,
  leftoverMany: (p, f) =>
    `${p.items.length} dingen van ${p.yesterday ? 'gisteren' : 'eerder'} zijn niet afgevinkt: ${f.list(p.items.map(f.name))}. Aan vandaag toevoegen?`,
  addIt: 'Toevoegen',
  addBoth: 'Allebei toevoegen',
  addAll: 'Alles toevoegen',
  choose: 'Kiezen',

  addedMore: (p, f) => `30 min toegevoegd aan ${f.quote(f.name(p.title))}.`,
  startsNow: (p, f) => `Oké, ${f.quote(f.name(p.title))} begint nu.`,
  movedTo: (p, f) => `${f.quote(f.name(p.title))} verplaatst naar ${f.weekday(p.date)}.`,
  addedToToday: 'Aan vandaag toegevoegd.',
  droppedThem: 'Geschrapt.',

  toastReshuffled: (p) => `↻ ${p.n} ${taak(p.n)} opnieuw ingedeeld`,
  toastRemoved: (p, f) => `✓ Verwijderd: ${f.list(p.items.map(f.name))}`,
  toastAdded: (p) => `✓ ${p.n} ${taak(p.n)} toegevoegd`,
  toastRenamed: '✓ Hernoemd',
  toastChatCleared: '✓ Chat gewist',
  cheer: (p) => variant(CHEERS[p.stage], p.i),
  dayCompleteTitle: 'Dag voltooid',
  celebrationMessage: (p) => variant(CELEBRATIONS, p.i)[0],
  celebrationQuote: (p) => variant(CELEBRATIONS, p.i)[1],
  restWell: 'Rust lekker uit',
}
