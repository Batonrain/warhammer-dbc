// module/combat/walker.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ШАГОХОД в бою — обвязка Foundry над module/rules/walker.mjs (wdbc-6wzt).
//
//  Книга Машин, Ходовая «Шагоход»: «двигается и атакует как персонаж, а не
//  техника». Это и есть причина, по которой файл отдельный от
//  combat/vehicle.mjs: там всё считает МАШИНА (Вираж Operate, Таран Лобовой
//  бронёй, Трудный Ландшафт мехводом), а здесь — ПИЛОТ своими Навыками, через
//  корпус машины. Поэтому Парирование и Уклонение берут расчёт у персонажа
//  (combat/defense.mjs::parryProfile/dodgeProfile), а не заводят свой: боец в
//  саркофаге не перестаёт быть бойцом со своей Усталостью, Талантами и
//  записями Конструктора.
//
//  Реализованы пункты 1, 2, 5, 6, 8. Пункт 9 («рукопашные атаки по Шагоходу
//  не могут Избирательной атакой −20 попадать в Кормовую броню») сознательно
//  НЕ начат: общего выбора стороны брони при атаке ПЕРСОНАЖА по технике в
//  системе нет вовсе (combat/attack.mjs всегда шлёт side:"side"), запрет
//  оказался бы кодом, который никогда не выполняется. Пункты 3/4/7 (Бег 4×SPD,
//  Трудный Ландшафт, S/Un.S) живут в rules/vehicle.mjs и combat/vehicle.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { _degWord, _hitWord, _leftoverSuccessPhrase, negatedHits, esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, thresholdLine, outcomeHtml } from "../helpers/test-card.mjs";
import { parryProfile, dodgeProfile, _noReactionCard } from "./defense.mjs";
import { spendReaction, apCostForActionType, canSpendActionPoints, spendActionPoints }
  from "./action-economy.mjs";
import { addEvasionSurplus } from "./evasion-pool.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { applyStructureLoss } from "./vehicle.mjs";
import { ARMOUR_SIDES, VEHICLE_STATUS_EFFECTS } from "../constants/vehicle.mjs";
import { isThrottleCountAvailable, incrementThrottleCount, throttleCount } from "../rules/cooldown.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import {
  WALKER_CREW_ROLES, WALKER_TURN_CAPABILITY, WALKER_CHARGE_BONUS, TIP_OVER_LABEL,
  WALKER_ALL_ARMS_ACTION,
  isWalkerVehicle, walkerDefenceMod, walkerDodgeThresholds, walkerTurnsPerRound,
  hasCombatMasterTalent, walkerChargeDistance, walkerChargeMark, isWalkerChargeActive,
  knockdownOutcomeFor, tipOverDamageFormula, tipOverArmour, tipOverLedgeBonus, isTippedOver
} from "../rules/walker.mjs";

const sgn  = n => `${n >= 0 ? "+" : ""}${n}`;
const norm = v => String(v ?? "").trim().toLowerCase();

/** Возможность «Мастер Боя» из реестра правил — на случай, если её выдаст не предмет-Талант. */
const COMBAT_MASTER_FLAG = "dodge.core.combatMaster";

/** Флаг метки объявленного Натиска Шагохода (см. rules/walker.mjs::walkerChargeMark). */
export const WALKER_CHARGE_FLAG = "walkerCharge";

// ── Общее: кто ведёт машину ──────────────────────────────────────────────────

/**
 * Пилот/мехвод Шагохода — актор с места экипажа по порядку WALKER_CREW_ROLES.
 * Возвращает null, если машина пуста: тогда Парировать/Уклоняться/Натиск
 * некому, и это НЕ ошибка кода, а состояние стола — вызывающий скажет об этом
 * карточкой, а не молча отработает нулями.
 */
export async function walkerCrew(vehicle) {
  const stations = Array.isArray(vehicle?.system?.stations) ? vehicle.system.stations : [];
  for (const role of WALKER_CREW_ROLES) {
    const st = stations.find(s => norm(s?.role) === role && s?.uuid);
    if (!st) continue;
    const doc = await fromUuid(st.uuid).catch(() => null);
    const actor = doc?.actor ?? doc;
    if (actor) return { actor, station: st, role };
  }
  return null;
}

/** Первое рукопашное орудие машины — им Шагоход Парирует и бьёт в ближнем бою. */
export function walkerMeleeWeapon(vehicle) {
  const items = vehicle?.items ?? [];
  const list = typeof items.filter === "function" ? items.filter(i => i?.type === "weapon") : [];
  return list.find(i => norm(i.system?.weaponClass) === "melee") || null;
}

/** Короткий отказ карточкой — «действие недоступно», а не «провалено». */
function refusal(vehicle, title, why) {
  return postTestCard(vehicle, {
    icon: rollIcon("sword"), title: `${title} — ${esc(vehicle.name)}`,
    outcome: `<span class="roll-failure">${rollIcon("ban", "#ff6b6b")}${why}</span>`
  }, { sound: false });
}

/** Общий гейт «это вообще Шагоход?». */
function requireWalker(vehicle, title) {
  if (isWalkerVehicle(vehicle)) return true;
  ui.notifications?.warn(`⚠️ ${title}: это правило есть только у Ходовой «Шагоход».`);
  return false;
}

// ── Пункт 5: Парирование Шагоходом ──────────────────────────────────────────

/**
 * Парирование Шагоходом (п.5): тест ПИЛОТА (WS + Навык Парирования + свойства
 * орудия), штраф −Размер×10 за габариты машины.
 *
 * Реакцию тратит пилот — у машины Реакций нет вовсе (у vehicle нет
 * system.reactions), а книга и не даёт их машине: парирует человек внутри.
 * Крестовой Блок выключен намеренно: он про два клинка в руках персонажа, а
 * не про манипуляторы корпуса.
 */
export async function performWalkerParry(vehicle, { extraMod = 0, attackerUuid = "", hitsCount = 1 } = {}) {
  if (!requireWalker(vehicle, "Парирование")) return;
  const crew = await walkerCrew(vehicle);
  if (!crew) return refusal(vehicle, "Парирование",
    "В машине нет пилота/мехвода — Парировать некому (посадите экипаж на вкладке «Экипаж»).");
  const weapon = walkerMeleeWeapon(vehicle);
  if (!weapon) return refusal(vehicle, "Парирование",
    "У машины нет рукопашного орудия — Парировать нечем (добавьте орудие класса «Рукопашное»).");

  const sizeMod = walkerDefenceMod(vehicle.system?.size);
  const { wsTotal, balance, balanceMod, threshold, modParts } =
    parryProfile(crew.actor, extraMod + sizeMod, weapon, { useCrossblock: false });
  if (balanceMod === null) return refusal(vehicle, "Парирование",
    `Орудием «${esc(weapon.name)}» нельзя парировать (Баланс ${sgn(balance)}).`);

  if (!(await spendReaction(crew.actor, { forDefense: true })))
    return _noReactionCard(crew.actor, "Парирование (Шагоход)");

  // Подпись −Размер×10 ставится своей строкой: parryProfile сложил его в общий
  // «приём», а игрок должен видеть, что штраф именно от габаритов машины.
  const parts = modParts.filter(p => !String(p).startsWith("приём "));
  if (extraMod !== 0) parts.push(`приём ${sgn(extraMod)}`);
  parts.push(`Размер ${sgn(sizeMod)}`);

  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const { success: passed, deg } = testOutcome(rv, threshold);
  const { total: totalHits, negated, remaining } = negatedHits(passed, deg, hitsCount);
  const leftover = passed ? deg - negated : 0;
  const banked = leftover > 0 && await addEvasionSurplus(vehicle, attackerUuid, leftover, extraMod);

  await postTestCard(vehicle, {
    icon: rollIcon("sword"), title: `Парирование (Шагоход) — ${esc(vehicle.name)}`,
    actorUuid: vehicle.uuid,
    // Без esc: thresholdLine экранирует label и parts сам (helpers/test-card.mjs).
    threshold: thresholdLine({ label: `WS ${crew.actor.name}`, base: wsTotal, parts, threshold }),
    lines: [`<div style="font-size:0.82em;color:#5a4a30;margin-bottom:2px;">Орудие: ${esc(weapon.name)} (Баланс ${sgn(balance)}) · Реакцию тратит пилот</div>`],
    rv, outcome: defenceOutcome("Парирование", passed, deg, totalHits, negated, remaining, "Атака отражена."),
    sections: [leftoverNote(banked, leftover)]
  }, { rolls: [roll] });
}

// ── Пункт 5: Уклонение Шагоходом ────────────────────────────────────────────

/**
 * Уклонение Шагоходом (п.5): «со штрафом −Размер×10; всегда комбинированное с
 * Operate−10».
 *
 * Комбинированный тест по корбуку (стр. 25) — ОДИН бросок против НАИМЕНЬШЕГО
 * из двух Пределов (rules/walker.mjs::walkerDodgeThresholds). Operate берётся
 * у самой машины (system.operate — то же поле, которым считается Вираж), а
 * половина Уклонения — у пилота, со всем его стеком модификаторов.
 */
export async function performWalkerDodge(vehicle, { extraMod = 0, attackerUuid = "", hitsCount = 1 } = {}) {
  if (!requireWalker(vehicle, "Уклонение")) return;
  const crew = await walkerCrew(vehicle);
  if (!crew) return refusal(vehicle, "Уклонение",
    "В машине нет пилота/мехвода — Уклоняться некому (посадите экипаж на вкладке «Экипаж»).");

  const profile = dodgeProfile(crew.actor, extraMod);
  const operate = Number(vehicle.system?.operate) || 0;
  const size    = Number(vehicle.system?.size) || 0;
  const { dodgePart, operatePart, threshold } =
    walkerDodgeThresholds({ dodgeBase: profile.threshold, size, operate });

  if (!(await spendReaction(crew.actor, { forDefense: true })))
    return _noReactionCard(crew.actor, "Уклонение (Шагоход)");

  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const { success: passed, deg } = testOutcome(rv, threshold);
  const { total: totalHits, negated, remaining } = negatedHits(passed, deg, hitsCount);
  const leftover = passed ? deg - negated : 0;
  const banked = leftover > 0 && await addEvasionSurplus(vehicle, attackerUuid, leftover, extraMod);

  const lower = threshold === operatePart && operatePart < dodgePart ? "Operate" : "Уклонение";

  await postTestCard(vehicle, {
    icon: rollIcon("run"), title: `Уклонение (Шагоход) — ${esc(vehicle.name)}`,
    actorUuid: vehicle.uuid,
    threshold: `<div class="roll-threshold">Комбинированный тест (наименьший Предел): Уклонение ${esc(crew.actor.name)} <b>${dodgePart}</b>${
      profile.modParts.length ? ` (${profile.modParts.map(esc).join(", ")}, Размер ${sgn(walkerDefenceMod(size))})` : ` (Размер ${sgn(walkerDefenceMod(size))})`
    } · Operate машины <b>${operatePart}</b> (${operate} −10) → Порог <b>${threshold}</b></div>`,
    lines: [`<div style="font-size:0.82em;color:#5a4a30;margin-bottom:2px;">Ниже оказался ${lower} — по нему и бросок. Реакцию тратит пилот.</div>`],
    rv, outcome: defenceOutcome("Уклонение", passed, deg, totalHits, negated, remaining, "Атака промахивается."),
    sections: [leftoverNote(banked, leftover)]
  }, { rolls: [roll] });
}

/** Общая строка исхода Избегания — тот же вид, что у персонажа (defense.mjs). */
function defenceOutcome(label, passed, deg, totalHits, negated, remaining, successTail) {
  if (!passed) {
    return `<span class="roll-failure">${label} провалено — ${deg} ${_degWord(deg)}. ${
      totalHits > 1 ? `Все ${totalHits} ${_hitWord(totalHits)} проходят.` : "Попадание проходит."}</span>`;
  }
  if (remaining === 0) {
    return `<span class="roll-success">${label} успешно — ${deg} ${_degWord(deg)}${
      totalHits > 1 ? `, снимает все ${totalHits} ${_hitWord(totalHits)}` : ""}! ${successTail}</span>`;
  }
  return `<span class="roll-failure">${rollIcon("warn", "#ffb84d")}${label} успешно — ${deg} ${_degWord(deg)}, снимает ${negated} из ${totalHits} ${_hitWord(totalHits)}. ${remaining} ${_hitWord(remaining)} всё ещё проходит.</span>`;
}

function leftoverNote(banked, leftover) {
  return banked
    ? `<div class="roll-defense-note">Остаётся ${leftover} ${_leftoverSuccessPhrase(leftover)} — можно потратить на попадания других атак этого противника в этом Ходу (2 Усп./попадание).</div>`
    : "";
}

// ── Пункт 8: поворот до 180° вне своего Хода ────────────────────────────────

/**
 * «Раз в Раунд вне своего Хода может повернуться на до 180° (обычно —
 * подставить лобовую броню). Талант Combat Master позволяет пилоту делать это
 * до ½WS.b (окр. вверх) раз в Раунд» (п.8).
 *
 * Счётчик — общая плоскость «до N раз за Раунд» (rules/cooldown.mjs::
 * incrementThrottleCount), та же, которой считаются Песнь Скорости и Bone
 * Song. Вне активного боя Раунд отследить нечем: тогда счётчик не ведётся, а
 * поворот разрешён — тот же принцип, что у isCapabilityAvailable («не отнимаем
 * возможность отсутствием боевого трекера»).
 *
 * Сам поворот токена на холсте система не делает — как и Таран, и Ландшафт,
 * и Крушение: холст двигает ГМ руками (см. заголовок combat/vehicle.mjs).
 */
export async function performWalkerTurnAbout(vehicle) {
  if (!requireWalker(vehicle, "Поворот вне Хода")) return;
  const crew = await walkerCrew(vehicle);
  const combatMaster = !!crew && (hasCombatMasterTalent(crew.actor.items ?? [])
    || hasRuleFlag(crew.actor, COMBAT_MASTER_FLAG));
  const wsBonus = Number(crew?.actor?.system?.characteristics?.ws?.bonus) || 0;
  const max = walkerTurnsPerRound({ combatMaster, wsBonus });

  if (!isThrottleCountAvailable(vehicle, WALKER_TURN_CAPABILITY, "round", max)) {
    return ui.notifications?.warn(
      `⚠️ Повороты вне Хода в этом Раунде исчерпаны (${max} из ${max}).`);
  }
  const counted = await incrementThrottleCount(vehicle, WALKER_TURN_CAPABILITY, "round", max);
  const used = counted ? throttleCount(vehicle, WALKER_TURN_CAPABILITY, "round") : 0;

  const why = combatMaster
    ? `Combat Master пилота (${esc(crew.actor.name)}): до ½WS.b — ${max} раз${max === 1 ? "" : "а"} за Раунд`
    : "Обычный лимит: 1 раз за Раунд";

  await postTestCard(vehicle, {
    icon: rollIcon("run", "#8fd0ff"), title: `Поворот вне Хода — ${esc(vehicle.name)}`,
    outcome: outcomeHtml(true, "Разворот на до 180° — обычно чтобы подставить Лобовую броню."),
    sections: [`<div class="roll-allout-note">${why}. ${counted
      ? `Использовано в этом Раунде: <b>${used}</b> из ${max}.`
      : "Активного боя нет — счётчик поворотов не ведётся, следите за ним по столу."}</div>`]
  }, { sound: false });
}

// ── Пункт 2: Опрокидывание вместо сбивания с ног ────────────────────────────

/**
 * Опрокидывание (п.2, полный текст — VEHICLE_STATUS_EFFECTS в
 * constants/vehicle.mjs): «Шагоход падает… <Размер>d10 урона в приземлившуюся
 * сторону (АР вдвое ниже, окр.▲). С уступа +1 урон за каждые ½ м. Экипаж T+0
 * или Оглушение на 1 Раунд. Встаёт за полное действие (Leap Up — за
 * полудействие)».
 *
 * До этой правки в системе не было НИ ОДНОЙ строки кода, разыгрывающей
 * Опрокидывание, — только текст в справочнике и в четырёх Крит. Эффектах
 * Ходовой («Шагоход → Опрокидывание»), то есть ГМ считал всё руками.
 *
 * Что осталось на столе (осознанно): случайное направление падения выбирает
 * ГМ (у Шагохода стороны брони — это ориентация корпуса, которую система не
 * знает, и врать «выпал борт» было бы хуже, чем спросить), и тест Стойкости
 * экипажа — обычный тест T на листе бойца, своей кнопки для него здесь нет.
 */
export async function showTipOverDialog(vehicle) {
  // Спрашиваем именно «что с этой машиной делает толчок», а не «Шагоход ли
  // она»: правило книги звучит как замена исхода, и точка входа должна читать
  // его так же — тогда будущий вызывающий (когда в системе появится путь,
  // сбивающий технику с ног) спросит ту же функцию, а не заведёт свою копию.
  if (knockdownOutcomeFor(vehicle) !== "tipOver") {
    ui.notifications?.warn("⚠️ Опрокидывание: этот исход книга даёт только Ходовой «Шагоход» — прочую технику толчок сбивает по общим правилам.");
    return;
  }
  const size = Number(vehicle.system?.size) || 0;
  const sideOpts = Object.entries(ARMOUR_SIDES)
    .map(([k, label]) => `<option value="${k}"${k === "side" ? " selected" : ""}>${label}</option>`).join("");

  new Dialog({
    title: `Опрокидывание — ${vehicle.name}`,
    content: `
      <form class="wh-vehicle-dialog" style="padding:6px;">
        <div class="atk-dlg-row"><label>Приземлился на сторону:</label><select id="tp-side">${sideOpts}</select></div>
        <div class="atk-dlg-row"><label>Высота уступа, м:</label><input id="tp-ledge" type="number" value="0" min="0" step="0.5"/></div>
        <div class="atk-range-info" style="font-size:0.82em;">
          Урон ${tipOverDamageFormula(size)} (по Размеру ${size}) в приземлившуюся сторону, её АР считается вдвое ниже (окр.▲).
          С уступа +1 урон за каждые ½ м. Направление, если толчок не был направленным, выбирает ГМ.
        </div>
      </form>`,
    buttons: {
      go: { icon: '<i class="fas fa-person-falling"></i>', label: "Опрокинуть!",
        callback: async html => {
          const side  = html.find("#tp-side").val() || "side";
          const ledge = parseFloat(html.find("#tp-ledge").val()) || 0;
          await resolveTipOver(vehicle, { side, ledgeMetres: ledge });
        } },
      cancel: { label: "Отмена" }
    },
    default: "go"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 440 }).render(true);
}

/** Разыграть Опрокидывание: урон по Структуре, состояние «Опрокидывание», памятка экипажу. */
export async function resolveTipOver(vehicle, { side = "side", ledgeMetres = 0 } = {}) {
  const size  = Number(vehicle.system?.size) || 0;
  const roll  = await new Roll(tipOverDamageFormula(size)).evaluate();
  const ledge = tipOverLedgeBonus(ledgeMetres);
  const raw   = roll.total + ledge;
  const apRaw = Number(vehicle.system?.armour?.[side]) || 0;
  const ap    = tipOverArmour(apRaw);
  const net   = Math.max(0, raw - ap);

  const { currentValue, newValue, newCritical, gotCritical } = await applyStructureLoss(vehicle, net);

  // Состояние — тот же список, что ставится вручную кнопкой на вкладке
  // «Повреждения» (system.damageStates), а не новое поле схемы: текст
  // «Опрокидывание» уже живёт в VEHICLE_STATUS_EFFECTS, и второй копии ему
  // не нужно.
  if (!isTippedOver(vehicle)) {
    const src = VEHICLE_STATUS_EFFECTS.find(s => s.name === TIP_OVER_LABEL);
    const states = foundry.utils.deepClone(vehicle.system.damageStates || []);
    states.push({ id: foundry.utils.randomID(), kind: "effect",
      label: TIP_OVER_LABEL, note: src?.text || "" });
    await vehicle.update({ "system.damageStates": states });
  }

  const crew = (vehicle.system?.stations || []).filter(s => s?.uuid).map(s => esc(s.name || "?"));

  await postTestCard(vehicle, {
    icon: rollIcon("burst", "#ff8a3a"), title: `Опрокидывание — ${esc(vehicle.name)}`,
    threshold: `<div class="roll-threshold">Урон ${tipOverDamageFormula(size)}: <b>${roll.total}</b>${
      ledge ? ` + уступ <b>${ledge}</b> (${ledgeMetres} м)` : ""} = <b>${raw}</b> · АР ${ARMOUR_SIDES[side] || side} <b>${apRaw}</b> → вдвое <b>${ap}</b></div>`,
    outcome: net > 0
      ? outcomeHtml(false, `В Структуру: <b>${net}</b>. Структура ${currentValue} → ${newValue}${gotCritical ? ` (крит. ${newCritical})` : ""}.`)
      : outcomeHtml(true, `Удар о землю поглощён бронёй (${raw} ≤ ${ap}).`),
    sections: [
      `<div class="roll-allout-note">Экипаж проходит тест T+0 или Оглушён на 1 Раунд${
        crew.length ? `: ${crew.join(", ")}` : " (мест никто не занимает)"}.</div>`,
      `<div class="roll-defense-section">
         <button class="wh-walker-standup-btn" type="button" data-vehicle-uuid="${vehicle.uuid}">
           Встать (полное действие; Leap Up — полудействие)
         </button>
       </div>`
    ]
  }, { rolls: [roll] });
}

/** Встать из Опрокидывания — снимает состояние. Экономику действий не считает (её у машины нет). */
export async function standUpFromTipOver(vehicle) {
  if (!isTippedOver(vehicle)) {
    return ui.notifications?.info(`${vehicle.name}: машина не Опрокинута.`);
  }
  const states = (vehicle.system.damageStates || []).filter(s => String(s?.label || "") !== TIP_OVER_LABEL);
  await vehicle.update({ "system.damageStates": states });
  await postTestCard(vehicle, {
    icon: rollIcon("run", "#4dffa6"), title: `Опрокидывание — ${esc(vehicle.name)}`,
    outcome: outcomeHtml(true, "Шагоход поднимается на ноги."),
    sections: [`<div class="roll-allout-note">Полное действие; с Талантом Leap Up / Быстрый Подъём — полудействие.</div>`]
  }, { sound: false });
}

// ── Пункт 1: Натиск Шагоходом ───────────────────────────────────────────────

/**
 * Объявить Натиск (п.1: «может в ближний бой, включая Натиск»).
 *
 * Персонажный declareCharge (combat/movement-actions.mjs) Шагоходу не годится
 * буквально: он читает system.movement.charge и пишет system.meleeBase —
 * полей, которых в схеме техники нет вовсе, и запись ушла бы в никуда. Здесь
 * тот же смысл, но своими полями машины: дистанция считается от SPD машины
 * (rules/walker.mjs::walkerChargeDistance), а бонус +20 читает диалог
 * стрельбы рукопашным орудием (sheets/vehicle-sheet.mjs).
 *
 * Цена действия списывается с ПИЛОТА — ОД есть у него, а не у машины (тот же
 * приём, что у Залпа, combat/vehicle.mjs::resolveVolleyAction). Пустая машина
 * Натиск объявить может: некому платить — нечего и списывать.
 */
export async function declareWalkerCharge(vehicle) {
  if (!requireWalker(vehicle, "Натиск")) return;
  if (isTippedOver(vehicle)) {
    return ui.notifications?.warn("⚠️ Машина Опрокинута — сначала встать (как Повален у персонажа).");
  }
  const crew = await walkerCrew(vehicle);
  const cost = apCostForActionType("Полное действие");
  if (crew && !canSpendActionPoints(crew.actor, cost)) {
    return ui.notifications?.warn(`⚠️ У ${crew.actor.name} не хватает ОД на Натиск (полное действие).`);
  }
  if (crew) await spendActionPoints(crew.actor, cost, { physical: true });

  const combatId = game.combat?.id ?? "";
  const round    = game.combat?.round ?? 0;
  await vehicle.setFlag("warhammer-dbc", WALKER_CHARGE_FLAG, walkerChargeMark({ combatId, round }));

  const spd = Number(vehicle.system?.derived?.effSpd) || Number(vehicle.system?.chassis?.spd) || 0;

  await postTestCard(vehicle, {
    icon: rollIcon("sword", "#ff9d4d"), title: `Натиск — ${esc(vehicle.name)}`,
    outcome: outcomeHtml(true, `Перемещение до <b>${walkerChargeDistance(spd)}</b> м (SPD×3, не менее 4), заканчивая в контакте с противником.`),
    sections: [`<div class="roll-allout-note">Рукопашная атака машины в этом Раунде получает <b>+${WALKER_CHARGE_BONUS}</b> — бонус подставится в окне «Стрельба» рукопашного орудия сам.${
      crew ? ` Полное действие списано у ${esc(crew.actor.name)}.` : " Экипажа нет — ОД списывать не с кого."}</div>`]
  }, { sound: false });
}

/** Действует ли объявленный Натиск на машине прямо сейчас (читает диалог рукопашной). */
export function walkerChargeActive(vehicle) {
  if (!isWalkerVehicle(vehicle)) return false;
  const mark = vehicle.getFlag?.("warhammer-dbc", WALKER_CHARGE_FLAG);
  return isWalkerChargeActive(mark, { combatId: game.combat?.id ?? "", round: game.combat?.round ?? 0 });
}

// ── Пункт 6: весь арсенал за одно действие ──────────────────────────────────

/**
 * «Пилот может использовать всё оружие машины — дальнее и ближнее — в один
 * Ход, как если бы у него был Трейт Multiple Arms достаточного рейтинга»
 * (п.6). Что именно из этого автоматизируется и почему не больше — см.
 * rules/walker.mjs::WALKER_ALL_ARMS_ACTION.
 *
 * Возвращает результат, а не пишет карточку: у диалога листа свой текст, а
 * тесту нужен именно факт списания (тот же договор, что у resolveVolleyAction).
 */
export async function resolveWalkerAllArms(vehicle) {
  if (!isWalkerVehicle(vehicle)) {
    return { ok: false, error: "Это правило есть только у Ходовой «Шагоход»." };
  }
  const items = vehicle.items ?? [];
  const weapons = typeof items.filter === "function" ? items.filter(i => i?.type === "weapon") : [];
  if (!weapons.length) return { ok: false, error: "У машины нет ни одного орудия." };

  const crew = await walkerCrew(vehicle);
  if (!crew) return { ok: false, error: "В машине нет пилота/мехвода — использовать оружие некому." };

  const cost = apCostForActionType(WALKER_ALL_ARMS_ACTION);
  if (!canSpendActionPoints(crew.actor, cost)) {
    return { ok: false, error: `У ${crew.actor.name} не хватает ОД на полное действие.` };
  }
  await spendActionPoints(crew.actor, cost);
  return { ok: true, occupant: crew.actor, weapons };
}
