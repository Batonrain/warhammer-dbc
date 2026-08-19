export const HIT_LOCATIONS = [
  { min: 1,  max: 10,  label: "Голова"  },
  { min: 11, max: 20,  label: "П. Рука" },
  { min: 21, max: 30,  label: "Л. Рука" },
  { min: 31, max: 70,  label: "Торс"    },
  { min: 71, max: 85,  label: "П. Нога" },
  { min: 86, max: 100, label: "Л. Нога" }
];

export const MELEE_STANCES = {
  standard:    { label: "Стандартная",  wsBonus: 0,   dodgeBonus: 0,   parryBonus: 0  },
  aggressive:  { label: "Агрессивная",  wsBonus: 10,  dodgeBonus: -10, parryBonus: 0  },
  defensive:   { label: "Защитная",     wsBonus: -20, dodgeBonus: 10,  parryBonus: 10 },
  covering:    { label: "Прикрывающая", wsBonus: 0,   dodgeBonus: 0,   parryBonus: 0  },
  springing:   { label: "Пружинящая",   wsBonus: 0,   dodgeBonus: 10,  parryBonus: 0  },
  rapidstrike: { label: "Частокол",     wsBonus: 0,   dodgeBonus: 0,   parryBonus: 0  }
};

// null = нельзя парировать
export const BALANCE_PARRY_MOD = {
  "-2": null,
  "-1": -10,
  "0":   0,
  "1":  10,
  "2":  15
};

export const MELEE_TECHNIQUES = {
  standard: {
    label: "Обычная Атака", wsBonus: 0,
    note: "Стандартная рукопашная атака.",
    targetDodgeMod: 0, targetParryMod: 0, chatNote: ""
  },
  sweep: {
    label: "Широкий Взмах", wsBonus: 0,
    note: "Уклонение от этой атаки −10. Парирование этой атаки +10.",
    targetDodgeMod: -10, targetParryMod: 10,
    chatNote: "🛡️ Цель: Парирование +10 | Уклонение −10"
  },
  thrust: {
    label: "Выпад", wsBonus: 0,
    note: "Парирование этой атаки −10. Уклонение от неё +10.",
    targetDodgeMod: 10, targetParryMod: -10,
    chatNote: "🛡️ Цель: Парирование −10 | Уклонение +10"
  },
  saw: {
    label: "Пила", wsBonus: -10,
    note: "WS −10. Игнорирует силовые щиты.",
    targetDodgeMod: 0, targetParryMod: 0,
    chatNote: "⚡ Игнорирует силовые щиты"
  },
  stun: {
    label: "Оглушить", wsBonus: -20,
    note: "Избирательная атака в голову (−20). Успех → Оглушение вместо урона.",
    targetDodgeMod: 0, targetParryMod: 0,
    chatNote: "😵 При попадании — Оглушение (голова)"
  },
  knockdown: {
    label: "Повалить", wsBonus: 0,
    note: "Состязание: Athletics S+0 vs Athletics S+0.",
    targetDodgeMod: 0, targetParryMod: 0,
    chatNote: "⚡ Состязательный бросок Athletics"
  },
  grapple: {
    label: "Захват", wsBonus: 0,
    note: "Парируется со штрафом −30.",
    targetDodgeMod: 0, targetParryMod: -30,
    chatNote: "🤼 Парирование −30"
  },
  charge: {
    label: "Натиск", wsBonus: 20,
    note: "Движение ≥4м + атака. WS +20.",
    targetDodgeMod: 0, targetParryMod: 0, chatNote: ""
  },
  fullatk: {
    label: "Полная Атака", wsBonus: 30,
    note: "WS +30. Теряет Физические Избегания до следующего хода.",
    targetDodgeMod: 0, targetParryMod: 0,
    chatNote: "⚠️ Атакующий теряет Избегания до следующего хода"
  },
  careful: {
    label: "Осторожная Атака", wsBonus: -10,
    note: "WS −10. Физические Избегания атакующего +10 до следующего хода.",
    targetDodgeMod: 0, targetParryMod: 0,
    chatNote: "🛡️ Атакующий: Избегания +10 до следующего хода"
  },
  feint: {
    label: "Финт", wsBonus: 0,
    note: "WS vs WS. При победе цель не может уклоняться.",
    targetDodgeMod: 0, targetParryMod: 0,
    chatNote: "⚡ Состязательный бросок WS"
  },
  press: {
    label: "Давление", wsBonus: 0,
    note: "WS vs WS. При победе цель перемещается на кол-во Успехов в метрах.",
    targetDodgeMod: 0, targetParryMod: 0,
    chatNote: "⚡ Состязательный бросок WS"
  }
};
// ── Хваты рукопашного оружия (стр. 39) ──────────────────────────────────────
// Модификаторы применяются к атаке: ws — к порогу WS; addProp — добавляемое
// свойство; rngNote/dmgNote — текстовые эффекты (урон/дальность применяются
// вручную/по профилю, т.к. зависят от S.b и базового профиля). Ключ = сокращение
// из таблиц оружия. Первый в профиле — основной хват, в скобках — альтернативы.
//   Механические поля хвата:
//     ws       — модификатор всех тестов WS этим оружием (всегда).
//     secWs    — доп. мод WS, только если хват вторичный (не основной для оружия).
//     dmgFlat  — плоский мод урона (всегда, напр. Кл −2).
//     secDmg   — плоский мод урона, только как вторичный хват (напр. 2р +3).
//     addProp  — добавляемое особое свойство (precise / cheapShot).
//     sbHalf   — S.b в расчёте урона считается как ½ (▲).
//     balSet   — Баланс оружия принудительно ставится в это значение (для парирования).
//     rngSet/rngMod — изменение досягаемости (в основном справочно).
export const GRIPS = {
  "1р":  { label: "Одноручный (1р)",  ws: 0,   secWs: -5, rngMod: +1, secBal: -1, note: "Занимает 1 руку. Как вторичный хват двуручного: −1 кубик урона (или −4, если кубик один), Баланс −1, WS −5, +1 Rng." },
  "2р":  { label: "Двуручный (2р)",   ws: 0,   secDmg: +3, note: "Занимает 2 руки. Как вторичный хват одноручного: +3 урона, +10 к приёмам Оглушить/Повалить." },
  "Об":  { label: "Обратный (Об)",    ws: -10, sbHalf: true, rngMod: -2, note: "−10 WS (Финт +10, Выпад — без штрафа), урон ½S.b (▲), −2 Rng (мин 0). Можно метать оружие (Rng S.b×1, BS −10)." },
  "Бл":  { label: "Ближний (Бл)",     ws: 0,   addProp: "precise", balSet: -2, rngMod: -2, note: "Свойство Precise, −2 Rng (мин 0), Баланс −2, нельзя в Борьбе." },
  "Кл":  { label: "Кулачный (Кл)",    ws: 0,   dmgFlat: -2, rngSet: 0, note: "Rng 0, −2 урона, считается кулаком (только профили топора/крюка/молота)." },
  "Мх":  { label: "Мордхау (Мх)",     ws: -5,  note: "−5 WS, профиль одноручной булавы в двуручном хвате (удар яблоком/гардой)." },
  "П":   { label: "Предплечье (П)",   ws: 0,   note: "На предплечье, не занимает ладонь; нельзя выбить/вырвать." },
  "Л":   { label: "Ладонь (Л)",       ws: 0,   note: "На пальцах-лезвиях; нельзя атаковать с занятой ладонью." },
  "П+Л": { label: "Предплечье+Ладонь (П+Л)", ws: 0, note: "Эффекты обоих хватов; смена — 5 Ходов." },
  "Ног": { label: "Нога (Ног)",       ws: 0,   note: "Атака ногой; +20 по лежачей цели меньшего Размера при проходе через неё." },
  "Гол": { label: "Голова (Гол)",     ws: 0,   note: "Голова как отдельная «рука» (Multiple Arms +1); одна атака головой в Ход." },
  "Хв":  { label: "Хвост (Хв)",       ws: 0,   addProp: "cheapShot", balSet: -2, rngSet: 0, note: "Rng 0, Баланс −2, свойство Cheap Shot." }
};

// Парсит строку хватов из профиля («1р (2р, Об)» или «1р [Об]») в список ключей;
// первый — основной. Возвращает [] если распознать нечего.
export function parseGrips(str) {
  if (!str) return [];
  const keys = String(str).match(/П\+Л|1р|2р|Об|Бл|Кл|Мх|Ног|Гол|Хв|П|Л/g) || [];
  return [...new Set(keys)].filter(k => GRIPS[k]);
}

// Сводит эффекты выбранного хвата с учётом, основной он или вторичный.
// isSecondary — хват отличается от основного (первого в профиле оружия).
export function gripEffects(key, isSecondary = false) {
  const g = GRIPS[key];
  if (!g) return { ws: 0, dmgFlat: 0, addProps: [], sbHalf: false, label: "", note: "", balSet: null };
  const ws      = (g.ws || 0) + (isSecondary ? (g.secWs || 0) : 0);
  const dmgFlat = (g.dmgFlat || 0) + (isSecondary ? (g.secDmg || 0) : 0);
  return {
    ws, dmgFlat,
    addProps: g.addProp ? [g.addProp] : [],
    sbHalf: !!g.sbHalf,
    balSet: (g.balSet ?? null),
    label: g.label,
    note: g.note
  };
}
