// module/constants/bio-lab.mjs
// ════════════════════════════════════════════════════════════════════════
//  Биолаборатория Друкхари: выращивание биоимплантов в Ферментном Чане.
//
//  Биоимпланты НЕ крафтятся по обычным правилам Мастерской — у них нет банка
//  успехов. Вместо этого чан прогоняет циклы роста по 24 часа, и в конце
//  КАЖДОГО цикла КАЖДОГО чана крафтер проходит тест. Поэтому режим вынесен
//  отдельной вкладкой, а не ещё одной категорией крафта.
//
//  Экспортирует: VAT_QUALITY, BIO_TEST_SKILLS, BIO_TARGET_QUALITY,
//  BIO_OUTCOMES, biomassFor(), cyclesFor(), vatPlan().
// ════════════════════════════════════════════════════════════════════════

// ─────────────────────── КАЧЕСТВО САМОГО ЧАНА ───────────────────────────
// rarity — как реквизируется сам чан; maxQuality — потолок выращиваемого.
export const VAT_QUALITY = [
  { key: "poor", label: "Poor.Q — кустарный чан", rarity: 0, mod: 0,
    maxQuality: "good", onlyCommon: true, rerolls: 0,
    note: "Распространён среди тех, у кого нет связей с Гемункулами. Позволяет создавать только ОБЫЧНЫЕ биоимпланты и не выше Good.Q." },
  { key: "common", label: "Comm.Q — рабочий чан", rarity: 2, mod: 0,
    maxQuality: "best", onlyCommon: false, rerolls: 0,
    note: "Стандартный биоалхимический реактор. Гемункульские импланты недоступны." },
  { key: "good", label: "Good.Q — чан лаборатории гемункула", rarity: 3, mod: 0,
    maxQuality: "best", onlyCommon: false, rerolls: 1,
    note: "При провале — один переброс процесса создания. Чан показывает изнутри, что случилось с имплантом, и позволяет ликвидировать его, вернув ½ затраченных ресурсов. Либо (на выбор при покупке) чан передвижной и с внутренним источником энергии." },
  { key: "best", label: "Best.Q — чан великого ковена", rarity: 4, mod: 30,
    maxQuality: "best", onlyCommon: false, rerolls: 2, haemonculi: true, freeCommonSolution: true,
    note: "+30 на создание, два переброса итогового импланта (можно выбрать любой из перебросов или первоначальный вариант). Обычный имплант не тратит раствор. Только такой чан создаёт ГЕМУНКУЛЬСКИЕ биоимпланты." }
];
export const VAT_QUALITY_MAP = Object.fromEntries(VAT_QUALITY.map(v => [v.key, v]));

// ─────────────────── ЖЕЛАЕМОЕ КАЧЕСТВО ИМПЛАНТА ─────────────────────────
// mod — модификатор теста; solution — единиц питательного раствора;
// template — нужен ли генетический шаблон.
export const BIO_TARGET_QUALITY = [
  { key: "poor",   label: "Poor.Q",  mod: +30, solution: 0, template: false,
    parts: "Только биомасса, раствор не тратится" },
  { key: "common", label: "Comm.Q",  mod: 0,   solution: 1, template: false,
    parts: "Биомасса и 1 единица раствора" },
  { key: "good",   label: "Good.Q",  mod: -10, solution: 2, template: true,
    parts: "Биомасса, генетический шаблон и 2 единицы раствора" },
  { key: "best",   label: "Best.Q",  mod: -30, solution: 5, template: true,
    parts: "Биомасса, генетический шаблон и 5 единиц раствора" }
];
export const BIO_TARGET_MAP = Object.fromEntries(BIO_TARGET_QUALITY.map(q => [q.key, q]));
const Q_ORDER = ["poor", "common", "good", "best"];

// ───────────────────────── ТЕСТ И ЕГО ИСХОДЫ ────────────────────────────
// Книга даёт выбор: Medicae(I) ЛИБО связка Scholastic Lore (Chymistry) и
// Trade (Chymist). Тест проходится в конце каждого цикла каждого чана.
export const BIO_TEST_SKILLS = [
  { key: "medicae",   label: "Medicae (I)",                 skills: ["medicae"] },
  { key: "chymistry", label: "Schol. Lore (Chymistry) (I)", skills: ["scholasticLore"] },
  { key: "chymist",   label: "Trade (Chymist) (I)",         skills: ["trade"] }
];

// Порог входа: чтобы вообще работать с чаном, нужны Medicae+10,
// Scholastic Lore (Chymistry) и Trade (Chymist). Без подготовки — с помехой.
export const VAT_ENTRY_REQ = "Medicae+10, Scholastic Lore (Chymistry), Trade (Chymist). "
  + "Без подготовки в тёмных искусствах чан используется с помехой — есть риск вырастить нечто непредсказуемое.";

export const BIO_OUTCOMES = [
  { key: "critSuccess", label: "Критический успех", dos: "5+ степеней успеха",
    text: "Имплант идеален. Обладает редкими регенеративными способностями и самовосстанавливается после повреждений: вне боёв +1 рана каждые 6 часов. Если создавался Poor.Q — он становится Comm.Q." },
  { key: "success", label: "Успех", dos: "1–4 степени успеха",
    text: "Получается имплант ровно того качества, которое задумывалось." },
  { key: "fail", label: "Провал", dos: "1–4 степени провала",
    text: "Имплант выходит на категорию качества ниже. Best.Q при провале даёт сразу Comm.Q. Такой имплант можно вернуть в чан и за 3 цикла работы восстановить желаемое качество." },
  { key: "critFail", label: "Критический провал", dos: "5+ степеней провала",
    text: "Катастрофа, вариант выбирает ГМ. • Бесполезная биомасса: комок гниющей плоти. • Враждебный мутант: из чана вырывается оса-паразит, плотоядный усик или рычащий эмбрион и немедленно атакует создателя. • Сбой «настройки»: имплант выглядит как Comm.Q, но имеет скрытый дефект, который проявится позже." }
];

/** Качество результата при провале: на ступень ниже, Best.Q → Comm.Q. */
export function failQuality(target) {
  if (target === "best") return "common";
  const i = Q_ORDER.indexOf(target);
  return Q_ORDER[Math.max(0, i - 1)];
}

/**
 * Биомасса. Базовый обычный имплант — 2 единицы; более продвинутые
 * или крупные — R×3+3.
 */
export function biomassFor(rarity, advanced) {
  const r = Number(rarity) || 0;
  if (!advanced && r <= 0) return 2;
  return Math.max(2, r * 3 + 3);
}

/**
 * Циклы роста. Один цикл — 24 часа. Крупные импланты (целая конечность)
 * требуют примерно по 3 цикла за каждую редкость выше 0.
 */
export function cyclesFor(rarity, large) {
  const r = Number(rarity) || 0;
  if (!large) return 1;
  return Math.max(1, r * 3);
}

/**
 * Полный расчёт партии: ресурсы, время, модификатор теста и запреты.
 * vatKey — качество чана, target — желаемое качество импланта.
 */
export function vatPlan({ vatKey, target, rarity, advanced, large, haemonculi, gmMod = 0 }) {
  const vat = VAT_QUALITY_MAP[vatKey] || VAT_QUALITY_MAP.common;
  const tgt = BIO_TARGET_MAP[target] || BIO_TARGET_MAP.common;

  const biomass = biomassFor(rarity, advanced);
  const cycles  = cyclesFor(rarity, large);

  // Best.Q-чан не тратит раствор на обычный имплант.
  const freeSolution = vat.freeCommonSolution && target === "common";
  const solution = freeSolution ? 0 : tgt.solution;

  // Запреты: потолок качества чана, «только обычные», гемункульские.
  const blocks = [];
  if (Q_ORDER.indexOf(target) > Q_ORDER.indexOf(vat.maxQuality))
    blocks.push(`${vat.label.split(" — ")[0]} не выращивает выше ${BIO_TARGET_MAP[vat.maxQuality].label}.`);
  if (vat.onlyCommon && advanced)
    blocks.push("Этот чан создаёт только ОБЫЧНЫЕ биоимпланты — необычные ему не по силам.");
  if (haemonculi && !vat.haemonculi)
    blocks.push("Гемункульские биоимпланты создаёт только чан Best.Q в лаборатории Гемункула.");

  return {
    vat, tgt, biomass, solution, cycles, freeSolution,
    needTemplate: tgt.template,
    hours: cycles * 24,
    mod: tgt.mod + vat.mod + (Number(gmMod) || 0),
    rerolls: vat.rerolls,
    blocks
  };
}

/**
 * Генетический шаблон через Исследование Medicae: успехов нужно тем больше,
 * чем габаритнее и сложнее имплант (границу внутри вилки выбирает ГМ).
 * Good.Q — 50/100/150 за одну редкость, Best.Q — 100/150/200.
 */
export const TEMPLATE_RESEARCH = {
  good: [50, 100, 150],
  best: [100, 150, 200],
  note: "Успехи считаются ЗА ОДНУ РЕДКОСТЬ импланта: имплант R2 Good.Q средних габаритов требует 200 успехов "
      + "(100 за редкость × 2). Конкретное значение внутри вилки выбирает ГМ по габаритам и сложности.",
  sources: "Извлечённый орган существа с нужным признаком · пробирка с обработанным генокодом · "
      + "шаблон, вытащенный пытками из разума сведущего существа · многомесячная селекция одного импланта "
      + "через один шаблон · пустой шаблон, записывающий лучшие попытки."
};

/** Успехи на шаблон для конкретной редкости и качества. */
export function templateSuccesses(quality, rarity, size = 1) {
  const row = TEMPLATE_RESEARCH[quality];
  if (!row) return null;
  const per = row[Math.max(0, Math.min(2, Number(size) || 1))];
  return per * Math.max(1, Number(rarity) || 1);
}
