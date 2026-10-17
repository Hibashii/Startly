import type { Dict } from './index'
import { variant, type CheerStage, type DayPart } from './shared'
import type { Fmt } from './format'


const GREETINGS: Record<DayPart, string[]> = {
  morning: ['Bonjour ☀️', 'Bonjour ! Nouvelle journée, nouveau départ.', 'Bonjour ! Prêt·e quand tu veux.'],
  afternoon: ['Bon après-midi !', 'Re-bonjour ! Je suis là pour la suite de ta journée.'],
  evening: ['Bonsoir !', 'Bonsoir ! Profitons bien de ce qu’il reste.'],
}
const CHEERS: Record<CheerStage, string[]> = {
  first: ['Super début ! 🚀', 'Et de un 🎯', "C'est parti 🏁", 'L’élan est lancé ⚡️'],
  half: ['À mi-chemin 💪', 'La moitié, c’est fait 🔥', 'Le plus dur est passé 🏔️'],
  lastOne: ['Plus qu’une 🔥', 'La dernière, tu gères 💪', 'Dernière ligne droite 🏁'],
  any: ['Bien joué ! Une de moins 🎉', 'Celle-là, c’est réglé 💪', 'Garde le rythme ✨', 'Fait et bien fait ✅', 'Regarde-toi avancer 🙌', 'Tu es lancé·e 🔥', 'Voilà comment on fait ⚡️'],
}
const CELEBRATIONS = [
  ['Tu as tout donné aujourd’hui. Tout est coché. Va te reposer, tu le mérites.', 'La discipline, c’est choisir entre ce que tu veux maintenant et ce que tu veux le plus.'],
  ['Tout est fait. Tu as commencé, et tu as fini. C’était le plus dur.', 'Soit tu mènes ta journée, soit c’est elle qui te mène.'],
  ['Sois fier·ère de la personne qui s’est présentée aujourd’hui.', 'Les petits progrès quotidiens mènent à de grands résultats.'],
  ['Tout est fini. Demain, tu remercieras celle ou celui que tu as été aujourd’hui.', 'Nous sommes ce que nous faisons de manière répétée. L’excellence n’est donc pas un acte, mais une habitude.'],
  ['Chaque case cochée. La soirée est à toi.', 'Le secret pour avancer, c’est de commencer.'],
]
const tache = (n: number) => (n === 1 ? 'tâche' : 'tâches')

export const fr: Dict = {
  hookQuestion: 'Tu ne sais pas par où commencer ?',
  hookAnswer: 'Commence ici.',
  step1: 'Vide ta tête',
  step2: 'Reçois ton emploi du temps',
  step3: 'Dis-moi quand ça change',
  stepArrow: '→',
  dumpLabel: 'Dis-moi tout ce que tu as à faire',
  dumpPlaceholder: 'Dis-moi tout ce que tu as à faire…',
  planMyDay: 'Planifier ma journée →',
  planning1: 'Je lis ta liste…',
  planning2: 'Je repère les horaires fixes…',
  planning3: 'Je choisis un bon ordre…',
  planning4: 'J’ajoute le déjeuner et les pauses…',
  planning5: 'Je construis ton emploi du temps…',

  askStartly: 'Demander à Startly',
  weekToggle: (p: { date: string; open: boolean }, f: Fmt) => `${f.dayMonth(p.date)} : ${p.open ? 'masquer' : 'afficher'} la semaine`,
  settings: 'Réglages',
  color: 'Couleur',
  accent: (p) => ({ iris: 'Iris', ocean: 'Océan', sage: 'Sauge', plum: 'Prune', coral: 'Corail', ink: 'Encre' })[p.accent],
  remembers: (p) => `${p.name} · Startly s’en souvient.`,
  darkMode: 'Mode sombre',
  language: 'Langue',
  startFresh: 'Tout recommencer…',
  startFreshTitle: 'Tout recommencer ?',
  startFreshBody:
    'Ceci supprime ton planning, ta discussion et tes disponibilités, et te ramène au premier écran. Tes préférences restent (couleur, mode, langue, fin de journée, pauses). C’est irréversible.',
  cancel: 'Annuler',
  deleteEverything: 'Tout supprimer',

  thisWeek: 'Cette semaine',
  today: 'Aujourd’hui',
  tomorrow: 'Demain',
  weekDay: (p, f) => `${f.dayMonth(p.date)} : ${p.planned ? `${p.planned} prévus` : 'rien de prévu'}${p.pinned ? ', rendez-vous fixe' : ''}`,

  dayComplete: 'Journée terminée ✓',
  plannedUntil: (p) => `${p.planned} prévus · jusqu’à ${p.until}`,
  nothingPlanned: 'Rien de prévu pour l’instant',
  freeTime: (p, f) => `Libre ${f.list(p.windows)}`,
  freeUnknown: 'Disponibilités inconnues',
  planned: (p) => `${p.planned} prévus`,
  view: 'Affichage',
  viewList: 'Liste',
  viewGrid: 'Grille',
  timetableOf: (p) => `Emploi du temps de ${p.day.toLowerCase()}`,
  todaysTimetable: 'Emploi du temps du jour',
  tasksOf: (p) => `Tâches : ${p.day}`,
  laterDayHint: 'Je détaillerai cette journée heure par heure le moment venu, ou demande-moi de la planifier maintenant.',
  laterDayEmpty: 'Rien de prévu ce jour-là pour l’instant.',
  noFitBefore: (p) => `Ne rentre pas avant ${p.end}`,
  noFitToday: 'Ne rentre pas aujourd’hui',
  noFitOn: (p) => `Ne rentre pas ${p.day.toLowerCase()}`,
  lunch: 'Déjeuner',
  break: 'Pause',
  hourGrid: 'Grille horaire',
  now: 'Maintenant',
  fixedAppointment: 'rendez-vous fixe',

  doneLabel: (p) => `Fait : ${p.title}`,
  nowLeft: (p) => `En cours · reste ${p.left}`,
  didYouFinish: 'Tu as fini ?',
  btnDone: '✓ Fait',
  needMoreTime: 'Plus de temps',
  notStarted: 'Pas commencé',
  toTomorrow: '→ Demain',
  skipToTomorrow: 'Remettre à demain',
  clickToRename: 'Clique pour renommer',
  renameLabel: (p) => `Renommer ${p.title}`,
  continued: (p) => `${p.title} (suite)`,

  chatWithStartly: 'Discuter avec Startly',
  clearChat: 'Effacer la discussion',
  clearChatHint: 'Effacer la discussion (ton planning reste)',
  closeChat: 'Fermer la discussion',
  rearranging: 'Je réorganise ta journée…',
  messageLabel: 'Écrire à Startly',
  messagePlaceholder: 'Écris à Startly…',
  send: 'Envoyer',
  retry: 'Réessayer',
  whatMoved: 'Ce qui a bougé',
  notToday: 'pas aujourd’hui',
  errRateLimited: 'Ça fait beaucoup de messages en une heure. Laisse-moi quelques minutes.',
  errUnavailable: 'Je n’arrive pas à réfléchir pour l’instant. On réessaie ?',
  didntGet: 'Désolé, je n’ai pas bien compris. Tu peux le dire autrement ?',
  answerWithButtons: 'Tu peux répondre avec les boutons au-dessus.',
  youChose: (p) => `Ton choix : ${p.answer}`,
  questionExpired: 'Question expirée.',
  questionSkipped: 'Question ignorée (tu as changé autre chose).',
  questionLater: 'Je te redemande dans un instant.',
  nAdded: (p) => `${p.n} ajoutée${p.n > 1 ? 's' : ''}`,
  chooseLegend: 'Choisis quoi ajouter à aujourd’hui',
  addSelected: 'Ajouter la sélection · retirer le reste',
  backToEarlier: 'Revenons à la question de tout à l’heure :',

  noteRemoved: (p, f) => `Retiré : ${f.list(p.items.map(f.name))}.`,
  notePutOn: (p, f) => `J’ai mis ${f.quote(f.name(p.title))} ${f.weekday(p.date)}, car c’est à rendre ${f.weekday(p.due)}.`,
  noteWhenFree: (p, f) =>
    `Quand es-tu libre ${f.weekday(p.date)} ?` +
    (p.waiting.length ? ` J’aimerais caser ${f.list(p.waiting.map((x) => f.quote(f.name(x))))} avant l’échéance.` : ' Dis-le-moi et je planifie.'),
  notePlanned: (p, f) => `J’ai planifié ${f.list(p.dates.map(f.weekday))} heure par heure.`,
  noteNoFitToday: (p, f) => `Ça ne rentre pas avant ${p.end} aujourd’hui : ${f.list(p.items.map(f.name))}.`,
  noteNoFitOn: (p, f) => `Ça ne rentre pas ${f.weekday(p.date)} : ${f.list(p.items.map(f.name))}.`,

  qUntil: (p, f) => `Ça te mène jusqu’à ${p.until}. D’accord, ou je déplace ${f.quote(f.name(p.title))} à ${f.weekday(p.date)} ?`,
  keepIt: 'Je garde',
  moveIt: 'Déplacer',
  qNoFit: (p, f) => {
    const one = p.items.length === 1
    const ways = [p.stay ? `rester jusqu’à ${p.stay}` : null, `${one ? 'le' : 'les'} déplacer à ${f.weekday(p.date)}`, `${one ? 'l’' : 'les '}abandonner`].filter(
      (x): x is string => !!x,
    )
    const choice = ways.slice(0, -1).join(', ') + ' ou ' + ways.at(-1)
    return `${f.list(p.items.map((x) => f.quote(f.name(x))))} ${one ? 'ne rentre' : 'ne rentrent'} pas avant ${p.end}. ${choice[0].toUpperCase()}${choice.slice(1)} ?`
  },
  stayUntil: (p) => `Rester jusqu’à ${p.until}`,
  dayOption: (p, f) => f.weekday(p.date).replace(/^./, (c) => c.toUpperCase()),
  dropIt: 'Abandonner',
  dropThem: 'Tout abandonner',

  greeting: (p) =>
    `${variant(GREETINGS[p.part], p.i)} ${p.hasPlan ? 'Ton planning est toujours là.' : 'Qu’est-ce qu’on a aujourd’hui ? Dis-moi tout et je planifie.'}`,
  leftoverOne: (p, f) => `${f.quote(f.name(p.title))} ${p.yesterday ? 'd’hier' : 'd’avant'} n’a pas été coché. Je l’ajoute à aujourd’hui ?`,
  leftoverMany: (p, f) =>
    `${p.items.length} choses ${p.yesterday ? 'd’hier' : 'd’avant'} n’ont pas été cochées : ${f.list(p.items.map(f.name))}. Je les ajoute à aujourd’hui ?`,
  addIt: 'Ajouter',
  addBoth: 'Ajouter les deux',
  addAll: 'Tout ajouter',
  choose: 'Choisir',

  addedMore: (p, f) => `J’ai ajouté 30 min à ${f.quote(f.name(p.title))}.`,
  startsNow: (p, f) => `OK, ${f.quote(f.name(p.title))} commence maintenant.`,
  movedTo: (p, f) => `J’ai déplacé ${f.quote(f.name(p.title))} à ${f.weekday(p.date)}.`,
  addedToToday: 'Ajouté à aujourd’hui.',
  droppedThem: 'C’est abandonné.',

  toastReshuffled: (p) => `↻ ${p.n} ${tache(p.n)} réorganisée${p.n > 1 ? 's' : ''}`,
  toastRemoved: (p, f) => `✓ Retiré : ${f.list(p.items.map(f.name))}`,
  toastAdded: (p) => `✓ ${p.n} ${tache(p.n)} ajoutée${p.n > 1 ? 's' : ''}`,
  toastRenamed: '✓ Renommé',
  toastChatCleared: '✓ Discussion effacée',
  cheer: (p) => variant(CHEERS[p.stage], p.i),
  dayCompleteTitle: 'Journée terminée',
  celebrationMessage: (p) => variant(CELEBRATIONS, p.i)[0],
  celebrationQuote: (p) => variant(CELEBRATIONS, p.i)[1],
  restWell: 'Repose-toi bien',
}
