// module/rules/aptitude-overrides.mjs
// ════════════════════════════════════════════════════════════════════════════
//  «Навык/Талант/Характеристика всегда Дружественный/Враждебный, независимо от
//  Покровительства» — но не от культуры легиона (cultureCat в
//  module/constants/legions.mjs), а от РАСЫ/СУБРАСЫ: Африэль/Эльданар (N
//  характеристик и навыков по выбору игрока) и Серый Человек (целые ветки
//  Скорость/Внимательность/Избегание). См. bd wdbc-zk69.
//
//  Данные — эффект `grantAptitudeOverride` записи «Возможность» Конструктора
//  Механики (второй режим той же записи, см. module/rules/item-rules.mjs),
//  собирается общим движком правил (module/rules/collect.mjs) — тем же путём,
//  что и grantFlag (module/rules/flags.mjs). Ничего нового в схеме актора.
//
//  Приоритет ВЫШЕ культуры легиона (решение владельца, wdbc-zk69): раса —
//  более фундаментальная категория, а текст субрас говорит то же «независимо
//  от Покровительства», что и культура. Враждебность побеждает дружественность
//  при конфликте — тот же приём, что внутри самого cultureCat.
// ════════════════════════════════════════════════════════════════════════════

import { collectRules } from "./collect.mjs";

const norm = s => String(s ?? "").toLowerCase().trim();

/**
 * Совпадение по подстроке имени или по целой «группе:Имя» (тот же приём, что
 * у cultureCat) — «группа:Имя!Искл1,Искл2» значит «вся группа, кроме...».
 */
function nameHit(match, name, group) {
  const m = norm(match);
  if (!m) return false;
  if (m.startsWith("группа:")) {
    const [grp, exc] = m.slice(7).split("!");
    if (norm(group) !== grp.trim()) return false;
    if (!exc) return true;
    return !exc.split(",").some(x => name.includes(x.trim()));
  }
  return name.includes(m);
}

/**
 * Категория Навыка/Таланта/Характеристики по расовым/субрасовым override:
 * "ally" | "enemy" | null (override нет — решает cultureCat/Склонности).
 *
 * @param {Actor}  actor
 * @param {"skill"|"talent"|"characteristic"} scope
 * @param {string} name   имя из компендиума (skill/talent) или ключ
 *                        характеристики (characteristic — сверяется точно,
 *                        не по подстроке: ключей всего ~10, и подстрока
 *                        только путала бы, "s" совпало бы с "social").
 * @param {string} [group] специализация/папка Группы Навыков, для «группа:Имя»
 */
export function resolveAptitudeOverride(actor, scope, name, group = "", ctx = {}) {
  if (!actor || !name) return null;
  const n = norm(name);
  let ally = false, enemy = false;
  for (const rule of collectRules(actor, ctx)) {
    for (const effect of rule?.effects ?? []) {
      if (effect?.kind !== "grantAptitudeOverride" || effect.scope !== scope) continue;
      const hit = scope === "characteristic" ? norm(effect.match) === n : nameHit(effect.match, n, group);
      if (!hit) continue;
      if (effect.align === "enemy") enemy = true;
      else if (effect.align === "ally") ally = true;
    }
  }
  if (enemy) return "enemy";
  if (ally) return "ally";
  return null;
}
