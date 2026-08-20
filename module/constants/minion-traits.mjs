// module/constants/minion-traits.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Трейты Миньонов (корбук стр. 112) — таблица доступности и цены.
//
//  Две таблицы книги сведены в одну: обычные Трейты и комплексные, отражающие
//  субрасы и особые типы слуг (Геносемя, Огрин, Сервочереп, Тралл-Вирд…).
//  Разница между ними — в поле `complex`: комплексный Трейт включает в себя
//  другие, и они с обычными НЕ складываются (miньон с Gene-Seed не берёт ещё
//  раз Unnatural S за очко, но может поднять рейтинг за очко).
//
//  Колонки книги:
//    cost   — цена в Очках Трейтов (бывает 0 и отрицательной: недостаток
//             возвращает очко);
//    groups — доступность по группам: true — можно, false — нельзя,
//             "required" — обязателен (Daemonic у демона, Machine у машины);
//    tiers  — что даёт уровень силы: null — недоступен, true — доступен без
//             рейтинга, число — базовый Рейтинг, строка — формула книги;
//    perPoint — на сколько поднимается Рейтинг за лишнее Очко Трейтов.
//
//  Пары через дробь (Daemonic Armament «1/0», Daemonic Presence «5/10») книга
//  пишет как «рейтинг/рейтинг»: у Трейта два числа сразу, и здесь они хранятся
//  строкой ровно как напечатано — толковать их за ГМа система не берётся.
//
//  Таблица снята с плоского текста книги: в PDF она свёрстана колонками и
//  разметкой не размечена, поэтому проверяется тестом на форму записи, а числа
//  сверены построчно глазами.
// ════════════════════════════════════════════════════════════════════════════

/** Сокращение: доступен всем четырём группам. */
const ALL = { human: true, beast: true, machine: true, daemon: true };

/** Доступность по группам списком «кому можно». */
const only = (...keys) => ({
  human:   keys.includes("human"),
  beast:   keys.includes("beast"),
  machine: keys.includes("machine"),
  daemon:  keys.includes("daemon")
});

/** Уровни: Низший, Обычный, Высший. Превосходящий и Орда берут те же (стр. 111). */
const tiers = (lesser, standard, greater) => ({ lesser, standard, greater });

export const MINION_TRAITS = {
  "Amorphous":        { cost: 1,  groups: ALL,                              tiers: tiers(true, true, true) },
  "Amphibious":       { cost: 1,  groups: ALL,                              tiers: tiers(true, true, true) },
  "Bite":             { cost: 1,  groups: ALL,                              tiers: tiers(1, 2, 4), perPoint: 1 },
  // Недостаток: очко возвращается, а не тратится.
  "Blind":            { cost: -1, groups: ALL,                              tiers: tiers(true, true, true) },
  "Blunted":          { cost: 1,  groups: only("human", "beast"),           tiers: tiers(1, 2, 4), perPoint: 1 },
  "Brutal Charge":    { cost: 1,  groups: ALL,                              tiers: tiers(2, 4, 6), perPoint: 1 },
  "Daemonic":         { cost: 1,  groups: { ...ALL, daemon: "required" },   tiers: tiers(1, 2, 4), perPoint: 1 },
  "Daemonic Armament":{ cost: 1,  groups: only("daemon"),                   tiers: tiers("1/0", "2/1", "4/2"), perPoint: "+1/1" },
  "Daemonic Presence":{ cost: 1,  groups: only("daemon"),                   tiers: tiers("5/10", "10/10", "15/15"), perPoint: "+0/5" },
  "Digitigrade":      { cost: 1,  groups: ALL,                              tiers: tiers(1, 2, 4), perPoint: 1 },
  "Incorporeal":      { cost: 1,  groups: only("beast", "machine", "daemon"), tiers: tiers(null, true, true) },
  "Machine":          { cost: 1,  groups: { ...ALL, machine: "required" },  tiers: tiers(2, 4, 6), perPoint: 1 },
  "Monodevotant":     { cost: 1,  groups: only("human"),                    tiers: tiers(null, true, true) },
  "Multiple Arms":    { cost: 1,  groups: ALL,                              tiers: tiers("+2", "+3", "+4") },
  "Mutant":           { cost: 1,  groups: only("human", "beast"),           tiers: tiers(null, 1, 2) },
  "Natural Armour":   { cost: 1,  groups: ALL,                              tiers: tiers(4, 6, 8), perPoint: 2 },
  "Natural Weapons":  { cost: 1,  groups: ALL,                              tiers: tiers(1, 3, 5), perPoint: 1 },
  // Размер даётся бесплатно: он у слуги и так есть, вопрос только какой.
  "Size":             { cost: 0,  groups: ALL,                              tiers: tiers(true, true, true) },
  "Sonar Sense":      { cost: 1,  groups: ALL,                              tiers: tiers(true, true, true) },
  "Soul-Bound":       { cost: 1,  groups: only("human", "beast", "daemon"), tiers: tiers(true, true, true) },
  "Stampede":         { cost: -1, groups: only("beast", "daemon"),          tiers: tiers(true, true, true) },
  "Stuff of Nightmares":{ cost: 1, groups: ALL,                             tiers: tiers(null, null, true) },
  "Sturdy":           { cost: 1,  groups: ALL,                              tiers: tiers(true, true, true) },
  "Swarm":            { cost: 1,  groups: ALL,                              tiers: tiers(null, "d5−1", "d5+1") },
  "Sycophant":        { cost: 1,  groups: only("human", "daemon"),          tiers: tiers(true, true, true) },
  "Touched by the Fates":{ cost: 1, groups: ALL,                            tiers: tiers(null, 1, 2), perPoint: 1 },
  "Toxic":            { cost: 1,  groups: ALL,                              tiers: tiers(1, 2, 3), perPoint: 1 },
  "Undying":          { cost: 1,  groups: ALL,                              tiers: tiers(null, true, true) },
  "Unnatural Characteristic":{ cost: 1, groups: ALL,                        tiers: tiers(2, 3, 4), perPoint: 1 },
  "Unnatural Senses": { cost: 1,  groups: ALL,                              tiers: tiers(5, 10, 15), perPoint: 5 },
  "Warp Gifted":      { cost: 1,  groups: ALL,                              tiers: tiers(null, 2, 4), perPoint: 1 },
  "Warp Instability": { cost: -1, groups: ALL,                              tiers: tiers(true, true, true) },
  "Warp Sight":       { cost: 1,  groups: ALL,                              tiers: tiers(null, true, true) },
  "Warp Weapon":      { cost: 1,  groups: ALL,                              tiers: tiers(null, null, true) },

  // ── Комплексные (стр. 112, вторая таблица) ──
  // Включают в себя обычные Трейты; те с ними не складываются, но рейтинг
  // включённого Трейта поднимается за очко как обычно.
  "Dedication": {
    cost: 1, complex: true, groups: only("daemon"), tiers: tiers(null, true, true),
    note: "Посвящение: Покровительство одного из Богов и его божественный Трейт демонов (Книга Хаоса, стр. 5)."
  },
  "Gene-Seed": {
    cost: 5, complex: true, groups: only("human", "daemon"), tiers: tiers(null, null, true),
    note: "Геносемя: все его преимущества, Трейты Amphibious, Nimble (10), Size (1), Unnatural S (4), "
        + "Unnatural T (4), Таланты Heightened Senses (Hearing, Sight), Resistance (Cold, Heat, Poisons) "
        + "и Legion Weapon Training."
  },
  "Mechanicum Implants": {
    cost: 2, complex: true, groups: only("human", "daemon"), tiers: tiers(null, true, true),
    note: "Импланты Механикум: все стандартные, Технофокус (R1 Good Q или R2) и Навык Linguistics (Binary Cant)."
  },
  "Ogryn": {
    cost: 5, complex: true, groups: only("human", "machine", "daemon"), tiers: tiers(null, null, true),
    note: "Огрин: Трейты Size (1), Fanatic, Unnatural S (6), Unnatural T (6), Brute Physiology, BONE-Head, "
        + "Таланты Iron Jaw и Resistance (Cold, Heat), +15 S и T, −15 Ag и Int, +15 Ран."
  },
  "Servoskull": {
    cost: 2, complex: true, groups: only("machine"), tiers: tiers(true, true, true),
    note: "Сервочереп: Трейты Size (−2), Hoverer и Machine по силе. Считается имеющим одну руку — встроенное "
        + "оружие или инструмент, который нельзя выпустить, но с бонусом +15 на тесты с ним; мехатентрилы "
        + "поднимают предметы Размера −2 и меньше, но не бьют."
  },
  "Steed": {
    cost: 1, complex: true, groups: only("beast", "machine", "daemon"), tiers: tiers(true, true, true),
    note: "Скакун: на Миньоне можно ездить, если его вес ношения выше веса персонажа. Открывает Трейты скакунов — "
        + "по цене −1: Unruly; по ½: All-Terrain, Blades (1d10+2 R, Pen 0), Legion, Maneuverable, Stand, "
        + "War-Trained; по 1: Ablative Plating, Blades (2d10+2 R, Pen 2, Tearing)."
  },
  "Thrall-Wyrd": {
    cost: 2, complex: true, groups: only("human"), tiers: tiers(true, true, true),
    note: "Тралл-Вирд: Трейты Monodevotant и Psyker (PR 0). Считает максимум Миньонов и требование по W и "
        + "Forbidden Lore (Psykers) вместо F и Command. Генерируется всегда как Низший, но взятый как Обычный "
        + "или Высший даёт сразу 2 или 3 Тралл-Вирдов, считающихся за одного Миньона."
  }
};

/** Трейты, которые уровень силы делает обязательными для своей группы. */
export const MANDATORY_BY_GROUP = Object.entries(MINION_TRAITS)
  .flatMap(([name, def]) => Object.entries(def.groups)
    .filter(([, v]) => v === "required")
    .map(([group]) => ({ group, name })));

/** Тралл-Вирд считает максимум и требование по своей паре, а не по группе. */
export const THRALL_WYRD = { name: "Thrall-Wyrd", masterChar: "wp", reqSkill: "Forbidden Lore (Psykers)" };
