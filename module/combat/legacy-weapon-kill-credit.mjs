// module/combat/legacy-weapon-kill-credit.mjs
// ════════════════════════════════════════════════════════════════════════
//  Две Мутации Оружия Наследия (wdbc-1rno.35, Характер MERCILESS), которым
//  нужно знать «кто убил/чуть не убил кого этим оружием» — тот же готовый
//  хук LAST_DAMAGE_WEAPON_FLAG (module/combat/blood-flame.mjs), что уже
//  ставит module/combat/damage.mjs на непоглощённом уроне и читает
//  sheets/tabs/body.mjs::setDeceased для Кровавого Пламени.
// ════════════════════════════════════════════════════════════════════════

import { takenMutationNames } from "../rules/legacy-weapon.mjs";
import { changeActorInfamy } from "../apps/infamy-points.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

/**
 * Ужасающее/merciless 1-2 (стр. 428): «После убийства противника персонаж
 * получает рейтинг Страха 1 на Раунд, или повышает свой текущий на 1. Не
 * складывается.» Рейтинг Страха в этой системе — производное поле
 * (module/rules/character.mjs, максимум из Трейтов/Талантов), временные
 * прибавки «на Раунд» нигде не интегрированы в него автоматически (тот же
 * честный предел, что Dread Wail/«Боевое Построение» — module/combat/
 * dread-wail.mjs, module/constants/talents-library.mjs — обе тоже только
 * информационная карточка, отметка вручную). Звать из sheets/tabs/
 * body.mjs::setDeceased, тем же тактом, что registerBloodFlameKill.
 */
export async function registerLegacyDreadfulKill(weapon) {
  if (!weapon || !takenMutationNames(weapon).has("Ужасающее")) return;
  const owner = weapon.actor;
  if (!owner) return;
  await postTestCard(owner, {
    icon: rollIcon("skull", "#ff6b6b"),
    title: `${esc(weapon.name)} — Ужасающее`,
    lines: [`<div>${esc(owner.name)} получает рейтинг Страха 1 на этот Раунд (или +1 к текущему, не складывается) — отметьте вручную.</div>`]
  }, { sound: false });
}

/**
 * Злорадство/merciless 3-4 (стр. 428): «Когда противник тратит Бесчестие
 * или сжигает Очко Судьбы, чтобы избежать смерти, персонаж восстанавливает
 * одно Очко Бесчестия.» «Противник» — тот, чьё Оружие Наследия последним
 * ранило ЖЕРТВУ (тот же LAST_DAMAGE_WEAPON_FLAG, что Ужасающее/Кровавое
 * Пламя). Срабатывает на САМ ФАКТ траты пула (sheets/tabs/death.mjs::
 * _resolveFateSave), не на исход — книга говорит «тратит..., чтобы
 * избежать», не «...и избегает».
 */
export async function triggerLegacyGleeOnFateSave(victimActor) {
  const uuid = victimActor?.getFlag?.("warhammer-dbc", "lastDamageWeaponUuid");
  const weapon = uuid ? await fromUuid(uuid).catch(() => null) : null;
  if (!weapon || !takenMutationNames(weapon).has("Злорадство")) return;
  const owner = weapon.actor;
  if (!owner) return;
  await changeActorInfamy(owner, 1);
}
