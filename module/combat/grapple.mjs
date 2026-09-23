// module/combat/grapple.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Борьба (стр. 12). После успешного Приёма «Захват» (module/constants/
//  combat.mjs, MELEE_MANEUVERS.grapple) атакующий и цель становятся связаны
//  Захватом — заводим состояние conditions.grappling (module/data/actor/
//  _creature.mjs) на обоих, как Оглушение/Беспомощный. Пока оно активно, оба
//  участника видят кнопку «Борьба» в блоке Состязаний вкладки БОЙ.
//
//  Роль (кто сейчас Атакующий/Цель Борьбы) НЕ отслеживается отдельным полем —
//  книга сама даёт способ её сменить (Перехватить Контроль), а бои и так
//  требуют доверия к игрокам за столом (см. остальные Приёмы: Повалить,
//  Финт — тоже не проверяют, чей сейчас Ход). Поэтому все 8 действий раздела
//  показаны обоим участникам разом, с текстом ровно по книге — кто отыгрывает
//  какое, решают сами за столом.
//
//  Сжать/Метнуть/Замахнуться/Укусы не имеют парного встречного теста между
//  Атакующим и партнёром — только Заломить/Пересилить/Вырваться/Выкрутиться/
//  Перехватить Контроль его имеют, и заведены через уже готовый
//  _showContestDialog (module/combat/techniques.mjs) — тот же диалог «Приём
//  vs Приём», что у Повалить/Напролом/Финта/Давления, просто с другой
//  характеристикой по умолчанию.
//
//  Метнуть/Замахнуться (стр. 12) — НЕ атака на самого партнёра: это общее
//  правило «Импровизированное оружие»/«Метание» (стр. 27-28,
//  module/rules/improvised-weapon.mjs), где партнёр — снаряд/дубина, а бьют
//  ими по ТРЕТЬЕЙ цели (текущая цель под прицелом Foundry). Партнёр получает
//  тот же урон, что и цель, минуя броню («урон от падения») — см. _doSwing/
//  _doThrow ниже.
// ════════════════════════════════════════════════════════════════════════════

import { _showContestDialog } from "./techniques.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";
import { itemHasName, sizeOf } from "../rules/predicates.mjs";
import { invocationNaturalAdd } from "../rules/invocation-natural.mjs";
import { resolveWeaponProps, aggregateAuto } from "./weapon-properties.mjs";
import { damageFormulaFor, meleeStrengthBonus } from "./attack-outcome.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import { worldTimeRemaining, markWorldTimeCooldownUsed } from "../rules/cooldown.mjs";
import { tentacleBonusSuppressed } from "../rules/tentacle-hand-form.mjs";
import { MELEE_STANCES, MELEE_BASES } from "../constants/combat.mjs";
import { conditionApplyFields, conditionRemoveFields } from "../sheets/tabs/conditions.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { postTestCard, outcomeHtml, rollStatLine } from "../helpers/test-card.mjs";
import { bodyWeightOf, totalWeightOf, throwTier, canWieldAsCudgel, footingRequirement }
  from "../rules/improvised-weapon.mjs";
import { spendActionPoints, isEncounterActive, hasActionEconomy } from "./action-economy.mjs";
import { spdMeters } from "./recoil-pool.mjs";
import { maxHands, handsOccupied, weaponHandsRequired } from "../rules/hands.mjs";
import { bearingDegrees, relativeBearing } from "../rules/facing.mjs";
import { canTakeAttackAction, takeAttackAction } from "./attack-limit.mjs";

const NS = "warhammer-dbc";
const PARTNER_FLAG = "grapplePartnerUuid";

// ── Роль и руки в Захвате (wdbc-x1nz.2.75, .77) ─────────────────────────────
// Книга делит Борьбу на Атакующего (держит) и Цель, и права у них разные:
// Атакующий может бить цель ножом/пистолетом, атаковать третьих, двигаться,
// если крупнее; Цель — только действия Цели. Раньше роль сознательно не
// хранилась («решают за столом»), и общий запрет «только действия Борьбы»
// бил по обоим одинаково — Атакующий терял всё, что книга ему разрешает.
// Теперь роль — флаг на обоих, меняется Перехватить Контроль.
//   grappleRole      — "attacker" | "target" (нет флага — Захват заведён до
//                      этой правки: прежнее поведение, оба видят всё);
//   grappleHands     — сколько рук Атакующий держит цель (1 по умолчанию: «за
//                      каждую дополнительную руку... дополнительный раз,
//                      выбирая лучший»);
//   grappleHeldHands — на ЦЕЛИ: сколько её рук обездвижено («за каждую руку...
//                      обездвиживает 2 руки цели»); читает rules/hands.mjs без
//                      импорта Борьбы.
const ROLE_FLAG = "grappleRole";
export const GRAPPLE_HANDS_FLAG = "grappleHands";
export const GRAPPLE_HELD_HANDS_FLAG = "grappleHeldHands";
// Сжать (стр. 12): «В свой Ход цель получит штраф –10 на любые Физические
// действия, за каждое полудействие, потраченное на Сжатие». Копится во время
// Хода Атакующего (Pending), в начале Хода Цели переезжает в Active и
// действует весь её Ход (rules/turn-flags.mjs::turnStartSqueezeCarryOver,
// читает rules/situational.mjs).
export const SQUEEZE_PENDING_FLAG = "grappleSqueezePending";
export const SQUEEZE_ACTIVE_FLAG = "grappleSqueezeActive";

function flagOf(actor, key) {
  return actor?.getFlag?.(NS, key) ?? actor?.flags?.[NS]?.[key];
}

/** "attacker" | "target" | null (Захват без роли — заведён до wdbc-x1nz.2.75). */
export function grappleRole(actor) {
  return flagOf(actor, ROLE_FLAG) ?? null;
}
export function isGrappleAttacker(actor) { return grappleRole(actor) === "attacker"; }
export function isGrappleTarget(actor)   { return grappleRole(actor) === "target"; }

/** Сколько рук Атакующий держит цель (минимум 1). */
export function grappleHands(actor) {
  return Math.max(1, Number(flagOf(actor, GRAPPLE_HANDS_FLAG)) || 1);
}

/**
 * Свободные руки Цели: «если у цели есть свободные руки, она может
 * действовать ими без ограничений Борьбы». Каждая рука Атакующего
 * обездвиживает две её руки.
 */
export function grappleFreeHands(actor) {
  if (!isGrappleTarget(actor)) return 0;
  const held = Number(flagOf(actor, GRAPPLE_HELD_HANDS_FLAG)) || 2;
  return Math.max(0, maxHands(actor) - held);
}

/**
 * «Если один из участников Захвата меньше другого, он получает штраф –10 на
 * все тесты Борьбы за каждый уровень разницы в Размере» (wdbc-x1nz.2.74).
 */
export function grappleSizePenalty(actor, partner) {
  if (!partner) return 0;
  const diff = sizeOf(actor) - sizeOf(partner);
  return diff < 0 ? diff * 10 : 0;
}

/** Модификаторы теста Борьбы для этой стороны — в порог и в подпись. */
export function grappleTestMods(actor, partner) {
  const out = [];
  const t = tentacleBonus(actor);
  if (t) out.push({ label: "Щупальце", value: t });
  const s = grappleSizePenalty(actor, partner);
  if (s) out.push({ label: "меньше Размером", value: s });
  return out;
}

/**
 * После попадания Приёмом «Захват» — связать атакующего и цель Борьбой.
 * Вызывается из module/combat/attack.mjs сразу после расчёта попадания.
 *
 * Стр. 12: «Этот приём нельзя проводить против целей на 2 и более Размера
 * больше персонажа» (wdbc-x1nz.2.66.4) — гейт ДО броска, без встречного
 * теста вовсе: попытка невозможна в принципе, не просто невыгодна. «При
 * попадании персонаж и цель проходят тест на Athletics(S)+0 vs Athletics(S)+0
 * и при победе персонаж берёт цель в Захват; при победе цели она успешно
 * отбивает попытку» — тот же контест-диалог (_showContestDialog), что и
 * остальные 5 действий Борьбы ниже (Заломить/Пересилить/Вырваться/
 * Выкрутиться/Перехватить Контроль): цель резолвится тем же способом
 * (game.user.targets), должна оставаться выцеленной с самой атаки.
 *
 * НЕ реализовано здесь (отдельный тикет wdbc-x1nz.2.66.13): «Парируется со
 * штрафом −30 (или тратит +3 Успеха от предыдущего Парирования)» — это
 * модификатор ПАРИРОВАНИЯ исходной WS-атаки, разыгрывается ДО этой функции
 * (на стороне защиты, module/combat/defense.mjs), не встречный тест ниже.
 * @param {Actor} actor       атакующий
 * @param {Token|null} targetToken   первая наведённая цель (как у остального attack.mjs)
 * @param {boolean} hit
 * @param {{technique?:string}} techOpts
 */
export async function applyGrappleOnHit(actor, targetToken, hit, techOpts) {
  if (!hit || techOpts?.technique !== "grapple") return;
  const target = targetToken?.actor;
  if (!actor || !target || target === actor) return;

  if (sizeOf(target) - sizeOf(actor) >= 2) {
    await postTestCard(actor, {
      icon: rollIcon("sword","#e08a3a"), title: `Захват — ${esc(actor.name)} → ${esc(target.name)}`,
      outcome: outcomeHtml(false, `Захват невозможен: ${esc(target.name)} крупнее на 2+ Размера (стр. 12).`)
    }, { sound: false });
    return;
  }

  await _showContestDialog(actor, grappleTechDef(actor, {
    label: "Захват", defaultChar: "s", opponent: target,
    note: "Athletics(S)+0 vs Athletics(S)+0 цели. Победа: оба персонажа связаны Захватом (состояние «Борьба»). Поражение цели: она успешно отбивает попытку Захвата.",
    chatNote: "🤼 Захват: встречный тест — цель может отбить попытку",
    onSuccess: resolveGrappleSuccess
  }));
}

/** Связывает атакующего и цель Захватом — вызывается onSuccess встречного теста выше при победе атакующего. */
export async function resolveGrappleSuccess(actor, { target }) {
  // Состояние и флаг партнёра одним update на актора: каждая отдельная
  // запись — это prepareData + re-render листа и токена у всех клиентов.
  await actor.update({ ...conditionApplyFields("grappling", null, actor), [`flags.${NS}.${PARTNER_FLAG}`]: target.uuid,
    [`flags.${NS}.${ROLE_FLAG}`]: "attacker", [`flags.${NS}.${GRAPPLE_HANDS_FLAG}`]: 1 });
  await target.update({ ...conditionApplyFields("grappling", null, target), [`flags.${NS}.${PARTNER_FLAG}`]: actor.uuid,
    [`flags.${NS}.${ROLE_FLAG}`]: "target", [`flags.${NS}.${GRAPPLE_HELD_HANDS_FLAG}`]: 2 });

  await postTestCard(actor, {
    icon: rollIcon("sword","#e08a3a"), title: `Захват — ${esc(actor.name)} ↔ ${esc(target.name)}`,
    outcome: outcomeHtml(true, "Оба персонажа связаны Захватом (состояние «Борьба»)."),
    sections: [`<div class="roll-threshold" style="font-size:0.85em;">Кнопка «Борьба» появилась на вкладке БОЙ у обоих участников.</div>`]
  }, { sound: false });
}

/** Партнёр по Борьбе (или null, если флаг протух — цель распалась/сменила сцену). */
export function grapplePartner(actor) {
  const uuid = actor?.getFlag?.(NS, PARTNER_FLAG);
  if (!uuid) return null;
  try { return fromUuidSync(uuid); } catch { return null; }
}

/** Все флаги Захвата одним патчем снятия. */
function grappleClearFields() {
  return {
    ...conditionRemoveFields("grappling"),
    [`flags.${NS}.-=${PARTNER_FLAG}`]: null,
    [`flags.${NS}.-=${ROLE_FLAG}`]: null,
    [`flags.${NS}.-=${GRAPPLE_HANDS_FLAG}`]: null,
    [`flags.${NS}.-=${GRAPPLE_HELD_HANDS_FLAG}`]: null,
    [`flags.${NS}.-=${SQUEEZE_PENDING_FLAG}`]: null,
    [`flags.${NS}.-=${SQUEEZE_ACTIVE_FLAG}`]: null
  };
}

/** Снять Борьбу с обоих участников разом (кнопка «Разорвать Захват» и любой Выход). */
export async function endGrapple(actor) {
  const partner = grapplePartner(actor);
  await actor.update(grappleClearFields());
  if (partner) await partner.update(grappleClearFields());
}

/**
 * «...и автоматически выпускает, когда он Оглушен, в Ступоре, или Беспомощен»
 * (wdbc-x1nz.2.74). Зовётся из hooks.mjs на updateActor.
 * @returns {Promise<boolean>} был ли выпуск
 */
export async function maybeAutoReleaseGrapple(actor) {
  if (!isGrappleAttacker(actor)) return false;
  const c = actor.system?.conditions ?? {};
  const why = c.stunned ? "Оглушён" : c.dazed ? "в Ступоре" : c.helpless ? "Беспомощен" : "";
  if (!why) return false;
  const partner = grapplePartner(actor);
  await endGrapple(actor);
  await postTestCard(actor, {
    icon: rollIcon("sword","#e08a3a"), title: `Захват разорван — ${esc(actor.name)}`,
    outcome: `${esc(actor.name)} ${why} и выпускает ${partner ? esc(partner.name) : "цель"} (стр. 12).`
  }, { sound: false });
  return true;
}

/** Когти (meleeCategory) на актора — первое экипированное, для замены урона Заломить (см. ниже). */
function _wrenchClawsWeapon(actor) {
  return (actor?.items ?? []).find(i => i.type === "weapon" && i.system?.equipped && i.system?.meleeCategory === "Когти") ?? null;
}

/**
 * Заломить (стр. 12) — успех даёт выбор: урон (1d5+S.b I(Cr), игнорирует
 * броню — или, при экипированных Когтях, урон САМОГО оружия, core.json,
 * «Типы Рукопашного Оружия»: «Позволяют наносить урон оружия приёмом...
 * Заломить в Борьбе (считается как с 1 Успехом)») и/или 1 Усталости
 * партнёру. «И/или» из книги — оба чекбокса независимы, можно снять оба
 * (пропустить эффект, взять только чистый успех теста) или отметить один/оба
 * сразу. Вызывается _showContestDialog (techniques.mjs) как techDef.onSuccess
 * только при выигранном тесте.
 */
async function _resolveWrenchSuccess(actor) {
  const partner = grapplePartner(actor);
  if (!partner) {
    ui.notifications.warn(`${actor.name}: партнёр по Борьбе не найден (Захват уже разорван?) — эффект Заломить некому применить.`);
    return;
  }
  const sb = Number(actor.system?.characteristics?.s?.bonus) || 0;
  const claws = _wrenchClawsWeapon(actor);
  const dmgLabel = claws
    ? `Нанести урон Когтей (${esc(claws.name)}), считается как с 1 Успехом`
    : `Нанести урон 1d5+S.b (S.b ${sb}) I(Cr), игнорирует броню`;
  const content = `
    <form style="padding:4px 6px;">
      <label class="atk-dlg-row" style="display:flex;gap:6px;align-items:center;margin:4px 0;">
        <input type="checkbox" name="dmg" checked/> ${dmgLabel}
      </label>
      <label class="atk-dlg-row" style="display:flex;gap:6px;align-items:center;margin:4px 0;">
        <input type="checkbox" name="fat"/> Нанести 1 Усталость
      </label>
    </form>`;
  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: `Заломить — эффект (${partner.name})` },
    classes: ["warhammer-dbc", "wh-holo"],
    content,
    rejectClose: false,
    buttons: [
      { action: "apply", label: "Применить", default: true,
        callback: (_e, button) => ({
          dmg: !!button.form.querySelector('input[name="dmg"]')?.checked,
          fat: !!button.form.querySelector('input[name="fat"]')?.checked
        }) },
      { action: "skip", label: "Пропустить", callback: () => null }
    ]
  });
  if (!choice || (!choice.dmg && !choice.fat)) return;

  if (choice.dmg && claws) {
    // Урон оружия Когтей, deg зафиксирован в 1 (книга: «считается как с 1
    // Успехом») — Когти.Р «+1 Dmg за нечётный Успех, кроме первого» на
    // deg=1 не подключается (первый Успех книгой прямо исключён).
    const wp = aggregateAuto(resolveWeaponProps(claws));
    const sbEff = meleeStrengthBonus({ sb, wp });
    const dmgFormula = damageFormulaFor({
      damage: claws.system.damage, flatBonus: sbEff, chars: actor.system.characteristics,
      corruptionBonus: actor.system.corruptionBonus ?? 0, wp, isMelee: true
    });
    const roll = await new Roll(dmgFormula).evaluate();
    const { applyDamageToActor } = await import("./damage.mjs");
    await applyDamageToActor(partner, {
      rawDamage: roll.total, penetration: Number(claws.system?.penetration) || 0,
      damageType: claws.system?.damageType || "impact", damageSubtype: claws.system?.damageSubtype || "",
      hitLocation: "Торс", melee: true,
      attackerName: actor.name, attackerUuid: actor.uuid, weaponName: claws.name
    });
    await postTestCard(actor, {
      icon: rollIcon("sword","#e08a3a"), title: `Заломить: урон ${esc(partner.name)}`,
      lines: [`<div class="roll-dice">Когти (${esc(claws.name)}): <b>${roll.total}</b> Dmg</div>`]
    }, { rolls: [roll] });
  } else if (choice.dmg) {
    const roll = await new Roll("1d5").evaluate();
    const dmg = roll.total + sb;
    const { applyDamageToActor } = await import("./damage.mjs");
    await applyDamageToActor(partner, {
      rawDamage: dmg, penetration: 0, damageType: "impact", damageSubtype: "crushing", ignoreArmour: true,
      hitLocation: "Торс", melee: true,
      attackerName: actor.name, attackerUuid: actor.uuid, weaponName: "Заломить"
    });
    await postTestCard(actor, {
      icon: rollIcon("sword","#e08a3a"), title: `Заломить: урон ${esc(partner.name)}`,
      lines: [`<div class="roll-dice">1d5: <b>${roll.total}</b> + S.b <b>${sb}</b> = <b>${dmg}</b> I(Cr), броня проигнорирована</div>`]
    }, { rolls: [roll] });
  }
  if (choice.fat) {
    const { addFatigue } = await import("../sheets/tabs/conditions.mjs");
    await addFatigue(partner, 1);
    await postTestCard(actor, {
      icon: rollIcon("sword","#e08a3a"), title: "Заломить: Усталость",
      outcome: `${esc(partner.name)} получает 1 Усталость.`
    }, { sound: false });
  }
}

// ── Действия Атакующего (стр. 12) ────────────────────────────────────────────
const ATTACKER_TESTS = {
  wrench: {
    label: "Заломить", defaultChar: "s", apCost: 1, isAttack: true,
    note: "Полудействие. Athletics(S)+0 vs Athletics(S)+0 партнёра. Победа: на выбор — 1d5+S.b I(Cr) Dmg (игнорирует броню) и/или 1 Усталость цели.",
    chatNote: "🤼 Борьба: Заломить",
    onSuccess: _resolveWrenchSuccess
  },
  overpower: {
    label: "Пересилить", defaultChar: "s", apCost: 2, isAttack: true,
    note: "Полное действие. Athletics(S)+0 vs Athletics(S)+0 партнёра. Победа: сдвиг цели на Успехи м. (до меньшего из SPD) в любом направлении вместе с собой, либо Повалить её.",
    chatNote: "🤼 Борьба: Пересилить",
    onSuccess: (a, o) => _resolveOverpowerSuccess(a, o)
  }
};

// ── Действия Цели (стр. 12) ──────────────────────────────────────────────────
const TARGET_TESTS = {
  breakFree: {
    label: "Вырваться", defaultChar: "s", apCost: 2,
    note: "Полное действие. Athletics(S)+0 vs Athletics(S)+0 партнёра. Победа: персонаж вырывается из Захвата.",
    chatNote: "🤼 Борьба: Вырваться",
    onSuccess: a => _resolveEscapeSuccess(a)
  },
  // defaultChar был "a" — такой Характеристики нет (ключ Ловкости — "ag"), и
  // Выкрутиться открывалось с порогом 0 (найдено в wdbc-x1nz.2.73).
  twistFree: {
    label: "Выкрутиться", defaultChar: "ag", apCost: 2,
    note: "Полное действие. Acrobatics(A)+0 vs Athletics(S)+0 партнёра. Победа: персонаж вырывается из Захвата.",
    chatNote: "🤼 Борьба: Выкрутиться",
    onSuccess: a => _resolveEscapeSuccess(a)
  },
  takeover: {
    label: "Перехватить Контроль", defaultChar: "s", defaultMod: -20, apCost: 2,
    note: "Полное действие. Athletics(S)−20 vs Athletics(S)+0 партнёра. Победа: персонаж становится Атакующим Захвата и получает обратно одно полудействие.",
    chatNote: "🤼 Борьба: Перехватить Контроль",
    onSuccess: a => _resolveTakeoverSuccess(a)
  }
};

const ALL_TESTS = { ...ATTACKER_TESTS, ...TARGET_TESTS };

// Мутация Tentacle/Щупальце (wdbc-vkwe): «+20 на приём Захват и все тесты в
// Борьбе». Приём Захват читается отдельно, в module/sheets/attack-dialog.mjs
// (resolveSelection) — здесь только 5 РОЛЕВЫХ тестов раздела (Заломить/
// Пересилить/Вырваться/Выкрутиться/Перехватить Контроль, см. ALL_TESTS выше).
// Укус (core.json, «Типы Рукопашного Оружия»: «может автоматически наносить
// попадание в Борьбе») броска не делает вовсе — тентакль-бонусу там
// нечего усиливать (тот же случай, что Сжать/Хруст, см. _doBite ниже).
// Метнуть/Замахнуться — свои бесповодочные тесты (см. блок ниже, после
// _doCrunch), бонус закладывается прямо в порог.
/**
 * +20, если у актора есть Щупальце (mutation.tentacle) — иначе 0. Субмутация
 * 9 «Изменчивое» (wdbc-2ynk): пока предмет временно в форме руки, бонусу
 * нечем помогать ни приёму Захват, ни этим тестам.
 */
export function tentacleBonus(actor) {
  return (hasRuleFlag(actor, "mutation.tentacle") && !tentacleBonusSuppressed(actor)) ? 20 : 0;
}

export function tentacleTechDef(actor, techDef) {
  const bonus = tentacleBonus(actor);
  return bonus
    ? { ...techDef, extraBonus: (techDef.extraBonus ?? 0) + bonus, extraBonusLabel: "Щупальце" }
    : techDef;
}

/**
 * Тест Борьбы как встречный (wdbc-x1nz.2.73/.74/.77): Навык, а не голая
 * Характеристика; противник — партнёр по Захвату (или цель при самой попытке
 * Захвата), сопротивляется Athletics(S); обе стороны получают свои Щупальце
 * и штраф Размера; Атакующий с лишними руками бросает лучший из N.
 */
export function grappleTechDef(actor, def) {
  const partner = def.opponent ?? grapplePartner(actor);
  const mods = grappleTestMods(actor, partner);
  const char = def.defaultChar || "s";
  return {
    ...def,
    defaultChar: char,
    allowedChars: [char],
    skills: { s: "athletics", ag: "acrobatics" },
    charLabels: { s: "Athletics(S)", ag: "Acrobatics(A)" },
    resist: [{ skill: "athletics" }],
    opponents: () => (partner ? [partner] : []),
    extraBonus: (def.extraBonus ?? 0) + mods.reduce((n, m) => n + m.value, 0),
    extraBonusLabel: mods.map(m => m.label).join(", ") || def.extraBonusLabel,
    rollCount: isGrappleAttacker(actor) ? grappleHands(actor) : 1,
    resistMods: (opp, me) => grappleTestMods(opp, me),
    resistRolls: opp => (isGrappleAttacker(opp) ? grappleHands(opp) : 1)
  };
}

/**
 * Сжать — Полудействие без броска (стр. 12): +1 к счётчику на Цели; в её
 * Ход — −10 за каждое на Физические действия (wdbc-x1nz.2.76, раньше
 * «накапливается вручную»).
 */
export async function _doSqueeze(actor) {
  const partner = grapplePartner(actor);
  if (!partner) return ui.notifications.warn(`${actor.name}: партнёр по Борьбе не найден (Захват уже разорван?).`);
  if (!(await spendActionPoints(actor, 1, { physical: true }))) return ui.notifications.warn("⚠️ Сжать: не хватает ОД (Полудействие).");
  const n = (Number(flagOf(partner, SQUEEZE_PENDING_FLAG)) || 0) + 1;
  await partner.setFlag(NS, SQUEEZE_PENDING_FLAG, n);
  await postTestCard(actor, {
    icon: rollIcon("sword","#e08a3a"), title: "Борьба: Сжать",
    outcome: `${esc(actor.name)} крепче заламывает ${esc(partner.name)}.`,
    sections: [`<div class="roll-threshold" style="font-size:0.85em;">Полудействие. В свой Ход ${esc(partner.name)} получит <b>−${n * 10}</b> на Физические действия, если всё ещё в Захвате (Сжатий накоплено: ${n}).</div>`]
  }, { sound: false });
}

/**
 * Пересилить (стр. 12): «может заставить цель переместиться на Успехи м. до
 * максимума в ее или свой SPD (выбирается меньший) в любом направлении,
 * перемещаясь вместе с ней, либо повалить ее на землю» (wdbc-x1nz.2.76).
 * Повалить — настоящее Состояние; сдвиг — число метров на карточке, фишки
 * двигают руками (направление выбирает игрок, как у Давления).
 */
export async function _resolveOverpowerSuccess(actor, { deg = 1 } = {}) {
  const partner = grapplePartner(actor);
  if (!partner) return ui.notifications.warn(`${actor.name}: партнёр по Борьбе не найден.`);
  const spds = [spdMeters(actor), spdMeters(partner)].filter(n => n > 0);
  const maxM = spds.length ? Math.min(deg, ...spds) : deg;
  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: `Пересилить — ${partner.name}` },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<p style="margin:4px 6px;">Встречный тест выигран (Успехов: ${deg}).</p>`,
    rejectClose: false,
    buttons: [
      { action: "move", label: `Сдвинуть до ${maxM} м`, default: true, callback: () => "move" },
      { action: "prone", label: "Повалить", callback: () => "prone" }
    ]
  });
  if (!choice) return;
  if (choice === "prone") {
    await partner.update(conditionApplyFields("prone", null, partner));
    await postTestCard(actor, {
      icon: rollIcon("sword","#e08a3a"), title: "Пересилить: Повален",
      outcome: `${esc(partner.name)} повален на землю (Захват сохраняется).`
    }, { sound: false });
    return;
  }
  await postTestCard(actor, {
    icon: rollIcon("sword","#e08a3a"), title: "Пересилить: сдвиг",
    outcome: `${esc(actor.name)} сдвигает ${esc(partner.name)} до <b>${maxM} м</b> в любом направлении, перемещаясь вместе с ней — передвиньте обе фишки.`,
    sections: [`<div class="roll-threshold" style="font-size:0.85em;">Потолок — меньшее из Успехов (${deg}) и SPD обоих (${spds.join(", ") || "неизвестен"}).</div>`]
  }, { sound: false });
}

/** Вырваться/Выкрутиться (стр. 12): «он вырывается из Захвата» — снимаем сразу. */
async function _resolveEscapeSuccess(actor) {
  const partner = grapplePartner(actor);
  await endGrapple(actor);
  await postTestCard(actor, {
    icon: rollIcon("sword","#e08a3a"), title: `Захват разорван — ${esc(actor.name)}`,
    outcome: outcomeHtml(true, `${esc(actor.name)} вырывается из Захвата${partner ? ` ${esc(partner.name)}` : ""}.`)
  }, { sound: false });
}

/**
 * Перехватить Контроль (стр. 12): «он становится атакующим в Захвате и
 * получает обратно одно полудействие, которое он может потратить на
 * действие Атакующего в Борьбе». Роли меняются, руки — новые (1), Сжатия
 * прежнего Атакующего сгорают (он больше не держит); 1 ОД возвращается.
 */
export async function _resolveTakeoverSuccess(actor) {
  const partner = grapplePartner(actor);
  if (!partner) return ui.notifications.warn(`${actor.name}: партнёр по Борьбе не найден.`);
  const apBack = isEncounterActive() && hasActionEconomy(actor);
  await actor.update({
    [`flags.${NS}.${ROLE_FLAG}`]: "attacker", [`flags.${NS}.${GRAPPLE_HANDS_FLAG}`]: 1,
    [`flags.${NS}.-=${GRAPPLE_HELD_HANDS_FLAG}`]: null,
    [`flags.${NS}.-=${SQUEEZE_PENDING_FLAG}`]: null, [`flags.${NS}.-=${SQUEEZE_ACTIVE_FLAG}`]: null,
    ...(apBack ? { "system.actionPoints.value": (Number(actor.system.actionPoints?.value) || 0) + 1 } : {})
  });
  await partner.update({
    [`flags.${NS}.${ROLE_FLAG}`]: "target", [`flags.${NS}.${GRAPPLE_HELD_HANDS_FLAG}`]: 2,
    [`flags.${NS}.-=${GRAPPLE_HANDS_FLAG}`]: null
  });
  await postTestCard(actor, {
    icon: rollIcon("sword","#e08a3a"), title: `Перехватить Контроль — ${esc(actor.name)}`,
    outcome: outcomeHtml(true, `${esc(actor.name)} теперь держит, ${esc(partner.name)} — в Захвате.`),
    sections: [`<div class="roll-threshold" style="font-size:0.85em;">${apBack ? "Возвращено 1 ОД (Полудействие) — " : ""}потратить его можно на действие Атакующего в Борьбе.</div>`]
  }, { sound: false });
}

/**
 * Сколько рук держат цель (wdbc-x1nz.2.77) — меняет Атакующий в окне Борьбы.
 * Потолок — свои свободные руки (рука, уже держащая цель, в счёт не идёт).
 */
export async function setGrappleHands(actor, n) {
  const partner = grapplePartner(actor);
  // Потолок — руки, не занятые оружием (handsOccupied уже считает текущие
  // руки Захвата занятыми, поэтому прибавляем их обратно).
  const limit = Math.max(1, handsOccupied(actor).free + grappleHands(actor));
  const hands = Math.min(limit, Math.max(1, Math.round(Number(n) || 1)));
  await actor.setFlag(NS, GRAPPLE_HANDS_FLAG, hands);
  if (partner) await partner.setFlag(NS, GRAPPLE_HELD_HANDS_FLAG, 2 * hands);
  return hands;
}

// Оружие «Укус» — обе половины двуязычного имени (wdbc-l07y: было /укус/i, не
// находило предмет, записанный только английской половиной «Bite»).
export function isBiteWeapon(item) {
  return item?.type === "weapon" && (itemHasName(item, "Укус") || itemHasName(item, "Bite"))
    && (item.system?.weaponClass === "melee" || !item.system?.weaponClass);
}

/**
 * Укус — автоматическое попадание в Борьбе (core.json, «Типы Рукопашного
 * Оружия»: «Может автоматически наносить попадание в Борьбе»), урон —
 * формула самого оружия Укус. Раньше этот приём ошибочно шёл полным тестом
 * WS/BS через attack-dialog.mjs (с шансом промаха) — единственное из
 * «безролловых» действий Борьбы, не совпадавшее с книгой; теперь устроен
 * так же, как Хруст (_doCrunch ниже) — свободное действие, попадание в Торс,
 * без броска на попадание. tentacleBonus (щупальце, +20 «на все тесты в
 * Борьбе») тут больше не участвует: тестов на попадание не осталось.
 */
// Укус Избирательной атакой (стр. 12, wdbc-x1nz.2.76): «Укус автоматически
// попадает в торс, но персонаж может провести Избирательную атаку, чтобы
// попасть в другую часть тела» — тест WS со штрафом Избирательной той же
// таблицы, что в окне атаки (sheets/attack-dialog.mjs::aimTargets).
const BITE_AIMS = {
  torso: { label: "Торс — автоматическое попадание", loc: "Торс", penalty: null },
  head:  { label: "Голова — Избирательная (WS −20)", loc: "Голова", penalty: -20 },
  arm:   { label: "Рука — Избирательная (WS −20)",   loc: "Рука",   penalty: -20 },
  leg:   { label: "Нога — Избирательная (WS −15)",   loc: "Нога",   penalty: -15 }
};

async function _doBite(actor, { aim = null } = {}) {
  const biteWeapon = actor.items.find(isBiteWeapon);
  if (!biteWeapon) {
    ui.notifications.warn(`${actor.name}: не найдено оружие «Укус» в снаряжении — Укус доступен только персонажам, способным кусаться.`);
    return;
  }
  const partner = grapplePartner(actor);
  if (!partner) {
    ui.notifications.warn(`${actor.name}: партнёр по Борьбе не найден (Захват уже разорван?).`);
    return;
  }
  if (!aim) {
    aim = await foundry.applications.api.DialogV2.wait({
      window: { title: `Укус — ${partner.name}` },
      classes: ["warhammer-dbc", "wh-holo"],
      content: `<p style="margin:4px 6px;">Куда кусать?</p>`,
      rejectClose: false,
      buttons: Object.entries(BITE_AIMS).map(([k, a], i) => ({ action: k, label: a.label, default: i === 0, callback: () => k }))
    });
    if (!aim) return;
  }
  const aimDef = BITE_AIMS[aim] ?? BITE_AIMS.torso;
  let aimRoll = null;
  let aimLine = "";
  if (aimDef.penalty != null) {
    const ws = Number(actor.system?.characteristics?.ws?.total) || 0;
    const threshold = ws + aimDef.penalty;
    aimRoll = await new Roll("1d100").evaluate();
    const { success } = testOutcome(aimRoll.total, threshold);
    aimLine = `Избирательная в ${aimDef.loc}: WS ${ws} ${aimDef.penalty} = ${threshold}, бросок ${aimRoll.total}.`;
    if (!success) {
      await postTestCard(actor, {
        icon: rollIcon("sword","#e08a3a"), title: `Борьба: Укус (${esc(biteWeapon.name)})`,
        outcome: outcomeHtml(false, `Промах: ${aimLine}`)
      }, { rolls: [aimRoll], sound: false });
      return;
    }
  }
  const wp = aggregateAuto(resolveWeaponProps(biteWeapon));
  const sb = Number(actor.system?.characteristics?.s?.bonus) || 0;
  const sbEff = meleeStrengthBonus({ sb, wp });
  // Укус Дара «Пасть» (wdbc-o368c) — +рейтинг DNW от Проявления, как в attack.mjs.
  const invocationAdd = invocationNaturalAdd(wp, actor);
  const dmgFormula = damageFormulaFor({
    damage: biteWeapon.system.damage, flatBonus: sbEff + invocationAdd.dmg, chars: actor.system.characteristics,
    corruptionBonus: actor.system.corruptionBonus ?? 0, wp, isMelee: true
  });
  const dmgRoll = await new Roll(dmgFormula).evaluate();
  const { applyDamageToActor } = await import("./damage.mjs");
  await applyDamageToActor(partner, {
    rawDamage: dmgRoll.total, penetration: (Number(biteWeapon.system?.penetration) || 0) + invocationAdd.pen,
    damageType: biteWeapon.system?.damageType || "impact", damageSubtype: biteWeapon.system?.damageSubtype || "",
    hitLocation: aimDef.loc, melee: true,
    attackerName: actor.name, attackerUuid: actor.uuid, weaponName: biteWeapon.name
  });
  await postTestCard(actor, {
    icon: rollIcon("sword","#e08a3a"), title: `Борьба: Укус (${esc(biteWeapon.name)})`,
    outcome: `${esc(actor.name)} ${aimRoll ? "попадает" : "автоматически наносит"} ${esc(partner.name)} (${aimDef.loc}): <b>${dmgRoll.total}</b> Dmg.`,
    sections: [`<div class="roll-threshold" style="font-size:0.85em;">Свободное действие${aimRoll ? `. ${aimLine}` : ". Автоматическое попадание в Торс"} — доступно только пока цель удержана Захватом.</div>`]
  }, { rolls: aimRoll ? [aimRoll, dmgRoll] : [dmgRoll], sound: false });
}

// Оружие со свойством Crunch (стр. 168): «Когда удерживаете цель в Борьбе,
// можете как свободное действие нанести автоматическое попадание (S.b÷2)» —
// wdbc-1d5u. Реестр auto.crunch уже был заведён (module/constants/
// weapon-properties.mjs), но нигде не читался.
export function crunchWeapon(item) {
  if (item?.type !== "weapon") return false;
  return !!aggregateAuto(resolveWeaponProps(item)).crunch;
}

/** Хруст — автоматическое попадание S.b÷2 (окр. вверх) партнёру, свободное действие. */
async function _doCrunch(actor) {
  const weapon = actor.items.find(crunchWeapon);
  if (!weapon) {
    ui.notifications.warn(`${actor.name}: нет оружия со свойством Crunch — Хруст доступен только персонажам с таким оружием.`);
    return;
  }
  const partner = grapplePartner(actor);
  if (!partner) {
    ui.notifications.warn(`${actor.name}: партнёр по Борьбе не найден (Захват уже разорван?).`);
    return;
  }
  const sb  = Number(actor.system?.characteristics?.s?.bonus) || 0;
  const dmg = Math.ceil(sb / 2);
  const { applyDamageToActor } = await import("./damage.mjs");
  await applyDamageToActor(partner, {
    rawDamage: dmg, penetration: 0, damageType: weapon.system?.damageType || "impact",
    damageSubtype: weapon.system?.damageSubtype || "", hitLocation: "Торс", melee: true,
    attackerName: actor.name, attackerUuid: actor.uuid, weaponName: weapon.name
  });
  await postTestCard(actor, {
    icon: rollIcon("sword","#e08a3a"), title: `Борьба: Хруст (${esc(weapon.name)})`,
    outcome: `${esc(actor.name)} автоматически наносит ${esc(partner.name)}: <b>${dmg}</b> Dmg (S.b÷2, окр. вверх).`,
    sections: [`<div class="roll-threshold" style="font-size:0.85em;">Свободное действие. Доступно только пока цель удержана Захватом.</div>`]
  }, { sound: false });
}

// wdbc-1f5j: субмутация 10 «Отделяемое» (стр. 440) — единственная из шести
// оставшихся необработанных строк Щупальца, что трогает сам движок Захвата,
// а не просто числовой бонус (сравни с флейвором «растягивается до 4м» у
// базовой мутации, wdbc-vkwe). Книга: «Взяв персонажа в Захват, персонаж
// может отсоединить своё щупальце у плеча. Оно продолжит держать цель в
// Захвате. Новое щупальце отрастёт из культи через 3 часа.» Действие ломает
// СИММЕТРИЮ endGrapple — Атакующий выходит из Борьбы, Цель остаётся.
// Отдельного флага «отделено» не заводим: состояние ВЫЧИСЛЯЕТСЯ (см.
// isDetachedGrapple ниже) — так его не нужно чистить отдельным путём, когда
// Цель в итоге вырывается обычным Разорвать Захват (endGrapple уже приводит
// оба conditions.grappling к false, а вычисляемый признак пропадает сам).
//
// Три пункта из тикета:
//  1. Асимметрия — реализована ниже (_doDetachTentacle + isDetachedGrapple).
//  2. Регенерация «через 3 часа» — таймер заведён через готовый
//     worldTime-примитив rules/cooldown.mjs (тот же, что у Void supply-timer,
//     doombc-supply-timer-poolmax-target), просто как информационная метка
//     в чате/диалоге. Временная потеря бонусов Щупальца на культю НЕ
//     автоматизирована: что именно «отваливается» на 3 часа — не текст
//     книги, а собственная гипотеза тикета, и движок Возможностей
//     (rules/mech-when.mjs) сейчас не умеет гейтить запись по временному
//     флагу актора — только по легиону/субмутации/Таланту. Отдельная
//     архитектурная работа ради одной строки d10 не оправдана — тот же
//     флейвор/договорённость за столом, что и растяжение до 4м.
//  3. Что с культёй, если Цель вырвется — книга не уточняет нигде (ни в
//     тексте самой строки, ни в общих правилах Захвата стр. 12 — сверено).
//     Решение: отсоединённая культя ведёт себя как обычный partner в тестах
//     Вырваться/Выкрутиться (сила культи — это сила её бывшего владельца,
//     она никуда не делась), а после победы Цели просто отпускает — как
//     любой другой Захват, без предмета/токена на карте (система и так не
//     трекает большинство подобного реквизита боя).
const TENTACLE_REGROW_SECONDS = 3 * 3600;
const TENTACLE_REGROW_FLAG = "tentacleRegrowAt";

/** Мутация Щупальце с выпавшей субмутацией 10 «Отделяемое» — есть ли она у актора. */
export function detachableTentacle(actor) {
  return actor?.items?.find(i => i.type === "mutation"
    && (itemHasName(i, "Щупальце") || itemHasName(i, "Tentacle"))
    && i.system?.submutation?.label === "10") ?? null;
}

/**
 * Захват «расщеплён»: Цель ещё связана (conditions.grappling), а её партнёр
 * (владелец щупальца, найденный ровно как обычно — через её же
 * grapplePartnerUuid) уже нет. Единственный способ попасть в такое
 * рассогласованное состояние — _doDetachTentacle ниже; никакой другой путь
 * симметрию endGrapple не ломает.
 */
export function isDetachedGrapple(actor, partner) {
  return !!(actor?.system?.conditions?.grappling && partner && !partner?.system?.conditions?.grappling);
}

/** Отсоединить щупальце у плеча — без теста. Атакующий выходит из Захвата,
 *  культя остаётся держать цель одна (стр. 440, субмутация 10). */
async function _doDetachTentacle(actor) {
  const partner = grapplePartner(actor);
  if (!partner) {
    ui.notifications.warn(`${actor.name}: партнёр по Борьбе не найден (Захват уже разорван?).`);
    return;
  }
  await actor.update({ ...conditionRemoveFields("grappling"), [`flags.${NS}.-=${PARTNER_FLAG}`]: null });
  await markWorldTimeCooldownUsed(actor, TENTACLE_REGROW_FLAG);

  await postTestCard(actor, {
    icon: rollIcon("sword","#e08a3a"), title: "Борьба: Отсоединить щупальце",
    outcome: `${esc(actor.name)} отсоединяет щупальце у плеча — оно продолжает держать ${esc(partner.name)} в Захвате, а сам ${esc(actor.name)} волен действовать свободно.`,
    sections: [`<div class="roll-threshold" style="font-size:0.85em;">Без теста (действие по решению стола — книга не уточняет). Новое щупальце отрастёт из культи через 3 часа. ${esc(partner.name)} по-прежнему может Вырваться или Выкрутиться из хватки культи.</div>`]
  }, { sound: false });
}

// Метнуть/Замахнуться (стр. 12) отсылают к ОБЩЕМУ правилу «Импровизированное
// оружие»/«Метание» (стр. 27-28, module/rules/improvised-weapon.mjs) — это
// ДВА РАЗНЫХ действия книги (Дубина и Метание — свои профили, свои гейты по
// весу/размеру), не один приём с выбором характеристики, как предполагалось
// раньше:
//   Замахнуться (Дубина, стр. 27) — рукопашный удар партнёром по ДРУГОЙ цели:
//     WS−20 (как обычный рукопашный тест — Стойка/База/усталость те же, что
//     у любого другого безоружного приёма), урон 1d10 I(Cr) +1d10 за каждый
//     Размер партнёра больше 0. Годится только если партнёр ≤¼ Веса Ношения
//     и Размером не больше владельца — иначе кнопка недоступна. Партнёр
//     получает ТОТ ЖЕ урон, что и цель, ВСЕГДА — даже при промахе или
//     уклонении/парировании цели (урон от падения, минует броню).
//   Метнуть (Метание, стр. 28) — дальнобойный/силовой бросок партнёра в
//     ДРУГУЮ цель, тир зависит от полного веса партнёра относительно Веса
//     Ношения бросающего: лёгкий (≤¼) — BS+0, дальность S.b×3м; средний
//     (¼-½)/тяжёлый (½-полного, доп. −30) — Athletics(S), дальность
//     1d10+S.b+2×Успехи, направление приблизительное. Отдельно — опора
//     (сравнение с СОБСТВЕННЫМ весом ТЕЛА бросающего, не с Ношением): без
//     неё в диапазоне 0.5-3× тела — совмещённый тест Athletics(S)−30 И
//     Acrobatics(A)−30, провал — Повален и вдвое меньше дальность/урон.
//     Партнёр получает тот же урон, что и цель, ТОЛЬКО при попадании
//     (в отличие от Дубины) — минуя броню (урон от падения).
// Оба — настоящие тесты WS/BS/Athletics(S) в Борьбе, получают +20 от Мутации
// Tentacle/Щупальце (wdbc-vkwe) наравне с Укусом — здесь напрямую заложено
// в порог через tentacleBonus(actor), не через presetModifier/extraBonus (у
// обоих нет ни Item-оружия, ни общего с 5 контестами _showContestDialog).
// Совмещённый тест на опору (Athletics/Acrobatics−30) намеренно НЕ получает
// бонус Щупальца — это отдельная механика общего правила «Метание», не сам
// тест Борьбы, который мутация усиливает.
const TIER_LABEL = { light: "лёгкий", medium: "средний", heavy: "тяжёлый" };

/**
 * Годность и параметры Замахнуться партнёром как Дубиной (стр. 27). Чистая
 * функция — тестируема без бросков.
 * @returns {{ok:boolean, wsBonus?:number, tentacleBonus?:number, diceCount?:number}}
 */
export function swingProfile(actor, partner) {
  if (!canWieldAsCudgel(actor, partner)) return { ok: false };
  const extraDice = Math.max(0, Math.floor(sizeOf(partner)));
  const tentacle = tentacleBonus(actor);
  return { ok: true, wsBonus: -20 + tentacle, tentacleBonus: tentacle, diceCount: 1 + extraDice };
}

/**
 * Тир и параметры Метнуть партнёром (стр. 28). null — партнёр тяжелее
 * полного Веса Ношения бросающего, метать нельзя вовсе. Чистая функция.
 * @returns {?{tier:string, testChar:string, testLabel:string, testBonus:number,
 *   tentacleBonus:number, rangeM?:number, athleticsPenalty?:number}}
 */
export function throwProfile(actor, partner) {
  const carry = Number(actor.system?.encumbrance?.carry) || 0;
  const tier  = throwTier(carry, totalWeightOf(partner));
  if (!tier) return null;
  const sb = Number(actor.system?.characteristics?.s?.bonus) || 0;
  const tentacle = tentacleBonus(actor);
  if (tier === "light") {
    return { tier, testChar: "bs", testLabel: "BS", testBonus: tentacle, tentacleBonus: tentacle, rangeM: sb * 3 };
  }
  const athleticsPenalty = tier === "heavy" ? -30 : 0;
  return { tier, testChar: "s", testLabel: "Athletics(S)",
    testBonus: athleticsPenalty + tentacle, tentacleBonus: tentacle, athleticsPenalty };
}

/**
 * Общий блок «применить урон цели + защита» — тот же HTML-контракт, что и
 * showAttackDialogNoWeapon (классы читает module/hooks.mjs). Экспортирован
 * (не только для этого файла) — combat/improvised-item.mjs реюзает его для
 * обычных предметов-Дубин/снарядов (не партнёров по Захвату), та же разметка.
 */
export function _targetDamageSection(dmgTotal, weaponName, actor) {
  return `
    <div class="roll-damage-section">
      <div class="roll-damage-label">Урон цели (Ударный, Проб. 0): <b>${dmgTotal}</b> · Primitive, Баланс −2</div>
      <button class="wh-apply-dmg-btn" type="button"
        data-damage="${dmgTotal}" data-penetration="0"
        data-damage-type="impact" data-hit-location="Торс"
        data-primitive="1" data-weapon-name="${weaponName}" data-attacker="${actor.name}" data-attacker-uuid="${actor.uuid}">
        Применить урон: ${dmgTotal} → Торс
      </button>
    </div>
    <div class="roll-defense-section">
      <div class="roll-defense-title">${rollIcon("shield","#4dffa6")}Защита цели (выберите токен защищающегося):</div>
      <div class="roll-defense-btns">
        <button class="wh-dodge-btn" type="button" data-extra-mod="0" data-attacker-uuid="${actor.uuid}">Уклонение</button>
        <button class="wh-parry-btn" type="button" data-extra-mod="0">Парирование</button>
      </div>
    </div>`;
}

/** Партнёр по Захвату — обязательная третья цель под прицелом Foundry (то, во что бьют партнёром). */
function _requireThirdPartyTarget(actor, partner, verb) {
  const target = [...(game.user?.targets ?? [])][0]?.actor ?? null;
  if (!target) {
    ui.notifications.warn(`${actor.name}: наведите прицел на цель, по которой вы ${verb} ${esc(partner.name)}.`);
    return null;
  }
  if (target === partner) {
    ui.notifications.warn(`${actor.name}: ${verb === "замахнётесь" ? "Замахнуться" : "Метнуть"} бьёт кого-то ДРУГОГО, не самого партнёра — выберите цель.`);
    return null;
  }
  return target;
}

/** Замахнуться — удар партнёром как Дубиной по третьей цели под прицелом. */
/**
 * Цена Метнуть/Замахнуться (стр. 12, wdbc-x1nz.2.76): «Полное действие...
 * Если персонаж держит цель двумя руками, он может использовать этот прием
 * полудействием». Тип — Атака: входит в Лимит Атак за Ход.
 * @returns {Promise<boolean>} оплачено ли
 */
async function _payThrowOrSwing(actor, label) {
  if (!canTakeAttackAction(actor)) {
    ui.notifications.warn(`⚠️ ${label}: Атака в этом Ходу уже была (стр. 12).`);
    return false;
  }
  const cost = grappleHands(actor) >= 2 ? 1 : 2;
  if (!(await spendActionPoints(actor, cost, { physical: true }))) {
    ui.notifications.warn(`⚠️ ${label}: не хватает ОД (${cost === 1 ? "Полудействие — держит двумя руками" : "Полное действие"}).`);
    return false;
  }
  await takeAttackAction(actor);
  return true;
}

async function _doSwing(actor) {
  const partner = grapplePartner(actor);
  if (!partner) {
    ui.notifications.warn(`${actor.name}: партнёр по Борьбе не найден (Захват уже разорван?).`);
    return;
  }
  const profile = swingProfile(actor, partner);
  if (!profile.ok) {
    ui.notifications.warn(`${actor.name}: ${esc(partner.name)} слишком тяжёл(а) или крупен(на) для Дубины — нужно ≤¼ Веса Ношения и Размер не больше своего (стр. 27).`);
    return;
  }
  const target = _requireThirdPartyTarget(actor, partner, "замахнётесь");
  if (!target) return;
  if (!(await _payThrowOrSwing(actor, "Замахнуться"))) return;

  const stance  = actor.system.meleeStance || "standard";
  const stBon   = MELEE_STANCES[stance]?.wsBonus ?? 0;
  const baseKey = actor.system.meleeBase || "standard";
  const baseBon = MELEE_BASES[baseKey]?.wsBonus ?? 0;
  // Общий сбор модификаторов (wdbc-ct65.1): раньше здесь стояла одна
  // Усталость, а Черты/Таланты на Оружейное Мастерство в приёмы Борьбы не
  // попадали вовсе — этот путь шёл мимо реестра правил.
  const ruleMods = collectTestMods(actor, { kind: "skill", char: "ws" });
  const ws      = actor.system.characteristics.ws?.total ?? 0;
  const final   = ws + profile.wsBonus + baseBon + stBon + ruleMods.total;

  const roll = await new Roll("1d100").evaluate();
  const { success: hit, deg } = testOutcome(roll.total, final);
  const dmgRoll = await new Roll(`${profile.diceCount}d10`).evaluate();
  const dmgTotal = dmgRoll.total;

  // Партнёр получает тот же урон ВСЕГДА — даже при промахе/уклонении
  // цели (стр. 27), минуя броню (урон от падения).
  const { applyWoundLoss } = await import("../rules/wounds.mjs");
  await applyWoundLoss(partner, dmgTotal);

  // Блок «Приём: …» стоит ВЫШЕ шапки карточки — тот же вид, что у остальных
  // Приёмов (combat/techniques.mjs, карточка атаки); в общем сборщике под это
  // есть prelude.
  await postTestCard(actor, {
    prelude: `<div class="roll-technique-block">${rollIcon("sword")}Приём: <b>Замахнуться (Дубина)</b>
        <div class="roll-technique-note">🤼 Борьба: ${esc(partner.name)} используется как импровизированная Дубина против ${esc(target.name)} (стр. 27).${profile.tentacleBonus ? ` Щупальце: +${profile.tentacleBonus} учтено.` : ""}</div>
      </div>`,
    icon: rollIcon("sword"),
    title: `Замахнуться — удар Дубиной (${profile.diceCount}d10 I(Cr))`,
    threshold: rollStatLine({
      label: "WS", base: ws,
      parts: [
        `база ${baseBon >= 0 ? "+" : ""}${baseBon}`,
        ...(stBon !== 0 ? [`стойка ${stBon >= 0 ? "+" : ""}${stBon}`] : []),
        "Дубина −20",
        ...(profile.tentacleBonus ? [`Щупальце +${profile.tentacleBonus}`] : []),
        ...ruleMods.parts
      ],
      threshold: final, rv: roll.total
    }),
    outcome: outcomeHtml(hit, hit
      ? `Попадание по ${esc(target.name)} — ${deg} степеней`
      : `Промах мимо ${esc(target.name)} — ${deg} степеней`),
    sections: [
      `<div class="roll-threshold" style="font-size:0.85em;">${esc(partner.name)} получил(а) как Дубина: <b>${dmgTotal}</b> Dmg — урон от падения (игнорирует броню, может быть поглощён Группированием вручную), НЕЗАВИСИМО от исхода атаки.</div>`,
      hit ? _targetDamageSection(dmgTotal, "Замахнуться (Борьба)", actor) : ""
    ]
  }, { rolls: [roll, dmgRoll] });
}

// wdbc-0mi1 (08.09.2026): разрывает ли книга Захват при Метании — проверено
// и стр. 12 (pdfPage 32, раздел «Метнуть или Замахнуться»), и стр. 27-28
// (pdfPage 27, «Импровизированное Оружие»/«Метание»). Ответ — НЕТ, книга не
// говорит об этом ни словом ни в одном из двух мест:
//   • «Метнуть или Замахнуться» (стр. 12) — ОДНА книжная секция сразу на оба
//     действия (Атака, Физическое, Борьба, Полное действие, либо
//     полудействие при хвате двумя руками), без разницы в исходе для Захвата
//     между ними.
//   • Разрыв Захвата в книге описан отдельным, явно перечисленным списком
//     способов (стр. 12, блок «Действия Атакующего» перед Сжать): свободное
//     действие «выпустить», автоматический разрыв при Оглушении/Ступоре/
//     Беспомощности Атакующего, а со стороны Цели — Вырваться/Выкрутиться/
//     Перехватить Контроль. Метнуть в этот список не входит.
// Раз «Замахнуться» (та же самая книжная секция) уже осознанно НЕ разрывает
// Захват в этом файле (_doSwing выше, комментарий в шапке файла), по RAW
// Метнуть — тот же случай: партнёр физически остаётся «в руках» до явного
// Вырваться/Выкрутиться/«Разорвать Захват», даже когда карточка описывает
// «улетает мимо» — та же условность броска, что и с партнёром-Дубиной, чей
// токен на сцене тоже не двигается. Решение: endGrapple() сюда НЕ добавлять,
// текущее поведение (Захват остаётся у обоих) — соответствует книге, не баг.
/** Метнуть — бросок партнёра в третью цель под прицелом, тир по весу партнёра. */
async function _doThrow(actor) {
  const partner = grapplePartner(actor);
  if (!partner) {
    ui.notifications.warn(`${actor.name}: партнёр по Борьбе не найден (Захват уже разорван?).`);
    return;
  }
  const profile = throwProfile(actor, partner);
  if (!profile) {
    ui.notifications.warn(`${actor.name}: ${esc(partner.name)} тяжелее полного Веса Ношения (${Number(actor.system?.encumbrance?.carry) || 0} кг) — метнуть нельзя вовсе (стр. 28).`);
    return;
  }
  const target = _requireThirdPartyTarget(actor, partner, "метнёте");
  if (!target) return;
  if (!(await _payThrowOrSwing(actor, "Метнуть"))) return;

  // Опора (стр. 28) — сравнение с СОБСТВЕННЫМ весом ТЕЛА бросающего
  // (bodyWeightOf), отдельная ось от тира выше (тот — про Ношение).
  const footing = footingRequirement(bodyWeightOf(actor), totalWeightOf(partner));
  if (footing === "impossible") {
    ui.notifications.warn(`${actor.name}: ${esc(partner.name)} весит втрое больше вашего собственного тела (без снаряжения) или больше — метнуть невозможно без магии (стр. 28).`);
    return;
  }
  let combinedTestRequired = false;
  if (footing === "harsh") {
    const hasFooting = await Dialog.confirm({
      title: "Опора при Метании",
      content: `<p>${esc(partner.name)} весит от 1.5 до 3 раз больше вашего собственного тела. Без надёжной опоры (стена, борт машины и т.п. позади, в стороне, противоположной броску) метнуть нельзя вовсе.</p><p>Опора есть?</p>`
    });
    if (!hasFooting) {
      ui.notifications.warn(`${actor.name}: без надёжной опоры метнуть настолько тяжёлого (относительно вас самих) партнёра нельзя (стр. 28).`);
      return;
    }
    combinedTestRequired = true; // «даже с опорой тест — как будто её нет»
  } else if (footing === "check") {
    const hasFooting = await Dialog.confirm({
      title: "Опора при Метании",
      content: `<p>${esc(partner.name)} весит сравнимо с вашим собственным телом (0.5-1.5×). Без надёжной опоры — риск сбития с ног.</p><p>Опора есть?</p>`
    });
    combinedTestRequired = !hasFooting;
  }

  let knockedDown = false, halved = false;
  if (combinedTestRequired) {
    const sTotal = actor.system.characteristics.s?.total ?? 0;
    const aTotal = actor.system.characteristics.a?.total ?? 0;
    const sRoll = await new Roll("1d100").evaluate();
    const aRoll = await new Roll("1d100").evaluate();
    if (!(sRoll.total <= sTotal - 30 && aRoll.total <= aTotal - 30)) {
      knockedDown = true;
      halved = true;
      await actor.update(conditionApplyFields("prone", null, actor));
    }
  }

  const charVal = actor.system.characteristics[profile.testChar]?.total ?? 0;
  // Тот же общий сбор, что у «Замахнуться» выше (wdbc-ct65.1).
  const throwMods = collectTestMods(actor, { kind: "skill", char: profile.testChar });
  const final   = charVal + profile.testBonus + throwMods.total;
  const roll = await new Roll("1d100").evaluate();
  const { success: hit, deg } = testOutcome(roll.total, final);
  const knockNote = knockedDown
    ? `<div class="roll-threshold" style="font-size:0.85em;">Без надёжной опоры: ${esc(actor.name)} сбит(а) с ног (Повален), дальность и урон уменьшены вдвое.</div>` : "";

  if (!hit) {
    // Блок «Приём: …» выше шапки — см. комментарий в _doSwing.
    await postTestCard(actor, {
      prelude: `<div class="roll-technique-block">${rollIcon("sword")}Приём: <b>Метнуть</b>
          <div class="roll-technique-note">🤼 Борьба: ${esc(partner.name)} метается в ${esc(target.name)} (стр. 28, тир «${TIER_LABEL[profile.tier]}»).</div>
        </div>`,
      icon: rollIcon("sword"),
      title: `Метнуть — ${profile.testLabel}${profile.rangeM ? `, дальность до ${profile.rangeM} м` : ""}`,
      threshold: rollStatLine({
        label: profile.testLabel, base: charVal,
        parts: [
          ...(profile.athleticsPenalty ? [`тир ${profile.athleticsPenalty}`] : []),
          ...(profile.tentacleBonus ? [`Щупальце +${profile.tentacleBonus}`] : []),
          ...throwMods.parts
        ],
        threshold: final, rv: roll.total
      }),
      outcome: outcomeHtml(false, `Промах — ${esc(partner.name)} улетает мимо ${esc(target.name)}, ${deg} степеней`),
      sections: [knockNote]
    }, { rolls: [roll] });
    return;
  }

  const sb = Number(actor.system?.characteristics?.s?.bonus) || 0;
  const dmgRoll = profile.tier === "light"
    ? await new Roll(`1d5+${sb}`).evaluate()
    : await new Roll(`1d10+${sb}+${deg}`).evaluate();
  const dmgTotal = halved ? Math.ceil(dmgRoll.total / 2) : dmgRoll.total;

  // Партнёр получает тот же урон, что и цель, ТОЛЬКО при попадании
  // (в отличие от Дубины) — минуя броню (урон от падения).
  const { applyWoundLoss } = await import("../rules/wounds.mjs");
  await applyWoundLoss(partner, dmgTotal);

  // Блок «Приём: …» выше шапки — см. комментарий в _doSwing.
  await postTestCard(actor, {
    prelude: `<div class="roll-technique-block">${rollIcon("sword")}Приём: <b>Метнуть</b>
        <div class="roll-technique-note">🤼 Борьба: ${esc(partner.name)} метается в ${esc(target.name)} (стр. 28, тир «${TIER_LABEL[profile.tier]}»).${profile.tentacleBonus ? ` Щупальце: +${profile.tentacleBonus} учтено.` : ""}</div>
      </div>`,
    icon: rollIcon("sword"),
    title: `Метнуть — ${profile.testLabel}${profile.rangeM ? `, дальность до ${profile.rangeM} м` : ""}`,
    threshold: rollStatLine({
      label: profile.testLabel, base: charVal,
      parts: [
        ...(profile.athleticsPenalty ? [`тир ${profile.athleticsPenalty}`] : []),
        ...(profile.tentacleBonus ? [`Щупальце +${profile.tentacleBonus}`] : []),
        ...throwMods.parts
      ],
      threshold: final, rv: roll.total
    }),
    outcome: outcomeHtml(true, `Попадание — ${deg} степеней`),
    sections: [
      knockNote,
      `<div class="roll-threshold" style="font-size:0.85em;">${esc(partner.name)} получил(а) как снаряд: <b>${dmgTotal}</b> Dmg — урон от падения (игнорирует броню, может быть поглощён Группированием вручную).</div>`,
      _targetDamageSection(dmgTotal, "Метнуть (Борьба)", actor)
    ]
  }, { rolls: [roll, dmgRoll] });
}

/** Диалог «Борьба» — вызывается кнопкой из блока Состязаний вкладки БОЙ. */
// ── Что можно делать, будучи в Захвате (стр. 12, wdbc-x1nz.2.74/.75) ───────
// Чистые проверки для окна атаки, Движения и Уклонения: пустая строка —
// можно, иначе — причина отказа для карточки/уведомления.

/**
 * Атака, будучи в Захвате.
 *  - Атакующий: «Атаки по другим целям без ограничений. Рукопашные атаки
 *    оружием с Rng 0-1 с базой Стандартная Атака или выстрелы в рукопашной из
 *    пистолетов по цели Захвата».
 *  - Цель: только свободными руками («может действовать ими без ограничений
 *    Борьбы»); удары, не требующие рук (пинок), — не её действия.
 *  - Захват без роли (заведён до правки) — прежний полный запрет.
 */
export function grappleAttackBlockReason(actor, weapon, targetActor, { isMelee = true, baseKey = "" } = {}) {
  if (!actor?.system?.conditions?.grappling) return "";
  const role = grappleRole(actor);
  if (role === "attacker") {
    const partner = grapplePartner(actor);
    if (!partner || !targetActor || targetActor.uuid !== partner.uuid) return "";
    if (isMelee) {
      if ((Number(weapon?.system?.range) || 0) > 1) return "по цели Захвата — только оружием с Rng 0–1";
      if (baseKey && baseKey !== "standard") return "по цели Захвата — только Стандартной Атакой";
      return "";
    }
    return weapon?.system?.weaponClass === "pistol" ? "" : "по цели Захвата стрелять можно только из пистолета";
  }
  if (role === "target") {
    const need = weaponHandsRequired(weapon, actor);
    const free = grappleFreeHands(actor);
    if (need > 0 && need <= free) return "";
    return free
      ? `в Захвате — только свободными руками (свободно ${free}, этому оружию нужно ${need})`
      : "в Захвате доступны только действия Цели";
  }
  return "в Захвате доступны только действия Борьбы";
}

// ── Укрытие друг для друга (стр. 12, wdbc-x1nz.2.77) ────────────────────────
// «Персонажи в Борьбе также служат как Укрытие друг для друга с углов 90°
// каждый со своей стороны, и не-Избирательные атаки с этих углов по одному
// попадают вместо этого по другому. При разнице в Размерах... меньший
// полностью закрыт со своих углов большим, без возможности выцеливать его
// Избирательными атаками.» Сектор — ±45° от направления «цель → партнёр».
// Часть книги «больший получает укрытие только в некоторые части тела по
// усмотрению ГМа» не автоматизирована — это решение ГМа по определению.

function _center(token) {
  const t = token?.object ?? token;
  if (t?.center) return t.center;
  const d = token?.document ?? token;
  const size = globalThis.canvas?.grid?.size ?? 1;
  return { x: (Number(d?.x) || 0) + (Number(d?.width) || 1) * size / 2,
           y: (Number(d?.y) || 0) + (Number(d?.height) || 1) * size / 2 };
}

/**
 * Лежит ли атакующий в секторе, который партнёр прикрывает собой.
 * Чистая геометрия: центры токенов.
 */
export function inGrappleCoverArc(targetPos, partnerPos, attackerPos) {
  if (!targetPos || !partnerPos || !attackerPos) return false;
  const toPartner = bearingDegrees(targetPos, partnerPos);
  const toAttacker = bearingDegrees(targetPos, attackerPos);
  return Math.abs(relativeBearing(toPartner, toAttacker)) <= 45;
}

/**
 * Кому на самом деле достаются попадания по сцепившейся цели: партнёр, если
 * атака пришла с его стороны и она не-Избирательная, — или если цель меньше
 * партнёра (тогда с этой стороны её не выцелить вовсе). Иначе null.
 */
export function grappleCoverPartner({ attackerToken, targetToken, targetActor, aimed = false }) {
  if (!targetActor?.system?.conditions?.grappling || !attackerToken || !targetToken) return null;
  const partner = grapplePartner(targetActor);
  if (!partner || partner.uuid === (attackerToken.actor ?? attackerToken.document?.actor)?.uuid) return null;
  const partnerToken = partner.getActiveTokens?.(false, false)?.[0] ?? null;
  if (!partnerToken) return null;
  if (!inGrappleCoverArc(_center(targetToken), _center(partnerToken), _center(attackerToken))) return null;
  if (aimed && sizeOf(targetActor) >= sizeOf(partner)) return null;
  return partner;
}

/** «Полудвижение и Движение, если его Размер больше цели» — только Атакующему. */
export function grappleMoveAllowed(actor) {
  if (!isGrappleAttacker(actor)) return false;
  const partner = grapplePartner(actor);
  return !!partner && sizeOf(actor) > sizeOf(partner);
}

/**
 * «Цель Борьбы не может совершать Уклонения. Атакующий не может совершать
 * Уклонения, если только ее вес Ношения не выше веса цели и ее Размер не
 * ниже Размера цели.» Захват без роли — проверяется как Атакующий (мягче из
 * двух: неизвестно, кто держит).
 */
export function grappleDodgeBlockReason(actor) {
  if (!actor?.system?.conditions?.grappling) return "";
  if (isGrappleTarget(actor)) return "Цель Борьбы не может Уклоняться (стр. 12).";
  const partner = grapplePartner(actor);
  if (!partner) return "";
  const carry = Number(actor.system?.encumbrance?.carry) || 0;
  const heavier = carry > totalWeightOf(partner);
  const notSmaller = sizeOf(actor) >= sizeOf(partner);
  if (heavier && notSmaller) return "";
  return `Держащий в Борьбе Уклоняется, только если его Вес Ношения выше веса цели и Размер не ниже (${!heavier ? `Ношение ${carry} кг ≤ ${totalWeightOf(partner)} кг` : "цель крупнее"}, стр. 12).`;
}

export function showGrappleDialog(actor) {
  if (!actor?.system?.conditions?.grappling) {
    ui.notifications.warn(`${actor.name}: не связан Захватом.`);
    return;
  }
  const partner = grapplePartner(actor);
  const hasCrunch = actor.items.some(crunchWeapon);
  // wdbc-1f5j: после Отсоединить щупальце (субмутация 10) держащий сторону
  // покинул Захват — Атакующего у Борьбы больше нет, только оставленная
  // культя. Действия Атакующего (в т.ч. новое «Отсоединить») и Перехватить
  // Контроль (некого перехватывать) в этом состоянии не показываются —
  // Цели остаются только Вырваться/Выкрутиться и общий Разорвать Захват.
  const detached = isDetachedGrapple(actor, partner);
  const canDetach = !detached && !!detachableTentacle(actor);
  // Роль (wdbc-x1nz.2.75): Атакующему — его действия, Цели — её. Захват без
  // роли (заведён до этой правки) — по-прежнему всё обоим.
  const role = grappleRole(actor);
  const showAttacker = !detached && role !== "target";
  const showTarget = role !== "attacker";
  // «Может выпустить цель из Захвата за свободное действие» — это право
  // Атакующего; Цели отпускать нечего, ей — Вырваться/Выкрутиться. ГМ может
  // разорвать всегда (правка ошибки за столом).
  const canRelease = role !== "target" || game.user?.isGM;
  const hands = grappleHands(actor);
  const freeHands = role === "target" ? grappleFreeHands(actor) : 0;

  // Метнуть/Замахнуться (стр. 27-28) годятся не всегда — зависит от веса/
  // Размера партнёра относительно бросающего (module/rules/improvised-weapon.mjs).
  // Без партнёра (флаг протух) считаем недоступными обе — нет payload'а.
  const throwP = partner ? throwProfile(actor, partner) : null;
  const swingP = partner ? swingProfile(actor, partner) : null;

  const btn = (key, label, extra = "") =>
    `<button type="button" class="wh-grapple-action" data-action="${key}" style="width:100%;text-align:left;margin:2px 0;">${label}</button>${extra}`;

  const detachedNote = detached
    ? `<div style="font-size:0.82em;margin-bottom:6px;">Держит культя отсоединённого щупальца${partner ? ` ${esc(partner.name)}` : ""} — Атакующего в Захвате больше нет, но культя всё ещё держит крепко: Вырваться/Выкрутиться работают как обычно, против той же Силы.${(() => {
        const usedAt = partner?.getFlag?.(NS, TENTACLE_REGROW_FLAG);
        const remaining = worldTimeRemaining(usedAt, game.time?.worldTime, TENTACLE_REGROW_SECONDS);
        return remaining > 0 ? ` Новое щупальце отрастёт через ~${Math.ceil(remaining / 3600)}ч.` : "";
      })()}</div>`
    : role === "attacker"
      ? `<div style="font-size:0.82em;margin-bottom:6px;">Вы держите${partner ? ` ${esc(partner.name)}` : ""}: Атакующий в Захвате. Атаки по другим — без ограничений; по цели — оружием Rng 0–1 Стандартной Атакой или из пистолета.</div>`
      : role === "target"
        ? `<div style="font-size:0.82em;margin-bottom:6px;">Вас держат${partner ? ` (${esc(partner.name)})` : ""}: только действия Цели или не-Физические.${freeHands ? ` Свободных рук: ${freeHands} — ими можно действовать без ограничений Борьбы.` : ""}</div>`
        : `<div style="font-size:0.82em;margin-bottom:6px;">Захват заведён до разделения ролей — оба видят все действия, кто держит, решается за столом.</div>`;

  const content = `
    <div class="wh-wizard-form" style="padding:6px;">
      <div class="atk-dlg-header"><span class="atk-weapon-name">${rollIcon("sword","#e08a3a")}Борьба${partner ? ` — ${esc(partner.name)}` : ""}</span></div>
      ${detachedNote}
      ${!showAttacker ? "" : `
      <b style="font-size:0.85em;">Действия Атакующего</b>
      <div style="font-size:0.82em;margin:2px 0;display:flex;gap:6px;align-items:center;">Держит руками: <b>${hands}</b>
        <button type="button" class="wh-grapple-action" data-action="handsDown" style="width:auto;padding:0 8px;">−</button>
        <button type="button" class="wh-grapple-action" data-action="handsUp" style="width:auto;padding:0 8px;">+</button>
        <span style="opacity:0.7;">каждая лишняя — ещё бросок на тесты Борьбы (лучший), обездвиживает 2 руки цели</span></div>
      ${btn("squeeze", "Сжать (полудействие, без броска)")}
      ${btn("wrench", "Заломить")}
      ${btn("overpower", "Пересилить")}
      ${throwP ? btn("throw", `Метнуть (${TIER_LABEL[throwP.tier]} тир, ${throwP.testLabel}) — цель под прицелом`)
               : `<div style="font-size:0.78em;opacity:0.7;margin:2px 0;">Метнуть недоступно — ${esc(partner?.name ?? "партнёр")} тяжелее полного Веса Ношения.</div>`}
      ${swingP?.ok ? btn("swing", "Замахнуться (Дубина, WS−20) — цель под прицелом")
                   : `<div style="font-size:0.78em;opacity:0.7;margin:2px 0;">Замахнуться недоступно — нужно ≤¼ Веса Ношения и Размер не больше своего.</div>`}
      ${btn("bite", "Укусы (свободное действие)")}
      ${hasCrunch ? btn("crunch", "Хруст (свободное действие, S.b÷2 авто-урона)") : ""}
      ${canDetach ? btn("detach", "Отсоединить щупальце (без теста)") : ""}
      `}
      ${!showTarget ? "" : `
      <b style="font-size:0.85em;display:block;margin-top:6px;">Действия Цели</b>
      ${btn("breakFree", "Вырваться (Полное действие)")}
      ${btn("twistFree", "Выкрутиться (Полное действие)")}
      ${detached ? "" : btn("takeover", "Перехватить Контроль (Полное действие)")}`}
      ${!canRelease ? "" : `<hr style="margin:8px 0;opacity:0.3;"/>
      ${btn("release", role === "attacker" ? "Отпустить цель (свободное действие)" : "Разорвать Захват (снять «Борьба» с обоих)")}`}
    </div>`;

  return foundry.applications.api.DialogV2.wait({
    window: { title: "Борьба" },
    classes: ["wh-attack-dialog", "warhammer-dbc"],
    position: { width: 380 },
    content,
    rejectClose: false,
    buttons: [{ action: "close", label: "Закрыть" }],
    render: (event, dialog) => {
      const form = dialog.element.querySelector("form") || dialog.element;
      form.querySelectorAll(".wh-grapple-action").forEach(b => b.addEventListener("click", async () => {
        const key = b.dataset.action;
        if (key === "squeeze") await _doSqueeze(actor);
        else if (key === "throw") await _doThrow(actor);
        else if (key === "swing") await _doSwing(actor);
        else if (key === "bite") await _doBite(actor);
        else if (key === "crunch") await _doCrunch(actor);
        else if (key === "detach") await _doDetachTentacle(actor);
        else if (key === "release") await endGrapple(actor);
        else if (key === "handsUp" || key === "handsDown") {
          await setGrappleHands(actor, grappleHands(actor) + (key === "handsUp" ? 1 : -1));
          dialog.close();
          return showGrappleDialog(actor);
        }
        else if (ALL_TESTS[key]) await _showContestDialog(actor, grappleTechDef(actor, ALL_TESTS[key]));
        dialog.close();
      }));
    }
  });
}

// Экспорт ТОЛЬКО ради теста (test/combat/damage-subtype-sources.test.mjs —
// подвид урона в прямых попаданиях Борьбы, wdbc-9zpt): внутри системы их зовёт
// лишь этот файл. showGrappleDialog, через который они идут в игре, заглушка
// тестов не проходит (см. шапку test/combat/grapple.test.mjs). Тот же приём,
// что у vehicle.mjs::_resolveRam.
export { _resolveWrenchSuccess, _doBite, _doCrunch };
