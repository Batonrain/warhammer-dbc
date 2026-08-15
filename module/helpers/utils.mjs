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

export function _calcMaxCarry(idx) {
  const table = [
    0.9,2.25,4.5,9,18,27,36,45,56,68,
    78,90,112,125,337,450,675,900,1350,1800,
    2250,2900,3550,4200,4850,5500,6300,7250,8300,9550,
    11000,13000,15000,17000,20000,23000,26000,30000,35000,40000,
    46000,53000,70000,84000,106000,212000
  ];
  return table[Math.max(0, Math.min(idx, table.length - 1))];
}