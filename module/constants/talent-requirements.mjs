// module/constants/talent-requirements.mjs
// ════════════════════════════════════════════════════════════════════════
//  Разбор строки «Требования» таланта и сверка с листом персонажа.
//
//  Формы, встречающиеся в библиотеке (611 талантов, 921 требование):
//    «Нет»                     — требования отсутствуют
//    «WS 40», «Inf 40+»        — Характеристика не ниже N
//    «PR 3»                    — Пси-рейтинг не ниже N
//    «Порча 20+», «Бесчестье 30+» — Порча / Бесчестье не ниже N
//    «Tech-Use»                — навык изучен (ранг «Знает» и выше)
//    «Medicae+10»              — навык продвинут минимум на +10
//    «Trade (Voidfarer)»       — специализация группового навыка изучена
//    «Forbidden Lore (Warp) +20» — специализация продвинута
//    «Frenzy», «Quick Draw»    — талант (или черта) уже есть
//    «X или Y», «X / Y»        — достаточно любого из вариантов
//
//  Всё, что не разобралось (проза вроде «Создание Персонажа» или «5+ ячеек»),
//  помечается как unknown и НЕ считается невыполненным: лучше не показать
//  предупреждение, чем показать ложное.
// ════════════════════════════════════════════════════════════════════════

import { SKILLS_DEF, GROUP_SKILLS_DEF } from "./skills.mjs";
import { SKILL_RANKS } from "./characteristics.mjs";

/** Сокращения характеристик из требований → ключи системы. */
const CHAR_ALIASES = {
  WS: "ws", BS: "bs", S: "s", T: "t",
  A: "ag", AG: "ag", INT: "int", I: "int", IN: "int",
  P: "per", PER: "per", W: "wp", WP: "wp",
  F: "fel", FEL: "fel", INF: "inf"
};

/** Пишутся как характеристики, но живут в других полях листа. */
const SPECIAL_ALIASES = { COR: "corruption", PR: "psyRating" };

/** Английские названия навыков из требований → ключи системы. */
const SKILL_ALIASES = {
  "acrobatics": "acrobatics", "athletics": "athletics", "awareness": "awareness",
  "charm": "charm", "command": "command", "commerce": "commerce", "deceive": "deceive",
  "dodge": "dodge", "inquiry": "inquiry", "interrogate": "interrogate",
  "intimidate": "intimidate", "intimidation": "intimidate", "logic": "logic", "medicae": "medicae", "parry": "parry",
  "psyniscience": "psyniscience", "scrutiny": "scrutiny", "security": "security",
  "sleight of hand": "sleightOfHand", "stealth": "stealth", "survival": "survival",
  "tech-use": "techUse", "tech use": "techUse", "techuse": "techUse"
};

/** Английские названия групповых навыков → ключи системы. */
const GROUP_ALIASES = {
  "common lore": "commonLore", "forbidden lore": "forbiddenLore",
  "scholastic lore": "scholasticLore", "schol. lore": "scholasticLore",
  "for.lore": "forbiddenLore", "linguistics": "linguistics",
  "navigation": "navigation", "navigate": "navigation",
  "operate": "operate", "trade": "trade"
};

/** Кириллические двойники латиницы — в требованиях встречаются оба написания. */
const LOOKALIKE = { "А": "A", "В": "B", "Е": "E", "К": "K", "М": "M", "Н": "H",
                    "О": "O", "Р": "P", "С": "C", "Т": "T", "Х": "X" };

const deLookalike = (s) => String(s).replace(/[АВЕКМНОРСТХ]/g, c => LOOKALIKE[c] || c);
const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

/** Режет по запятым верхнего уровня — запятые внутри скобок не разделяют. */
function splitTop(str) {
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

/**
 * Разбивает «X или Y / Z» на варианты, не трогая содержимое скобок:
 * «Exotic Weapon Training (Flechette или Needle)» — это один атом,
 * а не два обрубка.
 */
function splitAlternatives(token) {
  const out = []; let depth = 0, cur = "";
  const src = String(token);
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (depth === 0) {
      const rest = src.slice(i);
      const m = /^(\s+или\s+|\s+\/\s+)/i.exec(rest);
      if (m) { out.push(cur); cur = ""; i += m[1].length - 1; continue; }
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map(x => x.trim()).filter(Boolean);
}

/** «A 60 и WS 50» — оба условия обязательны, значит это разные требования. */
function splitConjunction(token) {
  const out = []; let depth = 0, cur = "";
  const src = String(token);
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (depth === 0) {
      const m = /^(\s+и\s+)/i.exec(src.slice(i));
      if (m) { out.push(cur); cur = ""; i += m[1].length - 1; continue; }
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map(x => x.trim()).filter(Boolean);
}

/** Разбирает один вариант требования в структуру. */
function parseAtom(raw) {
  const text = raw.trim();
  if (!text) return { kind: "none", raw };

  // Характеристика: «WS 40», «Inf 40+», «А 35»
  let m = /^([A-Za-zА-Яа-яЁё.]{1,4})\s*(\d{1,3})\s*\+?$/.exec(text);
  if (m) {
    const abbr = deLookalike(m[1]).toUpperCase().replace(/\./g, "");
    const key = CHAR_ALIASES[abbr];
    if (key) return { kind: "char", key, value: Number(m[2]), raw };
    if (SPECIAL_ALIASES[abbr]) return { kind: SPECIAL_ALIASES[abbr], value: Number(m[2]), raw };
  }
  // Пси-рейтинг, Порча, Бесчестье словами
  m = /^(PR|Пси-?рейтинг|Порча|Бесчестье|Инфамия)\s*(\d{1,3})\s*\+?$/i.exec(text);
  if (m) {
    const w = m[1].toLowerCase();
    const kind = /^pr|^пси/.test(w) ? "psyRating" : (/порча/.test(w) ? "corruption" : "infamy");
    return { kind, value: Number(m[2]), raw };
  }

  // Групповой навык со специализацией: «Trade (Voidfarer)», «Forbidden Lore (Warp) +20»
  m = /^([^()+]+?)\s*\(([^)]*)\)\s*(?:\+\s*(\d{1,3}))?$/.exec(text);
  if (m) {
    const group = GROUP_ALIASES[norm(m[1])];
    if (group) return { kind: "groupSkill", group, specialty: m[2].trim(), bonus: Number(m[3] || 0), raw };
    // «Two Weapon Wielder (Melee)» и подобное — талант со специализацией
    return { kind: "talent", name: text, base: m[1].trim(), spec: m[2].trim(), raw };
  }

  // Навык с продвижением: «Medicae+10»
  m = /^([^+]+?)\s*\+\s*(\d{1,3})$/.exec(text);
  if (m) {
    const skill = SKILL_ALIASES[norm(m[1])];
    if (skill) return { kind: "skill", key: skill, bonus: Number(m[2]), raw };
    const group = GROUP_ALIASES[norm(m[1])];
    if (group) return { kind: "groupSkill", group, specialty: "", bonus: Number(m[2]), raw };
    return { kind: "unknown", raw };
  }

  // Просто имя: навык без продвижения или талант
  const skill = SKILL_ALIASES[norm(text)];
  if (skill) return { kind: "skill", key: skill, bonus: 0, raw };
  const group = GROUP_ALIASES[norm(text)];
  if (group) return { kind: "groupSkill", group, specialty: "", bonus: 0, raw };
  // Латиница без цифр — почти наверняка талант; кириллическая проза — не знаем.
  if (/^[A-Za-z][A-Za-z' \-.]*$/.test(text)) return { kind: "talent", name: text, raw };
  return { kind: "unknown", raw };
}

/** Строка требований → массив {raw, alts:[atom]}. */
export function parseRequirement(str) {
  const s = String(str || "").trim();
  if (!s || /^нет$/i.test(s) || s === "—" || s === "-") return [];
  const parts = [];
  for (const tok of splitTop(s)) {
    if (/^нет$/i.test(tok)) continue;
    // «X и Y» — два независимых требования, каждое обязательно.
    for (const conj of splitConjunction(tok)) {
      const alts = [];
      for (const alt of splitAlternatives(conj)) {
        const atom = parseAtom(alt);
        // Специализация вида «(A или B)» разворачивается в отдельные варианты.
        const spec = atom.specialty || atom.spec;
        if (spec && /\s+(?:или|\/)\s+/i.test(spec)) {
          for (const one of spec.split(/\s+(?:или|\/)\s+/i).map(x => x.trim()).filter(Boolean)) {
            alts.push(atom.kind === "groupSkill" ? { ...atom, specialty: one }
                                                 : { ...atom, spec: one, name: `${atom.base} (${one})` });
          }
        } else alts.push(atom);
      }
      parts.push({ raw: conj, alts });
    }
  }
  return parts;
}

// ── Проверка по актору ───────────────────────────────────────────────────

const rankBonus = (rank) => SKILL_RANKS[rank]?.bonus ?? -20;

/** Есть ли у актора талант/черта с таким именем (сравнение по англ. части). */
function hasTalent(actor, atom) {
  const wanted = norm((atom.base || atom.name || "").split("/")[0]);
  const spec   = norm(atom.spec || "");
  for (const i of actor.items) {
    if (i.type !== "talent" && i.type !== "trait") continue;
    const nm = norm(String(i.name).split("/")[0]);
    // Имя предмета может уже содержать специализацию в скобках.
    const bare = nm.replace(/\s*\([^)]*\)\s*$/, "");
    if (bare !== wanted && nm !== wanted) continue;
    if (!spec) return true;
    const itemSpec = norm(i.system?.specialization || "");
    const inName   = norm((/\(([^)]*)\)/.exec(nm) || [])[1] || "");
    if (itemSpec.includes(spec) || inName.includes(spec)) return true;
  }
  return false;
}

/** Проверка одного варианта: true / false / null (не смогли определить). */
function checkAtom(actor, atom) {
  const sys = actor.system || {};
  switch (atom.kind) {
    case "none": return true;
    case "char": {
      const total = sys.characteristics?.[atom.key]?.total;
      return total == null ? null : total >= atom.value;
    }
    case "psyRating": {
      const pr = sys.psyker?.rating;
      return pr == null ? null : Number(pr) >= atom.value;
    }
    case "corruption": return (Number(sys.corruption?.value) || 0) >= atom.value;
    case "infamy":     return (Number(sys.characteristics?.inf?.total) || 0) >= atom.value;
    case "skill": {
      const sk = sys.skills?.[atom.key];
      if (!sk || !SKILLS_DEF[atom.key]) return null;
      return rankBonus(sk.rank) >= atom.bonus;
    }
    case "groupSkill": {
      const arr = sys.groupSkills?.[atom.group];
      if (!Array.isArray(arr) || !GROUP_SKILLS_DEF[atom.group]) return null;
      const want = norm(atom.specialty);
      const fit = arr.filter(e => !want || norm(e?.specialty).includes(want));
      if (!fit.length) return false;
      return fit.some(e => rankBonus(e.rank) >= atom.bonus);
    }
    case "talent": return hasTalent(actor, atom);
    default: return null;                      // проза — не проверяем
  }
}

/**
 * Сверяет требования таланта с листом.
 * @returns {{state:"ok"|"fail"|"unknown", unmet:string[], parts:object[]}}
 */
export function checkRequirement(actor, str) {
  const parts = parseRequirement(str);
  if (!actor || !parts.length) return { state: "ok", unmet: [], parts: [] };

  const detail = [];
  let anyFail = false, anyUnknown = false;

  for (const p of parts) {
    // Достаточно любого из вариантов; неизвестный вариант не даёт провалить.
    const results = p.alts.map(a => checkAtom(actor, a));
    let state;
    if (results.some(r => r === true)) state = "ok";
    else if (results.some(r => r === null)) state = "unknown";
    else state = "fail";

    if (state === "fail") anyFail = true;
    if (state === "unknown") anyUnknown = true;
    detail.push({ raw: p.raw, state });
  }

  return {
    state: anyFail ? "fail" : (anyUnknown ? "unknown" : "ok"),
    unmet: detail.filter(d => d.state === "fail").map(d => d.raw),
    parts: detail
  };
}
