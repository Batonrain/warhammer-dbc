// module/rules/elite-requirements.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Требования и цена Элитного архетипа (корбук стр. 114-164).
//
//  Требований два блока, и разница не косметическая:
//
//    ОБЯЗАТЕЛЬНЫЙ — не выполнено, и архетипа нет в списке доступных вовсе:
//        человеку не стать Ведьмой Культа, сколько опыта ни трать;
//    ВТОРИЧНЫЙ    — не выполнено, и требование красится красным, но взять
//        архетип можно: разрешить исключение вправе ГМ.
//
//  Виды записей у блоков одни и те же — блоки различаются строгостью, а не
//  тем, что в них можно потребовать. Требуемый Талант поэтому кладётся в любой
//  из двух: обычно во вторичный, но «без этого Таланта ты не он» тоже бывает.
//
//  Особые виды:
//    «Одно из» — ИЛИ-группа: выполнено, если выполнена хоть одна вложенная
//        запись. Так пишется «Ведьма ИЛИ Укротитель»;
//    счётчик у Таланта и у групповых Навыков — «Hatred, любые 3»: считаются
//        разные специализации, а не повторы одной.
//
//  Свободная строка машиной не проверяется вовсе: она не «провалена», а помечена
//  как ручная — читает её ГМ.
//
//  Цена: каждый следующий Элитный архетип удваивается — ×2 за второй, ×4 за
//  третий, ×8 за четвёртый. Считается от базовой цены самого архетипа.
//
//  Здесь нет ни Foundry, ни компендиумов: на вход идут описание требований и
//  «снимок» персонажа. Поэтому правило проверяется без запуска мира.
// ════════════════════════════════════════════════════════════════════════════

import { WARP_GODS } from "../constants/veil.mjs";
import { CHARACTERISTICS } from "../constants/characteristics.mjs";
import { SKILL_RANKS } from "../constants/characteristics.mjs";
import { specCovers, matchSpec } from "../constants/skill-specializations.mjs";

/** Покровительства для выбора: боги Варпа плюс «любое». */
export const PATRON_ANY = "any";
export const PATRON_OPTIONS = [
  { key: PATRON_ANY, label: "Любое" },
  ...WARP_GODS.map(g => ({ key: g.key, label: g.label }))
];

/**
 * Виды записей — общие для обоих блоков. `drop` — тип документа, который
 * кладётся в запись перетаскиванием.
 */
export const REQ_KINDS = [
  { key: "race",           label: "Раса",            drop: "race"    },
  { key: "subrace",        label: "Субраса",         drop: "subrace" },
  { key: "notEldar",       label: "Не эльдар (расы Основной книги)" },
  { key: "trait",          label: "Черта",           drop: "trait"   },
  { key: "talent",         label: "Талант",          drop: "talent"  },
  { key: "patron",         label: "Покровительство"  },
  { key: "skill",          label: "Умение"           },
  { key: "corruption",     label: "Порча"            },
  { key: "infamy",         label: "Бесчестие"        },
  { key: "characteristic", label: "Характеристика"   },
  { key: "xp",             label: "Опыт"             },
  { key: "other",          label: "Другое"           },
  { key: "or",             label: "Одно из (ИЛИ)"    }
];

/** Тип документа, который принимает запись этого вида; null — дропа нет. */
export const reqDropType = kind => REQ_KINDS.find(k => k.key === kind)?.drop || null;

/** Пустая заготовка требований — её же кладёт схема предмета. */
export const blankEliteReq = () => ({ primary: [], secondary: [] });

/** Расы группы «Аэльдари» (races/Аэльдари) — для требования «Не эльдар». */
export const ELDAR_RACE_KEYS = ["azuriane", "drukhari", "exodite", "ynnari", "harlequin", "halfEldar"];

const num = v => Number(v) || 0;
const RANKS = ["untrained", "knows", "trained", "veteran", "expert"];
const rankIdx = rank => Math.max(0, RANKS.indexOf(rank || "untrained"));
/** Сколько предметов требуется: пусто и 0 значат «один». */
const wantCount = e => Math.max(1, num(e?.count) || 1);

/**
 * Цена архетипа для персонажа: каждый следующий вдвое дороже предыдущего.
 * @param {number} base   цена самого архетипа
 * @param {number} taken  сколько Элитных архетипов у персонажа уже есть
 */
export function eliteCost(base, taken = 0) {
  const b = Math.max(0, num(base));
  return b * Math.pow(2, Math.max(0, num(taken)));
}

/** Подпись множителя для подсказки: «×4 — третий Элитный архетип». */
export function eliteCostNote(taken = 0) {
  const n = Math.max(0, num(taken));
  if (!n) return "";
  const words = ["первый", "второй", "третий", "четвёртый", "пятый", "шестой"];
  return `×${Math.pow(2, n)} — ${words[n] || `${n + 1}-й`} Элитный архетип`;
}

// ── Проверка одной записи ───────────────────────────────────────────────────

/**
 * Снимок персонажа для проверки. Отдельным объектом, а не актором: правило
 * должно считаться и в тестах, и там, где актора ещё нет.
 *
 * { race, subrace, patron, traits: [имена], talents: [{name, specialization}],
 *   skills: { ключ: ранг }, groupSkills: { ключ: [{specKey|specialty, rank}] },
 *   corruption, infamy, chars: { ключ: значение }, spentXP }
 */

/** Совпадают ли имена: требование пишется частью имени («Mechanicum Implants»). */
const nameHit = (have, want) => String(have || "").toLowerCase().includes(String(want).toLowerCase());

/**
 * Требуемые Таланты. Счётчик считает РАЗНЫЕ специализации: «Hatred, любые 3» —
 * это три ненависти к разным целям, а не один Талант, записанный трижды.
 */
function talentOk(entry, who) {
  const want = String(entry?.name || "").trim();
  if (!want) return true;
  const spec = String(entry?.specialization || "").toLowerCase();
  const hits = (who.talents || []).filter(t => nameHit(t?.name, want)
    && (!spec || String(t?.specialization || "").toLowerCase() === spec));
  const need = wantCount(entry);
  if (need <= 1) return hits.length > 0;
  // Без специализации в требовании считаем разные специализации найденного.
  return new Set(hits.map(t => String(t?.specialization || "").toLowerCase())).size >= need;
}

function skillOk(entry, who) {
  const want = rankIdx(entry.rank);
  if (entry.scope !== "group") return rankIdx(who.skills?.[entry.skillKey]) >= want;

  const list = (who.groupSkills?.[entry.skillKey] || []).filter(e => rankIdx(e.rank) >= want);
  if (entry.specKey) {
    // entry.specKey в требованиях Элитных архетипов пишут и ключом
    // («daemons»), и текстом («Демоны») — matchSpec понимает оба, отсюда и
    // canonical-ключ для сверки с combines.
    // Совмещённая запись («Варп, Демоны и Псайкеры» и т.п., см. specCovers)
    // закрывает требование по любой из объединённых специализаций — тем же
    // рангом, что и она сама.
    const wantDef = matchSpec(entry.skillKey, entry.specKey);
    return list.some(e => e.specKey === entry.specKey || e.specialty === entry.specKey
      || (wantDef && specCovers(entry.skillKey, e.specKey, wantDef.key)));
  }
  // «Любые N специализаций этой группы» — считаем разные, а не повторы одной.
  return new Set(list.map(e => e.specKey || e.specialty)).size >= wantCount(entry);
}

/**
 * Одна запись: true — выполнено, false — нет, null — проверяет ГМ.
 * Вынесена отдельно, потому что ИЛИ-группа зовёт её на своих вложенных.
 */
function entryOk(entry, who) {
  switch (entry?.kind) {
    case "race":    return !entry.key || who.race === entry.key;
    case "subrace": return !entry.key || who.subrace === entry.key;
    // «Любая» (папка Элитных архетипов) — доступны расам Основной книги, но не
    // Эльдар: список — races/Аэльдари (Азуриане/Друкхари/Экзодит/Иннари/
    // Арлекин/Полуэльдар). Сслит в этот список не входит (races помечает его
    // «раса не-эльдар»), поэтому «Любая» ему доступна.
    case "notEldar": return !ELDAR_RACE_KEYS.includes(who.race);
    case "trait": {
      const want = String(entry.name || "").trim();
      return !want || (who.traits || []).some(t => nameHit(t, want));
    }
    case "patron":
      // «Любое» значит «хоть какое-то»: у безбожника Покровительства нет вовсе.
      if (!entry.key) return true;
      return entry.key === PATRON_ANY ? !!who.patron : who.patron === entry.key;
    case "talent":         return talentOk(entry, who);
    case "skill":          return skillOk(entry, who);
    case "corruption":     return num(who.corruption) >= num(entry.value);
    case "infamy":         return num(who.infamy) >= num(entry.value);
    case "characteristic": return num(who.chars?.[entry.charKey]) >= num(entry.value);
    case "xp":             return num(who.spentXP) >= num(entry.value);
    case "or": {
      const items = Array.isArray(entry.items) ? entry.items : [];
      if (!items.length) return true;
      const res = items.map(e => entryOk(e, who));
      if (res.some(r => r === true)) return true;
      // Ни одна не выполнена, но среди них есть ручная — решает ГМ, а не мы.
      return res.some(r => r === null) ? null : false;
    }
    // Свободную строку машина не проверяет — её читает ГМ.
    case "other":          return null;
    default: return true;
  }
}

/** Человеческая подпись записи — для строки в пикере и подсказки «чего не хватает». */
export function describeEliteReq(entry) {
  const n = wantCount(entry);
  switch (entry?.kind) {
    case "race":    return `Раса: ${entry.name || entry.key || "?"}`;
    case "subrace": return `Субраса: ${entry.name || entry.key || "?"}`;
    case "notEldar": return "Раса: не эльдар (Основная книга)";
    case "trait":   return `Черта: ${entry.name || "?"}`;
    case "patron":  return `Покровительство: ${PATRON_OPTIONS.find(p => p.key === entry.key)?.label || "?"}`;
    case "talent": {
      const name = entry.name || "?";
      if (entry.specialization) return `${name} (${entry.specialization})`;
      return n > 1 ? `${name} — любые ${n}` : name;
    }
    case "skill": {
      const rank = SKILL_RANKS[entry.rank]?.label || "";
      const base = entry.label || entry.skillKey;
      if (entry.specKey) return `${base} (${entry.specKey}) ${rank}`.trim();
      return n > 1 ? `${base} — любые ${n}, ${rank}`.trim() : `${base} ${rank}`.trim();
    }
    case "corruption":     return `Порча ${entry.value}`;
    case "infamy":         return `Бесчестие ${entry.value}`;
    case "characteristic": return `${CHARACTERISTICS[entry.charKey]?.abbr || entry.charKey} ${entry.value}`;
    case "xp":             return `Потрачено опыта: ${entry.value}`;
    case "other":          return entry.text || "—";
    case "or": {
      const parts = (entry.items || []).map(describeEliteReq).filter(Boolean);
      return parts.length ? `Одно из: ${parts.join(" / ")}` : "Одно из: —";
    }
    default: return entry?.name || "—";
  }
}

/**
 * Полная проверка. Возвращает состояние по каждому блоку и общий вывод:
 *   available — показывать ли архетип в списке (обязательный блок выполнен);
 *   warn      — есть ли невыполненное среди вторичных требований.
 */
export function checkEliteRequirements(req, who = {}) {
  const r = req || blankEliteReq();

  const sort = (list) => {
    const unmet = [], manual = [];
    for (const e of list || []) {
      const res = entryOk(e, who);
      if (res === null) manual.push(describeEliteReq(e));
      else if (!res) unmet.push(describeEliteReq(e));
    }
    return { unmet, manual };
  };

  const p = sort(r.primary);
  const s = sort(r.secondary);

  return {
    available: p.unmet.length === 0,
    warn: s.unmet.length > 0,
    primaryUnmet: p.unmet,
    secondaryUnmet: s.unmet,
    manual: [...p.manual, ...s.manual],
    unmet: [...p.unmet, ...s.unmet]
  };
}

/**
 * Снимок персонажа для проверки требований. Отдельной функцией и здесь же,
 * рядом с правилом: так видно, какие поля листа правило вообще читает, и
 * проверка не разъедется с тем, что ей скармливают в игре.
 *
 * Принимает актора, но обходится его данными — ни компендиумов, ни game.
 */
export function eliteWho(actor) {
  const s = actor?.system ?? {};
  const items = [...(actor?.items ?? [])];

  const skills = {};
  for (const [key, val] of Object.entries(s.skills ?? {})) skills[key] = val?.rank || "untrained";

  const groupSkills = {};
  for (const [key, list] of Object.entries(s.groupSkills ?? {})) {
    groupSkills[key] = (Array.isArray(list) ? list : []).map(e => ({
      specKey: e?.specKey, specialty: e?.specialty, rank: e?.rank || "untrained"
    }));
  }

  const chars = {};
  for (const [key, val] of Object.entries(s.characteristics ?? {})) chars[key] = num(val?.total);

  return {
    race: s.race || "", subrace: s.subrace || "", patron: s.patronGod || "",
    traits:  items.filter(i => i.type === "trait").map(i => i.name),
    talents: items.filter(i => i.type === "talent")
      .map(i => ({ name: i.name, specialization: i.system?.specialization || "" })),
    skills, groupSkills, chars,
    corruption: num(s.corruption?.value),
    // Бесчестие — Характеристика inf, отдельного поля у него нет.
    infamy: num(s.characteristics?.inf?.total),
    spentXP: num(s.experience?.spent)
  };
}

/** Сколько Элитных архетипов уже взято — от этого удваивается цена. */
export function eliteTakenCount(actor) {
  return [...(actor?.items ?? [])].filter(i => i.type === "eliteArchetype").length;
}
