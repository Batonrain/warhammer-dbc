// ════════════════════════════════════════════════════════════════════════
//  Библиотека брони Азуриан (Аэльдари) для компендиума «Броня — DBC».
//  Папка «Азуриане» → «Ячеистая» / «Аспектная».
//  Свойства — строкой `props`, парсятся в массив ключей system.properties
//  (реестр ARMOR_PROPERTIES). Рейтинги/группы/неузнанное — памяткой в special.
//  Вся эльдарская броня считается Силовой (для модификаций/систем) и Ячеистой
//  (в расчёте правил урона/сочленений).
// ════════════════════════════════════════════════════════════════════════

// Имя свойства брони → ключ реестра ARMOR_PROPERTIES.
const ARMOR_ALIASES = {
  "Protective": "protective", "Sealed": "sealed", "Void": "void", "Stealthed": "stealthed",
  "Hard": "hard", "Heavy": "heavy", "Cloak": "cloak", "Undersuit": "undersuit",
  "Primitive": "primitive", "Soft": "soft", "Gorget": "gorget", "Open": "open",
  "Aspect": "aspect", "Runes of Protection": "runesOfProtection",
  "Wraithbone Regeneration": "wraithboneRegen", "Special": "special",
  "Conductive": "conductive", "Rods": "rods", "Blinders": "blinders", "Flak": "flak"
};

// Строка свойств брони → { properties:[ключи], notes:[...] }
function parseArmorProps(str) {
  if (!str) return { properties: [], notes: [], ratings: {} };
  const tokens = []; let depth = 0, cur = "";
  for (const ch of str) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { tokens.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  if (cur.trim()) tokens.push(cur.trim());

  const properties = [], notes = [], ratings = {};
  for (const tok of tokens) {
    if (!tok) continue;
    const m = tok.match(/^(.*?)\s*\((.*)\)\s*$/);
    let name = tok, rating = null;
    if (m) { name = m[1].trim(); rating = m[2].trim(); }
    const key = ARMOR_ALIASES[name];
    if (!key) { notes.push(tok); continue; }
    if (!properties.includes(key)) properties.push(key);
    if (rating != null) {
      // Числовой рейтинг (Protective 2, Gorget 8, Blinders 120) кладём в
      // машинное поле — раньше он уходил только текстом и ни на что не влиял.
      const n = Number(rating);
      if (Number.isFinite(n) && String(n) === rating.trim()) ratings[key] = n;
      else notes.push(`${name} (${rating})`);
    }
  }
  return { properties, notes, ratings };
}

// Броня. o: {at, ap:[h,b,a,l], maxA, sb(+S), wb(+W), props, wt, av, note}
function A(folder, name, o) {
  const { properties, notes, ratings } = parseArmorProps(o.props || "");
  if (o.note) notes.push(o.note);
  const ap = o.ap || [0, 0, 0, 0];
  return {
    folder, name, type: "armor",
    system: {
      armorType: o.at || "power",
      // Друкхарийская броня считается по своей таблице Качества (5 уровней,
      // Poor даёт Сочленения, Good/Best/Arts дают +1/+2/+3 AP всем частям).
      drukhari: folder?.[0] === "Друкхари",
      head: ap[0] || 0, body: ap[1] || 0,
      leftArm: ap[2] || 0, rightArm: ap[2] || 0,
      leftLeg: ap[3] || 0, rightLeg: ap[3] || 0,
      maxAgility: o.maxA ?? 100, strengthBonus: o.sb ?? 0, wpBonus: o.wb ?? 0,
      quality: "common", availability: o.av ?? 0, weight: o.wt ?? 0,
      properties, propRatings: ratings, special: notes.join(". "),
      // Второй профиль AP: сверхброня терминаторов (атаки с Pen не выше этого
      // уровня режут урон вдвое) или защита задней арки у Мк III (стр. 234-235).
      ...(o.ap2 ? { apSecond: {
        head: o.ap2[0] || 0, body: o.ap2[1] || 0,
        arms: o.ap2[2] || 0, legs: o.ap2[3] || 0,
        kind: o.ap2kind || "super"
      } } : {})
    }
  };
}

const MESH = ["Азуриане", "Ячеистая"];
const ASP  = ["Азуриане", "Аспектная"];
const DARM = ["Друкхари", "Броня"];
const IMP_APRIM  = ["Имперское", "Броня", "Примитивная"];
const IMP_AIMPR  = ["Имперское", "Броня", "Импровизированная"];
const IMP_AFLAK  = ["Имперское", "Броня", "Флак"];
const IMP_ACARA  = ["Имперское", "Броня", "Панцирная"];
const IMP_AMESH  = ["Имперское", "Броня", "Ячеистая"];
const IMP_AOTHER = ["Имперское", "Броня", "Прочая"];
const IMP_APOW   = ["Имперское", "Броня", "Силовая"];
const AST_APOW   = ["Астартес", "Броня", "Силовая"];
const AST_TERM   = ["Астартес", "Броня", "Терминаторская"];
const HQ_ARM     = ["Арлекины", "Снаряжение"];

export const AELDARI_ARMOR = [

  // ─────────────────────────── ЯЧЕИСТАЯ ───────────────────────────
  A(MESH, "Эльдарская Рейдерская Броня", { ap:[4,4,4,4], props:"Sealed, Wraithbone Regeneration", wt:2, av:0, note:"Безоружная атака может считаться Best.Q Мононожом; починка +30." }),
  A(MESH, "Броня Стража", { ap:[4,5,4,4], props:"Protective (4), Sealed, Stealthed, Void, Wraithbone Regeneration", wt:3, av:1, note:"Визор, ретинальный дисплей, когитатор; моды Osmotic Life Sustainer, Bio-Monitor; лёгкий ранец." }),
  A(MESH, "Рейнджерская Плетёная Броня", { ap:[4,4,4,4], props:"Aspect (Рейнджеры), Protective (2), Stealthed, Undersuit", wt:2, av:2, note:"Best.Q Хамелеолиновый Плащ, фото-визор, охотничий визор, Best.Q ребризер." }),
  A(MESH, "Эльдарская Пустотная Броня", { ap:[5,5,5,5], props:"Protective (4), Sealed, Stealthed, Void, Wraithbone Regeneration", wt:4, av:2, note:"Ретинальный дисплей, охотничий визор; моды Thermal, Cooler, Osmotic Life Sustainer, Bio-Monitor; в вакууме/слабой гравитации Flyer (12); лёгкий ранец." }),
  A(MESH, "Рунная Броня", { ap:[6,7,6,6], props:"Aspect (Видящие), Protective (6), Runes of Protection, Sealed, Stealthed, Void, Wraithbone Regeneration", wt:3, av:3, note:"AP работает против варп-урона. +2 бPR к Runes of Protection. Усиления поглощения по свойствам оружия (см. справочник). Специализации: Варлока/Духовидца/Провидца/Певца Кости." }),
  A(MESH, "Плащ Теней", { ap:[0,1,1,1], props:"Aspect (Видящие), Cloak, Stealthed, Undersuit", wt:1, av:3, note:"Видящий (Следующий+): до 3 раз/бой Свободным действием — психосила Крепость Туманов (бPR 6)." }),
  A(MESH, "Роба Чемпиона", { ap:[0,1,1,1], props:"Aspect (Видящие), Cloak, Stealthed, Undersuit", wt:3, av:3, note:"+10 атака, +20 командование. 1 тPR → 2 аблативных AP (психощит, слабеет 1d5+1/раунд)." }),
  A(MESH, "Мантия Смеющегося Бога", { ap:[0,0,0,0], props:"Protective (A.b), Stealthed", wt:0, av:4, note:"AP = A.b−4 по всем зонам. +2 к максимуму Очков Судьбы; всегда возвращается владельцу." }),
  A(MESH, "Шлем Арасты", { ap:[6,0,0,0], props:"Special", wt:0, av:4, note:"Шлем. Трейт Fear (2/+1). Встраивается в любую броню." }),
  A(MESH, "Броня Провидца", { ap:[2,2,2,2], props:"Aspect (Провидцы/Путевидцы), Protective (4), Runes of Protection, Stealthed", wt:1, av:4, note:"+10 манифестация, +20 сопротивление психосилам/одержимости (×2 против Слаанеш), +30 на Прорицание/ритуалы." }),
  A(MESH, "Броня Эльданеша", { ap:[6,6,6,6], props:"Protective (6), Runes of Protection, Sealed, Stealthed, Void, Wraithbone Regeneration", wt:5, av:4, note:"Как Рунная. В начале хода: до бПР в Runes of Protection → удваивает их." }),
  A(MESH, "Броня Фортуны", { ap:[6,6,6,6], props:"Protective (6), Runes of Protection, Sealed, Stealthed, Void, Wraithbone Regeneration", wt:5, av:4, note:"Как Рунная. Колдовской Щит-Дефлектор 1–10+PR×5/−; можно передать союзнику (себе остаётся 1–25/−)." }),
  A(MESH, "Броня Азуриана", { ap:[5,5,5,5], props:"Protective (6), Runes of Protection, Sealed, Stealthed, Void, Wraithbone Regeneration", wt:5, av:4, note:"Как Рунная. Темпормортис: 5 зарядов (1/час) — взрыв 9 м замедляет врагов на 2 раунда." }),
  A(MESH, "Провидение", { ap:[6,0,0,0], props:"Aspect (Видящие), Runes of Protection, Special", wt:0, av:5, note:"Шлем. Best.Q Стекло Души, Good.Q Призрачный Шлем. Раз/бой — Стазис 3 раунда: неуязвим, психосилы за полудействие + Цикл (6), без лимита." }),
  A(MESH, "Мантия Малан’тай", { ap:[2,2,2,2], props:"Aspect (Видящие), Runes of Protection, Special", wt:0, av:5, note:"Шлем. 4 камня душ + Best.Q Призрачный Шлем. Раз/бой — провидцы из камней манифестируют по 2 психосилы." }),

  // ─────────────────────────── АСПЕКТНАЯ ───────────────────────────
  A(ASP, "Броня Воющей Баньши", { at:"aspect", ap:[6,7,6,6], props:"Aspect (Воющие Баньши), Protective (5), Sealed, Void, Wraithbone Regeneration", wt:5, av:4, note:"Встроенный Шлем Баньши (активация — свободное действие)." }),
  A(ASP, "Броня Варп-Паука", { at:"aspect", ap:[7,8,7,7], maxA:45, wb:5, props:"Aspect (Варп-Пауки), Hard, Protective (7), Sealed, Void, Wraithbone Regeneration", wt:25, av:4, note:"Multiple Arms (+2) с Best.Q Мономечами; генератор прыжков варп-пауков." }),
  A(ASP, "Броня Жалящего Скорпиона", { at:"aspect", ap:[7,8,7,7], maxA:65, wb:5, sb:10, props:"Aspect (Жалящие Скорпионы), Hard, Protective (7), Sealed, Stealthed, Void, Wraithbone Regeneration", wt:8, av:4, note:"Good.Q хамелеоновый плащ; встроены мандибластеры." }),
  A(ASP, "Броня Зловещего Мстителя", { at:"aspect", ap:[6,7,6,6], props:"Aspect (Зловещие Мстители), Protective (5), Sealed, Void, Wraithbone Regeneration", wt:6, av:4, note:"Встроенный сигнум-целеуказатель (распространяет прицел на отмеченные цели)." }),
  A(ASP, "Броня Огненного Дракона", { at:"aspect", ap:[7,8,7,7], maxA:60, wb:10, props:"Aspect (Огненные Драконы), Hard, Protective (7), Sealed, Stealthed, Void, Wraithbone Regeneration", wt:15, av:4 }),
  A(ASP, "Броня Пикирующего Ястреба", { at:"aspect", ap:[5,6,5,5], props:"Aspect (Пикирующие Ястребы), Protective (5), Sealed, Void, Wraithbone Regeneration", wt:5, av:4, note:"Встроенные спектральные крылья." }),
  A(ASP, "Броня Сияющего Копья", { at:"aspect", ap:[7,8,7,7], maxA:50, wb:10, props:"Aspect (Сияющие Копья), Hard, Protective (7), Sealed, Stealthed, Void, Wraithbone Regeneration", wt:15, av:4, note:"+20 на управление гравициклами." }),
  A(ASP, "Броня Тёмного Жнеца", { at:"aspect", ap:[8,8,8,8], maxA:45, wb:10, props:"Aspect (Тёмные Жнецы), Hard, Protective (8), Sealed, Stealthed, Void, Wraithbone Regeneration", wt:25, av:4, note:"Без движения: Auto-Stabilized и Sturdy; дальномер тёмных жнецов." }),
  A(ASP, "Броня Теневого Фантома", { at:"aspect", ap:[7,8,7,7], wb:5, props:"Aspect (Теневые Фантомы), Hard, Protective (7), Sealed, Stealthed, Void, Wraithbone Regeneration", wt:10, av:5, note:"Спектральные крылья и голо-поле R3." }),
  A(ASP, "Броня Экзарха", { at:"aspect", ap:[0,0,0,0], wb:5, props:"Aspect (Экзархи)", wt:0, av:5, note:"+1/+1/+1/+1 AP к носимой аспектной броне. Слияние с душами камня (−30 пока не слился). Считается любой аспектной бронёй." }),
  A(ASP, "Броня Горху", { at:"aspect", ap:[7,8,7,7], wb:15, sb:10, props:"Protective (8), Sealed, Void, Wraithbone Regeneration", wt:10, av:5, note:"Regeneration (7), Undying + таланты; нельзя снять; проклятие забвения навыков (см. справочник)." }),
  A(ASP, "Броня Идранель", { at:"aspect", ap:[6,7,6,6], props:"Aspect (Видящие), Protective (6), Runes of Protection, Sealed, Stealthed, Void, Wraithbone Regeneration", wt:3, av:5, note:"Как Рунная. Психосилы Проблеск и Прекогнитивное Уклонение (PR 8)." }),
  A(ASP, "Три Луны", { at:"aspect", ap:[6,7,6,6], props:"Aspect (Видящие), Protective (6), Runes of Protection, Sealed, Stealthed, Void, Wraithbone Regeneration", wt:4, av:5, note:"Как Рунная. В начале раунда — 2d6, выбор эффекта Трёх Лун (благословения/рок)." }),
  A(ASP, "Пластина Стража Душ", { at:"aspect", ap:[0,5,5,5], props:"Protective (5), Sealed, Void, Wraithbone Regeneration", wt:5, av:5, note:"+10 WS/BS на тесты, +10 S/A на атакующие. Снимает форс. «ничью» против Unnatural." }),
  A(ASP, "Шлем Стража Кселльтона", { at:"aspect", ap:[6,0,0,0], props:"Special", wt:0, av:5, note:"Шлем. Психокостяные конструкты в 100 м видят носителя сквозь преграды; Fanatic к нему, ×2 SPD. Берёт свойства носимой брони." }),
  A(ASP, "Призрачный Шлем Алишазиера", { at:"aspect", ap:[6,0,0,0], props:"Runes of Protection, Special", wt:0, av:5, note:"Шлем. Best.Q Призрачный Шлем с камнем душ Алишазиеры (бПР 9, хар-ки 50, W 70) — советы/манифестация." }),

  // ─────────────────────────── ДРУКХАРИ ───────────────────────────
  A(DARM, "Туника из Ксеношкуры", { at:"mesh", ap:[0,0,0,3], props:"Soft", wt:2, av:-1, note:"Одежда Мандрагор. Варианты по шкуре: человек (1 AP, R−3), бритвокрыл (2 AP, Spikes Pen 3 Razor Sharp), адский паук (3 AP, Spikes Toxic 1), Когтистый Дьявол (4 AP, Flak), Кхимера (2 AP, +2 vs Warp Weapon), Мегазавр (6 AP, Flak)." }),
  A(DARM, "Ксеноячеистая Броня", { at:"mesh", ap:[4,4,4,4], props:"Flak, Sealed, Stealthed", wt:3, av:-1, note:"Flak — против Осколочного (Best.Q) и Стаб (Good.Q) оружия." }),
  A(DARM, "Кабалитская Броня", { at:"power", ap:[4,5,4,4], props:"Protective (4), Sealed, Stealthed, Void", wt:5, av:-1, note:"Затвердевает по приказу; Хим-Инжектор стимуляторов; крепится к нервам (минута надеть/снять). Моды Spikes, Foam Sealant, Vox Link, плечевой когитатор. Не-Друкхари: W+0/T+0 или 1d5 усталости/урона в W." }),
  A(DARM, "Ведьмин Костюм", { at:"mesh", ap:[0,3,3,3], props:"", wt:1, av:0, note:"Передняя арка 180° — этот профиль; задняя 180° — –/2/2/2. Под него попадает броня Геллионов/Разбойников. Гладиатор: считается 2 AP и не закрывает всё тело." }),
  A(DARM, "Затвердевшая Кожа", { at:"mesh", ap:[0,0,0,0], wb:5, props:"Special", wt:3, av:1, note:"AP = T.b носителя (для не-Друкхари — 3/4/3/3). W +5." }),
  A(DARM, "Психокостяной Тканый Костюм", { at:"power", ap:[4,5,5,5], wb:5, props:"Sealed, Stealthed", wt:1.3, av:2, note:"W +5. Встроенные поля (по качеству): Защитное (купол 1–25/5), Рассеивающее (дым 2 м, Nimble→20), Амортизирующее (Good.Q, Flak), Подавляющее (Best.Q, Blunted 0, −10 психотестам). Био-монитор, вокс, ретин. дисплей." }),
  A(DARM, "Призрачная Броня", { at:"power", ap:[6,7,6,6], props:"Protective (4), Sealed, Void", wt:2.5, av:3, note:"Тяжёлый доспех (силовой для модов). Поля: Защитное (1–35/1, перегрузка → Blinding 2), Рассеивающее (Nimble→30), Амортизирующее (Good.Q, Flak + Protective 4), Подавляющее (Best.Q, Blunted 1, −20 психотестам)." }),
  A(DARM, "Латы Инкуба", { at:"power", ap:[10,12,10,10], maxA:65, wb:5, sb:10, props:"Hard, Protective (6), Sealed, Void", wt:8, av:4, note:"W +5, S +10. Неперегружаемый Щит-Дефлектор 1–20/–. Как Кабалитская Броня. Иммунитет к радиации/давлению. Боевой костюм инкуба: R−1, AP −5 во всех частях." }),

  // ─────────────────────────── ИМПЕРСКОЕ: ПРИМИТИВНАЯ ───────────────────────────
  A(IMP_APRIM, "Выделанная Кожа", { at:"simple", ap:[0,1,1,1], props:"Primitive, Soft, Undersuit", wt:2, av:-3 }),
  A(IMP_APRIM, "Меха", { at:"simple", ap:[0,2,2,0], props:"Primitive, Soft", wt:4, av:-3 }),
  A(IMP_APRIM, "Стёганка", { at:"simple", ap:[0,3,2,2], maxA:50, props:"Primitive, Soft, Undersuit", wt:4.5, av:-2 }),
  A(IMP_APRIM, "Стальные Колодки", { at:"simple", ap:[0,0,4,4], props:"Conductive, Hard, Primitive, Rods", wt:2, av:-2 }),
  A(IMP_APRIM, "Кольчужный Капюшон", { at:"simple", ap:[4,0,0,0], props:"Conductive, Open, Primitive, Soft", wt:1, av:-1 }),
  A(IMP_APRIM, "Кольчужный Жилет", { at:"simple", ap:[0,4,0,0], maxA:45, props:"Conductive, Primitive, Soft, Undersuit", wt:4, av:-1 }),
  A(IMP_APRIM, "Кольчужный Хауберк", { at:"simple", ap:[0,4,4,4], maxA:35, props:"Conductive, Heavy, Primitive, Soft", wt:10, av:-1 }),
  A(IMP_APRIM, "Латный Шлем", { at:"simple", ap:[5,0,0,0], props:"Conductive, Hard, Open, Primitive", wt:1.5, av:-1 }),
  A(IMP_APRIM, "Бригандина", { at:"simple", ap:[0,5,5,5], maxA:50, props:"Conductive, Hard, Heavy, Primitive", wt:16, av:0 }),
  A(IMP_APRIM, "Латная Кираса", { at:"simple", ap:[0,6,0,0], maxA:50, props:"Conductive, Hard, Heavy, Primitive", wt:10, av:0 }),
  A(IMP_APRIM, "Великий Шлем", { at:"simple", ap:[7,0,0,0], props:"Blinders (120), Conductive, Hard, Primitive", wt:3, av:1 }),
  A(IMP_APRIM, "Латный Доспех", { at:"simple", ap:[6,6,5,5], maxA:40, props:"Conductive, Gorget (8), Hard, Heavy, Primitive", wt:20, av:1 }),

  // ─────────────────────────── ИМПЕРСКОЕ: ИМПРОВИЗИРОВАННАЯ ───────────────────────────
  A(IMP_AIMPR, "Рабочий Комбинезон", { at:"simple", ap:[0,1,1,1], maxA:45, props:"Primitive, Protective (2), Soft, Undersuit", wt:2, av:-4 }),
  A(IMP_AIMPR, "Рабочий Шлем", { at:"simple", ap:[2,0,0,0], props:"Hard, Primitive, Protective (5)", wt:1, av:-4 }),
  A(IMP_AIMPR, "Импровизированная Броня", { at:"simple", ap:[0,3,2,2], maxA:40, props:"Primitive, Soft", wt:6, av:-3 }),
  A(IMP_AIMPR, "Шахтерский Скафандр", { at:"carapace", ap:[2,3,2,2], maxA:30, props:"Gorget (9), Protective (4), Hard, Open, Primitive", wt:8, av:-1 }),
  A(IMP_AIMPR, "Металлоломная Броня", { at:"carapace", ap:[4,5,4,4], maxA:25, props:"Conductive, Hard, Heavy, Primitive", wt:30, av:0 }),
  A(IMP_AIMPR, "Пустотный Скафандр", { at:"simple", ap:[1,2,2,2], maxA:30, props:"Open, Sealed, Soft, Void", wt:4, av:-1 }),
  A(IMP_AIMPR, "Ветреный Скафандр", { at:"simple", ap:[4,4,4,4], maxA:30, props:"Open, Sealed, Soft", wt:16, av:0 }),

  // ─────────────────────────── ИМПЕРСКОЕ: ФЛАК ───────────────────────────
  A(IMP_AFLAK, "Флак Фуражка", { at:"flak", ap:[3,0,0,0], props:"Flak, Open, Soft", wt:0.5, av:-1 }),
  A(IMP_AFLAK, "Флак Плащ", { at:"flak", ap:[3,3,3,3], props:"Cloak, Flak, Open, Soft", wt:1, av:-1 }),
  A(IMP_AFLAK, "Флак Униформа", { at:"flak", ap:[0,3,3,3], maxA:65, props:"Flak, Soft, Undersuit", wt:1.5, av:-1 }),
  A(IMP_AFLAK, "Флак Шинель", { at:"flak", ap:[0,4,4,4], maxA:40, props:"Flak, Soft, Sealed, Protective (2)", wt:5, av:-1 }),
  A(IMP_AFLAK, "Флак Шлем", { at:"flak", ap:[4,0,0,0], props:"Flak, Hard, Open", wt:1.2, av:-1 }),
  A(IMP_AFLAK, "Флак Жилет", { at:"flak", ap:[0,4,0,0], maxA:55, props:"Flak, Hard", wt:4, av:-1 }),
  A(IMP_AFLAK, "Закрытый Флак Шлем", { at:"flak", ap:[4,0,0,0], props:"Flak, Hard, Sealed", wt:1.4, av:0 }),
  A(IMP_AFLAK, "Полная Флак Броня", { at:"flak", ap:[4,4,4,4], maxA:50, props:"Flak, Hard, Sealed", wt:11, av:0 }),
  A(IMP_AFLAK, "Укреплённый Флак", { at:"flak", ap:[5,6,5,5], maxA:40, props:"Flak, Hard, Heavy, Protective (3), Sealed", wt:16, av:1 }),

  // ─────────────────────────── ИМПЕРСКОЕ: ПАНЦИРНАЯ ───────────────────────────
  A(IMP_ACARA, "Панцирный Шлем", { at:"carapace", ap:[6,0,0,0], props:"Conductive, Hard, Open", wt:1.5, av:1 }),
  A(IMP_ACARA, "Панцирная Маска", { at:"carapace", ap:[6,0,0,0], props:"Blinders (180), Conductive, Hard", wt:2, av:1 }),
  A(IMP_ACARA, "Панцирный Нагрудник", { at:"carapace", ap:[0,6,0,0], maxA:60, props:"Conductive, Hard", wt:6, av:1 }),
  A(IMP_ACARA, "Лёгкий Панцирь", { at:"carapace", ap:[0,6,5,5], maxA:55, props:"Conductive, Hard, Heavy", wt:12, av:1 }),
  A(IMP_ACARA, "Панцирь Силовиков", { at:"carapace", ap:[6,6,6,6], maxA:45, props:"Conductive, Hard, Heavy", wt:15, av:1 }),
  A(IMP_ACARA, "Пустотный Панцирь", { at:"carapace", ap:[6,6,5,5], maxA:40, props:"Blinders (180), Conductive, Hard, Heavy, Sealed, Void", wt:16, av:1 }),
  A(IMP_ACARA, "Панцирь Арбитров", { at:"carapace", ap:[6,6,6,6], maxA:50, props:"Conductive, Hard, Heavy, Sealed", wt:15, av:2 }),
  A(IMP_ACARA, "Панцирь Темпестус", { at:"carapace", ap:[6,7,6,6], maxA:50, props:"Conductive, Gorget (7), Hard, Heavy, Sealed, Void", wt:12, av:2 }),
  A(IMP_ACARA, "Панцирь Скаутов", { at:"carapace", ap:[5,7,6,6], props:"Open, Hard, Stealthed", wt:21, av:3 }),

  // ─────────────────────────── ИМПЕРСКОЕ: ЯЧЕИСТАЯ ───────────────────────────
  A(IMP_AMESH, "Ячеистый Капюшон", { at:"mesh", ap:[4,0,0,0], props:"Open, Protective (2)", wt:0.5, av:1 }),
  A(IMP_AMESH, "Ячеистый Плащ", { at:"mesh", ap:[4,4,4,4], props:"Cloak, Open, Protective (2)", wt:1, av:1 }),
  A(IMP_AMESH, "Ячеистый Поддоспешник", { at:"mesh", ap:[0,4,4,4], props:"Protective (2), Sealed, Stealthed, Undersuit", wt:2, av:1 }),
  A(IMP_AMESH, "Ячеистая Броня", { at:"mesh", ap:[4,4,4,4], props:"Protective (2), Open, Stealthed, Sealed", wt:3, av:1 }),
  A(IMP_AMESH, "Тяжёлая Ячеистая Броня", { at:"mesh", ap:[5,6,5,5], props:"Protective (4), Sealed, Stealthed, Void", wt:5, av:2 }),
  A(IMP_AMESH, "Ксено-Ячейка", { at:"mesh", ap:[4,5,4,4], props:"Protective (4), Sealed, Stealthed, Void", wt:1, av:2 }),
  A(IMP_AMESH, "Тяжёлая Ксено-Ячейка", { at:"mesh", ap:[6,7,6,6], props:"Hard, Protective (6), Sealed, Stealthed, Void", wt:3, av:3 }),
  A(IMP_AMESH, "Ксено-Ячеистые Латы", { at:"mesh", ap:[8,10,8,8], maxA:50, props:"Gorget (7), Hard, Heavy, Protective (8), Sealed, Stealthed, Void", wt:8, av:4 }),
  A(IMP_AMESH, "Фениксийские Латы", { at:"mesh", ap2:[3,5,4,4], ap:[14,14,14,14], props:"Hard, Protective (10), Sealed, Stealthed, Void", wt:1, av:5, note:"Вторичный профиль AP: 3/5/4/4." }),

  // ─────────────────────────── ИМПЕРСКОЕ: ПРОЧАЯ ───────────────────────────
  A(IMP_AOTHER, "Ксено-Шкуры", { at:"simple", ap:[0,6,6,0], maxA:50, props:"Soft", wt:9, av:1 }),
  A(IMP_AOTHER, "Комбинезон из Синтекожи", { at:"simple", ap:[2,2,2,2], props:"Sealed, Soft, Stealthed, Undersuit", wt:0.5, av:2 }),
  A(IMP_AOTHER, "Вулканизированный Плащ", { at:"simple", ap:[4,4,4,4], props:"Cloak, Open, Soft", wt:4, av:2 }),
  A(IMP_AOTHER, "Силовая Сбруя", { at:"power", ap:[0,4,4,4], maxA:40, props:"Conductive, Heavy, Rods", wt:15, av:3 }),
  A(IMP_AOTHER, "Обсидиановые Латы", { at:"carapace", ap:[8,10,8,8], props:"Gorget (7), Hard, Heavy", wt:4, av:4 }),

  // ─────────────────────────── ИМПЕРСКОЕ: СИЛОВАЯ (мортальная) ───────────────────────────
  A(IMP_APOW, "Лёгкая Силовая Броня", { at:"power", ap:[7,8,7,7], sb:10, wt:40, av:2, note:"Не увеличивает Размер, нет штрафа на тонкие манипуляции. Снять/надеть 15/5 мин. В выключенном состоянии — обычная броня с Max.A 35." }),
  A(IMP_APOW, "Силовая Броня Саббат", { at:"power", ap:[7,8,7,7], sb:10, wt:35, av:3, note:"Адепта Сороритас. +4 к S.b в расчёте подъёмного веса. Не увеличивает Размер, нет штрафа. Снять/надеть 15/5 мин. Выключенная — обычная броня с Max.A 50." }),
  A(IMP_APOW, "Силовая Броня", { at:"power", ap:[8,9,8,8], sb:20, wt:75, av:3, note:"Без подготовки Max.A 35, если носитель не подключён через MIU или не имеет таланта Armour Training (Power Armour). +4 к S.b в расчёте подъёмного веса." }),
  A(IMP_APOW, "Драконья Чешуя", { at:"power", ap:[8,9,8,8], sb:20, wt:65, av:2, note:"Древняя силовая броня Механикум. Носят только персонажи с Имплантами Механикум (питается от Катушки Потенции, без батареи). Даёт Трейт Nimble (10), не подавляет Трейты, совместима с имплантами/мутациями." }),
  A(IMP_APOW, "Броня Врантин", { at:"power", ap:[9,11,9,9], sb:15, wt:35, av:5, note:"Латы Сестёр Тишины. Не увеличивает Размер, нет штрафа. Снять/надеть 15/5 мин. Выключенная — обычная Max.A 35. Включённая: +20 К; полудействием вкл/выкл поле Парии (аура до 1 м). Иммунна к Haywire; Поддерживаемый Источник Питания; нельзя ставить др. системы в ранец." }),

  // ─────────────────────────── АСТАРТЕС: СИЛОВАЯ ───────────────────────────
  A(AST_APOW, "Мк II Крестовый Поход", { at:"power", ap:[8,9,7,7], sb:25, wt:280, av:4, note:"Автоматика даёт +5 вместо +10. Угол обзора ограничен 120°, штраф к Stealth до −20." }),
  A(AST_APOW, "Мк III Железный", { at:"power", ap2:[9,7,6,6], ap2kind:"rear", ap:[9,12,9,9], sb:25, wt:300, av:3, note:"Тыл бронирован слабее: AP 9/7/6/6. Автоматика +5 вместо +10. Обзор 180°, угол 120°, штраф к Stealth до −20." }),
  A(AST_APOW, "Мк IV Максимус", { at:"power", ap:[8,9,8,8], sb:20, wt:220, av:3, note:"Ретинальный дисплей; Targeter — прицел распространяется на оружие." }),
  A(AST_APOW, "Мк V Ереси", { at:"power", ap:[8,8,8,8], sb:20, wt:200, av:2, note:"Автоматика +5 вместо +10. Тесты на ремонт и обслуживание получают +30." }),
  A(AST_APOW, "Мк VI Корвус", { at:"power", ap:[8,9,8,8], sb:20, wt:170, av:3, note:"Авточувства дают +15 вместо +10 и включают нюх. +10 на Operate (Aeronautica); нет обычного штрафа к Stealth." }),
  A(AST_APOW, "Мк VII Аквила", { at:"power", ap:[8,10,8,8], sb:20, wt:180, av:3, note:"Финальная модель Ереси: системы Mk IV + упрощённое производство, мономолекулярные заклёпки. Основная модель Лоялистов в 41-м тыс.; у Хаоса — с грабежом/трофеями, заменяет Mk V." }),
  A(AST_APOW, "Мк VIII Странник", { at:"power", ap:[8,11,8,8], sb:20, wt:190, av:4, props:"Gorget (6)", note:"Бронированный горжет частично защищает голову." }),
  A(AST_APOW, "Мк X Примарис", { at:"power", ap:[8,10,8,8], sb:20, wt:170, av:4, note:"Модульная, перестраивается без тестов. Тактикус: +1 AP всем зонам, Gorget (6), целеуказатель в авточувствах как Mk IV, +20 на обслуживание/ремонт как Mk V. Гравис: +3 AP всем зонам, Gorget (5), +10 аблативных Ран (восстановимы ремонтом), Трейт Auto-Stabilized; свободным действием закрыть горжет → попадания в голову идут в торс, нет бонуса >90°, теряется Auto-Stabilized; чёрный панцирь без Nimble, −15 к Ловкости. Фобос: авточувства +15 вместо +10, нет штрафа Stealth, невидим для тепловизора/аускультации, +Преимущество к Трудному Ландшафту и Stealth (бесшумность). Доступна в играх 42-го тыс. и позже." }),
  A(AST_APOW, "Ремесленная Броня", { at:"power", ap:[12,12,12,12], sb:20, wt:160, av:5, note:"Несёт особые свойства Mk IV, Mk VI и Mk VIII одновременно. Линзы и сочленения имеют AP 8." }),
  A(AST_APOW, "Броня Эгида", { at:"power", ap:[9,11,9,9], sb:20, wt:190, av:5, note:"Броня Серых Рыцарей. AP работает против Варп-Оружия; +20 на встречные тесты против психосил и демонической одержимости. Только как трофей. Несёт свойства Mk IV/VI/VIII." }),

  // ─────────────────────────── АСТАРТЕС: ТЕРМИНАТОРСКАЯ ───────────────────────────
  // Сверхброня: «AP» — основной профиль; «Второй профиль» (в примечании) применяется к атакам с Pen ≥ основного AP и режет Экстрем. урон вдвое.
  // Столбец «W» книги = аблативные Раны (в примечании), «A» = штраф к Ловкости (в примечании). Все: Auto-Stabilized, Sturdy, нет Nimble; нельзя Прыгать/Уклоняться/Acrobatics; иммунитет к радиации/давлению.
  A(AST_TERM, "Мк I Сатурнин", { at:"power", ap2:[4,6,5,5], ap:[16,20,18,18], sb:40, maxA:25, wt:1600, av:5, props:"Gorget (4)", note:"Сверхброня. Второй профиль AP: 4/6/5/5. +15 аблативных Ран. Штраф −30 к Ловкости. Экспериментальная: нельзя Бежать, поворот ≤90°/ход, скорость Натиска вдвое, обзор 90°. На спину — тяжёлое/длинное оружие (Shoulder Mount)." }),
  A(AST_TERM, "Мк II Катафракт", { at:"power", ap2:[3,5,5,5], ap:[14,15,15,15], sb:30, maxA:35, wt:1200, av:4, props:"Gorget (5)", note:"Сверхброня. Второй профиль AP: 3/5/5/5. +10 аблативных Ран. Штраф −25 к Ловкости. Нельзя Бежать, обзор 120°. Неперегружаемый щит-купол 1–50." }),
  A(AST_TERM, "Мк III Индомитус", { at:"power", ap:[14,14,14,14], sb:30, maxA:45, wt:1000, av:4, note:"Сверхброня. Второй профиль AP: 3/5/4/4. +10 аблативных Ран. Штраф −20 к Ловкости. Обзор 180°. Неперегружаемый щит-дефлектор 1–35. Есть уменьшенная мортальная версия (400 кг, R 5)." }),
  A(AST_TERM, "Мк IV Тартарос", { at:"power", ap:[14,14,14,14], sb:30, wt:800, av:5, props:"Gorget (6)", note:"Сверхброня. Второй профиль AP: 3/5/4/4. +10 аблативных Ран. Штраф −15 к Ловкости. Самая подвижная. Неперегружаемый щит-дефлектор 1–35." }),
  A(AST_TERM, "Терминатор Эгида", { at:"power", ap:[14,15,14,14], sb:30, wt:800, av:5, note:"Серые Рыцари. Сверхброня. Второй профиль AP: 3/5/4/4. +10 аблативных Ран. Штраф −15 к Ловкости. Щит-дефлектор как Mk III/Mk IV. AP против Варп-Оружия; +30 на встречные тесты против психосил и демонической одержимости. Иммунитет к Демоническому Присутствию + Трейт Fear (2); только трофей." }),

  // ─────────────────────────── АРЛЕКИНЫ: СНАРЯЖЕНИЕ ───────────────────────────
  // Снаряжение арлекинов: для арлекина редкость −2; работает только в одобренных руках;
  // иммунно к Haywire/Null-полям; трофей у не-арлекина — как Poor.Q.
  A(HQ_ARM, "Голокостюм (Dathedi)", { at:"mesh", ap:[0,3,3,3], maxA:100, wt:0.1, av:4, props:"Protective (A.b), Stealthed, Wraithbone Regeneration", note:"Все атаки по носителю −3×A.b. Встроенное голо-поле R2. Переброс с +25 на встречные тесты против психосил/демонических даров/Одержимости. Против Варп-Оружия AP = A.b. С Ложным Лицом получает Sealed и Void. Не работает вместе с другой бронёй." }),
  A(HQ_ARM, "Ложное Лицо (Agaith)", { at:"mesh", ap:[3,0,0,0], maxA:100, wt:0.1, av:4, note:"Маска (голова). Скрывает эмоции/мысли даже от психосил. Fear (2) (включая демонов ниже герольда). Иммунитет к Hallucinogenic. Good.Q Психофокус; Best.Q противогаз/ингалятор/фото-визор/ребризер/глушащие беруши/охотничий визор/ретинальный дисплей. Warp Sight. +3 AP головы. Вариации: Перекошенная / Ужасная / Страшная Маска." }),
  // Артефакты Чёрной Библиотеки
  A(HQ_ARM, "Звёздное Одеяние", { at:"mesh", ap:[0,3,3,3], maxA:100, wt:0.1, av:5, props:"Protective (A.b), Stealthed, Wraithbone Regeneration", note:"Как Best.Q Голокостюм (Dathedi). Неперегружаемый щит-дефлектор 1–50/– (до 1–90/–, если в прошлом раунде носитель действовал или избегал). Рукопашные атаки по носителю получают Blinding (A.b)." }),
  A(HQ_ARM, "Маска Секретов", { at:"mesh", ap:[3,0,0,0], maxA:100, wt:0.1, av:5, note:"Как Best.Q Ложное Лицо (Agaith). Иммунитет к Страху/Шоку/Подавлению; Fear (4) (даже высшие демоны/бесстрашные). Провалившие тест Страха становятся Беспомощными (неуменьшаемо). После боя — цена по решению ГМ." })
];
