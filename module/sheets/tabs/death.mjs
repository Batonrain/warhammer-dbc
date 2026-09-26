// module/sheets/tabs/death.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Смерть (стр. 232-233): диалог «Спасение» рядом с Кардио-монитором
//  (bc-death-toggle, templates/actor/parts/tab-effects.hbs) — доступен, только
//  пока констатирована смерть (флаг warhammer-dbc.deceased). Три пути:
//  Чудесное Спасение и Божественная Защита (оба всем — разница только в
//  цене и тяжести последствий, книга не требует для второй никакого
//  Таланта, несмотря на одноимённый Талант Пси-стойкости — совпадение
//  перевода названий, не связанные механики; wdbc-80du), и Замедленная
//  Анимация (только Астартес с установленной Сус-ан Мембраной, одна попытка
//  на смерть, Раны не ниже −15 / −(10+T.b) со Сном Героя).
//
//  Сверка с книгой (wdbc-x1nz.2, 24.09.2026):
//   • цена хаосита — характеристика Inf, не пул Очков (rules/death-save.mjs);
//   • Чудесное Спасение откатывает Раны к снимку до смертельного удара и
//     прекращает Состояние-причину смерти; Божественная Защита — все
//     смертельные Состояния, Без сознания, и до ⏻ Конца сессии неуязвимость
//     и только полудвижения (флаг divineProtection);
//   • Астартес может отменить Спасение/Защиту, которые провалились бы или
//     подняли бы Cor до 100, и вместо них попытаться войти в Замедленную
//     Анимацию (стр. 233);
//   • «Игрушка Богов» — у Покровительствуемого одним из четырёх Богов на
//     первой смерти сессии диалог называет обязательные пути (кроме тех, что
//     могут поднять Cor до 100) и даёт тест Inf+30 для отказа.
//  «Воскресить» — отдельная кнопка без формулы вовсе: последствия того, ЧТО
//  и КАК воскресило персонажа (стр. 233, «Воскрешение» — чистая нарративная
//  глава без единой цифры в книге) — на усмотрение ГМа и игроков.
// ════════════════════════════════════════════════════════════════════════════

import { rollIcon } from "../../constants/roll-icons.mjs";
import { esc } from "../../helpers/utils.mjs";
import { postTestCard } from "../../helpers/test-card.mjs";
import {
  fatePoolLabel, MIRACULOUS_SAVE, DIVINE_PROTECTION, SUS_AN_TEST_MOD,
  hasSusAnMembrane, susAnEligible, susAnCriticalLimit, hasHeroSleep, fateSaveFails,
  toyOfGodsApplies, toyOfGodsForcedOptions, TOY_OF_GODS_FLAG, TOY_OF_GODS_TEST_MOD,
  saveCostSource, rollsTwiceKeepLow, conditionsEndedBySave, rollbackWounds,
  DIVINE_PROTECTION_FLAG, DIVINE_TELEPORT_MIN_INF, DEATH_CAUSE_FLAG, PRE_HIT_WOUNDS_FLAG,
  SUS_AN_ATTEMPT_FLAG, FATE_SAVE_FAILED_FLAG
} from "../../rules/death-save.mjs";
import { computeWoundHealing } from "./wounds.mjs";
import { conditionApplyFields, conditionRemoveFields } from "./conditions.mjs";
import { hasRuleFlag } from "../../rules/flags.mjs";
import { spendFromInfamyPool, changeActorInfamy } from "../../apps/infamy-points.mjs";
import { SUNDERING_CAPABILITY } from "../../rules/sundering.mjs";
import { defaultSpawnSunderingFn } from "../../combat/sundering.mjs";
import {
  eternalWarriorEligible, eternalWarriorFreeSaveAvailable, markEternalWarriorUsed
} from "../../combat/eternal-warrior.mjs";
import { collectTestMods } from "../../rules/roll-mods.mjs";
import { KISS_OF_DEATH_FLAG } from "../../rules/kiss-of-death.mjs";
import { triggerLegacyGleeOnFateSave } from "../../combat/legacy-weapon-kill-credit.mjs";
import { isThrottleReady, markThrottleUsed } from "../../rules/cooldown.mjs";
import { inPariahVoid } from "../../rules/null-zones.mjs";

const NS = "warhammer-dbc";

/** Флаг: тест Inf+30 против «Игрушки Богов» на этой смерти уже провален. */
const TOY_TEST_FAILED_FLAG = "toyOfGodsTestFailed";

// Все карточки Спасения — одной формы: шапка «череп + название пути» и один
// блок строк. Сборка и публикация — общий helpers/test-card.mjs (wdbc-kuun);
// звук кубика только там, где кубик действительно катался (Замедленная
// Анимация и бросок пула — с ним, «Воскресить» — без).
async function _postCard(actor, header, lines, rolls = []) {
  await postTestCard(actor, {
    icon: rollIcon("skull", "#ff6b6b"), title: `${esc(header)} — ${esc(actor.name)}`,
    threshold: `<div class="roll-threshold">${lines.join("<br/>")}</div>`
  }, { rolls, sound: rolls.length > 0 });
}

/**
 * Снятие всех меток ОДНОЙ смерти, когда она разрешилась (спасся, вошёл в
 * анабиоз, воскрешён): причина, снимок Ран, попытка Сус-ан, провал теста
 * Игрушки Богов, провал Спасения и одноразовая метка Поцелуя Смерти
 * (wdbc-zye1). Только реально стоящие — «-=» на отсутствующем флаге лишний.
 */
export function _deathResolvedFields(actor) {
  const out = {};
  for (const key of [DEATH_CAUSE_FLAG, PRE_HIT_WOUNDS_FLAG, SUS_AN_ATTEMPT_FLAG, TOY_TEST_FAILED_FLAG, KISS_OF_DEATH_FLAG,
    FATE_SAVE_FAILED_FLAG]) {
    if (actor.getFlag?.(NS, key) !== undefined) out[`flags.${NS}.-=${key}`] = null;
  }
  return out;
}

/** Патч снятия Состояний из списка — только реально стоящих, с метками Удушья. */
function _endConditionsFields(actor, keys) {
  const conds = actor.system?.conditions ?? {};
  const out = {};
  const ended = [];
  for (const key of keys) {
    const active = key === "haemorrhaging" ? (Number(conds.haemorrhagingLevel) || 0) > 0 || conds.haemorrhaging : conds[key];
    if (!active) continue;
    Object.assign(out, conditionRemoveFields(key));
    ended.push(key);
    // Отсчёт задержки дыхания/смерти от удушья живёт во флагах
    // (combat/condition-ticks.mjs::SUFFOCATION_*) — строками, как в
    // conditions.mjs: condition-ticks тянет damage.mjs и цикл импорта.
    if (key === "suffocating") {
      for (const f of ["suffocation", "suffocationRest", "suffocationClockAt"]) {
        if (actor.getFlag?.(NS, f) !== undefined) out[`flags.${NS}.-=${f}`] = null;
      }
    }
  }
  return { fields: out, ended };
}

const CONDITION_LABELS = {
  bleeding: "Кровотечение", haemorrhaging: "Обескровливание", burning: "Горение",
  suffocating: "Удушье", gangrene: "Гангрена"
};

/** Бросок кубика; у Наследника — дважды, берётся меньший. */
async function _rollMaybeKeepLow(formula, keepLow) {
  const a = await new Roll(formula).evaluate();
  if (!keepLow) return { roll: a, total: a.total, rolls: [a], note: "" };
  const b = await new Roll(formula).evaluate();
  const pick = b.total < a.total ? b : a;
  return { roll: pick, total: pick.total, rolls: [a, b], note: ` (Наследник: ${a.total}/${b.total} → меньший)` };
}

/** Может ли Астартес сейчас вместо этого пути попробовать Замедленную Анимацию. */
function _susAnAvailable(actor) {
  return hasSusAnMembrane(actor) && susAnEligible(actor);
}

async function _confirmSusAnInstead(actor, reason) {
  return foundry.applications.api.DialogV2.confirm({
    window: { title: "Отменить Спасение?" },
    content: `<p>${esc(actor.name)}: ${reason}</p>
      <p>Можно отменить этот путь (ничего не тратится) и вместо него попытаться войти в Замедленную Анимацию (тест W+${SUS_AN_TEST_MOD}).</p>`,
    rejectClose: false
  });
}

/**
 * Чудесное Спасение и Божественная Защита. eternalWarrior: null (обычная
 * стоимость по cfg), "free" (Вечный Воин, путь 1 — 0 цены/0 Порчи, отмечает
 * разовый заряд сессии), "flat" (путь 2 — фиксированное 1 Очко Бесчестия из
 * пула, без кубика, без Порчи). confirmSusAn — внедряемый для тестов вопрос
 * «отменить и уйти в Замедленную Анимацию?».
 */
async function _resolveFateSave(actor, kind, cfg, { eternalWarrior = null, confirmSusAn = _confirmSusAnInstead } = {}) {
  const title = kind === "divine" ? "Божественная Защита" : "Чудесное Спасение";
  // Пустота Парии (rules/null-zones.mjs): «не могут… избегать смерти,
  // сжигая Бесчестие или Очки Судьбы» — у Хаосита это постоянный Inf, мимо
  // пула, поэтому отказ здесь, а не только в spendFromInfamyPool.
  if (inPariahVoid(actor)) {
    ui.notifications?.warn(`${title}: в Пустоте Парии нельзя избежать смерти, сжигая Бесчестие/Судьбу.`);
    return;
  }
  if (actor.getFlag?.(NS, FATE_SAVE_FAILED_FLAG)) {
    ui.notifications?.warn(`${title}: Спасение на эту смерть уже провалено — Боги отвернулись.`);
    return;
  }
  const pool = fatePoolLabel(actor);
  const free = eternalWarrior === "free" || eternalWarrior === "flat";
  // Цена обычного пути у хаосита — характеристика Inf (rules/death-save.mjs);
  // Вечный Воин «flat» платит именно Очком Бесчестия — пулом.
  const src = eternalWarrior === "flat"
    ? { kind: "pool", current: Number(actor.system.fate?.value) || 0, path: "system.fate.value" }
    : saveCostSource(actor);
  const current = src.current;
  const keepLow = !free && rollsTwiceKeepLow(actor);

  let fate = null, rolledLoss;
  if (eternalWarrior === "free") rolledLoss = 0;
  else if (eternalWarrior === "flat") rolledLoss = 1;
  else {
    fate = await _rollMaybeKeepLow(cfg.fateDie, keepLow);
    rolledLoss = fate.total + (cfg.fateFlat || 0);
  }
  // Kiss of Death/Поцелуй Смерти (Слаанеш, wdbc-1rno): «Спасение от смерти,
  // вызванной этой атакой, тратит двойное количество Бесчестия или Очков
  // Судьбы» — Вечного Воина (free/flat) книга не упоминает, фиксированные
  // цены не удваиваются. Метка снимается при ЛЮБОЙ попытке (wdbc-zye1).
  const hadKissOfDeath = !!actor.getFlag?.(NS, KISS_OF_DEATH_FLAG);
  const kissOfDeathDoubled = !free && hadKissOfDeath;
  const loss = kissOfDeathDoubled ? rolledLoss * 2 : rolledLoss;
  // Нулевая цена (Вечный Воин «free») ничего не опускает — провала нет.
  const failed = loss > 0 && fateSaveFails(current, loss);

  // Порча катится сразу — от неё зависит, отменит ли Астартес путь (Cor 100).
  const cor = free || failed ? null : await _rollMaybeKeepLow(cfg.corDie, keepLow);
  const corGain = cor ? cor.total : 0;
  const curCor = Number(actor.system.corruption?.value) || 0;
  const newCor = curCor + corGain;

  const kissNote = kissOfDeathDoubled ? ", ×2 Поцелуй Смерти" : "";
  const lossLabel = fate
    ? `(${cfg.fateFlat ? `${cfg.fateFlat}+` : ""}${fate.total}=${rolledLoss}${fate.note}${kissNote})`
    : `${loss}${kissNote}`;
  const costWord = src.kind === "inf" ? "Inf" : `Пул ${pool}`;
  const allRolls = [...(fate?.rolls ?? []), ...(cor?.rolls ?? [])];

  // Замедленная Анимация (стр. 233): «если это опускает его Inf до 0 или
  // поднимает Cor до 100, выбрать отменить его и вместо этого попытаться
  // войти в Замедленную Анимацию» — ничего не списывается.
  if ((failed || newCor >= 100) && _susAnAvailable(actor)) {
    const reason = failed
      ? `${title} провалится — ${costWord} ${current} − ${lossLabel} опустится до 0.`
      : `${title} поднимет Порчу до ${newCor} (100+).`;
    if (await confirmSusAn(actor, reason)) {
      await _postCard(actor, title, [
        `${reason}`,
        "Отменено — ничего не потрачено. Десантник пытается войти в Замедленную Анимацию."
      ], allRolls);
      await doSusAnimation(actor);
      return;
    }
  }

  // Списание. Inf хаосита — постоянное, в inf.base (как награда Бесчестием,
  // rules/session-rewards.mjs); пул — через общую точку (временный запас
  // Очков гасит цену первым, wdbc-e728).
  const costUpd = {};
  let spentNote = "";
  let newValue;
  if (src.kind === "inf") {
    // База — с полом 0, Продвижение цена не трогает: остаток считается от
    // реально записанного, а не current − loss, иначе карточка врёт.
    const newBase = Math.max(0, src.base - loss);
    if (loss > 0) costUpd[src.path] = newBase;
    newValue = current - (src.base - newBase);
  } else {
    const spend = await spendFromInfamyPool(actor, loss, src.path);
    if (!spend) return;
    costUpd[src.path] = spend.poolValue;
    newValue = spend.poolValue;
    if (spend.tempSpent) spentNote = `, из них ${spend.tempSpent} из временного запаса`;
  }
  const shortNote = src.kind === "inf" && current - newValue < loss
    ? `, списано ${current - newValue} — база Inf исчерпана` : "";
  // Злорадство, Оружие Наследия (wdbc-1rno.35, merciless 3-4, стр. 428) —
  // на сам факт траты (у "free" реальной траты нет).
  if (eternalWarrior !== "free") await triggerLegacyGleeOnFateSave(actor);
  await _markToyOfGodsSession(actor);

  if (failed) {
    // Метка провала — иначе на остатке Inf (Продвижение) повтор на эту же
    // смерть проходил бы; снимает её только разрешение смерти (_deathResolvedFields).
    const upd = { ...costUpd, [`flags.${NS}.${FATE_SAVE_FAILED_FLAG}`]: true };
    if (hadKissOfDeath) upd[`flags.${NS}.-=${KISS_OF_DEATH_FLAG}`] = null;
    await actor.update(upd);
    await _postCard(actor, title, [
      `${costWord}: <b>${current}</b> − ${lossLabel}${spentNote} → 0 и ниже; осталось <b>${newValue}</b>${shortNote}.`,
      `<span class="roll-failure">Провал — Боги отвернулись. Персонаж мёртв по-настоящему.</span>`
    ], allRolls);
    return;
  }

  if (eternalWarrior === "free") await markEternalWarriorUsed(actor);

  const updates = {
    ...costUpd,
    "system.corruption.value": Math.min(100, newCor),
    [`flags.${NS}.deceased`]: false,
    ..._deathResolvedFields(actor)
  };
  const lines = [
    `${costWord}: <b>${current}</b> − ${loss}${kissNote}${spentNote}${fate?.note ?? ""}${shortNote} → <b>${newValue}</b>.`,
    free
      ? `Порча: без изменений (Вечный Воин, ${eternalWarrior === "free" ? "раз за сессию" : "дальнобойная смерть"} — бесплатно в Ярости).`
      : `Порча: +${corGain}${cor?.note ?? ""} → <b>${Math.min(100, newCor)}</b>${newCor > 100 ? " (потолок 100)" : ""}.`
  ];

  const cause = actor.getFlag?.(NS, DEATH_CAUSE_FLAG) || null;
  const { fields: condFields, ended } = _endConditionsFields(actor, conditionsEndedBySave(kind, cause));
  Object.assign(updates, condFields);

  if (kind === "miraculous") {
    const back = rollbackWounds(actor);
    if (back) {
      updates["system.wounds.value"] = back.value;
      updates["system.wounds.critical"] = back.critical;
      lines.push(`Смертельный удар откатан — Раны возвращены к <b>${back.value}</b>${back.critical ? ` (крит. ${back.critical})` : ""}, как до попадания. `
        + "Потерю конечностей и прочие последствия этого удара ГМ снимает руками.");
    } else {
      Object.assign(updates, _healToZero(actor));
      if (cause === "toughness") lines.push("Смерть от падения T до 0 — сколько урона в T вернуть, решает ГМ.");
    }
    if (cause === "suffocating") lines.push("До конца сцены персонаж чудом может дышать в вакууме, под водой или в удушающей хватке.");
  } else {
    Object.assign(updates, _healToZero(actor));
    Object.assign(updates, conditionApplyFields("unconscious", null, actor));
    updates[`flags.${NS}.${DIVINE_PROTECTION_FLAG}`] = true;
  }
  if (ended.length) lines.push(`Прекращено: ${ended.map(k => CONDITION_LABELS[k] || k).join(", ")}.`);

  await actor.update(updates);

  lines.push(`<span class="roll-success">Успех — персонаж жив. Кардиомонитор перезапущен.</span>`);
  if (kind === "divine") {
    lines.push("Без сознания до конца сцены/боя. До ⏻ Конца сессии его нельзя ранить или убить, в бою — только полудвижения.");
    if (src.kind === "inf" && newValue >= DIVINE_TELEPORT_MIN_INF) {
      lines.push(`Inf ${newValue} ≥ ${DIVINE_TELEPORT_MIN_INF}: если есть безопасная база (крепость, корабль, логово) — можно чудом перенестись туда.`);
    }
    lines.push(`<button type="button" class="wh-divine-protection-lift" data-actor-uuid="${esc(actor.uuid ?? "")}">`
      + "Снять Защиту досрочно (ГМ: остался во власти врагов без союзников)</button>");
  }
  await _postCard(actor, title, lines, allRolls);
}

/** Раны до 0, если они ниже (снимаются и Критические). */
function _healToZero(actor) {
  const w = Number(actor.system.wounds?.value) || 0;
  const crit = Number(actor.system.wounds?.critical) || 0;
  return computeWoundHealing(actor.system, Math.max(0, -w) + crit);
}

/** Игрушка Богов: смерть этой сессии уже была — обязанность снята до ⏻ Конца сессии. */
async function _markToyOfGodsSession(actor) {
  if (toyOfGodsApplies(actor) && isThrottleReady(actor, TOY_OF_GODS_FLAG, "session")) {
    await markThrottleUsed(actor, TOY_OF_GODS_FLAG, "session");
  }
}

function _miraculousCfg(actor) {
  // Руническая Вязь «Прах Феникса» (wdbc-unku): тратит только 1d5 Порчи
  // вместо обычного 1d10 — тот же MIRACULOUS_SAVE, только corDie сужен.
  return hasRuleFlag(actor, "runicWeave.ashesOfThePhoenix")
    ? { ...MIRACULOUS_SAVE, corDie: "1d5" }
    : MIRACULOUS_SAVE;
}

export async function doMiraculousSave(actor, opts = {}) {
  await _resolveFateSave(actor, "miraculous", _miraculousCfg(actor), opts);
}

export async function doDivineProtection(actor, opts = {}) {
  await _resolveFateSave(actor, "divine", DIVINE_PROTECTION, opts);
}

/** ГМ снимает Божественную Защиту досрочно — книжное «во власти врагов без союзников». */
export async function liftDivineProtection(actor) {
  if (!actor?.getFlag?.(NS, DIVINE_PROTECTION_FLAG)) return false;
  await actor.unsetFlag(NS, DIVINE_PROTECTION_FLAG);
  await _postCard(actor, "Божественная Защита снята", [
    "Персонаж остался во власти врагов без единого боеспособного союзника — Боги больше не хранят его."
  ]);
  return true;
}

/**
 * Божественная Защита: «теряет сознание до конца сцены или боя» — будит
 * защищённых (флаг divineProtection) по «🎬 Новая сцена» и по концу боя.
 * Неуязвимость и полудвижения при этом остаются до ⏻ Конца сессии.
 * @param {Iterable<Actor>} actors
 */
export async function wakeDivineProtected(actors) {
  for (const actor of actors ?? []) {
    if (!actor?.getFlag?.(NS, DIVINE_PROTECTION_FLAG) || !actor.system?.conditions?.unconscious) continue;
    await actor.update(conditionRemoveFields("unconscious"));
  }
}

/**
 * Замедленная Анимация — не тратит Судьбу/Бесчестье, отдельный тест W+30
 * (Сус-ан Мембрана). Одна попытка на смерть; Сон Героя перебрасывает провал.
 */
export async function doSusAnimation(actor) {
  const w = Number(actor.system.characteristics?.wp?.total) || 0;
  // Общий сбор модификаторов (wdbc-asuc): Усталость, Черты, Состояния.
  const ruleMods = collectTestMods(actor, { kind: "skill", char: "wp" });
  const threshold = w + SUS_AN_TEST_MOD + ruleMods.total;
  const rolls = [await new Roll("1d100").evaluate()];
  let success = rolls[0].total <= threshold;
  const heroSleep = !success && hasHeroSleep(actor);
  if (heroSleep) {
    rolls.push(await new Roll("1d100").evaluate());
    success = rolls[1].total <= threshold;
  }

  const lines = [`W <b>${w}</b>+${SUS_AN_TEST_MOD}${ruleMods.parts.map(p => ` ${p}`).join("")} → порог <b>${threshold}</b>, бросок <b>${rolls[0].total}</b>`
    + `${heroSleep ? `, Сон Героя — переброс <b>${rolls[1].total}</b>` : ""}.`];
  if (success) {
    // Беспомощность отдельно не ставим (wdbc-r5o7.7): «Без сознания» сама
    // производит Беспомощность (rules/character.mjs, derived data).
    await actor.update({
      [`flags.${NS}.deceased`]: false,
      ...conditionApplyFields("unconscious", null, actor),
      ..._deathResolvedFields(actor)
    });
    lines.push(`<span class="roll-success">Успех — десантник входит в Замедленную Анимацию вместо смерти.</span>`);
    lines.push("Без сознания и Беспомощен. Диагностика −60 (For.Lore (Astartes Implants) снимает штраф). "
      + "Вывод — операция в апотекарионе, Medicae−40, медик с For.Lore (Astartes Implants)+0, 12−Успехи ч. (мин. 3).");
  } else {
    // «свою попытку» — одна на смерть; Спасение/Защита после неё остаются.
    await actor.setFlag(NS, SUS_AN_ATTEMPT_FLAG, true);
    lines.push(`<span class="roll-failure">Провал — тело не выдерживает. Остаются Чудесное Спасение и Божественная Защита.</span>`);
  }
  await _postCard(actor, "Замедленная Анимация", lines, rolls);
}

/**
 * Игрушка Богов: тест Inf+30 — союзники способны «поднять из мёртвых», и
 * Бог позволяет фигуре поставить жизнь на кон. Успех снимает обязанность
 * до конца сессии, провал — повторить на этой смерти нельзя.
 */
export async function doToyOfGodsTest(actor) {
  const inf = Number(actor.system.characteristics?.inf?.total) || 0;
  const ruleMods = collectTestMods(actor, { kind: "skill", char: "inf" });
  const threshold = inf + TOY_OF_GODS_TEST_MOD + ruleMods.total;
  const roll = await new Roll("1d100").evaluate();
  const success = roll.total <= threshold;
  if (success) await markThrottleUsed(actor, TOY_OF_GODS_FLAG, "session");
  else await actor.setFlag(NS, TOY_TEST_FAILED_FLAG, true);
  await _postCard(actor, "Игрушка Богов", [
    `Inf <b>${inf}</b>+${TOY_OF_GODS_TEST_MOD}${ruleMods.parts.map(p => ` ${p}`).join("")} → порог <b>${threshold}</b>, бросок <b>${roll.total}</b>.`,
    success
      ? `<span class="roll-success">Успех — уверенность в соратниках передаётся Богу, и тот позволяет своей фигуре поставить жизнь на кон. Спасаться не обязан.</span>`
      : `<span class="roll-failure">Провал — Бог не отпустит свою игрушку: обязан воспользоваться Спасением/Защитой.</span>`
  ], [roll]);
  return success;
}

/**
 * Разделение/Sundering (Дар Тзинча, wdbc-1rno): «на смерти — 1 Очко
 * Бесчестия → тело исчезает, появляются 2 копии, действующие в его
 * Инициативу». В отличие от Чудесного Спасения/Божественной Защиты НЕ
 * снимает флаг deceased — тело чемпиона реально «исчезло», он не то чтобы
 * жив; deceased снимается только в конце сцены (module/combat/sundering.mjs::
 * revertSunderingOnSceneEnd), когда чемпион фактически возвращается на поле.
 */
export async function doSundering(actor) {
  await changeActorInfamy(actor, -1);
  await defaultSpawnSunderingFn(actor.uuid);
  await _postCard(actor, "Разделение", [
    "1 Очко Бесчестия → тело исчезает, на его месте появляются 2 копии чемпиона " +
      "(S/T−20, 9 Ран, Размер−1, Демонический(+1)/Материал Кошмаров/Варп-нестабильность), " +
      "действующие в его Инициативу, с его снаряжением и поддерживаемыми психосилами.",
    "В конце сцены обе копии исчезают, чемпион возникает с 0 Ран на месте одной из них (выбор игрока).",
    "Если обе копии падут раньше конца сцены — это смерть персонажа как обычно, Спасение открыто снова."
  ]);
}

export async function doResurrect(actor) {
  // Одним update и снятие меток этой смерти, включая Поцелуй Смерти:
  // воскрешённый не платит вдвое при следующей, уже не связанной (wdbc-zye1).
  await actor.update({
    [`flags.${NS}.deceased`]: false,
    ..._deathResolvedFields(actor)
  });
  await _postCard(actor, "Воскрешение", [
    "Кардиомонитор перезапущен вручную — персонаж воскрешён.",
    "Формулы в книге для этого нет (стр. 233 — чистый нарратив): что, как и какой ценой его вернуло, решают ГМ и игроки."
  ]);
}

/** Блок «Игрушка Богов» диалога — пусто, если правило не действует на эту смерть. */
function _toyOfGodsHtml(actor, miracCfg) {
  if (!toyOfGodsApplies(actor)) return "";
  if (!isThrottleReady(actor, TOY_OF_GODS_FLAG, "session")) return "";
  const forced = toyOfGodsForcedOptions(actor, { miraculousCorDie: miracCfg.corDie });
  const style = "font-size:0.82em;color:#e0a83a;";
  if (!forced.length) {
    return `<div class="atk-range-info" style="${style}">Игрушка Богов: оба пути могут поднять Cor до 100 — спасаться не обязан.</div>`;
  }
  const names = forced.map(k => k === "miraculous" ? "Чудесное Спасение" : "Божественная Защита").join(" или ");
  const testFailed = !!actor.getFlag?.(NS, TOY_TEST_FAILED_FLAG);
  return `<div class="atk-range-info" style="${style}">
      ⚠ Игрушка Богов: первая смерть за сессию — Покровитель обязывает использовать ${names}
      (путь, способный поднять Cor до 100, не обязателен). Не действует, если смерть ненастоящая (изгнание в Варп, анабиоз).
      <button type="button" class="wh-death-action" data-action="toy" ${testFailed ? "disabled" : ""}
        style="width:100%;text-align:left;margin:3px 0;${testFailed ? "opacity:0.45;" : ""}">
        <b>Тест Inf+${TOY_OF_GODS_TEST_MOD}</b> — союзники способны поднять из мёртвых${testFailed ? " (уже провален)" : ""}
      </button>
    </div>`;
}

export function showDeathSaveDialog(actor) {
  if (!actor?.getFlag?.(NS, "deceased")) {
    ui.notifications.warn(`${actor.name}: смерть не констатирована.`);
    return;
  }
  // Цена Спасения/Защиты — Inf у всех (rules/death-save.mjs::saveCostSource).
  const cost = "Inf";
  const canSusAn  = _susAnAvailable(actor);
  const miracCfg = _miraculousCfg(actor);
  const miracCorNote = miracCfg.corDie === "1d5" ? "1d5 Порчи (Прах Феникса)" : "1d10 Порчи";
  const heir = rollsTwiceKeepLow(actor) ? " Наследник: кубы дважды, берётся меньший." : "";
  const toyNote = _toyOfGodsHtml(actor, miracCfg);

  // Eternal Warrior/Вечный Воин (wdbc-sk8s): в Ярости следующий Miraculous/Divine
  // бесплатен (раз за сессию), либо всегда за фиксированную 1 Очко Бесчестия при
  // дальнобойной смерти вне дистанции Натиска — «дистанция Натиска до убийцы»
  // движком не отслеживается вовсе, флажок ниже — самоподтверждение игрока
  // (тот же честный компромисс, что у Deadly Effectiveness).
  const ewEligible = eternalWarriorEligible(actor);
  const ewFreeAvail = ewEligible && eternalWarriorFreeSaveAvailable(actor);
  const ewNote = ewEligible
    ? `<div class="atk-range-info" style="font-size:0.82em;color:#9a7fe0;">
        ☠ Вечный Воин (в Ярости): следующее Спасение/Защита ниже бесплатно —
        <label style="display:block;margin-top:2px;"><input type="radio" name="ew-mode" value="free" ${ewFreeAvail ? "checked" : "disabled"}/>
          раз за сессию${ewFreeAvail ? "" : " (уже потрачено)"}</label>
        <label style="display:block;"><input type="radio" name="ew-mode" value="flat" ${ewFreeAvail ? "" : "checked"}/>
          дальнобойная смерть вне дистанции Натиска — за 1 Очко Бесчестия (не тратит заряд сессии)</label>
        <label style="display:block;"><input type="radio" name="ew-mode" value="" />обычная стоимость (не использовать Вечного Воина)</label>
      </div>`
    : "";

  // Sundering/Разделение (Дар Тзинча, wdbc-1rno) — только у носителя Дара,
  // не показываем всем отключённой кнопкой (в отличие от Замедленной
  // Анимации выше — та книжно доступна любому Астартес, просто не всегда
  // условия выполнены; Разделение без самого Дара не существует вообще).
  const hasSundering = hasRuleFlag(actor, SUNDERING_CAPABILITY);

  const opt = (key, label, note, enabled = true) => `
    <button type="button" class="wh-death-action" data-action="${key}" ${enabled ? "" : "disabled"}
      style="width:100%;text-align:left;margin:3px 0;${enabled ? "" : "opacity:0.45;"}">
      <b>${label}</b><br/><span style="font-size:0.8em;">${note}</span>
    </button>`;

  const susLimit = susAnCriticalLimit(actor);
  const susAttempted = !!actor.getFlag?.(NS, SUS_AN_ATTEMPT_FLAG);
  const saveFailed = !!actor.getFlag?.(NS, FATE_SAVE_FAILED_FLAG);
  const failedNote = "Уже провалено на эту смерть — Боги отвернулись.";
  const content = `
    <div class="wh-wizard-form" style="padding:6px;">
      <div class="atk-dlg-header"><span class="atk-weapon-name">${rollIcon("skull","#ff6b6b")}Спасение от смерти</span></div>
      ${toyNote}
      ${ewNote}
      ${opt("miraculous", "Чудесное Спасение", saveFailed ? failedNote : `−(1d10+10) ${cost} и ${miracCorNote} — провал, если ${cost} опустится до 0. `
        + `Смертельный удар откатывается, эффект-причина прекращается.${heir}`, !saveFailed)}
      ${opt("divine", "Божественная Защита", saveFailed ? failedNote : `−(1d5+5) ${cost} и 1d5 Порчи — провал, если ${cost} опустится до 0. `
        + `Раны до 0, без сознания до конца сцены/боя; до конца сессии неуязвим, в бою — только полудвижения.${heir}`, !saveFailed)}
      ${opt("susan", "Замедленная Анимация", canSusAn
        ? `Тест W+30 (не тратит ${cost}/Порчу). Одна попытка на смерть${hasHeroSleep(actor) ? ", Сон Героя — переброс провала" : ""}.`
        : susAttempted
          ? "Попытка на эту смерть уже потрачена."
          : `Только Астартес с установленной Сус-ан Мембраной и Ранами не ниже −${susLimit}.`, canSusAn)}
      ${hasSundering ? opt("sundering", "Разделение (Тзинч)",
        "1 Очко Бесчестия — тело исчезает, появляются 2 копии (S/T−20, 9 Ран, Размер−1), действующие в вашу Инициативу. "
        + "В конце сцены обе исчезают, вы возвращаетесь с 0 Ран на месте одной из них.") : ""}
    </div>`;

  return foundry.applications.api.DialogV2.wait({
    window: { title: "Спасение от смерти" },
    classes: ["wh-attack-dialog", "warhammer-dbc"],
    position: { width: 420 },
    content,
    rejectClose: false,
    buttons: [{ action: "close", label: "Закрыть" }],
    render: (event, dialog) => {
      const form = dialog.element.querySelector("form") || dialog.element;
      form.querySelectorAll(".wh-death-action:not([disabled])").forEach(b => b.addEventListener("click", async () => {
        const key = b.dataset.action;
        const ewChecked = form.querySelector('input[name="ew-mode"]:checked')?.value || null;
        const eternalWarrior = ewChecked || null;
        dialog.close();
        if (key === "miraculous") await doMiraculousSave(actor, { eternalWarrior });
        else if (key === "divine") await doDivineProtection(actor, { eternalWarrior });
        else if (key === "susan") await doSusAnimation(actor);
        else if (key === "sundering") await doSundering(actor);
        else if (key === "toy") {
          // Смерть тест не разрешает — диалог снова: при успехе без обязанности, при провале с ней.
          await doToyOfGodsTest(actor);
          showDeathSaveDialog(actor);
        }
      }));
    }
  });
}
