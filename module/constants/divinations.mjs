// module/constants/divinations.mjs
// ════════════════════════════════════════════════════════════════════════
//  Предсказания («Родные миры и Предсказания», таблица к100).
//
//  chars        — прямые модификаторы ЗНАЧЕНИЯ характеристик;
//  charChoices  — «X или Y»: выбор в диалоге при получении предсказания;
//  grants       — таланты, Раны, Порча, Очки Бесчестья;
//  rollMods     — ситуативное: приходит галочкой в диалог броска.
//
//  Ключи: ws bs s t ag int per wp fel inf. В книге: P=per, I=int, W=wp,
//  F=fel, A/Ag=ag, S=s, T=t, In=int.
// ════════════════════════════════════════════════════════════════════════

export const DIVINATION_SOURCE = "Родные миры и Предсказания";

export const DIVINATIONS = [
  {
    key: "gift", min: 1, max: 1,
    text: "Порча души одаривает плоть",
    effect: "Сделайте бросок по таблице Даров один раз.",
    giftRoll: true
  },
  {
    key: "fear", min: 2, max: 5,
    text: "Верь своему страху",
    effect: "P +5 и талант Paranoia.",
    chars: { per: 5 }, grants: { talents: ["Paranoia"] }
  },
  {
    key: "truthdeath", min: 6, max: 9,
    text: "Смерть во имя истины есть награда",
    effect: "Талант Fearless.",
    grants: { talents: ["Fearless"] }
  },
  {
    key: "pain", min: 10, max: 13,
    text: "Боль приносит откровения",
    effect: "Получив первый раз за бой Критическую Рану, бросьте 1к10. На 10, получив урон, игнорируйте критический эффект.",
    rollMods: [{ key: "pain-crit", when: { kind: "damage" }, value: 0,
      label: "Боль приносит откровения: 1к10, на 10 критический эффект игнорируется",
      note: "Первая Критическая Рана за бой." }]
  },
  {
    key: "boon", min: 14, max: 17,
    text: "Будь благом братьям и погибелью врагам",
    effect: "Талант Hatred (любая) и Peer (повязанные с персонажем).",
    choices: [
      { key: "boon-hatred", label: "Hatred", type: "target",
        hint: "Кого персонаж ненавидит.",
        talentTemplate: "Hatred ({v})" },
      { key: "boon-peer", label: "Peer", type: "target",
        hint: "С кем персонаж повязан.",
        talentTemplate: "Peer ({v})" }
    ]
  },
  {
    key: "wise", min: 18, max: 21,
    text: "Мудрые учатся на чужих ошибках",
    effect: "Ag или In +3; WS или BS −3.",
    charChoices: [
      { label: "Прибавка +3", options: [{ label: "Ag +3", chars: { ag: 3 } }, { label: "In +3", chars: { int: 3 } }] },
      { label: "Убавка −3",   options: [{ label: "WS −3", chars: { ws: -3 } }, { label: "BS −3", chars: { bs: -3 } }] }
    ]
  },
  {
    key: "killfirst", min: 22, max: 25,
    text: "Убей врага прежде, чем он солжет",
    effect: "Rapid Reaction или Lightning Reflexes.",
    choices: [{ key: "kill-talent", label: "Талант", type: "one",
      hint: "Выберите талант реакции.",
      options: [
        { label: "Rapid Reaction",     grants: { talents: ["Rapid Reaction"] } },
        { label: "Lightning Reflexes", grants: { talents: ["Lightning Reflexes"] } }
      ] }]
  },
  {
    key: "facets", min: 26, max: 29,
    text: "У истины тысяча граней",
    effect: "P и I +3; первое получение очков Порчи в сессию наделяет +1 очком Порчи.",
    chars: { per: 3, int: 3 },
    rollMods: [{ key: "facets-corruption", when: { kind: "corruption" }, value: 1,
      label: "У истины тысяча граней: первое получение Порчи за сессию (+1)",
      note: "Один раз за игровую сессию." }]
  },
  {
    key: "doubt", min: 30, max: 33,
    text: "Раздумья сбивают с пути",
    effect: "I −3, W +3.",
    chars: { int: -3, wp: 3 }
  },
  {
    key: "lies", min: 34, max: 38,
    text: "Ложь порождает возмездие",
    effect: "F или S +3; W или T −3.",
    charChoices: [
      { label: "Прибавка +3", options: [{ label: "F +3", chars: { fel: 3 } }, { label: "S +3", chars: { s: 3 } }] },
      { label: "Убавка −3",   options: [{ label: "W −3", chars: { wp: -3 } }, { label: "T −3", chars: { t: -3 } }] }
    ]
  },
  {
    key: "aimless", min: 39, max: 43,
    text: "Разум без цели блуждает во тьме",
    effect: "W или I +3.",
    charChoices: [
      { label: "Прибавка +3", options: [{ label: "W +3", chars: { wp: 3 } }, { label: "I +3", chars: { int: 3 } }] }
    ]
  },
  {
    key: "worthy", min: 44, max: 49,
    text: "Если цель важна, за неё стоит умереть",
    effect: "T или W +3; F или S −3.",
    charChoices: [
      { label: "Прибавка +3", options: [{ label: "T +3", chars: { t: 3 } }, { label: "W +3", chars: { wp: 3 } }] },
      { label: "Убавка −3",   options: [{ label: "F −3", chars: { fel: -3 } }, { label: "S −3", chars: { s: -3 } }] }
    ]
  },
  {
    key: "darkdreams", min: 50, max: 54,
    text: "Тёмные мечты лежат на тёмном сердце",
    effect: "При бросках мутаций считайте Inf.b на 1 выше.",
    mutationInfBonus: 1
  },
  {
    key: "violence", min: 55, max: 59,
    text: "Насилие решает всё",
    effect: "WS или BS +3; I или F −3.",
    charChoices: [
      { label: "Прибавка +3", options: [{ label: "WS +3", chars: { ws: 3 } }, { label: "BS +3", chars: { bs: 3 } }] },
      { label: "Убавка −3",   options: [{ label: "I −3", chars: { int: -3 } }, { label: "F −3", chars: { fel: -3 } }] }
    ]
  },
  {
    key: "ignorance", min: 60, max: 63,
    text: "Невежество — удел слабых",
    effect: "I +5; F −3.",
    chars: { int: 5, fel: -3 }
  },
  {
    key: "madthrive", min: 64, max: 67,
    text: "Лишь безумные будут процветать",
    effect: "W +3 и +3 очка Порчи.",
    chars: { wp: 3 }, grants: { corruption: 3 }
  },
  {
    key: "suspicious", min: 68, max: 71,
    text: "Подозрительный разум — здоровый разум",
    effect: "Талант Paranoia и Фобия (−1).",
    grants: { talents: ["Paranoia"] },
    phobia: 1
  },
  {
    key: "suffering", min: 72, max: 75,
    text: "Страдание — безжалостный учитель",
    effect: "Первый раз за игровую сессию, когда персонаж получает урон, он получает бонус +20 к следующей проверке до конца своего следующего хода.",
    rollMods: [{ key: "suffering-bonus", when: { kind: "skill" }, value: 20,
      label: "Страдание — безжалостный учитель: бонус за полученный урон (+20)",
      note: "Первый раз за игровую сессию, до конца следующего хода." }]
  },
  {
    key: "onefear", min: 76, max: 79,
    text: "Есть лишь один истинный страх — умереть, подведя Богов",
    effect: "+5 Ран и +5 T.",
    chars: { t: 5 }, grants: { wounds: 5 }
  },
  {
    key: "service", min: 80, max: 83,
    text: "Лишь со смертью завершается служение",
    effect: "Первый раз за игровую сессию, когда персонаж получает очки Усталости, уменьшите их количество на 1 (до минимума 0).",
    rollMods: [{ key: "service-fatigue", when: { kind: "fatigue" }, value: -1,
      label: "Лишь со смертью завершается служение: −1 к получаемой Усталости",
      note: "Первый раз за игровую сессию." }]
  },
  {
    key: "innocence", min: 84, max: 87,
    text: "Невинность есть иллюзия",
    effect: "I +5 и талант Analytical Eye.",
    chars: { int: 5 }, grants: { talents: ["Analytical Eye"] }
  },
  {
    key: "bornwar", min: 88, max: 91,
    text: "Ты рождён для войны",
    effect: "WS, BS, A или S +3; I или F −3.",
    charChoices: [
      { label: "Прибавка +3", options: [
        { label: "WS +3", chars: { ws: 3 } }, { label: "BS +3", chars: { bs: 3 } },
        { label: "A +3",  chars: { ag: 3 } }, { label: "S +3",  chars: { s: 3 } }
      ] },
      { label: "Убавка −3", options: [{ label: "I −3", chars: { int: -3 } }, { label: "F −3", chars: { fel: -3 } }] }
    ],
    bookNote: "В книге в списке прибавки «A» указана дважды (WS, BS, A, S или A) — здесь она оставлена один раз."
  },
  {
    key: "faith", min: 92, max: 95,
    text: "Ничто не заменит веру",
    effect: "W +3 и талант Idolater.",
    chars: { wp: 3 }, grants: { talents: ["Idolater"] }
  },
  {
    key: "givelife", min: 96, max: 99,
    text: "Даже не имеющий ничего может отдать свою жизнь",
    effect: "Когда персонаж сжигает Inf для Чудесного Спасения, бросьте 1к10. При результате 10 он выживает, но не снижает свой Inf.",
    rollMods: [{ key: "givelife-burn", when: { kind: "infamyBurn" }, value: 0,
      label: "Даже не имеющий ничего: 1к10, на 10 Inf не снижается",
      note: "При сжигании Inf на Чудесное Спасение." }]
  },
  {
    key: "howserve", min: 100, max: 100,
    text: "Не спрашивай почему ты служишь. Спрашивай как",
    effect: "Получите дополнительное Очко Бесчестья.",
    grants: { infamyPoint: 1 }
  }
];

export const DIVINATION_BY_KEY = Object.fromEntries(DIVINATIONS.map(d => [d.key, d]));

const CHAR_ABBR = { ws: "WS", bs: "BS", s: "S", t: "T", ag: "A", int: "I", per: "P", wp: "W", fel: "F", inf: "Inf" };

/** «01» или «02-05» — колонка к100. */
export function rollLabel(d) {
  return d.min === d.max ? String(d.min).padStart(2, "0")
    : `${String(d.min).padStart(2, "0")}-${String(d.max).padStart(2, "0")}`;
}

/** «+5 P, −3 F» — подпись прямых модификаторов. */
export function charModLabel(chars = {}) {
  return Object.entries(chars)
    .map(([k, v]) => `${v >= 0 ? "+" : "−"}${Math.abs(v)} ${CHAR_ABBR[k] || k.toUpperCase()}`)
    .join(", ");
}

/** Предсказание по броску к100. */
export function divinationByRoll(roll) {
  const r = Math.max(1, Math.min(100, Number(roll) || 1));
  return DIVINATIONS.find(d => r >= d.min && r <= d.max) || null;
}

/** Требует ли предсказание диалога выбора. */
export function hasChoices(d) {
  return !!((d?.charChoices || []).length || (d?.choices || []).length);
}
