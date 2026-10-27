// module/combat/psyker-pools.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Пачка I1 (Sahara 3-28, решения владельца 26.10.2026): Foundry-обвязка Талантов
//  Псайканы с пулами и экономикой манифестации. Правила и проверки — чистый
//  rules/psyker-talents.mjs; здесь — запись состояния и карточки чата.
//
//   • Манифестация в бою ТРАТИТ ОД по полю действия самой силы (Полудействие 1, Полное и
//     Длительное 2, Свободное 0, Реакция — Реакция); не хватает — отказ до броска.
//   • Быстрое Плетение — пул 2 ОД, выдаётся в начале боя (combatStart), уменьшает это
//     списание (галочка «−N ОД из пула»), только для силы без типа «Атака», гаснет с началом
//     своего Хода (реестр rules/turn-flags.mjs), Врасплох обнуляет.
//   • Текучее Плетение — пул I.b очков на самом Таланте, кнопка «переплести» на
//     поддерживаемой силе (поддержание снимается и заводится заново), возврат очка —
//     полное действие концентрации.
//   • Ключевые Силы — раз в Раунд бесплатное Очко Бесчестия на карточке СВОЕЙ
//     манифестации ключевой силы (психотест, Феномен, Прорыв), в том числе на переброс
//     самого психотеста (карточка хранит параметры броска).
// ════════════════════════════════════════════════════════════════════════════

import { isCapabilityAvailable, markCapabilityUsed, releaseCapabilityUsed } from "../rules/cooldown.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { isEncounterActive, isOwnTurn, hasActionEconomy, spendActionPoints, apSpendGate, canSpendReaction,
         spendReaction, reactionSpendGate } from "./action-economy.mjs";
import { PSY_ACTIONS } from "../constants/psyker.mjs";
import { sustainOffPatch } from "./psychic-sustain.mjs";
import { syncItemEffectsDisabled } from "../apps/effects.mjs";
import { WOUND_FREE_FLAG } from "../rules/wound-in-reality.mjs";
import { tempInfamyAmount } from "../rules/temp-infamy.mjs";
import { canTakeConcentrationAction, takeConcentrationAction } from "./concentration-limit.mjs";
import { runCardOnce, cardOnceUsed, markCardOnce, unmarkCardOnce } from "./card-once.mjs";
import { spendFreeInfamyAbility, spendFromInfamyPool, actorInfamyPath } from "../apps/infamy-points.mjs";
import {
  FAST_WEAVING_FLAG, hasFastWeaving, fastWeavingStart, fastWeavingGate, fastWeavingLeft, psychicApCost,
  FLUID_WEAVE_SPENT_FLAG, FLUID_WEAVE_TURN_FLAG, fluidWeaveTalent, fluidWeaveMax, fluidWeaveSpent,
  fluidWeaveLeft, fluidWeaveGate, isSignaturePower
} from "../rules/psyker-talents.mjs";

const NS = "warhammer-dbc";

// ── Быстрое Плетение ────────────────────────────────────────────────────────

/** Начало боя (хук combatStart, пишет ГМ): каждому носителю Таланта — пул 2 ОД, застигнутому Врасплох — 0. */
export async function processFastWeavingCombatStart(combat, updateData = null) {
  // Хук combatStart звучит ДО первого обновления боя (turn там ещё null), поэтому «кто ходит
  // первым» берём из порядка Инициативы и номера Хода будущего обновления, а не из combat.combatant.
  const first = combat?.turns?.[updateData?.turn ?? 0]?.actor ?? combat?.combatant?.actor ?? null;
  for (const combatant of combat?.combatants ?? []) {
    const actor = combatant?.actor;
    if (!actor) continue;
    // Метка «раз в Ход» Текучего Плетения не гасится концом боя — новый бой начинается с чистого листа.
    if (actor.getFlag?.(NS, FLUID_WEAVE_TURN_FLAG)) await actor.unsetFlag(NS, FLUID_WEAVE_TURN_FLAG);
    if (!hasFastWeaving(actor)) continue;
    // Чей Ход уже идёт (обработчик догнал начало первого Хода) — тому пул не нужен: «до первого
    // Хода» для него нет окна, а метка пережила бы сброс Хода и осталась бы пулом вне очереди.
    const itsTurn = !!first && (first === actor || (!!first.uuid && first.uuid === actor.uuid));
    await actor.setFlag(NS, FAST_WEAVING_FLAG, itsTurn ? 0 : fastWeavingStart(actor));
  }
}

/** Гейт «сейчас, в этом бою»: свой Ход пул уже сбросил; вне боя пула нет (метка могла остаться от прошлого боя). */
export function fastWeavingGateNow(actor, power) {
  if (!isEncounterActive()) return { ok: false, code: "empty", reason: "", cost: 0, left: 0, cover: 0 };
  return fastWeavingGate(actor, power, { ownTurn: isOwnTurn(actor) });
}

const line = (html, extra = "") => `<div class="roll-threshold" style="font-size:0.85em;${extra}">${html}</div>`;

/**
 * Что манифестация этой силы стоит СЕЙЧАС и чем платится — без побочных эффектов (проверка до броска).
 * Вне боя и у акторов без экономики действий платить нечего. Цена — по полю действия самой силы;
 * пул Быстрого Плетения (fastWeaving — галочка окна) только уменьшает реальное списание ОД.
 * @returns {{ok:boolean, kind:"none"|"free"|"reaction"|"ap", cost:number, cover:number, rest:number, fw:object|null, reason:string}}
 */
export function manifestActionPlan(actor, power, { fastWeaving = false } = {}) {
  const none = { ok: true, kind: "none", cost: 0, cover: 0, rest: 0, fw: null, reason: "" };
  if (!isEncounterActive() || !hasActionEconomy(actor)) return none;
  const action = power?.system?.action;
  if (action === "reaction") {
    const ok = canSpendReaction(actor, { physical: false });
    return { ...none, ok, kind: "reaction", cost: 1, reason: ok ? "" : (reactionSpendGate(actor, { physical: false }).title || "Не хватает Реакций") };
  }
  const cost = psychicApCost(action);
  if (cost <= 0) return { ...none, kind: "free" };
  const fw = (fastWeaving && hasFastWeaving(actor)) ? fastWeavingGateNow(actor, power) : null;
  const cover = fw?.ok ? fw.cover : 0;
  const rest = cost - cover;
  if (rest > 0) {
    const gate = apSpendGate(actor, rest, { physical: false });
    if (gate.disabled) return { ok: false, kind: "ap", cost, cover, rest, fw, reason: gate.title };
  }
  return { ok: true, kind: "ap", cost, cover, rest, fw, reason: "" };
}

/**
 * Списать по плану (после проверки manifestActionPlan, перед броском психотеста): ОД, Реакцию и пул.
 * @returns {Promise<{ok:boolean, lines:string[]}>} lines — строки для карточки манифестации
 */
export async function payManifestAction(actor, power, plan) {
  const lines = [];
  const label = PSY_ACTIONS[power?.system?.action] ?? PSY_ACTIONS.half;
  if (plan.kind === "reaction") {
    if (!(await spendReaction(actor, { physical: false }))) return { ok: false, lines };
    lines.push(line(`Действие: ${label} — списана 1 Реакция.`));
  } else if (plan.kind === "ap") {
    // Остаток пула перечитывается: между планом и списанием были await, а второе окно манифестации
    // (лист и HUD) могло уже взять свою долю — недостающее добирается из обычных ОД.
    const cover = plan.cover > 0 ? Math.min(plan.cover, fastWeavingLeft(actor)) : 0;
    const rest = plan.cost - cover;
    if (rest > 0 && !(await spendActionPoints(actor, rest, { physical: false }))) return { ok: false, lines };
    if (cover > 0) {
      const left = fastWeavingLeft(actor) - cover;
      await actor.setFlag(NS, FAST_WEAVING_FLAG, left);
      lines.push(line(`Действие: ${label} — ${plan.cost} ОД. Быстрое Плетение: −${cover} ОД из отдельного пула (осталось ${left})${rest > 0 ? `, остальное списано из обычных ОД: ${rest}` : "; обычные ОД не тратятся"}.`));
    } else {
      lines.push(line(`Действие: ${label} — списано ${rest} ОД.`));
    }
  }
  if (plan.kind === "ap" && plan.fw && !plan.fw.ok && plan.fw.reason) {
    lines.push(line(`${esc(plan.fw.reason)} Манифестация без пула.`, "color:#a33;"));
  }
  return { ok: true, lines };
}

// ── Текучее Плетение ────────────────────────────────────────────────────────

/**
 * Кнопка «переплести» на поддерживаемой силе (Вливание/Призыв/Психический Клинок).
 * Поддержание СНИМАЕТСЯ общим патчом (combat/psychic-sustain.mjs) и заводится заново с теми же
 * эPR, Успехами и целью — без психотеста; силе записывается метка «переплетено». Цель прежняя,
 * чужим таргетом сцены не подменяется; прочие эффекты игрок меняет вручную. Заточённую в Плоде
 * Плоти силу развеять нельзя (книга), пока плод цел, — отказ. Предел психотеста выше исходного
 * повышать нельзя (книга) — карточка напоминает.
 */
export async function weaveFluid(actor, power) {
  const inCombat = isEncounterActive();
  const gate = fluidWeaveGate(actor, power, { inCombat });
  if (!gate.ok) { ui.notifications?.warn(gate.reason); return false; }
  // Заточение Силы (Плод Плоти): та же защита, что у галочки «Подд.» (sheets/tabs/psychic.mjs) — пока плод цел, силу не развеять.
  const lockUuid = power.getFlag?.(NS, "fruitOfFleshLockUuid");
  if (lockUuid) {
    let fruit = null;
    try { fruit = await fromUuid(lockUuid); } catch { fruit = null; }
    if (fruit) { ui.notifications?.warn("Текучее Плетение: сила заточена в Плоде Плоти — развеять (и переплести) нельзя, пока плод цел."); return false; }
  }
  const talent = fluidWeaveTalent(actor);
  const spent = fluidWeaveSpent(actor) + 1;
  await talent.setFlag(NS, FLUID_WEAVE_SPENT_FLAG, spent);
  if (inCombat) await actor.setFlag(NS, FLUID_WEAVE_TURN_FLAG, true);
  const s = power.system;
  const epr = s.sustainedEpr ?? null;
  const degree = s.sustainedDegree ?? null;
  // Снимок того, что поддержание сбрасывает, а «те же эPR и Успехи» обязаны пережить. Цель прежняя:
  // книга — «на ту же цель или в то же пространство»; sustainedTargetUuid читают Возможности силы
  // (rules/psychic-sustain-target.mjs), подменять его чужим таргетом сцены нельзя.
  const target = s.sustainedTargetUuid ?? "";
  const weaponBuff = s.hasWeaponShop ? foundry.utils.deepClone(s.effects?.weaponBuff ?? null) : null;
  const woundFree = power.getFlag?.(NS, WOUND_FREE_FLAG);
  // 1) развеять старое — общим патчом снятия (psychic-sustain.mjs), как при обычном снятии галочки «Подд.»
  await power.update(sustainOffPatch(power));
  await syncItemEffectsDisabled(power);
  // 2) завести новое поддерживаемое с теми же числами, без психотеста
  const on = {
    "system.isSustained": true,
    "system.sustainedDegree": degree,
    "system.sustainedEpr": epr,
    "system.sustainedTargetUuid": target,
    [`flags.${NS}.rewoven`]: { epr, degree, round: game.combat?.round ?? null }
  };
  if (weaponBuff) on["system.effects.weaponBuff"] = weaponBuff;
  if (woundFree) on[`flags.${NS}.${WOUND_FREE_FLAG}`] = woundFree;
  await power.update(on);
  await syncItemEffectsDisabled(power);
  const left = fluidWeaveLeft(actor);
  const kept = (epr != null || degree != null)
    ? `Те же эPR <b>${epr ?? "—"}</b> и Успехи <b>${degree ?? "—"}</b>, без психотеста.`
    : "эPR и Успехи не записаны (сила поддерживалась без манифестации с листа) — возьмите исходные значения вручную.";
  await postTestCard(actor, {
    icon: rollIcon("spark", "#c98bff"), title: `Текучее Плетение — ${esc(power.name)} — ${esc(actor.name)}`,
    lines: [
      `<div class="roll-threshold">Поддержание снято и заведено заново: ${kept}</div>`,
      `<div class="roll-threshold" style="font-size:0.85em;">Цель или пространство прежние; другие эффекты, если сила позволяет их выбирать, укажите вручную. Предел психотеста выше исходного повышать нельзя.</div>`,
      `<div class="roll-threshold" style="font-size:0.85em;">Очков Плетения: <b>${left}</b> / ${fluidWeaveMax(actor)}${inCombat ? " · раз в Ход — следующее переплетение в следующем Ходу" : ""}.</div>`
    ]
  }, { sound: false });
  return true;
}

/** Полное действие концентрации возвращает 1 очко Текучего Плетения. */
export async function restoreFluidWeavePoint(actor) {
  const talent = fluidWeaveTalent(actor);
  if (!talent) return false;
  if (fluidWeaveSpent(actor) <= 0) { ui.notifications?.info("Текучее Плетение: все очки на месте."); return false; }
  if (!canTakeConcentrationAction(actor)) {
    ui.notifications?.warn("Текучее Плетение: в Ход можно совершить только одну Концентрацию (стр. 12).");
    return false;
  }
  if (!(await spendActionPoints(actor, 2, { physical: false }))) return false;
  await takeConcentrationAction(actor);
  await talent.setFlag(NS, FLUID_WEAVE_SPENT_FLAG, fluidWeaveSpent(actor) - 1);
  await postTestCard(actor, {
    icon: rollIcon("spark", "#c98bff"), title: `Текучее Плетение — концентрация — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">Полное действие концентрации: очко Плетения восстановлено. Очков: <b>${fluidWeaveLeft(actor)}</b> / ${fluidWeaveMax(actor)}.</div>`]
  }, { sound: false });
  return true;
}

// ── Ключевые Силы ───────────────────────────────────────────────────────────

/** Ключ метки «раз в Раунд» (rules/cooldown.mjs, usageLimits на акторе). */
export const SIGNATURE_USAGE_KEY = "psyker.core.signaturePowers";
/** Метка карточки (combat/card-once.mjs): бесплатное Очко с этой карточки уже занято. */
const SIGNATURE_CARD_FLAG = "signatureFreeUsed";

/** Свободно ли сейчас бесплатное Очко ЭТОЙ ключевой силы: сила ключевая и в Раунде оно ещё не использовано. */
export function signatureFreeAvailable(actor, power) {
  return isSignaturePower(actor, power) && isCapabilityAvailable(actor, SIGNATURE_USAGE_KEY, "round");
}

/** Занять бесплатное Очко (Усмирение Варпа на карточке ключевой силы). false — оно недоступно. */
export async function claimSignatureFree(actor, power, message = null) {
  if (!signatureFreeAvailable(actor, power)) return false;
  // Одна бесплатная трата на карточку: вне боя Раунда нет, и метка Раунда ничего не запоминает.
  if (message && cardOnceUsed(message, SIGNATURE_CARD_FLAG)) return false;
  await markCapabilityUsed(actor, SIGNATURE_USAGE_KEY, "round");
  if (message) await markCardOnce(message, SIGNATURE_CARD_FLAG);
  return true;
}

/** Вернуть бесплатное Очко (Штиль отменил переброс, ради которого оно использовалось). */
export async function releaseSignatureFree(actor, message = null) {
  await releaseCapabilityUsed(actor, SIGNATURE_USAGE_KEY, "round");
  if (message) await unmarkCardOnce(message, SIGNATURE_CARD_FLAG);
}

/** Способности Очка Бесчестия, применимые к тесту манифестации (подпись — как на полосе Очков). */
const SIGNATURE_ABILITIES = [
  { key: "success", label: "Успех (+1 Успех)", onlyOnSuccess: true,
    title: "Ключевая Сила: способность «Успех» без траты Очка Бесчестия — +1 Успех к удавшейся манифестации (Успехи силы на листе растут сами)" },
];

/**
 * Блок карточки СВОЕЙ манифестации ключевой силы (видят владелец и ГМ): строка о бесплатном
 * Очке и кнопки способностей для теста. Феномен и Прорыв — кнопки Усмирения Варпа рядом
 * (combat/calm-warp.mjs) — становятся бесплатными сами, пока Очко не занято.
 * rerollable — карточка хранит параметры броска, и психотест можно перебросить: первый переброс Раунда
 * бесплатный, последующие платные Очком Бесчестия.
 * @returns {string} пустая строка, если сила не ключевая
 */
export function signatureFreeHtml(actor, power, { success, rerollable = false, freeSpent = false }) {
  if (!isSignaturePower(actor, power)) return "";
  // freeSpent — бесплатное Очко уже ушло на переброс, породивший эту карточку (вне боя Раунда нет, метка его не помнит).
  const free = !freeSpent && isCapabilityAvailable(actor, SIGNATURE_USAGE_KEY, "round");
  const attrs = `data-actor-uuid="${esc(actor.uuid)}" data-power-uuid="${esc(power.uuid)}"`;
  const btns = free ? SIGNATURE_ABILITIES.filter(a => !a.onlyOnSuccess || success).map(a =>
    `<button type="button" class="wh-signature-free-btn" ${attrs} data-ability="${a.key}" title="${esc(a.title)}">⚜ ${esc(a.label)}</button>`).join(" ") : "";
  const reroll = rerollable
    ? `<button type="button" class="wh-psy-reroll-btn" ${attrs} data-free="${free ? 1 : 0}"
        title="Переброс психотеста с теми же модификаторами: результат этой карточки заменяется новым. ${free ? "Первый в Раунде — бесплатно (Ключевая Сила)." : "Бесплатное Очко Раунда занято — переброс за 1 Очко Бесчестия."}">${free ? "⚜ Переброс психотеста (бесплатно)" : "↻ Переброс психотеста (−1 Очко Бесчестия)"}</button>`
    : "";
  const head = free
    ? "⚜ Ключевая Сила: раз в Раунд Очко Бесчестия бесплатно — для этой манифестации, её Феномена и Прорыва (Усмирение Варпа ниже — тоже без траты)."
    : "Ключевая Сила: бесплатное Очко Бесчестия в этом Раунде уже использовано — дальше Очки платные.";
  return `<div class="roll-threshold wh-owner-only wh-signature-free" data-actor-uuid="${esc(actor.uuid)}">
      ${head} ${btns} ${reroll}
    </div>`;
}

/**
 * Снять Порчу Варп-Шока, которую начислила прежняя карточка манифестации (решение владельца 27.10.2026:
 * переброс заменяет результат целиком, значит и его Порчу). Снимается ровно то, что карточка записала
 * при начислении (psyManifest.warpShock), а не пересчёт: Порча из других источников и ручные правки не
 * трогаются, ниже нуля не уходит. Один раз на карточку — отметка psyWarpShockReturned, чтобы повторный клик
 * после сорванного переброса не снял Порчу второй раз. Варп-Замок этим не пользуется: его Порча остаётся.
 * @returns {Promise<number>} сколько Порчи снято (0 — нечего снимать или уже снято)
 */
export async function returnWarpShock(actor, message, saved) {
  const amount = Math.max(0, Math.trunc(Number(saved?.warpShock) || 0));
  if (!amount || cardOnceUsed(message, "psyWarpShockReturned")) return 0;
  const cur = Math.max(0, Number(actor.system?.corruption?.value) || 0);
  const back = Math.min(amount, cur);
  if (back > 0) await actor.update({ "system.corruption.value": cur - back });
  await markCardOnce(message, "psyWarpShockReturned");
  return back;
}

/**
 * Переброс психотеста с карточки СВОЕЙ ключевой силы. Параметры броска лежат во флаге карточки
 * (psyManifest.opts); тест повторяется целиком с ними (executePsychotest с reroll:true): те же
 * модификаторы, поддержание и Феномен пересчитываются новым результатом, а разовые траты первой
 * попытки — ОД, пул Быстрого Плетения, Очко Возрождения/Проводника, Руны, Раны Конверсии — не
 * платятся заново. Порча Варп-Шока прежнего результата снимается, новый результат начисляет свою.
 * Первый переброс Раунда бесплатный, прочие — 1 Очко Бесчестия (как переброс с полосы
 * Очков). Старая карточка помечается заменённой (флаг psyRerolled, хук гасит её кнопки).
 */
export async function handlePsyRerollClick(message, btn) {
  const { actorUuid, powerUuid } = btn.dataset;
  let actor = null, power = null;
  try { actor = await fromUuid(actorUuid); } catch { actor = null; }
  if (actor && !(actor instanceof Actor)) actor = actor.actor ?? null;
  try { power = await fromUuid(powerUuid); } catch { power = null; }
  if (!actor?.isOwner) { ui.notifications?.warn("Перебросить может только владелец псайкера."); return false; }
  const saved = message.getFlag?.(NS, "psyManifest");
  if (!saved?.opts || saved.powerUuid !== powerUuid) { ui.notifications?.warn("Карточка не хранит параметры броска — перебросить нельзя."); return false; }
  if (!isSignaturePower(actor, power)) { ui.notifications?.warn("Эта сила не выбрана ключевой."); return false; }
  // Покровительство Нургла: «Принятие Судьбы» — способность Переброса недоступна (constants/demon-prince.mjs).
  if (actor.system?.patronGod === "nurgle") { ui.notifications?.warn("Принятие Судьбы (Нургл): Переброс недоступен."); return false; }
  // Надпись кнопки «бесплатно» ставится при выпуске карточки; если Очко Раунда с тех пор ушло в другое место,
  // молча платить Очком нельзя — переспрашиваем.
  if (btn.dataset.free === "1" && !signatureFreeAvailable(actor, power)) {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: `Переброс — ${actor.name}` },
      content: "<p>Бесплатное Очко Ключевых Сил в этом Раунде уже ушло. Перебросить психотест за <b>1 Очко Бесчестия</b>?</p>",
      yes: { label: "Перебросить за Очко" }, no: { label: "Отмена" }, rejectClose: false
    });
    if (!ok) return false;
  }
  return runCardOnce(message, "psyRerolled", async () => {
    let note;
    let freeSpent = false;
    if (await claimSignatureFree(actor, power, message)) {
      note = "бесплатно: Ключевая Сила, раз в Раунд";
      freeSpent = true;
    } else {
      const path = actorInfamyPath(actor);
      const cur = Number(foundry.utils.getProperty(actor, path)) || 0;
      if (cur < 1 && tempInfamyAmount(actor) < 1) { ui.notifications?.warn("Нет Очков Бесчестия."); return false; }
      const spend = await spendFromInfamyPool(actor, 1, path);
      if (!spend) return false;
      await actor.update({ [path]: spend.poolValue });
      note = `−1 Очко Бесчестия, осталось ${spend.poolValue}`;
    }
    // Порча Варп-Шока прежнего результата уходит вместе с ним — новый результат начислит свою заново.
    const returned = await returnWarpShock(actor, message, saved);
    if (returned) note += `; Порча Варп-Шока прежнего результата (−${returned}) снята, новый результат начисляет заново`;
    const { executePsychotest } = await import("../sheets/tabs/psychic.mjs");
    await executePsychotest(actor, power, { ...foundry.utils.deepClone(saved.opts), reroll: true, rerollNote: note,
      rolled: saved.rolled ?? null, signatureFreeSpent: freeSpent });
    return true;
  }, "Эта карточка уже переброшена.");
}

/** Клик по кнопке способности: применяет её без траты Очка и занимает бесплатное Очко Раунда. */
export async function handleSignatureFreeClick(message, btn) {
  const { actorUuid, powerUuid, ability } = btn.dataset;
  let actor = null, power = null;
  try { actor = await fromUuid(actorUuid); } catch { actor = null; }
  if (actor && !(actor instanceof Actor)) actor = actor.actor ?? null;
  try { power = await fromUuid(powerUuid); } catch { power = null; }
  if (!actor?.isOwner) { ui.notifications?.warn("Тратить Очко Бесчестия может только владелец персонажа."); return false; }
  if (!isSignaturePower(actor, power)) { ui.notifications?.warn("Эта сила не выбрана ключевой."); return false; }
  if (!isCapabilityAvailable(actor, SIGNATURE_USAGE_KEY, "round")) {
    ui.notifications?.warn("В этом Раунде бесплатное Очко Ключевых Сил уже использовано.");
    return false;
  }
  return runCardOnce(message, "signatureFreeUsed", async () => {
    if (!SIGNATURE_ABILITIES.some(a => a.key === ability)) return false;
    const ok = await spendFreeInfamyAbility(actor, ability);
    if (ok) {
      await markCapabilityUsed(actor, SIGNATURE_USAGE_KEY, "round");
      // «Успех»: +1 Успех удавшейся манифестации — тот же счёт, с которого потом переплетают.
      const deg = power.system?.sustainedDegree;
      if (ability === "success" && deg != null) await power.update({ "system.sustainedDegree": Number(deg) + 1 });
    }
    return ok;
  }, "С этой карточки бесплатное Очко уже потрачено.");
}
