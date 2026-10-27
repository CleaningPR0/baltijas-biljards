// Default texts of the "Rules" page (LV / RU / EN). Editable later in the admin panel (tab "Правила").
// Body format: lines starting with "- " become bullets, other lines become paragraphs.
// Sections with an empty body and no link are hidden on the public page until filled in.
const t = (lv, ru, en) => ({ lv, ru, en });

module.exports = [
  {
    id: 'disc', link: '',
    title: t('Disciplīnas', 'Дисциплины', 'Disciplines'),
    body: t(
`Mūsu klubā spēlē trīs galvenos biljarda veidus:
- Piramīda: brīvā, kombinētā un dinamiskā piramīda, kā arī daudzcīņa.
- Pūls: 8 bumbas, 9 bumbas, 10 bumbas un 14.1 nepārtrauktā spēle.
- Snukers: klasiskais snukers ar 15 sarkanajām un 6 krāsainajām bumbām.
Konkrētā turnīra disciplīna vienmēr norādīta turnīra nolikumā.`,
`В клубе играют в три основных вида бильярда:
- Пирамида: свободная, комбинированная и динамичная пирамида, а также многоборье.
- Пул: 8 шаров, 9 шаров, 10 шаров и 14.1 «в одну партию».
- Снукер: классический снукер с 15 красными и 6 цветными шарами.
Дисциплина конкретного турнира всегда указана в положении о турнире.`,
`The club offers three main kinds of billiards:
- Pyramid: free, combined and dynamic pyramid, plus the all-around (multi-discipline) event.
- Pool: 8-ball, 9-ball, 10-ball and 14.1 continuous.
- Snooker: classic snooker with 15 reds and 6 colours.
The discipline of a given tournament is always stated in its regulations.`)
  },
  {
    id: 'pyr', link: '',
    title: t('Piramīdas noteikumi', 'Правила пирамиды', 'Pyramid rules'),
    body: t(
`Īss atgādinājums. Oficiālie noteikumi — pie tiesneša vai klubā.
- Spēlē 12 pēdu galdā ar 15 mērķa bumbām un bitu, bumbas diametrs 68 mm.
- Bumbas saliek trijstūrī, spēle sākas ar sitienu pa piramīdu.
- Uzvar tas, kurš pirmais iesit noteikto bumbu skaitu (parasti 8).
- Kļūda (fouls): bita iešana kabatā, bumba ārpus galda vai nepareizs sitiens — gājiens pāriet pretiniekam.
- Precīzus noteikumus nosaka izvēlētā disciplīna (brīvā, kombinētā, dinamiskā, daudzcīņa).`,
`Краткая памятка. Официальный текст правил — у судьи или в клубе.
- Играют на столе 12 футов, 15 прицельных шаров и биток, диаметр шаров 68 мм.
- Шары ставятся треугольником, партия начинается с разбоя пирамиды.
- Побеждает тот, кто первым забьёт нужное число шаров (обычно 8).
- Фол: биток в лузе, шар за бортом или неправильный удар — ход переходит сопернику.
- Точные правила зависят от выбранной дисциплины (свободная, комбинированная, динамичная, многоборье).`,
`A short reminder. The official rules are available from the referee or at the club.
- Played on a 12 ft table with 15 object balls and a cue ball, ball diameter 68 mm.
- Balls are racked in a triangle and the game starts with a break.
- The winner is the first to pocket the required number of balls (usually 8).
- Foul: cue ball pocketed, ball off the table or a wrong stroke — the turn passes to the opponent.
- Exact rules depend on the chosen discipline (free, combined, dynamic, all-around).`)
  },
  {
    id: 'pool', link: '',
    title: t('Pūla noteikumi', 'Правила пула', 'Pool rules'),
    body: t(
`Īss atgādinājums. Oficiālie noteikumi — pie tiesneša vai klubā.
- 8 bumbas: 15 bumbas — vesels (1–7) un svītrains (9–15) komplekts un melnā 8. Jāiesit sava grupa, tad 8. bumba.
- 9 bumbas: bumbas 1–9, vienmēr jātrāpa pa mazāko numuru; uzvar tas, kurš likumīgi iesit 9. bumbu.
- 10 bumbas: kā 9 bumbas, bet kabata jānosauc.
- 14.1: katra iesistā bumba ir 1 punkts, spēlē līdz noteiktam punktu skaitam.
- Pēc kļūdas pretinieks drīkst novietot bitu jebkur uz galda.`,
`Краткая памятка. Официальный текст правил — у судьи или в клубе.
- 8 шаров: 15 шаров — «цельные» (1–7), «полосатые» (9–15) и чёрный 8. Нужно забить свою группу, затем 8-й шар.
- 9 шаров: шары 1–9, всегда нужно попасть по наименьшему номеру; побеждает тот, кто легально забил 9-й.
- 10 шаров: как 9 шаров, но лузу нужно называть.
- 14.1: каждый забитый шар — 1 очко, игра до заранее оговорённого числа очков.
- После фола соперник ставит биток в любое место стола.`,
`A short reminder. The official rules are available from the referee or at the club.
- 8-ball: 15 balls — solids (1–7), stripes (9–15) and the black 8. Pocket your group, then the 8.
- 9-ball: balls 1–9, you must always hit the lowest number first; whoever legally pockets the 9 wins.
- 10-ball: like 9-ball, but the pocket must be called.
- 14.1: every pocketed ball is 1 point, the game is played to an agreed number of points.
- After a foul the opponent places the cue ball anywhere on the table.`)
  },
  {
    id: 'snooker', link: '',
    title: t('Snukera noteikumi', 'Правила снукера', 'Snooker rules'),
    body: t(
`Īss atgādinājums. Oficiālie noteikumi — pie tiesneša vai klubā.
- 22 bumbas: 15 sarkanās (1 punkts), dzeltenā 2, zaļā 3, brūnā 4, zilā 5, rozā 6, melnā 7 un baltā bita bumba.
- Gājiens: vispirms sarkanā, tad jebkura krāsainā (tā tiek izcelta atpakaļ), un tā tālāk.
- Kad sarkanās beigušās, krāsainās iesit augošā secībā no dzeltenās līdz melnajai.
- Kļūda (fouls): vismaz 4 punkti pretiniekam.
- Freimu uzvar tas, kuram vairāk punktu.`,
`Краткая памятка. Официальный текст правил — у судьи или в клубе.
- 22 шара: 15 красных (1 очко), жёлтый 2, зелёный 3, коричневый 4, синий 5, розовый 6, чёрный 7 и белый биток.
- Очередность: сначала красный, затем любой цветной (он возвращается на стол), и так далее.
- Когда красные закончились, цветные забиваются по возрастанию — от жёлтого до чёрного.
- Фол: минимум 4 очка в пользу соперника.
- Фрейм выигрывает тот, у кого больше очков.`,
`A short reminder. The official rules are available from the referee or at the club.
- 22 balls: 15 reds (1 point), yellow 2, green 3, brown 4, blue 5, pink 6, black 7 and the white cue ball.
- Order of play: a red first, then any colour (it is re-spotted), and so on.
- When the reds are gone, the colours are pocketed in ascending order, yellow to black.
- Foul: at least 4 points to the opponent.
- The frame is won by the player with more points.`)
  },
  {
    id: 'ekp', link: '',
    title: t('EKP noteikumi', 'Правила ЕКП', 'EKP rules'),
    body: t('', '', '')
  },
  {
    id: 'mkp', link: '',
    title: t('MKP noteikumi', 'Правила МКП', 'MKP rules'),
    body: t('', '', '')
  },
];
