/**
 * Экранировать текст перед вставкой в HTML: & < > " ' — всё, чем можно выйти
 * из текста или из атрибута. Имена предметов и акторов задаёт игрок у себя на
 * листе, а собранная строками разметка разбирается как HTML, — без этого
 * «<img src=x onerror=…>» в названии исполняется у того, кто её видит.
 *
 * Работу делает foundry.utils.escapeHTML, своей замены ему не нужно. Обёртка
 * здесь ради двух вещей: пустое значение даёт пустую строку, а не слово
 * «null», и на проект остаётся одна точка вызова вместо двух десятков
 * разошедшихся копий (wdbc-84g).
 */
export const esc = v => foundry.utils.escapeHTML(v ?? "");

/**
 * Навесить обработчик на все узлы под корнем — замена `html.find(sel).on(ev, fn)`
 * при снятии листов с jQuery (wdbc-z0z). Та же форма записи, что у jQuery,
 * поэтому переезд модуля читается построчно, а не как переписывание.
 *
 * @param {ParentNode} root  корень листа или окна
 */
export const on = (root, selector, event, handler) =>
  root.querySelectorAll(selector).forEach(el => el.addEventListener(event, handler));

export function _getAmmoSpent(weapon, rofMode) {
  const sys = weapon.system;
  switch (rofMode) {
    case "single":      return 1;
    case "semi":        return sys.rof_semi  || 1;
    case "full":        return sys.rof_full  || 1;
    case "suppression": return Math.max(sys.rof_semi || 0, sys.rof_full || 0) || 1;
    default:            return 0;
  }
}

export function _buildAmmoModString(sys) {
  const parts = [];
  if (sys.attackMod      && sys.attackMod      !== 0)
    parts.push(`Атака ${sys.attackMod >= 0 ? "+" : ""}${sys.attackMod}`);
  if (sys.damageMod      && sys.damageMod      !== 0)
    parts.push(`Урон ${sys.damageMod >= 0 ? "+" : ""}${sys.damageMod}`);
  if (sys.penetrationMod && sys.penetrationMod !== 0)
    parts.push(`Проб. ${sys.penetrationMod >= 0 ? "+" : ""}${sys.penetrationMod}`);
  if (sys.damageTypeOverride)
    parts.push(`→${sys.damageTypeOverride}`);
  if (sys.rangeMod       && sys.rangeMod       !== 0)
    parts.push(`Дальн. ${sys.rangeMod >= 0 ? "+" : ""}${sys.rangeMod}м`);
  if (sys.rangeMultiplier && sys.rangeMultiplier !== 1)
    parts.push(`Дальн. ×${sys.rangeMultiplier}`);
  if (sys.special)
    parts.push(sys.special);
  return parts.join(", ");
}

export function _buildAmmoModDetails(sys) {
  const lines = [];
  if (sys.attackMod      && sys.attackMod      !== 0)
    lines.push(`📊 Атака: ${sys.attackMod >= 0 ? "+" : ""}${sys.attackMod}`);
  if (sys.damageMod      && sys.damageMod      !== 0)
    lines.push(`💥 Урон: ${sys.damageMod >= 0 ? "+" : ""}${sys.damageMod}`);
  if (sys.penetrationMod && sys.penetrationMod !== 0)
    lines.push(`🔩 Пробитие: ${sys.penetrationMod >= 0 ? "+" : ""}${sys.penetrationMod}`);
  if (sys.damageTypeOverride)
    lines.push(`🔄 Тип урона: → ${sys.damageTypeOverride}`);
  if (sys.rangeMod       && sys.rangeMod       !== 0)
    lines.push(`📏 Дальность: ${sys.rangeMod >= 0 ? "+" : ""}${sys.rangeMod}м`);
  if (sys.rangeMultiplier && sys.rangeMultiplier !== 1)
    lines.push(`📏 Дальность ×${sys.rangeMultiplier}`);
  if (sys.special)
    lines.push(`✨ Свойства: ${sys.special}`);
  if (sys.description)
    lines.push(`<em>${sys.description}</em>`);
  return lines.join("<br/>");
}

export function _degWord(n) {
  if (n === 1) return "степень";
  if (n < 5)  return "степени";
  return "степеней";
}

/** Разбивает строку по запятым верхнего уровня (запятые внутри скобок не режут). */
export function splitTopLevel(str) {
  const out = []; let depth = 0, cur = "";
  for (const ch of String(str)) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map(s => s.trim()).filter(Boolean);
}

export function _getActorFromIds(actorId, tokenId) {
  if (tokenId) {
    const token = canvas.tokens?.get(tokenId);
    if (token?.actor) return token.actor;
  }
  if (actorId) return game.actors.get(actorId);
  return null;
}

// Канонические сокращения бонусов характеристик (Warhammer FFG).
// Бонус = десятки значения характеристики. Поддерживаются и краткие (A,I,P,W,F),
// и привычные расширенные формы (Ag,Int,Per,WP,Fel) — как алиасы.
const _CHAR_BONUS_KEYS = {
  ws: "ws", bs: "bs", s: "s", t: "t",
  a: "ag",  ag: "ag",
  i: "int", int: "int",
  p: "per", per: "per",
  w: "wp",  wp: "wp",
  f: "fel", fel: "fel",
  inf: "inf",
  cor: "__cor"          // Порча — отдельный бонус, не из characteristics
};

/**
 * Подставляет бонусы характеристик в строку формулы урона/дальности.
 * Канонические токены: WS.b, BS.b, S.b, T.b, A.b (Ловкость), I.b (Интеллект),
 * P.b (Восприятие), W.b (Воля), F.b (Товарищество), Inf.b (Влияние), Cor.b (Порча).
 * Регистр и пробелы не важны: «1d10 + I.b», «1d5+a.b» и т.п. работают.
 * @param {object} chars  actor.system.characteristics
 * @param {number} corB   actor.system.corruptionBonus (для Cor.b)
 */
export function resolveCharFormula(formula, chars, corB = 0) {
  return String(formula ?? "").replace(
    /(?<![A-Za-z])(Int|Inf|Cor|Per|Fel|WS|BS|Ag|WP|S|T|A|I|P|W|F)\.b(?![A-Za-z0-9])/gi,
    (m, tok) => {
      const key = _CHAR_BONUS_KEYS[tok.toLowerCase()];
      if (key === "__cor") return corB;
      return chars?.[key]?.bonus ?? 0;
    }
  );
}

/**
 * Название ресурса «Очки Судьбы» в зависимости от персонажа:
 *   субраса Друкхари → «Очки Боли»; Хаосит → «Очки Бесчестья»; иначе «Очки Судьбы».
 * Возвращает { plural, one, word } (множ., ед., короткое слово).
 */
export function fateTerm(system) {
  if (system?.race === "drukhari")
    return { plural: "Очки Боли", one: "Очко Боли", word: "Боль" };
  if (system?.alignment === "heretic")
    return { plural: "Очки Бесчестья", one: "Очко Бесчестья", word: "Бесчестье" };
  return { plural: "Очки Судьбы", one: "Очко Судьбы", word: "Судьба" };
}

// ── Максимальный Вес (стр. 27) ──────────────────────────────────────────────
// Строка таблицы — [Ношение, Подъём, Толкание] для суммы S.b + T.b. Три
// столбца хранятся отдельно, а не выводятся сдвигом строки: сдвиг сходится с
// книгой только на первых четырёх строках, а дальше расходится (при сумме 4
// книга даёт Подъём 36, а строка 5 — 27), и Астартес с суммой 16 получал
// Подъём 900 вместо 1350 и Толкание 1350 вместо 2700.
//
// В прежнем одностолбцовом наборе разошёлся и сам столбец Ношения: с суммы 43
// стояли числа Подъёма (84 000 вместо 80 000, 106 000 вместо 92 000,
// 212 000 вместо 106 000).
//
// Числа взяты из книги как есть, включая её собственные неровности: строка 9
// даёт Подъём 134 (а не 136), строка 13 — Подъём 450 при Ношении 125.
const CARRY_TABLE = [
  [0.9, 2.25, 4.5],       [2.25, 4.5, 9],          [4.5, 9, 18],            [9, 18, 36],
  [18, 36, 72],           [27, 54, 108],           [36, 72, 144],           [45, 90, 180],
  [56, 112, 224],         [68, 134, 268],          [78, 156, 312],          [90, 180, 360],
  [112, 224, 448],        [125, 450, 900],         [337, 674, 1348],        [450, 900, 1800],
  [675, 1350, 2700],      [900, 1800, 3600],       [1350, 2700, 5400],      [1800, 3600, 7200],
  [2250, 4500, 9000],     [2900, 5800, 11600],     [3550, 7100, 14200],     [4200, 8400, 16800],
  [4850, 9700, 19400],    [5500, 11000, 22000],    [6300, 12600, 25200],    [7250, 14500, 29000],
  [8300, 16600, 33200],   [9550, 19100, 38200],    [11000, 22000, 44000],   [13000, 26000, 52000],
  [15000, 30000, 60000],  [17000, 34000, 68000],   [20000, 40000, 80000],   [23000, 46000, 92000],
  [26000, 52000, 104000], [30000, 60000, 120000],  [35000, 70000, 140000],  [40000, 80000, 160000],
  [46000, 92000, 184000], [53000, 106000, 212000], [70000, 140000, 280000], [80000, 160000, 320000],
  [92000, 184000, 368000],[106000, 212000, 424000]
];

/** Строка Максимального Веса по сумме S.b + T.b: Ношение, Подъём, Толкание. */
export function carryRow(idx) {
  const row = CARRY_TABLE[Math.max(0, Math.min(parseInt(idx) || 0, CARRY_TABLE.length - 1))];
  return { carry: row[0], lift: row[1], push: row[2] };
}

/** Ношение по сумме S.b + T.b. */
export function _calcMaxCarry(idx) {
  return carryRow(idx).carry;
}