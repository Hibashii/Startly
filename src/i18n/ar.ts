import type { Dict } from './index'
import { variant, type CheerStage, type DayPart } from './shared'


const GREETINGS: Record<DayPart, string[]> = {
  morning: ['صباح الخير ☀️', 'صباح الخير! يوم جديد وبداية جديدة.', 'صباح النور! أنا جاهز متى كنت جاهزًا.'],
  afternoon: ['مساء الخير!', 'أهلًا من جديد! أنا هنا لبقية يومك.'],
  evening: ['مساء الخير!', 'مساء الخير! لنستفد من بقية اليوم.'],
}
const CHEERS: Record<CheerStage, string[]> = {
  first: ['بداية رائعة! 🚀', 'أنجزت الأولى 🎯', 'انطلقنا 🏁', 'الحماس انطلق ⚡️'],
  half: ['وصلت إلى المنتصف 💪', 'نصف اليوم أُنجز 🔥', 'تجاوزت الجزء الأصعب 🏔️'],
  lastOne: ['بقيت واحدة فقط 🔥', 'الأخيرة، أنت قدها 💪', 'المرحلة الأخيرة 🏁'],
  any: ['أحسنت! واحدة أقل 🎉', 'أنجزتها بجدارة 💪', 'حافظ على الإيقاع ✨', 'تمّت على أكمل وجه ✅', 'انظر كيف تتقدّم 🙌', 'أنت في أفضل حالاتك 🔥', 'هكذا تُنجز الأمور ⚡️'],
}
const CELEBRATIONS = [
  ['أبدعت اليوم. كل المهام مُنجزة. اذهب وارتح، تستحق ذلك.', 'الانضباط هو الاختيار بين ما تريده الآن وما تريده أكثر.'],
  ['كل شيء أُنجز. بدأت وأنهيت، وهذا كان الجزء الأصعب.', 'إما أن تقود يومك أو يقودك يومك.'],
  ['افتخر بالنسخة منك التي حضرت اليوم.', 'التحسينات الصغيرة اليومية هي مفتاح النتائج الكبيرة.'],
  ['انتهى كل شيء. غدًا ستشكر نفسك على ما فعلته اليوم.', 'نحن ما نفعله باستمرار. التميّز ليس فعلًا، بل عادة.'],
  ['كل المهام مُنجزة. المساء لك.', 'سرّ التقدّم هو البداية.'],
]
/** Arabic plural forms: 1, 2, 3–10, 11+. */
const count = (n: number, one: string, two: string, few: string, many: string) =>
  n === 1 ? one : n === 2 ? two : n <= 10 ? `${n} ${few}` : `${n} ${many}`
const tasks = (n: number) => count(n, 'مهمة واحدة', 'مهمتان', 'مهام', 'مهمة')

export const ar: Dict = {
  hookQuestion: 'لا تعرف من أين تبدأ؟',
  hookAnswer: 'ابدأ من هنا.',
  step1: 'أفرغ كل ما في رأسك',
  step2: 'احصل على جدولك',
  step3: 'أخبرني عندما يتغيّر شيء',
  stepArrow: '←',
  dumpLabel: 'أخبرني بكل ما عليك فعله',
  dumpPlaceholder: 'أخبرني بكل ما عليك فعله…',
  planMyDay: 'خطّط يومي ←',
  planning1: 'أقرأ قائمتك…',
  planning2: 'أحدّد المواعيد الثابتة…',
  planning3: 'أختار ترتيبًا مناسبًا…',
  planning4: 'أضيف الغداء والاستراحات…',
  planning5: 'أبني جدولك…',

  askStartly: 'اسأل Startly',
  weekToggle: (p, f) => `${f.dayMonth(p.date)}: ${p.open ? 'إخفاء' : 'إظهار'} الأسبوع`,
  settings: 'الإعدادات',
  color: 'اللون',
  accent: (p) => ({ iris: 'سوسن', ocean: 'محيط', sage: 'مريمية', plum: 'برقوق', coral: 'مرجان', ink: 'حبر' })[p.accent],
  remembers: (p) => `${p.name} · Startly يتذكّر اختيارك.`,
  darkMode: 'الوضع الداكن',
  language: 'اللغة',
  startFresh: 'البدء من جديد…',
  startFreshTitle: 'البدء من جديد؟',
  startFreshBody:
    'سيحذف هذا خطتك ومحادثتك وأوقات فراغك، ويعيدك إلى الشاشة الأولى. تبقى تفضيلاتك (اللون، الوضع، اللغة، نهاية اليوم، الاستراحات). لا يمكن التراجع عن ذلك.',
  cancel: 'إلغاء',
  deleteEverything: 'حذف كل شيء',

  thisWeek: 'هذا الأسبوع',
  today: 'اليوم',
  tomorrow: 'غدًا',
  weekDay: (p, f) => `${f.dayMonth(p.date)}: ${p.planned ? `${p.planned} مخطط` : 'لا شيء مخطط'}${p.pinned ? '، موعد ثابت' : ''}`,

  dayComplete: 'اكتمل اليوم ✓',
  plannedUntil: (p) => `${p.planned} مخطط · حتى ${p.until}`,
  nothingPlanned: 'لا شيء مخطط بعد',
  freeTime: (p, f) => `متاح ${f.list(p.windows)}`,
  freeUnknown: 'وقت الفراغ غير معروف',
  planned: (p) => `${p.planned} مخطط`,
  view: 'العرض',
  viewList: 'قائمة',
  viewGrid: 'شبكة',
  timetableOf: (p) => `جدول ${p.day}`,
  todaysTimetable: 'جدول اليوم',
  tasksOf: (p) => `مهام ${p.day}`,
  laterDayHint: 'سأنظّم هذا اليوم ساعة بساعة عندما يأتي، أو اطلب مني تخطيطه الآن.',
  laterDayEmpty: 'لا شيء مخطط لهذا اليوم بعد.',
  noFitBefore: (p) => `لا يتّسع قبل ${p.end}`,
  noFitToday: 'لا يتّسع اليوم',
  noFitOn: (p) => `لا يتّسع يوم ${p.day}`,
  lunch: 'الغداء',
  break: 'استراحة',
  hourGrid: 'شبكة الساعات',
  now: 'الآن',
  fixedAppointment: 'موعد ثابت',

  doneLabel: (p) => `تم: ${p.title}`,
  nowLeft: (p) => `الآن · متبقٍ ${p.left}`,
  didYouFinish: 'هل انتهيت؟',
  btnDone: '✓ تم',
  needMoreTime: 'وقت إضافي',
  notStarted: 'لم أبدأ',
  toTomorrow: '← غدًا',
  skipToTomorrow: 'تأجيل إلى الغد',
  clickToRename: 'انقر لإعادة التسمية',
  renameLabel: (p) => `إعادة تسمية ${p.title}`,
  continued: (p) => `${p.title} (تابع)`,

  chatWithStartly: 'المحادثة مع Startly',
  clearChat: 'مسح المحادثة',
  clearChatHint: 'مسح المحادثة (تبقى خطتك)',
  closeChat: 'إغلاق المحادثة',
  rearranging: 'أعيد ترتيب يومك…',
  messageLabel: 'راسل Startly',
  messagePlaceholder: 'راسل Startly…',
  send: 'إرسال',
  retry: 'إعادة المحاولة',
  whatMoved: 'ما الذي تغيّر',
  notToday: 'ليس اليوم',
  errRateLimited: 'هذه رسائل كثيرة خلال ساعة. امنحني بضع دقائق.',
  errUnavailable: 'لم أتمكّن من التفكير الآن. نحاول مجددًا؟',
  didntGet: 'عذرًا، لم أفهم ذلك جيدًا. هل يمكنك قوله بطريقة أخرى؟',
  answerWithButtons: 'يمكنك الإجابة بالأزرار أعلاه.',
  youChose: (p) => `اخترت: ${p.answer}`,
  questionExpired: 'انتهت صلاحية السؤال.',
  questionSkipped: 'تم تخطّي السؤال (غيّرت شيئًا آخر).',
  questionLater: 'سأسألك مجددًا بعد قليل.',
  nAdded: (p) => `أُضيفت ${tasks(p.n)}`,
  chooseLegend: 'اختر ما تضيفه إلى اليوم',
  addSelected: 'أضف المحدّد · احذف الباقي',
  backToEarlier: 'لنعد إلى السؤال السابق:',

  noteRemoved: (p, f) => `تم الحذف: ${f.list(p.items.map(f.name))}.`,
  notePutOn: (p, f) => `وضعت ${f.quote(f.name(p.title))} يوم ${f.weekday(p.date)}، لأن موعده يوم ${f.weekday(p.due)}.`,
  noteWhenFree: (p, f) =>
    `متى تكون متاحًا يوم ${f.weekday(p.date)}؟` +
    (p.waiting.length ? ` أودّ إدراج ${f.list(p.waiting.map((x) => f.quote(f.name(x))))} قبل الموعد.` : ' أخبرني وسأخطّط له.'),
  notePlanned: (p, f) => `خطّطت ${f.list(p.dates.map(f.weekday))} ساعة بساعة.`,
  noteNoFitToday: (p, f) => `هذا لا يتّسع قبل ${p.end} اليوم: ${f.list(p.items.map(f.name))}.`,
  noteNoFitOn: (p, f) => `هذا لا يتّسع يوم ${f.weekday(p.date)}: ${f.list(p.items.map(f.name))}.`,

  qUntil: (p, f) => `هذا يجعلك مشغولًا حتى ${p.until}. هل هذا مناسب، أم أنقل ${f.quote(f.name(p.title))} إلى يوم ${f.weekday(p.date)}؟`,
  keepIt: 'أبقِه',
  moveIt: 'انقله',
  qNoFit: (p, f) => {
    const one = p.items.length === 1
    const ways = [p.stay ? `البقاء حتى ${p.stay}` : null, `${one ? 'نقله' : 'نقلها'} إلى يوم ${f.weekday(p.date)}`, one ? 'حذفه' : 'حذفها'].filter(
      (x): x is string => !!x,
    )
    return `${f.list(p.items.map((x) => f.quote(f.name(x))))} ${one ? 'لا يتّسع' : 'لا تتّسع'} قبل ${p.end}. ${ways.slice(0, -1).join('، ')} أو ${ways.at(-1)}؟`
  },
  stayUntil: (p) => `البقاء حتى ${p.until}`,
  dayOption: (p, f) => f.weekday(p.date),
  dropIt: 'احذفه',
  dropThem: 'احذفها',

  greeting: (p) =>
    `${variant(GREETINGS[p.part], p.i)} ${p.hasPlan ? 'خطتك ما زالت هنا.' : 'ما الذي لديك اليوم؟ أخبرني بكل شيء وسأخطّط له.'}`,
  leftoverOne: (p, f) => `لم يتم إنجاز ${f.quote(f.name(p.title))} ${p.yesterday ? 'من الأمس' : 'من قبل'}. هل أضيفها إلى اليوم؟`,
  leftoverMany: (p, f) => `${tasks(p.items.length)} ${p.yesterday ? 'من الأمس' : 'من قبل'} لم تُنجز: ${f.list(p.items.map(f.name))}. هل أضيفها إلى اليوم؟`,
  addIt: 'أضفها',
  addBoth: 'أضف الاثنتين',
  addAll: 'أضف الكل',
  choose: 'اختر',

  addedMore: (p, f) => `أضفت 30 دقيقة إلى ${f.quote(f.name(p.title))}.`,
  startsNow: (p, f) => `حسنًا، ${f.quote(f.name(p.title))} تبدأ الآن.`,
  movedTo: (p, f) => `نقلت ${f.quote(f.name(p.title))} إلى يوم ${f.weekday(p.date)}.`,
  addedToToday: 'أُضيفت إلى اليوم.',
  droppedThem: 'تم الحذف.',

  toastReshuffled: (p) => `↻ أُعيد ترتيب ${tasks(p.n)}`,
  toastRemoved: (p, f) => `✓ تم حذف ${f.list(p.items.map(f.name))}`,
  toastAdded: (p) => `✓ أُضيفت ${tasks(p.n)}`,
  toastRenamed: '✓ تمت إعادة التسمية',
  toastChatCleared: '✓ تم مسح المحادثة',
  cheer: (p) => variant(CHEERS[p.stage], p.i),
  dayCompleteTitle: 'اكتمل اليوم',
  celebrationMessage: (p) => variant(CELEBRATIONS, p.i)[0],
  celebrationQuote: (p) => variant(CELEBRATIONS, p.i)[1],
  restWell: 'استرح جيدًا',
}
