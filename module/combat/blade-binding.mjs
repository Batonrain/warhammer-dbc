// module/combat/blade-binding.mjs
// ════════════════════════════════════════════════════════════════════════════
//  BLADE BINDING / СЦЕПЛЕНИЕ КЛИНКОВ — Foundry-обвязка к rules/blade-binding.mjs
//  (Таланты «Рукопашные», Sahara 3-8dc5). Книга и устройство состояния — в шапке правил.
//
//  Кнопка рисуется на карточке успешного Парирования (combat/defense.mjs) для того, чья
//  атака парирована и у кого есть Талант (не против щита). Клик (hooks.mjs,
//  .wh-blade-binding-btn) открывает общий встречный тест (combat/techniques.mjs::
//  _showContestDialog) S+0 vs S+0, бросает цепляющий, противник сопротивляется кнопкой
//  «Сопротивляться». Победа — оба оружия сцеплены: флаг на цепляющем (гаснет с началом его
//  следующего Хода) и указатель на противнике (запись через ГМ-релей). Запрет атаки и
//  Парирования сцепленным оружием — sheets/attack-dialog.mjs и combat/defense.mjs.
//  Раз на карточку; отметка ставится в момент броска (pay).
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, outcomeHtml } from "./../helpers/test-card.mjs";
import { writeToTarget } from "./gm-relay.mjs";
import { BLADE_OWNER_FLAG, BLADE_BY_FLAG, BLADE_WEAPON_FLAG, hasBinding, isWeaponBound } from "../rules/blade-binding.mjs";

const NS = "warhammer-dbc";

/** Ключ отметки на карточке (белый список сокета — card-once.mjs::CARD_ONCE_FLAGS). */
export const BLADE_BINDING_CARD_FLAG = "bladeBindingUsed";

/** Определение Состязания: S+0 vs S+0 (Сила). */
export const BLADE_BINDING_CONTEST = {
  label: "Сцепление Клинков", wsBonus: 0,
  modLabel: "S vs S",
  defaultChar: "s",
  allowedChars: ["s"],
  note: "S+0 vs S+0 после успешного Парирования. Победа — ваше и его оружия сцеплены: ни вы, ни он не можете атаковать или парировать ими до начала вашего следующего Хода или пока не разойдётесь.",
  targetDodgeMod: 0, targetParryMod: 0,
  chatNote: "⚡ Состязательный бросок S — сцепить оружия"
};

/** Как система находит документ по uuid синхронно (цепляющий нужен при каждой проверке запрета). */
export const resolveSync = uuid => {
  try { return globalThis.fromUuidSync?.(uuid) ?? null; } catch { return null; }
};

/** Оружие актора сцеплено? (общая точка для окна атаки и Парирования). */
export function weaponIsBound(actor, weaponId) {
  return isWeaponBound(actor, weaponId, resolveSync);
}

/** Разметка кнопки (класс .wh-blade-binding-btn слушает hooks.mjs). */
export function bladeBindingButtonHtml({ attackerUuid, defenderUuid, attackerWeaponUuid, parryWeaponId, attackerName = "" }) {
  return `<div class="roll-defense-section">
    <button class="wh-blade-binding-btn" type="button"
      data-attacker-uuid="${esc(attackerUuid)}" data-defender-uuid="${esc(defenderUuid)}"
      data-attacker-weapon-uuid="${esc(attackerWeaponUuid)}" data-parry-weapon-id="${esc(parryWeaponId)}"
      title="Сцепление Клинков: S+0 vs S+0 — при победе ваше оружие и парирующее оружие противника сцеплены до начала вашего следующего Хода">
      ${rollIcon("sword")}Сцепление Клинков (${esc(attackerName)}): S+0 vs S+0 — сцепить оружия
    </button>
  </div>`;
}

/** Победа: записать сцепление (на себя — прямо, на противника — указателем через ГМ). */
export async function resolveBladeBindingSuccess(actor, { target, binding } = {}) {
  if (!target || !binding) return ui.notifications?.warn(`${actor.name}: сцепление не записано — противник или оружия не найдены.`);
  const foeUuid = target.uuid;
  // Сначала противник (отказ записи — приём не проводится), потом сам цепляющий.
  const ok = await writeToTarget(target, { kind: "update", data: {
    [`flags.${NS}.${BLADE_BY_FLAG}`]: actor.uuid,
    [`flags.${NS}.${BLADE_WEAPON_FLAG}`]: binding.foeWeaponId
  } }, actor);
  if (!ok) return;
  await actor.setFlag(NS, BLADE_OWNER_FLAG, { foeUuid, binderWeaponId: binding.binderWeaponId, foeWeaponId: binding.foeWeaponId });
  await postTestCard(actor, {
    icon: rollIcon("sword", "#e08a3a"),
    title: `Сцепление Клинков: ${esc(target.name)}`,
    outcome: outcomeHtml(true, "Победа — оружия сцеплены"),
    sections: [`<div class="roll-threshold">«${esc(binding.binderWeaponName)}» и «${esc(binding.foeWeaponName)}» сцеплены: ни ${esc(actor.name)}, ни ${esc(target.name)} не могут атаковать или парировать ими до начала следующего Хода ${esc(actor.name)} или пока не разойдутся (кнопка «Разойтись» на вкладке Боя).</div>`]
  }, { sound: false });
}

/** Открыть встречный тест; pay — отметка карточки в момент «Бросок!». */
export async function startBladeBinding(attacker, defender, { binderWeapon, parryWeaponId, pay } = {}) {
  const foeWeapon = defender.items?.get?.(parryWeaponId) ?? null;
  const binding = binderWeapon && foeWeapon ? {
    binderWeaponId: binderWeapon.id, binderWeaponName: binderWeapon.name,
    foeWeaponId: foeWeapon.id, foeWeaponName: foeWeapon.name
  } : null;
  const { _showContestDialog } = await import("./techniques.mjs");
  await _showContestDialog(attacker, {
    ...BLADE_BINDING_CONTEST, opponents: () => [defender],
    onSuccess: (a, o) => resolveBladeBindingSuccess(a, { ...o, binding }),
    ...(pay ? { pay } : {})
  });
}

/** Есть ли у актора живое сцепление (показ кнопки «Разойтись»). */
export function actorHasBinding(actor) {
  return hasBinding(actor, resolveSync);
}

/**
 * «Разойтись»: снять сцепление у обоих (кто бы ни нажал). Чужую сторону чистит ГМ-релей
 * (combat/gm-relay.mjs): игрок не владеет NPC, с которым сцеплен, и наоборот.
 */
export async function releaseBinding(actor) {
  const own = actor.getFlag?.(NS, BLADE_OWNER_FLAG);
  const by = actor.getFlag?.(NS, BLADE_BY_FLAG);
  const other = own ? resolveSync(own.foeUuid) : (by ? resolveSync(by) : null);
  if (!own && !by) return false;
  if (own) {
    await actor.unsetFlag?.(NS, BLADE_OWNER_FLAG);
    if (other) await writeToTarget(other, { kind: "update", data: {
      [`flags.${NS}.-=${BLADE_BY_FLAG}`]: null, [`flags.${NS}.-=${BLADE_WEAPON_FLAG}`]: null
    } }, actor);
  } else {
    await actor.update?.({ [`flags.${NS}.-=${BLADE_BY_FLAG}`]: null, [`flags.${NS}.-=${BLADE_WEAPON_FLAG}`]: null });
    if (other) await writeToTarget(other, { kind: "update", data: { [`flags.${NS}.-=${BLADE_OWNER_FLAG}`]: null } }, actor);
  }
  await postTestCard(actor, {
    icon: rollIcon("sword"), title: "Сцепление Клинков снято",
    lines: [`<div class="roll-threshold">${esc(actor.name)} и ${esc(other?.name ?? "противник")} разошлись — оружия свободны.</div>`]
  }, { sound: false });
  return true;
}
