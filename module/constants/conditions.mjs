// module/constants/conditions.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Реестр Состояний (wdbc-w88h) — раньше одно Состояние описывалось в ЧЕТЫРЁХ
//  независимых списках (схема существа, CONDITIONS_DEF листа, иконки токена,
//  тики по Ходам), и расхождение между ними проходило молча: именно так «В
//  Шоке» (wdbc-1xjx) оказался в схеме и в бою, но не на листе и не на токене.
//
//  Здесь — один источник данных на Состояние: подпись, книжное описание,
//  цвет+SVG иконки, счётчик (нет / уровень / раунды / штуки) и участие в
//  синхронизации с токеном. Всё остальное — схема существа
//  (data/actor/_creature.mjs), CONDITIONS_DEF листа (раньше жил в
//  sheets/sheet-helpers.mjs — расчёт боя не должен импортировать интерфейс),
//  статус-эффекты токена (apps/token-conditions.mjs) и тик «N раундов» по
//  Ходам (combat/condition-ticks.mjs) — строятся ИЗ этого реестра, тем же
//  приёмом, что Навыки строятся из constants/skills.mjs.
//
//  Новое Состояние из книги — одна запись ниже; оно само появится в схеме,
//  на листе, на токене и (если у него счётчик "rounds") в тике по Ходам.
// ════════════════════════════════════════════════════════════════════════════

const COUNTER_SUFFIX = { level: "Level", rounds: "Rounds", count: "Count" };

/**
 * @typedef {object} ConditionDef
 * @property {string} label книжная подпись
 * @property {string} desc  краткое книжное описание (уходит в title тега на листе)
 * @property {string} icon  эмодзи-запасной вариант (если svg почему-то недоступен)
 * @property {string} color цвет иконки (currentColor у svg ниже)
 * @property {string} body  svg-разметка глифа (без обёртки <svg>, currentColor наследуется)
 * @property {("level"|"rounds"|"count")} [counter] тип счётчика; без поля — счётчика нет
 * @property {string} [tickLabel] подпись для карточки тика по Ходам, если отличается от label
 * @property {boolean} [tokenSync] участвует ли в статус-наборе токена (умолчание true)
 * @property {boolean} [mark] МЕТКА, а не книжное Состояние (wdbc-5uae): хранится
 *   не своим флагом, а зеркалит чужой источник (см. rules/condition-mirrors.mjs).
 *   Автор контента такую не накладывает и не снимает — её ставит и снимает своё
 *   действие («объявить Бег», «войти в Ярость»); реестр нужен ей ради иконки на
 *   токене, тега на листе и предиката hasCondition.
 */

/** @type {Record<string, ConditionDef>} */
export const CONDITIONS = {
  bleeding: {
    label: "Кровотечение", icon: "🩸", counter: "level", color: "#ff5a5a",
    desc: "В конце каждого Хода — бросок d10: на 1-5 персонаж получает 1 уровень Обескровливания, на 0 и меньше — умирает. Снимается полудействием, тестом Medicae−10 (−30, если пациент активно действовал в прошлый Ход).",
    body: `<path fill="currentColor" d="M8 1.5C8 1.5 12.5 7 12.5 10.2A4.5 4.5 0 0 1 3.5 10.2C3.5 7 8 1.5 8 1.5Z"/>`
  },
  haemorrhaging: {
    label: "Обескровливание", icon: "💔", counter: "level", color: "#c0392b",
    desc: "За каждый уровень: −1 к тестам на смерть от Кровотечения и −5 ко всем тестам T. Выше 5 (10 у десантников) — раз в минуту тест W+0 или потеря сознания. Снимается по 1 уровню в час.",
    body: `<path fill="currentColor" d="M5.4 2C5.4 2 8.6 5.5 8.6 7.7A3.2 3.2 0 0 1 2.2 7.7C2.2 5.5 5.4 2 5.4 2Z"/>
     <path fill="currentColor" d="M11 6.2C11 6.2 13.6 9 13.6 10.8A2.6 2.6 0 0 1 8.4 10.8C8.4 9 11 6.2 11 6.2Z"/>`
  },
  stunned: {
    label: "Оглушение", icon: "💫", counter: "rounds", color: "#ffcf4d",
    desc: "Не может совершать Действия и Реакции, все атаки по нему получают +20. Не Беспомощен — видит, слышит, говорит с трудом.",
    body: `<g fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="2"/><circle cx="8" cy="8" r="5.2"/></g>`
  },
  fatigued: {
    label: "Усталость", icon: "😓", counter: "level", color: "#6fd6e0", tokenSync: false,
    desc: "−10 на все тесты, кроме T, Inf и Cor, с первого же уровня. При T.b+W.b Усталости персонаж теряет сознание.",
    body: `<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M4 4H11L4 12H11"/>`
  },
  poisoned: {
    label: "Отравление", icon: "☠️", color: "#7fdc5f",
    desc: "Снижает Предел Критического Провала на 10 для всех тестов, кроме T, Inf и Cor. Не касается Пределов Клина/Перегрева стрелкового оружия.",
    body: `<path fill="currentColor" d="M8 2C5.2 2 3 4 3 6.8c0 1.9 1 3 2.2 3.7V12h5.6v-1.5C12 9.8 13 8.7 13 6.8 13 4 10.8 2 8 2Z"/>
     <circle cx="6" cy="6.8" r="1.2" fill="#06140d"/><circle cx="10" cy="6.8" r="1.2" fill="#06140d"/>
     <path stroke="#06140d" stroke-width="1" d="M6.8 12v-1.5M8 12v-1.6M9.2 12v-1.5"/>`
  },
  prone: {
    label: "Повален", icon: "🧎", color: "#9fb4ff",
    desc: "−20 на WS и Dodge(A), +20 на Stealth(A), SPD вдвое, нельзя Бег и Натиск. Стрельба по нему −20, рукопашная — +20. Встать — Полудействие.",
    body: `<circle cx="3.6" cy="9" r="1.8" fill="currentColor"/>
     <path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" d="M5.6 10.6H13M6.2 10.6L9 8"/>`
  },
  helpless: {
    label: "Беспомощный", icon: "🪢", color: "#ff6b6b",
    desc: "Не может совершать Физические действия. Рукопашная и выстрел в упор/в рукопашной по нему автоматически успешны и наносят удвоенный урон. Прочая стрельба получает +30.",
    body: `<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
     <path d="M3 4.5H13M4.5 4.5V11.5M11.5 4.5V11.5"/>
     <path d="M4.5 8H11.5"/></g>
     <circle cx="4.5" cy="4.5" r="1.3" fill="currentColor" stroke="none"/>
     <circle cx="11.5" cy="4.5" r="1.3" fill="currentColor" stroke="none"/>`
  },
  unconscious: {
    label: "Без сознания", icon: "😵", color: "#b6c2cc",
    desc: "Не может совершать Действия и Реакции. Считается Беспомощным, не видит и не слышит окружающих.",
    body: `<path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M3.5 5L6 7.5M6 5L3.5 7.5M10 5L12.5 7.5M12.5 5L10 7.5M5 11.5C7 10 9 10 11 11.5"/>`
  },
  blinded: {
    label: "Ослеплён", icon: "🙈", counter: "rounds", tickLabel: "Ослепление", color: "#cf9fff",
    desc: "Не видит: автопровал BS, −30 на WS и тесты, требующие зрения. Весь незнакомый ландшафт — Трудный, −20 против настоящего Трудного Ландшафта. Все атаки по нему — Незримые.",
    body: `<g fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 8Q8 3 14 8Q8 13 2 8Z"/><circle cx="8" cy="8" r="1.9" fill="currentColor" stroke="none"/></g>
     <path stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M3 13L13 3"/>`
  },
  deafened: {
    label: "Оглох", icon: "🔇", color: "#b6c2cc",
    desc: "Не слышит, автопровал тестов на слух. Не получает эффектов Командования (кроме жестов/телепатии/Ноосферы). −30 на устные социальные тесты и Командование.",
    body: `<path fill="currentColor" d="M3 6.2H5L8 3.2V12.8L5 9.8H3Z"/>
     <path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M10.5 6L14 9.5M14 6L10.5 9.5"/>`
  },
  burning: {
    label: "Горение", icon: "🔥", counter: "level", color: "#ff8a3a",
    desc: "В конце Хода 1d10 E(Fl) урона мимо брони и 1 Усталости при непоглощённом уроне (иначе тест T+0). В начале Хода — тест W+0 или пропуск Хода в панике. Тушится полудействием (себе A−20, другому A+0).",
    body: `<path fill="currentColor" d="M8 1.5C8 1.5 4.2 5 4.2 9A3.8 3.8 0 0 0 11.8 9C11.8 6.2 9.4 5.2 9.4 3.2 8.7 4.2 8 4.7 8 6 8 4.2 8 2.8 8 1.5Z"/>`
  },
  radiation: {
    label: "Радиация", icon: "☢️", counter: "level", color: "#ffe14d",
    desc: "Периодический 1 урон в T от облучения. При накоплении 10/20/30... — тест T+0, провал даёт лучевую болезнь (доп. урон в T каждые 8 часов, лечится Medicae−30).",
    body: `<g fill="currentColor"><path d="M8 8L5.3 3.2A5.5 5.5 0 0 1 10.7 3.2Z"/>
     <path d="M8 8L5.3 3.2A5.5 5.5 0 0 1 10.7 3.2Z" transform="rotate(120 8 8)"/>
     <path d="M8 8L5.3 3.2A5.5 5.5 0 0 1 10.7 3.2Z" transform="rotate(240 8 8)"/>
     <circle cx="8" cy="8" r="1.7" fill="#06140d"/><circle cx="8" cy="8" r="1.1"/></g>`
  },
  hallucinogenic: {
    label: "Галлюцинации", icon: "🌀", counter: "rounds", color: "#c06fff",
    desc: "Провал теста T (обычно −10×X) — галлюцинации на 1 Раунд за Провал, случайный эффект по таблице (может валить с ног, вгонять в Ступор и т.п.).",
    body: `<path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M8 8a1.1 1.1 0 1 1 1.2-1.1A3 3 0 1 1 6 9.9 4.9 4.9 0 1 1 11.6 5.6"/>`
  },
  pinned: {
    label: "Подавление", icon: "📌", color: "#ff9a4d",
    desc: "Тест W+0 (Мораль) под шквальным огнём. Вне укрытия — тратит все действия, чтобы добраться до него, иначе Залегает. В укрытии — только 1 ОД в Ход и −20 на BS. Снимается тестом W+0 в конце Хода.",
    body: `<path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" d="M8 2V9.5M5 6.8L8 9.8L11 6.8M4 13.2H12"/>`
  },
  crippling: {
    label: "Калечение", icon: "🦯", color: "#d8b89a",
    desc: "Оставленные в ране осколки/шипы (свойство оружия Crippling): X непоглощаемого урона того же типа в ту же часть тела каждый раз, когда цель тратит оба ОД на физические действия в Ход. Снимается медицинской помощью или полным исцелением.",
    body: `<g stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"><path d="M4 5.5L11.5 13"/></g>
     <circle cx="3.8" cy="4.8" r="1.7" fill="currentColor"/><circle cx="12" cy="13.5" r="1.7" fill="currentColor"/>
     <path fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" d="M6.6 7.6l1.4-1 -0.8 2 1.6-0.7"/>`
  },
  addicted: {
    label: "Зависимость", icon: "💊", color: "#6fd6ff",
    desc: "Провален тест Зависимости от наркотика/яда. Не удовлетворена в срок — штраф зависимости весь период. Тест на избавление — со штрафом −50 (+10 за каждый выдержанный без него период).",
    body: `<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
     <path d="M2.5 13.5L9 7"/><path d="M7 5L11 9"/><path d="M9.6 3.4L12.6 6.4"/>
     <path d="M2.5 13.5L1.6 14.4"/><path d="M5 11L6.4 12.4"/><path d="M7 9L8.4 10.4"/></g>`
  },
  // Состояние «в Шоке» (стр. 53, «Оправиться от Шока», wdbc-1xjx) — раньше
  // было в схеме и в бою (combat/fear.mjs::rollShockRecovery), но не здесь,
  // поэтому не рисовалось ни на листе, ни на токене и не снималось вручную.
  shocked: {
    label: "В Шоке", icon: "😨", color: "#e8c34d",
    desc: "Провал теста Страха бросает по таблице Шока (стр. 53) — от −10 на все тесты, кроме T, до полной неспособности действовать (степень зависит от результата броска). Оправиться — тест WP+0 в начале каждого своего Хода (тест Морали, провал не снимает эффекты Командования).",
    body: `<path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M9 1.5L4.2 8.5H7.5L6.5 14.5L11.8 6.8H8.2L9 1.5Z"/>`
  },
  // ── Стр. 30-31 (Раны и Урон, «Статусы») ──────────────────────────────────
  dazed: {
    label: "Ступор", icon: "🌀", color: "#c9a8ff",
    desc: "Не может совершать Действия и Реакции, все атаки по нему +20. Не Беспомощен, но не понимает происходящее вокруг. Считается Оглушённой целью для прочих эффектов.",
    body: `<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="5.2"/>
     <path d="M5.8 9.4C6.4 10.2 9.6 10.2 10.2 9.4"/></g>
     <circle cx="5.7" cy="6.3" r="0.9" fill="currentColor" stroke="none"/>
     <circle cx="10.3" cy="6.3" r="0.9" fill="currentColor" stroke="none"/>`
  },
  suffocating: {
    label: "Удушье", icon: "🫁", counter: "rounds", color: "#8fb0c4",
    desc: "Задержка дыхания: T.b минут покоя или T.b×2 Раундов в активных действиях, дальше тест T+0 каждую минуту/Ход или +1 Усталости. Без вздоха — потеря сознания, смерть через T.b Раундов.",
    body: `<path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M3 6.5Q8 3 13 6.5M3 9.5Q8 13 13 9.5"/>
     <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M3.2 3.2L12.8 12.8"/>`
  },
  gangrene: {
    label: "Гангрена", icon: "🟢", color: "#7a8a4d",
    desc: "+1 неснимаемой Усталости, −20 на ментальные действия. Не восстанавливает урон T отдыхом/медитацией; каждые T.b×2 часов — 1d10 урона в T. Лечится операцией (Medicae−30), конечность теряется.",
    body: `<path fill="currentColor" d="M8 2C5.5 2 4 4.5 4 7.2 4 10.5 6 13 8 14.5 10 13 12 10.5 12 7.2 12 4.5 10.5 2 8 2Z" fill-opacity="0.35"/>
     <circle cx="6.6" cy="6.8" r="0.9" fill="currentColor"/><circle cx="9.6" cy="8.2" r="0.7" fill="currentColor"/>
     <circle cx="7.6" cy="10.4" r="0.8" fill="currentColor"/>`
  },
  lostHands: {
    label: "Потеря кистей", icon: "✋", counter: "count", color: "#c99a7a",
    desc: "−20 на все тесты, требующие двух рук. Этой рукой нельзя пользоваться оружием/предметами, кроме крепящихся к запястью.",
    body: `<path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M3 12V6.5M3 12H9M9 12V8.5"/>
     <path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M10.5 4L14.5 12"/>`
  },
  lostArms: {
    label: "Потеря рук", icon: "💪", counter: "count", color: "#c99a7a",
    desc: "Как потеря кисти, но без запястья — нельзя закрепить даже щит, когти или другой предмет.",
    body: `<path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M3.5 3V7.5A3 3 0 0 0 6.3 10.5H9" stroke-dasharray="1.6 1.6"/>
     <path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M10 6L14 13"/>`
  },
  lostFeet: {
    label: "Потеря стоп", icon: "🦶", counter: "count", color: "#c99a7a",
    desc: "SPD уменьшена вдвое (окр. вниз), −20 на тесты Движения. Без обеих стоп нужен бросок Acrobatics−10 просто чтобы ходить.",
    body: `<path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M6 3V8.5H12"/>
     <path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M3.5 10.5L9 13.5"/>`
  },
  lostLegs: {
    label: "Потеря ног", icon: "🦵", counter: "count", color: "#c99a7a",
    desc: "Как потеря стопы, но дополнительно нельзя Уклоняться. Без обеих ног персонаж не может ходить.",
    body: `<path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M7 2.5V7L9.5 10.5" stroke-dasharray="1.6 1.6"/>
     <path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M4 12.5L12.5 9"/>`
  },
  lostEyes: {
    label: "Потеря глаз", icon: "👁️", counter: "count", color: "#cf9fff",
    desc: "−10 на BS и тесты определения расстояний. Угол Караула сужен до 30°. Без обоих глаз персонаж Ослеплён.",
    body: `<path fill="none" stroke="currentColor" stroke-width="1.5" d="M4 8Q8 5.4 12 8"/>
     <path fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" d="M5 9.5L6 8M7.3 10L7.6 8.3M9.6 10L9.3 8.3M11 9.5L10 8"/>`
  },
  // ── Стр. 12 («Борьба») — связаны Захватом ────────────────────────────────
  grappling: {
    label: "Борьба", icon: "🤼", color: "#e08a3a",
    desc: "После успешного Захвата: только действия Борьбы или не-Физические, прочие атаки по обоим +20. Цель не может Уклоняться; атакующий — если не тяжелее/крупнее цели.",
    body: `<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
     <path d="M2.5 5.5C4 4 5.5 4.5 6 6.5S5 10.5 6.5 12.5"/>
     <path d="M13.5 5.5C12 4 10.5 4.5 10 6.5S11 10.5 9.5 12.5"/></g>`
  },
  // ── МЕТКИ (wdbc-5uae) — не книжные Состояния ─────────────────────────────
  //  Всё, что ниже, до этого было невидимым: своё поле схемы (system.inRage)
  //  или флаг актора, без иконки, без тега и без общего способа спросить «а
  //  это сейчас на мне?». Здесь они получают ровно то, чем от Оглушения
  //  отличались — вид на токене и на листе; хранятся по-прежнему там, где
  //  хранились (mark:true, зеркало ведёт rules/condition-mirrors.mjs).
  inRage: {
    label: "Ярость", icon: "😡", color: "#ff4d4d", mark: true,
    desc: "Персонаж в Ярости: пока она держится, работают Черты и Таланты, требующие её. Крестик на теге гасит саму Ярость, а не только тег.",
    body: `<path fill="currentColor" d="M8 1.6C9.1 4 8.4 5.1 7.4 6.2 6.2 7.5 5 8.7 5 10.4a3 3 0 0 0 6 0c0-1.2-.5-2-1-2.9.9.5 1.6 1.4 1.6 2.9a3.6 3.6 0 0 1-7.2 0c0-2.6 2-3.6 3-5.3.6-1 .8-2.2.6-3.5Z"/>`
  },
  running: {
    label: "Бег", icon: "🏃", color: "#7fd6ff", mark: true,
    desc: "Персонаж объявил Бег: по нему −20 стрельбой и +20 в рукопашной, сам он не может атаковать. Снимается в начале его следующего Хода.",
    body: `<circle cx="10.2" cy="3.2" r="1.6" fill="currentColor"/>
     <path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
           d="M10.6 6 7.6 8l1.8 2.2-1 3.4M7.6 8 4.4 7.2M9.4 10.2l3 .9"/>`
  },
  marching: {
    label: "Марш", icon: "🥾", color: "#c9a86a", mark: true,
    desc: "Персонаж в походном Марше (обычном или форсированном). Вид Марша и накопленные штрафы — в подсказке кнопки Марша.",
    body: `<path fill="currentColor" d="M3.4 2.2h2.4c.5 0 .9.4.9.9v5.3l1.9 1c.4.2.6.6.6 1v1.2H3.4Z"/>
     <path fill="currentColor" opacity="0.55" d="M9.2 13.8h4.4v-1c0-.4-.2-.8-.6-1l-1.9-1V9.2h-1.9Z"/>`
  },
  exposedStance: {
    label: "Открытая стойка", icon: "🗡️", color: "#ff9f43", mark: true,
    desc: "Персонаж бил во всю силу и раскрылся: атаки по нему получают бонус до начала его следующего Хода.",
    body: `<path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
           d="M8 2.4v3M8 10.6v3M2.4 8h3M10.6 8h3"/>
     <circle cx="8" cy="8" r="2.1" fill="none" stroke="currentColor" stroke-width="1.4"/>`
  },
  disengaging: {
    label: "Выход из Боя", icon: "↩️", color: "#8fd0ff", mark: true,
    desc: "Персонаж вышел из рукопашной: свободной атаки по нему не будет. Снимается, как только он сдвинулся.",
    body: `<path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
           d="M5.4 3.4H3.2v9.2h2.2"/>
     <path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
           d="M7.4 8h6M11 5.4 13.6 8 11 10.6"/>`
  },
  marked: {
    label: "Отмечен", icon: "🎯", color: "#ff5ac8", mark: true,
    desc: "На персонаже чужая метка (Аватар Резни или Проклятая Метка): по нему бьют с бонусом. Кто пометил — дописано в подсказке из самой метки.",
    body: `<circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="1.4"/>
     <circle cx="8" cy="8" r="1.6" fill="currentColor"/>
     <path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"
           d="M8 1.4v1.8M8 12.8v1.8M1.4 8h1.8M12.8 8h1.8"/>`
  },
  // Поклон Публике живёт ОТДЕЛЬНО от «Отмечен» (wdbc-5uae.2): его флаг лежит
  // на ИСПОЛНИТЕЛЕ поклона, а не на том, кому поклонились, — под «на мне чужая
  // метка» показывался тот, кто пометил ДРУГИХ.
  bowedToAudience: {
    label: "Поклон Публике", icon: "🎭", color: "#ffc95a", mark: true,
    desc: "Персонаж поклонился публике и наметил себе цели: по ним он бьёт с бонусом. Сколько целей и какой бонус — в подсказке.",
    body: `<path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"
           d="M3.2 6.2c0-2.2 2.1-3.8 4.8-3.8s4.8 1.6 4.8 3.8c0 3.4-2.4 6-4.8 7.4C5.6 12.2 3.2 9.6 3.2 6.2Z"/>
     <circle cx="6.2" cy="6.2" r="0.9" fill="currentColor"/><circle cx="9.8" cy="6.2" r="0.9" fill="currentColor"/>
     <path fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" d="M6 9.2c1.3 1 2.7 1 4 0"/>`
  },
  shieldUp: {
    label: "Щит поднят", icon: "🛡️", color: "#9fe8b0", mark: true,
    desc: "Хотя бы один щит в руках поднят: работает его защита. Опускается кнопкой «Щит поднят» у оружия на вкладке БОЙ — крестика на теге нет, потому что щитов может быть два, и тег не знает, какой опускать.",
    body: `<path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"
           d="M8 1.8 3 3.6v4.2c0 3 2.1 5 5 6.4 2.9-1.4 5-3.4 5-6.4V3.6Z"/>`
  },
  dreadWailFeared: {
    label: "Устрашён", icon: "😱", color: "#b48cff", mark: true,
    desc: "Грозный Вопль: Рейтинг Страха 2 до конца боя. Метка информационная — в производный Рейтинг Страха не входит, ГМ учитывает её сам.",
    body: `<path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
           d="M8 2.2c-3 0-5.2 2.2-5.2 5 0 1.9 1 3.2 2.2 4v2.4h6V11.2c1.2-.8 2.2-2.1 2.2-4 0-2.8-2.2-5-5.2-5Z"/>
     <circle cx="6.1" cy="7" r="1" fill="currentColor"/><circle cx="9.9" cy="7" r="1" fill="currentColor"/>
     <path fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" d="M6.6 10.4h2.8"/>`
  },
  seesOnlyCaster: {
    label: "Заворожён", icon: "🌀", color: "#ff8ad6", mark: true,
    desc: "Блистательные Одеяния: до начала следующего Хода носителя персонаж видит только его, считая всех остальных невидимыми.",
    body: `<circle cx="8" cy="8" r="5.2" fill="none" stroke="currentColor" stroke-width="1.4"/>
     <circle cx="8" cy="8" r="2.4" fill="none" stroke="currentColor" stroke-width="1.2"/>
     <circle cx="8" cy="8" r="0.9" fill="currentColor"/>`
  },
  justTheLight: {
    label: "Лишь Свет", icon: "✨", color: "#a8ffe8", mark: true,
    desc: "Весь прошлый Ход ушёл на движение: колдовской щит-дефлектор A.b×3/−, неперегружаемый. Держится до конца следующего Хода.",
    body: `<path fill="currentColor" d="M8 1.6 9.3 6 13.7 7.3 9.3 8.6 8 13 6.7 8.6 2.3 7.3 6.7 6Z"/>
     <path fill="currentColor" opacity="0.6" d="M12.4 10.2l.5 1.6 1.6.5-1.6.5-.5 1.6-.5-1.6-1.6-.5 1.6-.5Z"/>`
  },
  radiationSickness: {
    label: "Лучевая болезнь", icon: "☢️", color: "#e8e04d", mark: true,
    desc: "Осложнение Радиации: набрана доза кратная 10 и провален тест T+0. Отдельное от самой Радиации длительное последствие.",
    body: `<circle cx="8" cy="8" r="1.6" fill="currentColor"/>
     <path fill="currentColor" d="M8 1.6a6.4 6.4 0 0 1 5.5 3.2l-3.1 1.8A2.8 2.8 0 0 0 8 5.2Z"/>
     <path fill="currentColor" d="M13.5 11.2A6.4 6.4 0 0 1 8 14.4v-3.6a2.8 2.8 0 0 0 2.4-1.4Z"/>
     <path fill="currentColor" d="M2.5 11.2A6.4 6.4 0 0 0 8 14.4v-3.6a2.8 2.8 0 0 1-2.4-1.4Z" transform="rotate(180 5.25 12.6)"/>`
  },
  // Свойство оружия Вызов/Challenge (X), wdbc-2xku: блокирует «Выход из Боя».
  challenged: {
    label: "Вызван", icon: "⚔️", color: "#ff5a5a",
    desc: "Свойство оружия Вызов (Challenge X): нельзя добровольно выйти из рукопашной, пока наложено — кроме уклонения от атаки по площади (решает ГМ).",
    body: `<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
     <path d="M2.5 2.5L13.5 13.5M4 2.5L2.5 4M13.5 4L12 2.5"/>
     <path d="M13.5 2.5L2.5 13.5M12 13.5L13.5 12M2.5 12L4 13.5"/></g>`
  }
};

/** camelCase → kebab-case, для css-класса тега (cond-lost-hands из lostHands). */
function kebab(key) {
  return key.replace(/([A-Z])/g, "-$1").toLowerCase();
}

/** Имя поля-счётчика (напр. "bleedingLevel") или null, если у Состояния его нет. */
export function conditionLevelField(key) {
  const suffix = COUNTER_SUFFIX[CONDITIONS[key]?.counter];
  return suffix ? key + suffix : null;
}

/** Готовый HTML-глиф состояния (inline svg в цветной обёртке). */
export function condIconHTML(key, size = 16) {
  const c = CONDITIONS[key];
  if (!c) return "";
  return `<span class="wh-cond-ico" style="color:${c.color};width:${size}px;height:${size}px;">`
       + `<svg viewBox="0 0 16 16" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">${c.body}</svg>`
       + `</span>`;
}

/** Все ключи Состояний, в книжном порядке — схема существа строит поля из этого списка. */
export const CONDITION_KEYS = Object.keys(CONDITIONS);

/**
 * Ключи МЕТОК (mark:true, wdbc-5uae) — не книжные Состояния: хранятся не своим
 * флагом, а зеркалят чужой источник. Автор контента их не накладывает, поэтому
 * дропдаун Конструктора и диалог «Добавить состояние» их отсеивают, а иконка на
 * токене и тег на листе — показывают.
 */
export const CONDITION_MARK_KEYS = Object.entries(CONDITIONS)
  .filter(([, c]) => c.mark).map(([key]) => key);

/**
 * Ключи, у которых есть СВОЁ хранимое поле в схеме существа. Метки сюда не
 * входят намеренно: они целиком производные (считаются из чужого источника на
 * каждом пересчёте, rules/character.mjs), и хранить их — значит завести второе
 * место правды, ровно то, от чего этот шаг и уходит. Схема
 * (data/actor/_creature.mjs) строится из ЭТОГО списка, не из CONDITION_KEYS.
 */
export const CONDITION_STORED_KEYS = Object.entries(CONDITIONS)
  .filter(([, c]) => !c.mark).map(([key]) => key);

/** Метка ли это (а не книжное Состояние). */
export const isConditionMark = (key) => !!CONDITIONS[key]?.mark;

/** key → суффикс счётчика ("Level"/"Rounds"/"Count") — для схемы (data/actor/_creature.mjs). */
export const CONDITION_COUNTERS = Object.fromEntries(
  Object.entries(CONDITIONS)
    .filter(([, c]) => c.counter)
    .map(([key, c]) => [key, COUNTER_SUFFIX[c.counter]])
);

/** Форма, которую ждёт лист/эффекты (было sheets/sheet-helpers.mjs::CONDITIONS_DEF). */
export const CONDITIONS_DEF = Object.fromEntries(
  Object.entries(CONDITIONS).map(([key, c]) => {
    const levelField = conditionLevelField(key);
    return [key, {
      label: c.label, icon: c.icon, hasLevel: !!levelField, levelField,
      css: `cond-${kebab(key)}`, desc: c.desc,
      svg: condIconHTML(key), color: c.color
    }];
  })
);

/** Форма {color, body} на ключ (было constants/condition-icons.mjs::CONDITION_ICONS) — нужна token-conditions.mjs::statusIconUri, которому нужен «сырой» body без обёртки condIconHTML. */
export const CONDITION_ICONS = Object.fromEntries(
  Object.entries(CONDITIONS).map(([key, c]) => [key, { color: c.color, body: c.body }])
);

/** Состояния «N раундов», тикающие в начале Хода их обладателя (было combat/condition-ticks.mjs::ROUND_CONDITIONS). */
export const ROUND_TICK_CONDITIONS = Object.entries(CONDITIONS)
  .filter(([, c]) => c.counter === "rounds")
  .map(([key, c]) => ({ key, field: key + "Rounds", label: c.tickLabel || c.label }));

/** Ключи, исключённые из статус-набора токена (было apps/token-conditions.mjs::TOKEN_SYNC_EXCLUDE). */
export const TOKEN_SYNC_EXCLUDE = new Set(
  Object.entries(CONDITIONS).filter(([, c]) => c.tokenSync === false).map(([key]) => key)
);
