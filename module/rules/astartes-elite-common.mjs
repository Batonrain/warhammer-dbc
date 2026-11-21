// module/rules/astartes-elite-common.mjs
// ════════════════════════════════════════════════════════════════════════
//  Общая чистая логика пачки элитных архетипов «astartes» (Броненосец,
//  Герольд, Коготь Варпа, Моритат, Чемпион Терминатор, Облитератор, Кузнец
//  Крови). Без Foundry и без импортов, ведущих к rules/sources.mjs — этот файл
//  импортирует источник правил «astartesElite» (см. AGENTS.md, «циклы импорта»).
//
//  ВРЕМЕННЫЕ ДАРЫ СОРАТНИКАМ («до конца боя или сцены»). Книга часто даёт
//  чужим персонажам бонус от способности героя: «все соратники, видевшие
//  победу, получают +10 на все действия до конца боя» (Честь Злодеев),
//  «штраф −10 до конца боя» (утрата знамени Древнего), «Преимущество на тесты
//  Command/Charm/Intimidate до конца сцены» (Высший Герольд). Состояние — флаг
//  на получателе ELITE_BOON_FLAG = { <ключ>: "<combatId>|<sceneId>|<value>|<подпись>" }
//  — строкой, потому что чужому актору флаг пишет ГМ-релей
//  (combat/gm-relay.mjs, RELAY_TARGET_FLAGS), а он принимает только простые
//  значения. Дар жив, пока совпадает бой (если выдан в бою) или сцена (если
//  вне боя). Источник правил «astartesElite» (rules/sources.mjs) превращает
//  живые дары в модификаторы теста и Преимущество.
// ════════════════════════════════════════════════════════════════════════

import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../constants/skills.mjs";

const NS = "warhammer-dbc";

/** ½Cor.b (окр.▲) — главное число пачки. */
export function halfCorB(actor) {
  const corB = Math.max(0, Number(actor?.system?.corruptionBonus) || 0);
  return Math.ceil(corB / 2);
}

/** Бонус Характеристики. */
export function charBonus(actor, key) {
  return Math.max(0, Number(actor?.system?.characteristics?.[key]?.bonus) || 0);
}

/**
 * Значение теста Навыка по книге: обычный Навык — его итог; групповой
 * (Forbidden Lore (Heresy), Navigation (Warp)) — итог нужной специализации;
 * `char` — тест на другой Характеристике («Forbidden Lore (Heresy) (W)»):
 * берётся надбавка ранга сверх родной Характеристики и кладётся на заданную.
 * Нетренированный — родная Характеристика −20 (у «только тренированных»
 * групп — тоже −20, решает стол).
 * @returns {{value:number, char:string, label:string, trained:boolean}}
 */
export function skillTestValue(actor, { skill = "", group = "", spec = null, char = "" } = {}) {
  const chars = actor?.system?.characteristics ?? {};
  const ch = k => Number(chars?.[k]?.total) || 0;
  if (group) {
    const def = GROUP_SKILLS_DEF[group] ?? {};
    const nativeChar = def.char ?? "int";
    const list = actor?.system?.groupSkills?.[group];
    const hit = Array.isArray(list) ? list.find(e => !spec || spec.test(String(e?.specialty || e?.name || ""))) : null;
    const useChar = char || nativeChar;
    const specName = hit ? String(hit.specialty || hit.name || "") : "";
    const label = `${def.en ?? group}${specName ? ` (${specName})` : ""}`;
    if (hit && hit.total != null) {
      const rankBonus = (Number(hit.total) || 0) - ch(nativeChar);
      return { value: ch(useChar) + rankBonus, char: useChar, label, trained: true };
    }
    return { value: ch(useChar) - 20, char: useChar, label, trained: false };
  }
  if (skill) {
    const def = SKILLS_DEF[skill] ?? {};
    const nativeChar = def.char ?? char;
    const sk = actor?.system?.skills?.[skill];
    const useChar = char || nativeChar;
    const label = def.en ?? skill;
    if (sk?.total != null) {
      const rankBonus = (Number(sk.total) || 0) - ch(nativeChar);
      return { value: ch(useChar) + rankBonus, char: useChar, label, trained: true };
    }
    return { value: ch(useChar) - 20, char: useChar, label, trained: false };
  }
  return { value: ch(char), char, label: char.toUpperCase(), trained: true };
}

// ── Временные дары соратникам ────────────────────────────────────────────

export const ELITE_BOON_FLAG = "astartesBoon";

/** Строка дара для флага (чистая функция). */
export function boonString({ combatId = "", sceneId = "", value = 0, label = "" } = {}) {
  const safe = String(label).replace(/\|/g, "/");
  return `${combatId}|${sceneId}|${Number(value) || 0}|${safe}`;
}

/** Разбор строки дара. */
export function parseBoon(str) {
  if (typeof str !== "string") return null;
  const [combatId = "", sceneId = "", value = "0", ...rest] = str.split("|");
  return { combatId, sceneId, value: Number(value) || 0, label: rest.join("|") };
}

/**
 * Жив ли дар: выдан в бою — пока идёт тот же бой; вне боя — пока та же сцена.
 * @param {{combatId:string, sceneId:string}} boon
 * @param {{combatId?:string, sceneId?:string}} now
 */
export function boonAlive(boon, now = {}) {
  if (!boon) return false;
  if (boon.combatId) return boon.combatId === (now.combatId ?? "");
  if (boon.sceneId) return boon.sceneId === (now.sceneId ?? "");
  return true;
}

/** Все живые дары актора: [{key, value, label}]. */
export function aliveBoons(actor, now) {
  const raw = actor?.flags?.[NS]?.[ELITE_BOON_FLAG] ?? actor?.getFlag?.(NS, ELITE_BOON_FLAG) ?? {};
  const out = [];
  for (const [key, str] of Object.entries(raw || {})) {
    const b = parseBoon(str);
    if (b && boonAlive(b, now)) out.push({ key, ...b });
  }
  return out;
}

/**
 * Виды даров: что каждый ключ делает с тестами.
 *  morale    — ± ко всем тестам (Честь Злодеев +10, утрата знамени −10);
 *  herald    — Преимущество на Command/Charm/Intimidate (Высший Герольд);
 *  banner    — Преимущество на тесты Морали (Ни Шагу Назад: Страх, Шок, Паника, Подавление).
 */
export function boonRules(boons) {
  const rules = [];
  for (const b of boons ?? []) {
    const kind = String(b.key).split(":")[0];
    const label = b.label || "Дар соратника";
    if (kind === "morale" && b.value) {
      rules.push({ id: `astartes.boon.${b.key}`, label,
        effects: [{ kind: "rollBonus", target: "all", value: b.value, label, auto: true }] });
    } else if (kind === "herald") {
      rules.push({ id: `astartes.boon.${b.key}`, label,
        effects: [{ kind: "rollMode", target: ["skill:command", "skill:charm", "skill:intimidate"], mode: "keepBest", rolls: 2, label }] });
    } else if (kind === "banner") {
      rules.push({ id: `astartes.boon.${b.key}`, label,
        effects: [{ kind: "rollMode", target: "morale", mode: "keepBest", rolls: 2, label }] });
    }
  }
  return rules;
}

/** Бой (начатый), в котором стоит токен актора, и текущая сцена — без импортов Foundry-модулей. */
export function boonNow(actor) {
  const g = globalThis.game;
  let combatId = "";
  for (const c of g?.combats?.contents ?? g?.combats ?? []) {
    if (!c?.started) continue;
    if ([...(c.combatants ?? [])].some(cb => cb?.actor === actor || (actor?.uuid && cb?.actor?.uuid === actor.uuid))) { combatId = c.id; break; }
  }
  return { combatId, sceneId: globalThis.canvas?.scene?.id ?? g?.scenes?.current?.id ?? "" };
}
