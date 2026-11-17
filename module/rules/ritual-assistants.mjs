// module/rules/ritual-assistants.mjs
// ════════════════════════════════════════════════════════════════════════════
//  АССИСТЕНТЫ РИТУАЛА КАК СПИСОК АКТОРОВ С РОЛЯМИ (Sahara fallbacks-instructor,
//  дизайн согласован с владельцем 19.10.2026, «полная версия»).
//
//  Раньше ассистенты в состоянии броска были числами (assistants / assistSacrificed
//  в apps/ritual-cast.mjs), поэтому требования к ассистентам (assistReq на
//  предмете-ритуале) нечем было проверять, а Таланты Оккультиста
//  Instructor / Инструктор и Fallbacks / Запасные Планы — нечему применять.
//
//  Здесь — чистая логика (без Foundry, без game/ui): состав списка, годность по
//  assistReq, снижение требований Инструктором, потолок и роли запасных. Саму
//  проверку требований ВЫЗЫВАЮЩИЙ передаёт параметром `check`
//  (apps/mechanics.mjs::checkRequirements): модуль mechanics тянет за собой весь
//  Конструктор, а правило «одна проверка требований на систему» от этого не
//  страдает — считать мы её по-своему не собираемся.
//
//  Строка списка: { uuid, name, role: "primary"|"reserve", sacrificed, actor? }
//  — `actor` это разрешённый документ (в диалоге его держит замыкание), в
//  данные никуда не пишется.
//
//  Книга (core.json, Таланты Оккультиста):
//  - Fallbacks: «до ½I.b (окр.▲) запасных ассистентов, которые не дают бонуса на
//    тесты ритуала. Если какой-то из основных ассистентов выбывает из строя,
//    запасной может его заменить. Если ритуал проваливается … главный ритуалист
//    может убить одного из запасных ассистентов и проигнорировать срыв или
//    провести тест на ритуал еще раз уже в следующий Ход (это не считается как
//    переброс).»
//  - Instructor: «может потратить 8 часов на подготовку к ритуалу, чтобы снизить
//    требования к ассистентам на 1 уровень продвижения нужных Навыков, убирая
//    требование в навыках на +0. Эта подготовка требуется каждый раз».
// ════════════════════════════════════════════════════════════════════════════

import { RANKS, rankIndex } from "./req-atom.mjs";

export const ROLE_PRIMARY = "primary";
export const ROLE_RESERVE = "reserve";

/** Сколько часов подготовки стоит Инструктор (книга; в расчёт не входит, подпись в диалоге). */
export const INSTRUCTOR_PREP_HOURS = 8;

/**
 * Потолок запасных ассистентов ритуалиста: ½ бонуса Интеллекта с округлением
 * вверх [книга]. Доступность самого Таланта проверяет вызывающий (hasFallbacks),
 * не эта функция.
 */
export function maxReserveAssistants(actor) {
  const bonus = Number(actor?.system?.characteristics?.int?.bonus) || 0;
  return Math.max(0, Math.ceil(bonus / 2));
}

/** Ранг на одну ступень ниже по общей шкале рангов; пол — «Нетренированное». */
export function lowerSkillRank(rank) {
  return RANKS[Math.max(0, rankIndex(rank) - 1)];
}

/**
 * Требования к ассистентам после подготовки Инструктора: у каждой записи
 * `reqSkill` ранг на ступень ниже, прочие виды записей (раса, характеристика, …)
 * не трогаются — книга говорит только про «уровень продвижения нужных Навыков».
 *
 * Ранг, дошедший до «Нетренированного», означает «требования нет» [книга: «убирая
 * требование на +0»]. Запись при этом УДАЛЯЕТСЯ, а не получает ранг
 * `untrained`: у групповых Навыков проверка ищет запись специализации у актора, и
 * «нетренированное» у того, кто специализации вовсе не имеет, не выполнялось бы.
 * В ИЛИ-группе снятая альтернатива делает выполненной ВСЮ группу — выкинуть её,
 * оставив остальные, значило бы ужесточить требование.
 *
 * Исходные группы не меняются (они лежат во флаге предмета).
 */
export function loweredReqGroups(groups) {
  const out = [];
  for (const g of Array.isArray(groups) ? groups : []) {
    const entries = [];
    let lifted = false;
    for (const e of g?.entries || []) {
      if (e?.kind === "reqSkill" && e.skillKey) {
        const rank = lowerSkillRank(e.rank);
        if (rankIndex(rank) === 0) { lifted = true; continue; }
        entries.push({ ...e, rank });
      } else {
        entries.push({ ...e });
      }
    }
    if (g?.operator === "OR" && lifted) continue;
    if (!entries.length) continue;
    out.push({ ...g, entries });
  }
  return out;
}

/**
 * Годится ли актор в ассистенты по `assistReq` ритуала.
 * @param {object} assistant актор-кандидат
 * @param {object[]} groups  группы требований (flags.warhammer-dbc.assistReq)
 * @param {{check:Function, instructorPrepared?:boolean}} opts
 *   check — checkRequirements; instructorPrepared — отмечена «8 часов подготовки»
 * @returns {{ok:boolean, failed:string[]}}
 */
export function assistantQualifies(assistant, groups, { check, instructorPrepared = false } = {}) {
  const used = instructorPrepared ? loweredReqGroups(groups) : (Array.isArray(groups) ? groups : []);
  return check(assistant, used);
}

/** Почему кандидата в список не берут (текст) либо null, если можно. */
export function ritualAssistantRejection(candidate, { ritualist, list = [] } = {}) {
  if (!candidate) return "Не удалось определить, кого перетащили.";
  // Только по uuid: у несвязанного токена id совпадает с id мирового образца, и другая
  // фигура того же образца не есть «сам ритуалист».
  if (ritualist && candidate.uuid === ritualist.uuid)
    return "Ритуалист не может ассистировать самому себе.";
  if (list.some(r => r.uuid === candidate.uuid)) return `${candidate.name} уже в списке ассистентов.`;
  return null;
}

/** Новый список с добавленным основным ассистентом. */
export function addAssistant(list, candidate) {
  return [...(list || []), {
    uuid: candidate.uuid, name: candidate.name, role: ROLE_PRIMARY, sacrificed: false, actor: candidate
  }];
}

export function removeAssistant(list, uuid) {
  return (list || []).filter(r => r.uuid !== uuid);
}

/**
 * Смена роли строки. Запасным можно сделать только при Запасных Планах и пока
 * не превышен потолок; запасной не приносит бонуса, поэтому отметка жертвы
 * снимается. Обратно, в основные, — когда выбыл основной (его вычёркивают
 * removeAssistant), и только годного ассистента (`qualifies`).
 * @returns {{ok:boolean, list:object[], why?:string}}
 */
export function setAssistantRole(list, uuid, role, { fallbacks = false, reserveMax = 0, qualifies = true } = {}) {
  const cur = (list || []).find(r => r.uuid === uuid);
  if (!cur) return { ok: false, list, why: "Такого ассистента нет в списке." };
  if (cur.role === role) return { ok: true, list };
  if (role === ROLE_RESERVE) {
    if (!fallbacks) return { ok: false, list, why: "Запасных ассистентов вовлекает только носитель Таланта «Запасные Планы»." };
    const reserves = list.filter(r => r.role === ROLE_RESERVE).length;
    if (reserves >= reserveMax)
      return { ok: false, list, why: `Запасных ассистентов не больше ${reserveMax} (½ бонуса Интеллекта, округляя вверх).` };
  } else if (!qualifies) {
    return { ok: false, list, why: `${cur.name} не проходит требования к ассистентам — основным стать не может.` };
  }
  return {
    ok: true,
    list: list.map(r => r.uuid === uuid
      ? { ...r, role, sacrificed: role === ROLE_RESERVE ? false : r.sacrificed }
      : r)
  };
}

/** Отметка «принесён в жертву» — только у основного ассистента. */
export function setAssistantSacrificed(list, uuid, flag) {
  return (list || []).map(r => r.uuid === uuid && r.role === ROLE_PRIMARY
    ? { ...r, sacrificed: !!flag } : r);
}

/**
 * Оценка списка по assistReq: каждой строке — `ok` и `failed` (причины
 * отказа). Строка без разрешённого актора негодна (проверять нечего).
 */
export function evaluateAssistants(list, groups, { check, instructorPrepared = false } = {}) {
  return (list || []).map(r => {
    if (!r.actor) return { ...r, ok: false, failed: ["актор не найден"] };
    const res = assistantQualifies(r.actor, groups, { check, instructorPrepared });
    return { ...r, ok: res.ok, failed: res.failed };
  });
}

/**
 * Сводка оценённого списка. `sacrificed` — только жертвы ГОДНЫХ основных:
 * негодный ассистент исключён из броска целиком [решение владельца 19.10.2026],
 * запасной бонуса не даёт никогда [книга].
 */
export function tallyAssistants(rows) {
  const t = { primary: 0, reserve: 0, blocked: 0, sacrificed: 0 };
  for (const r of rows || []) {
    if (!r.ok) { t.blocked++; continue; }
    if (r.role === ROLE_RESERVE) { t.reserve++; continue; }
    t.primary++;
    if (r.sacrificed) t.sacrificed++;
  }
  return t;
}

/** Запасные, которых можно убить по Запасным Планам: годные, в роли запасного. */
export function reserveVictims(rows) {
  return (rows || []).filter(r => r.ok && r.role === ROLE_RESERVE);
}
