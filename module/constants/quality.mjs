// module/constants/quality.mjs
// ─────────────────────────────────────────────────────────────────────────────
//  ДВИЖОК КАЧЕСТВА СНАРЯЖЕНИЯ (Warhammer DBC)
//  Реестр четырёх уровней качества + разрешение эффектов по типу предмета.
//  Таблица «Качество» (книга):
//    Poor.Q / Низкое   +10 к сложности реквизиции/покупки/крафта/улучшения
//    Comm.Q / Обычное    0
//    Good.Q / Хорошее  −10
//    Best.Q / Высшее   −20
//  Плюс типо-специфичные эффекты на использование предмета.
// ─────────────────────────────────────────────────────────────────────────────

/** Базовый реестр качества. acqMod — модификатор сложности добычи/крафта/улучшения. */
export const ITEM_QUALITY = {
  poor:    { key: "poor",    label: "Низкое",     abbr: "Poor.Q", acqMod:  10 },
  common:  { key: "common",  label: "Обычное",    abbr: "Comm.Q", acqMod:   0 },
  good:    { key: "good",    label: "Хорошее",    abbr: "Good.Q", acqMod: -10 },
  best:    { key: "best",    label: "Высшее",     abbr: "Best.Q", acqMod: -20 },
  // Ремесленное — уровень друкхари. У имперского снаряжения его не бывает, но
  // держим в общем реестре, чтобы выпадашки и нормализация не ломались.
  artisan: { key: "artisan", label: "Ремесленное", abbr: "Arts.Q", acqMod: -70, drukhariOnly: true }
};

export const ITEM_QUALITY_LIST  = ["poor", "common", "good", "best"];

/** Нормализует ключ качества (устаревшее "best"="лучшее" тоже допускается). */
export function normQuality(q) {
  return ITEM_QUALITY[q] ? q : "common";
}

/** Друкхарийское ли снаряжение — у него своя таблица качества. */
export function isDrukhariItem(item) {
  return item?.system?.drukhari === true;
}

export function qualityInfo(q) {
  return ITEM_QUALITY[normQuality(q)];
}

/**
 * Повышение качества (моды, крафт, улучшения) не может дотянуть до Arts.Q —
 * ремесленный уровень получают только из рук мастера, а не апгрейдом.
 */
export function capUpgradeQuality(q) {
  return normQuality(q) === "artisan" ? "best" : normQuality(q);
}

// ─── Типовые эффекты качества ────────────────────────────────────────────────
// Возвращает { auto:{...}, reminders:[строки] } для конкретного предмета.
// Foundry-тип предмета → «категория качества» из книги:
//   weapon(ranged) — Стрелковое; weapon(melee/thrown) — Рукопашное;
//   armor — Броня; forcefield — Силовые Щиты; gear/tool/прочее — Прочее снаряжение.

const MELEE_CLASSES = new Set(["melee", "thrown"]);

/** Определяет категорию качества по предмету Foundry. */
export function qualityCategory(item) {
  const t = item?.type;
  if (t === "weapon") {
    return MELEE_CLASSES.has(item?.system?.weaponClass) ? "meleeWeapon" : "rangedWeapon";
  }
  if (t === "armor")      return "armor";
  if (t === "forcefield") return "shield";
  return "misc"; // gear, tool, cybernetic, implant и прочее
}

/**
 * Разрешает эффекты качества предмета.
 * @returns {{ cat:string, info:object, auto:object, reminders:string[] }}
 *   auto может содержать:
 *     reliabilityMod  — модификатор Надёжности (стрелковое)
 *     testMod         — модификатор тестов с предметом (рукопашное/прочее)
 *     damageMod       — модификатор урона (рукопашное Best)
 *     agiTestMod      — модификатор тестов Ловкости носителя (броня Poor)
 *     apAll / apJoints — бонус AP (броня Best)
 *     overloadMod     — модификатор рейтинга Перегрузки (щит), уже с клампом ≥1
 *     losesPrimitive  — предмет теряет Primitive (если имел)
 */
export function qualityEffects(item) {
  const cat  = qualityCategory(item);
  const q    = normQuality(item?.system?.quality);
  const info = ITEM_QUALITY[q];
  const auto = {};
  const reminders = [];

  // У друкхари своя таблица эффектов — уходим в неё целиком.
  if (isDrukhariItem(item)) return drukhariQualityEffects(cat, q, info);

  switch (cat) {
    case "rangedWeapon":
      if (q === "poor") { auto.reliabilityMod = -1; reminders.push("Низкое: Надёжность −1."); }
      if (q === "good") { auto.reliabilityMod = +1; reminders.push("Хорошее: Надёжность +1."); }
      if (q === "best") {
        auto.reliabilityMod = +2; auto.losesPrimitive = true;
        reminders.push("Высшее: Надёжность +2; теряет Primitive, если имело.");
      }
      break;

    case "meleeWeapon":
      if (q === "poor") { auto.testMod = -10; reminders.push("Низкое: −10 на все тесты с оружием."); }
      if (q === "good") { auto.testMod =  +5; reminders.push("Хорошее: +5 на все тесты с оружием."); }
      if (q === "best") {
        auto.testMod = +10; auto.damageMod = +1; auto.losesPrimitive = true;
        reminders.push("Высшее: +10 на все тесты, +1 к урону; теряет Primitive, если имело.");
      }
      break;

    case "armor":
      // Качество двигает Max.A и запас воздуха Пустотной брони (стр. 227).
      if (q === "poor") {
        auto.agiTestMod = -10; auto.maxAgiMod = -10; auto.voidHoursMod = -3;
        reminders.push("Низкое: −10 на все тесты Ловкости; Max.A −10; запас воздуха −3 ч.");
      }
      if (q === "good") {
        auto.maxAgiMod = 5; auto.voidHoursMod = 6;
        reminders.push("Хорошее: −10 на Избирательные атаки по сочленениям и визорам носителя; Max.A +5; запас воздуха +6 ч.");
      }
      if (q === "best") {
        auto.apAll = 1; auto.apJoints = 2; auto.losesPrimitive = true;
        auto.maxAgiMod = 10; auto.voidUnlimited = true;
        reminders.push("Высшее: −10 по сочленениям/визорам; +1 AP всем частям и +2 AP в сочленения после уменьшения; теряет Primitive; Max.A +10; запас воздуха не ограничен.");
      }
      break;

    case "shield":
      if (q === "poor") { auto.overloadMod = +10; reminders.push("Низкое: +10 к рейтингу Перегрузки."); }
      if (q === "good") { auto.overloadMod =  -5; reminders.push("Хорошее: −5 к рейтингу Перегрузки (до мин. 1)."); }
      if (q === "best") { auto.overloadMod = -10; reminders.push("Высшее: −10 к рейтингу Перегрузки (до мин. 1)."); }
      break;

    default: // misc — «Прочее снаряжение»
      if (q === "poor") { auto.testMod = -10; reminders.push("Низкое: −10 на тесты с этим снаряжением."); }
      if (q === "good") { auto.testMod =  +5; reminders.push("Хорошее: +5 на тесты с этим снаряжением."); }
      if (q === "best") { auto.testMod = +10; reminders.push("Высшее: +10 на тесты с этим снаряжением."); }
      break;
  }
  return { cat, info, auto, reminders };
}

/** Применяет модификатор Перегрузки щита от качества с клампом до мин. 1. */
export function applyShieldOverloadQuality(baseOverload, q) {
  const { auto } = qualityEffects({ type: "forcefield", system: { quality: q } });
  if (typeof auto.overloadMod !== "number") return baseOverload;
  if (baseOverload <= 0) return baseOverload; // 0 = не перегружается — не трогаем
  const v = baseOverload + auto.overloadMod;
  return auto.overloadMod < 0 ? Math.max(1, v) : v;
}

/**
 * Текст качества, специфичный для конкретного предмета библиотеки.
 * Читает system.qualityEffects.{poor,good,best} и возвращает строку для текущего
 * качества предмета (или "" если для этого уровня ничего не задано).
 */
export function itemSpecificQuality(item) {
  const q = normQuality(item?.system?.quality);
  const qe = item?.system?.qualityEffects;
  if (!qe) return "";
  return String(qe[q] || "").trim();
}

/**
 * HTML-блок «Качество» для карточки предмета в чате: общий типовой эффект +
 * специфичный для предмета текст текущего уровня качества.
 */
export function buildQualityChatBlock(item) {
  const q = normQuality(item?.system?.quality);
  if (q === "common") {
    const spec = itemSpecificQuality(item);
    if (!spec) return "";
  }
  const { info, reminders } = qualityEffects(item);
  const spec = itemSpecificQuality(item);
  const lines = [];
  for (const r of reminders) lines.push(`<div class="roll-wprop">${r}</div>`);
  if (spec) lines.push(`<div class="roll-wprop"><b>${info.abbr}:</b> ${spec}</div>`);
  if (!lines.length) return "";
  // Свёрнуто по умолчанию (как и свойства оружия) — карточка боя и так длинная.
  return `
    <details class="roll-collapsible roll-note-collapsible">
      <summary class="roll-section-head"><span class="roll-sum-title">Качество — ${info.label} (${info.abbr})</span></summary>
      ${lines.join("")}
    </details>`;
}

// ─── Качество друкхарийского снаряжения ──────────────────────────────────────
// Отдельная таблица: значения не совпадают с имперскими ни в одной строке,
// плюс пятый уровень Arts.Q. Рукопашное Poor.Q у друкхари мягче (−5 против −10),
// а Good/Best/Arts заметно щедрее — тонкость эльдарской работы.
function drukhariQualityEffects(cat, q, info) {
  const auto = {};
  const reminders = [];
  const R = (t) => reminders.push(t);

  switch (cat) {
    case "rangedWeapon":
      if (q === "poor")    { auto.reliabilityMod = -1; R("Низкое: Надёжность −1."); }
      if (q === "good")    { auto.reliabilityMod = +1; auto.damageMod = +1; R("Хорошее: Надёжность +1, +1 к урону."); }
      if (q === "best")    { auto.reliabilityMod = +2; auto.damageMod = +1; R("Высшее: Надёжность +2, +1 к урону."); }
      if (q === "artisan") { auto.reliabilityMod = +4; auto.damageMod = +2; R("Ремесленное: Надёжность +4, +2 к урону."); }
      break;

    case "meleeWeapon":
      if (q === "poor")    { auto.testMod = -5;  R("Низкое: −5 на все тесты с этим оружием."); }
      if (q === "good")    { auto.testMod = +5;  auto.damageMod = +1; R("Хорошее: +5 на все тесты, +1 к урону."); }
      if (q === "best")    {
        auto.testMod = +10; auto.damageMod = +2; auto.penMod = +1;
        auto.grantsPropChoice = ["stepByStep", "duelingWeapon"];
        R("Высшее: +10 на все тесты, +2 к урону, +1 Pen; даёт Step By Step ИЛИ Dueling Weapon (на выбор).");
      }
      if (q === "artisan") {
        auto.testMod = +15; auto.damageMod = +2; auto.penMod = +2;
        auto.grantsProps = ["stepByStep", "duelingWeapon"];
        R("Ремесленное: +15 на все тесты, +2 к урону, +2 Pen; даёт и Step By Step, и Dueling Weapon.");
      }
      break;

    case "armor":
      // Друкхарийская броня: качество двигает чистый AP, а Poor.Q добавляет Сочленения.
      if (q === "poor")    { auto.addsJoints = true; R("Низкое: броня получает Сочленения."); }
      if (q === "good")    { auto.apAll = 1; R("Хорошее: +1 AP во всех частях тела."); }
      if (q === "best")    { auto.apAll = 2; R("Высшее: +2 AP во всех частях тела."); }
      if (q === "artisan") { auto.apAll = 3; R("Ремесленное: +3 AP во всех частях тела."); }
      break;

    case "shield":
      if (q === "poor")    { auto.overloadMod = +5;  R("Низкое: +5 к рейтингу Перегрузки."); }
      if (q === "good")    { auto.overloadMod = -5;  R("Хорошее: −5 к рейтингу Перегрузки (до мин. 1)."); }
      if (q === "best")    { auto.overloadMod = -10; R("Высшее: −10 к рейтингу Перегрузки (до мин. 1)."); }
      if (q === "artisan") {
        auto.overloadMod = -15; auto.ratingMod = +5; auto.ratingCap = 99; auto.painReroll = true;
        R("Ремесленное: −15 к рейтингу Перегрузки (до мин. 1), +5 к рейтингу щита (до макс. 99); Силовой Щит можно перебрасывать за Очки Боли.");
      }
      break;

    default: // Прочее снаряжение
      if (q === "poor")    { auto.testMod = -5;  R("Низкое: −5 на тесты с этим снаряжением."); }
      if (q === "good")    { auto.testMod = +10; R("Хорошее: +10 на тесты с этим снаряжением."); }
      if (q === "best")    { auto.testMod = +15; R("Высшее: +15 на тесты с этим снаряжением."); }
      if (q === "artisan") { auto.testMod = +25; R("Ремесленное: +25 на тесты с этим снаряжением."); }
      break;
  }
  return { cat, info, auto, reminders, drukhari: true };
}
