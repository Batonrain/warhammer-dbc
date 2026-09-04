// module/combat/counter-attack.mjs
// ════════════════════════════════════════════════════════════════════════
//  Встречная атака (wdbc-2wy7) — kind:"counterAttack" Конструктора (см.
//  шапку module/apps/mechanics.mjs). Заведено под Шипы и Цепные Бандольеры
//  (packs-src/armor-mods, packs-src/armour-systems): «Промахнувшийся
//  рукопашной (Rng 0-3) или проведший безоружную атаку/приём «Захват» против
//  владельца получает попадание в ответ (Уклонение можно, Парирование нет)».
//
//  ЖИВОЙ ЗАПРОС — не пишет и не создаёт ничего при получении предмета
//  (см. applyMechEntry в mechanics.mjs): читается прямо здесь, в момент
//  атаки, тем же приёмом, что ignoredTerrainKeysForActor() в
//  module/combat/movement-terrain.mjs — getItemMechanics()/entryWhenOk() из
//  Конструктора живьём, isItemActive() из apps/effects.mjs гейтит активность
//  предмета (armorMod: установлен, и если включаемый — включён).
//
//  Формула урона и Рвущее переиспользуют движки оружия: resolveCharFormula
//  (module/helpers/utils.mjs, тот же парсер S.b/T.b/…, что у damageFormulaFor
//  в attack-outcome.mjs) и applyDamageDiceMods (module/combat/
//  weapon-properties.mjs) — второй писать заново незачем, а не только
//  Рвущее — на будущее можно передать ему и provenRating, если у записи
//  когда-нибудь заведут Проверенное.
//
//  НЕ покрывает провал/победу в тестах раздела «Борьба» (Заломить/Пересилить/
//  Вырваться/Выкрутиться/Перехватить Контроль, module/combat/grapple.mjs —
//  ALL_TESTS): те симметричный встречный тест через module/combat/
//  techniques.mjs::_showContestDialog, общий с добрым десятком других приёмов
//  (Повалить, Финт, Давление), без единого понятия «атакующий против
//  владельца» — оба участника Борьбы могут вызвать любое из пяти действий на
//  своём Ходу. Честный диагноз, не форсированный обходной путь — см. bd.
// ════════════════════════════════════════════════════════════════════════

import { getItemMechanics } from "../apps/mechanics.mjs";
import { entryWhenOk } from "../rules/mech-when.mjs";
import { isItemActive } from "../apps/effects.mjs";
import { resolveCharFormula, esc } from "../helpers/utils.mjs";
import { applyDamageDiceMods } from "./weapon-properties.mjs";
import { DAMAGE_TYPES } from "../constants/items.mjs";

/**
 * Активные записи kind:"counterAttack" у актора — предмет активен
 * (isItemActive), запись прошла entry.when (entryWhenOk), группа не ИЛИ
 * (тот же приём, что rulesFromItemMechanics в rules/item-rules.mjs: живой
 * запрос читает только безусловные И-группы, «ИЛИ» решается диалогом выбора
 * только при ПОЛУЧЕНИИ предмета — здесь этого шага нет и не было).
 * @param {Actor} actor  владелец предмета (защищающийся — не атакующий).
 * @returns {{entry:object, item:Item}[]}
 */
export function counterAttackEntriesForActor(actor) {
  const out = [];
  if (!actor) return out;
  for (const item of actor.items ?? []) {
    if (!isItemActive(item)) continue;
    for (const group of getItemMechanics(item)) {
      if (group.operator === "OR") continue;
      for (const entry of group.entries || []) {
        if (entry.kind !== "counterAttack") continue;
        if (!entryWhenOk(actor, entry, item)) continue;
        out.push({ entry, item });
      }
    }
  }
  return out;
}

/**
 * Записи, чей триггер совпадает с текущей атакой. `onMiss`/
 * `onUnarmedOrGrapple` — независимые условия (см. шапку файла): запись
 * годится, если ХОТЯ БЫ ОДНО совпавшее её условие включено.
 */
export function activeCounterAttackEntries(actor, { onMiss = false, onUnarmedOrGrapple = false } = {}) {
  if (!onMiss && !onUnarmedOrGrapple) return [];
  return counterAttackEntriesForActor(actor).filter(({ entry }) =>
    (onMiss && entry.ccOnMiss) || (onUnarmedOrGrapple && entry.ccOnUnarmedOrGrapple));
}

/**
 * Триггеры этой конкретной атаки против владельца (чистая функция — как
 * hitCount/attackPenetration в attack-outcome.mjs, без документов Foundry).
 * @param {{isMelee:boolean, hit:boolean, technique?:string, meleeCategory?:string}} p
 */
export function counterAttackTriggers({ isMelee, hit, technique = "", meleeCategory = "" } = {}) {
  return {
    onMiss: !!isMelee && !hit,
    // «Безоружная атака» — категория «Кулаки» (Fist/Kick/Headbutt, см.
    // module/constants/weapon-categories.mjs, MELEE_TRAINING_EXEMPT — тот же
    // ярлык, которым книга отличает голые руки от держимого оружия);
    // «Захват» — сам Приём (module/sheets/attack-dialog.mjs), любой исход,
    // не только попадание — контакт с шипами уже случился.
    onUnarmedOrGrapple: !!isMelee && (technique === "grapple" || meleeCategory === "Кулаки")
  };
}

/** Формула урона одной записи, готовая для Roll (без самого броска — тестируемо чисто). */
export function counterAttackDamageFormula(entry, defenderActor) {
  const chars = defenderActor?.system?.characteristics || {};
  const corB = defenderActor?.system?.corruptionBonus ?? 0;
  const raw = resolveCharFormula(String(entry.ccDamage ?? "0").trim() || "0", chars, corB);
  return applyDamageDiceMods(raw, { tearing: !!entry.ccTearing, provenRating: 0 });
}

/**
 * Кубы + HTML-секция кнопок карточки атаки: одна на каждую сработавшую
 * запись (несколько источников контратаки на одном акторе — редкость, но не
 * запрещена, см. шапку mechanics.mjs про несколько записей одного kind).
 * Кнопка «Применить урон» бьёт НАПРЯМУЮ по known-атакующему (data-force-target,
 * hooks.mjs) — не требует ретаргета цели на сцене, в отличие от обычной
 * атаки: тут атакующий уже известен на 100% (это тот, кто провёл ЭТУ атаку).
 * Только Уклонение — по тексту обеих записей брони («Парирование нет»).
 *
 * @param {Actor} defenderActor  владелец брони — теперь атакующий в ответ.
 * @param {Actor} attackerActor  тот, кто промахнулся/провёл безоружную/Захват.
 * @param {{onMiss:boolean, onUnarmedOrGrapple:boolean}} triggers
 * @returns {Promise<{html:string, rolls:Roll[]}>}
 */
export async function counterAttackSectionHtml(defenderActor, attackerActor, triggers) {
  const entries = activeCounterAttackEntries(defenderActor, triggers);
  if (!entries.length) return { html: "", rolls: [] };

  const rolls = [];
  const sections = [];
  for (const { entry, item } of entries) {
    const formula = counterAttackDamageFormula(entry, defenderActor);
    let dmgTotal = 0;
    try {
      const roll = await new Roll(formula || "0").evaluate();
      rolls.push(roll);
      dmgTotal = roll.total;
    } catch {
      dmgTotal = Number(formula) || 0;
    }
    const dtLabel = DAMAGE_TYPES[entry.ccDamageType] || entry.ccDamageType || "Ударный";
    const label = entry.ccLabel || item.name;
    sections.push(`
      <div class="roll-damage-section roll-counter-attack">
        <div class="roll-damage-label">${esc(label)} — встречная атака (${dtLabel}, Проб. ${entry.ccPen || 0}${entry.ccTearing ? ", Рвущее" : ""}): <b>${dmgTotal}</b></div>
        <button class="wh-apply-dmg-btn" type="button"
          data-force-target="${attackerActor?.uuid ?? ""}"
          data-damage="${dmgTotal}" data-penetration="${entry.ccPen || 0}"
          data-damage-type="${entry.ccDamageType || "impact"}" data-hit-location="Торс"
          data-weapon-name="${esc(label)}" data-attacker="${esc(defenderActor.name)}" data-attacker-uuid="${defenderActor.uuid ?? ""}">
          Применить урон: ${dmgTotal} → ${esc(attackerActor?.name ?? "атакующему")}
        </button>
        <div class="roll-defense-section">
          <div class="roll-defense-btns">
            <button class="wh-dodge-btn" type="button" data-extra-mod="0" data-attacker-uuid="${defenderActor.uuid ?? ""}">Уклонение</button>
          </div>
          <div class="roll-defense-note">Парирование против встречной атаки недоступно (стр. брони).</div>
        </div>
      </div>`);
  }
  return { html: sections.join(""), rolls };
}
