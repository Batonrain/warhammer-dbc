// module/combat/condition-ticks.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Тик Состояний по Ходам (wdbc-j3yf) — поля длительности (sheet-helpers.mjs::
//  CONDITIONS_DEF) уже существуют и пишутся с разных мест листа (weapon-
//  properties.mjs, drugs.mjs, healing.mjs), но ни один хук их не читал:
//  счётчики уменьшал и урон Кровотечения/Горения наносил игрок сам, руками.
//
//  Тайминг — из книги (core.json, «Раны и Урон», разделы «Кровотечение»/
//  «Огонь»): Кровотечение/Горение бьют «в конце своего Хода» (processTurnEnd,
//  зовётся из hooks.mjs для АКТОРА, чей Ход только что закончился), счётчики
//  длительности (Оглушение/Ослепление/Удушье) тикают «в начале своего Хода»
//  (processTurnStart, для актора, чей Ход начинается).
//
//  Паника от Горения (стр. «Раны и Урон», «Огонь») — тест W+0 в начале Хода
//  Горящего персонажа, тест Морали; провал пропускает весь Ход (обнуление ОД,
//  тот же приём, что «Подавленный в укрытии» в action-economy.mjs). Раньше
//  здесь было сознательное решение это НЕ реализовывать (игровое событие, не
//  число для тика) — отменено по прямому запросу пользователя, wdbc-zepq.
// ════════════════════════════════════════════════════════════════════════════

import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";
import { applyWoundLoss, woundDeathThreshold } from "../rules/wounds.mjs";
import { addFatigue, conditionAdjustFields, conditionRemoveFields } from "../sheets/tabs/conditions.mjs";
import { rollMoraleTest } from "../rules/morale-test.mjs";
import { postShockRecoveryPrompt } from "./fear.mjs";
import { applyLordOfExoditesFailPenalty } from "./lord-of-exodites.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import { resolveArmorProps } from "./armor-properties.mjs";
// Морозное Сердце (wdbc-5knb): щит с записью Конструктора
// kind:"shieldVsCondition" можно бросить против ТИКА Горения, гася его
// целиком при успехе — единственная причина, по которой этот модуль вообще
// знает о combat/damage.mjs (в остальном тик состояний намеренно идёт мимо
// конвейера урона, см. шапку файла).
import { rollShieldAgainstConditionTick, burningGraceSourceItem } from "./damage.mjs";
// Состояния «N раундов», тикающие в начале Хода их обладателя — ключ
// system.conditions.<key> (bool) + system.conditions.<field> (число). Из
// реестра constants/conditions.mjs (wdbc-w88h): любое Состояние со счётчиком
// "rounds" тикает здесь само, заводить его в этом списке отдельно не нужно.
import { ROUND_TICK_CONDITIONS as ROUND_CONDITIONS, CONDITIONS_DEF } from "../constants/conditions.mjs";
import { BLESSED_FITS_PENDING_FLAG, blessedFitsRefundDue } from "../rules/blessed-fits.mjs";
import { changeActorInfamy } from "../apps/infamy-points.mjs";
// Parasite/Паразит (Трейт — общий, wdbc-ux8a): parasiticContact — тот же
// генерик-цикл, что Оглушение/Ослепление, спец-хук на 0 — тот же приём, что
// возврат Очка Бесчестия у Blessed Fits ниже (апп-слой можно звать отсюда —
// тот прецедент уже есть, changeActorInfamy тоже apps/).
import { completeInfection } from "../apps/parasite-trait.mjs";
// Срок Состояния штатной Duration эффекта (wdbc-uqco). Состояние, у которого
// срок задан, сюда не попадает вовсе: его считает Foundry, а истечение
// подметается ниже. Свой декремент остаётся ровно для тех, кому срок
// проставили старым способом — числом в поле, без эффекта.
import { sweepConditionDurations, hasConditionDuration } from "./condition-effects.mjs";
import { postTestCard, rollStatLine } from "../helpers/test-card.mjs";

/**
 * Строка «срок вышел» для карточки — общая с подметанием по мировому времени
 * (hooks.mjs), чтобы истечение вне боя не проходило молча: тихо исчезнувшее
 * Состояние ГМ считает багом, а не сроком.
 */
export function conditionExpiryLine(key) {
  return `<div class="roll-threshold">${CONDITIONS_DEF[key]?.label || key}: срок вышел — снято</div>`;
}

/** Карточка Состояний в чат — экспортирована ради того же подметания по времени. */
export async function postConditionCard(actor, lines) {
  if (!lines.length) return;
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("warn", "#8fd0ff")}Состояния — ${esc(actor.name)}</div>
      ${lines.join("")}
    </div>`
  }, game.settings.get("core", "rollMode")));
}

/**
 * Броня Огненного Дракона (wdbc-q0q8, ARMOR_PROPERTIES.fireproof) — точечное
 * исключение из «Горение игнорирует броню целиком»: собственное AP тела
 * ИМЕННО ЭТОГО предмета (не суммарное AP актора со всех надетых сразу —
 * книга говорит «их AP», не «броня персонажа»), удвоенное. Несколько таких
 * предметов разом — маловероятно, берём максимум, не сумму.
 */
function fireproofBurningApBonus(actor) {
  let best = 0;
  for (const item of actor?.items ?? []) {
    if (item.type !== "armor" || !item.system?.equipped) continue;
    const fireproof = resolveArmorProps(item).some(p => p.def.auto?.apVsBurningBody);
    if (fireproof) best = Math.max(best, (Number(item.system.body) || 0) * 2);
  }
  return best;
}

// Горение (wdbc-3pv5, Cooler/Охладитель + Морозное Сердце, «даёт улучшение
// Cooler, пока активен»): книжный порог «пламя, которым объят персонаж,
// наносит не больше 1d10 урона» — 10, не повторный бросок 1d10 (это разбор
// РЕЙТИНГА свойства/удара, уже посчитанного в момент поджигания, а не гонка
// с новым кубом).
const BURNING_GRACE_DAMAGE_THRESHOLD = 10;

/**
 * Даёт (если ещё не выдано и порог пройден) или продлевает чтение окна
 * «игнорировать все негативные эффекты Горения 1d5 Ходов» — Cooler/Морозное
 * Сердце (kind:"burningGrace", combat/damage.mjs::hasBurningGraceCapability).
 * ЖИВОЙ ЗАПРОС и АВТОМАТИКА разом: без кнопки и без риска отказаться зря —
 * у способности нет цены и нет исхода «хуже, чем не пробовать» (в отличие от
 * броска щита rollShieldAgainstConditionTick выше, где неудача возможна),
 * поэтому спрашивать игрока нечего, включаем сами (wdbc-3pv5, решение по
 * итогам обсуждения — реальный wdbc-5knb тоже автоматика, не кнопка).
 *
 * Идемпотентна в пределах уже открытого окна: если burningGraceRounds уже
 * >0 (выдано на этом же или предыдущем Ходу), просто возвращает текущий
 * остаток без нового броска — вызывается и из processConditionTurnStart
 * (Паника), и из processConditionTurnEnd (тик), оба должны видеть одно и то
 * же окно одного и того же пожара.
 *
 * Выдача ОДНОРАЗОВА на одно загорание: burningSourceDamage обнуляется в
 * момент выдачи (roll.total записан в burningGraceRounds) — иначе счётчик
 * ходов кончался бы, а на следующем же Ходу тут же выдавался заново на то
 * же самое (ещё не остывшее) значение urона поджигания. Новое загорание
 * (свежий Flame-удар/крит, пока горит) перезапишет burningSourceDamage
 * заново — второе окно за бой возможно, просто не за счёт СТАРОГО числа.
 *
 * sourceName (wdbc-lm83) — имя предмета, реально дающего способность СЕЙЧАS
 * (Cooler/Охладитель ИЛИ Frozen Heart/Морозное Сердце, кто на акторе есть),
 * а не жёстко «Cooler»: заметка в чате раньше звала окно Cooler даже когда
 * сработал только Frozen Heart без Cooler на акторе. Ищется заново на каждом
 * вызове, в том числе когда окно уже открыто (current > 0) — предмет мог
 * смениться (снят один, надет другой) с прошлого Хода; пустая строка, если
 * сейчас на акторе ни одного нет вовсе (окно всё равно продолжает тикать —
 * решение «убрать предмет не гасит уже открытое окно» не пересматривается
 * здесь, только подпись).
 */
export async function ensureBurningGrace(actor) {
  const conds = actor?.system?.conditions;
  if (!conds) return { rounds: 0, roll: null, sourceName: "" };
  const sourceItem = burningGraceSourceItem(actor);
  const sourceName = sourceItem?.name || "";
  const current = Number(conds.burningGraceRounds) || 0;
  if (current > 0) return { rounds: current, roll: null, sourceName };
  if (!sourceItem) return { rounds: 0, roll: null, sourceName };
  const srcDmg = Number(conds.burningSourceDamage) || 0;
  if (srcDmg <= 0 || srcDmg > BURNING_GRACE_DAMAGE_THRESHOLD) return { rounds: 0, roll: null, sourceName };
  const roll = await new Roll("1d5").evaluate();
  await actor.update({
    "system.conditions.burningGraceRounds": roll.total,
    "system.conditions.burningSourceDamage": 0
  });
  return { rounds: roll.total, roll, sourceName };
}

/**
 * Тест Паники от Горения (W+0, тест Морали) — в начале Хода Горящего
 * персонажа. Провал: персонаж проводит Ход, паникуя и воя — обнуляем ОД
 * (тот же принцип, что «Подавленный в укрытии» — action-economy.mjs), Реакции
 * не трогаем (Уклонение/Парирование — не действия ЕГО хода).
 */
export async function rollBurningPanicTest(actor) {
  const wp = actor.system.characteristics.wp?.total ?? 0;
  const { eff, parts, roll, rv, rerollNote, success, dof, usedReroll } = await rollMoraleTest(actor, wp);
  if (!success) await actor.update({ "system.actionPoints.value": 0 });
  await applyLordOfExoditesFailPenalty(actor, { dof, usedReroll });

  await postTestCard(actor, {
    icon: rollIcon("fire","#ff8a3a"), title: `Паника от Горения — ${esc(actor.name)}`,
    threshold: rollStatLine({ label: "WP", base: wp, parts, threshold: eff, rv }),
    rerollNote,
    outcome: success
      ? `<span class="roll-success">Успех — держит себя в руках</span>`
      : `<span class="roll-failure">Провал — Ход потерян в панике (ОД обнулены)</span>`
  }, { rolls: [roll] });
  return { success, rv, eff };
}

/**
 * Начало Хода актора: Паника от Горения (если Горит), декремент счётчиков
 * длительности, снятие состояния на нуле. Зовётся из hooks.mjs::updateCombat
 * рядом с resetActionEconomy (после него — панике нужно обнулить уже
 * восстановленные ОД, а не значение до сброса).
 */
export async function processConditionTurnStart(actor) {
  const conds = actor?.system?.conditions;
  if (!conds) return;
  const updates = {};
  const lines = [];
  if (conds.burning) {
    // Cooler/Морозное Сердце (wdbc-3pv5): окно «игнорировать ВСЕ негативные
    // эффекты Горения» гасит и эту Панику, не только тик урона ниже —
    // книга не разделяет «эффекты» на подвиды.
    const { rounds, roll, sourceName } = await ensureBurningGrace(actor);
    if (rounds > 0) {
      // wdbc-lm83: имя сработавшего предмета, не жёстко «Cooler» — Frozen
      // Heart без Cooler на акторе даёт то же окно.
      lines.push(`<div class="roll-threshold">${rollIcon("fire","#8fd0ff")}${esc(sourceName || "Охлаждение")}: Паника от Горения пропущена (осталось Ходов: <b>${rounds}</b>${roll ? `, выдано 1d5 = <b>${roll.total}</b>` : ""})</div>`);
    } else {
      await rollBurningPanicTest(actor);
    }
  }
  // Выход из Шока (стр. 53) — по кнопке, не автоматически (тот же приём, что
  // напоминание Подавления в конце Хода — suppression.mjs).
  if (conds.shocked) await postShockRecoveryPrompt(actor);

  // Сроки, заданные штатной Duration, истекают сами — здесь только подмести
  // истёкшие и освежить видимый остаток. Гашение самого Состояния делает мост
  // «лист ↔ токен» (см. condition-effects.mjs), поэтому строк «снято» ниже мы
  // не дублируем — только называем, что кончилось.
  const swept = await sweepConditionDurations(actor, { round: game.combat?.round, turn: game.combat?.turn });
  for (const key of swept.expired) lines.push(conditionExpiryLine(key));

  for (const { key, field, label } of ROUND_CONDITIONS) {
    // Удушье (стр. 30-31, wdbc-r5o7.6) — особый случай, не общий приём этого
    // цикла: у Оглушения/Ослепления «0 = снято» верно (эффект кончился), а у
    // Удушья 0 значит ровно противоположное — «запас задержки дыхания
    // кончился, дальше начинаются тесты», сам тег «Задыхается» на нуле
    // сниматься не должен (см. отдельный блок ниже, тот же приём, что и у
    // Горения в processConditionTurnEnd — своя ветка вместо общего цикла).
    if (key === "suffocating") continue;
    if (!conds[key]) continue;
    // Срок ведёт Duration — свой декремент этому Состоянию не нужен и был бы
    // двойным: остаток уже пересчитан подметанием выше.
    if (hasConditionDuration(actor, key)) continue;
    const cur = Number(conds[field]) || 0;
    if (cur <= 0) continue;
    const next = cur - 1;
    Object.assign(updates, conditionAdjustFields(actor, key, -1));
    lines.push(next <= 0
      ? `<div class="roll-threshold">${label}: <b>${cur}</b> → снято</div>`
      : `<div class="roll-threshold">${label}: <b>${cur}</b> → <b>${next}</b></div>`);

    // Blessed Fits/Благословенные Припадки (Общие Мутации, wdbc-1rno):
    // Оглушение от переброшенного провала (hooks.mjs::btnReroll) естественно
    // дошло до 0 — «провёл полный Раунд в Оглушении», возвращаем списанное
    // Очко Бесчестия. Снятое ДОСРОЧНО каким-то другим путём сюда не попадёт
    // вовсе (условие этого декремента не наступает раньше срока) — метка
    // просто останется висеть без последствий, что и есть книжное «если».
    if (key === "stunned" && blessedFitsRefundDue(actor.getFlag("warhammer-dbc", BLESSED_FITS_PENDING_FLAG), next)) {
      await changeActorInfamy(actor, 1);
      updates[`flags.warhammer-dbc.-=${BLESSED_FITS_PENDING_FLAG}`] = null;
      lines.push(`<div class="roll-threshold">🥴 Благословенные Припадки: полный Раунд в Оглушении — Очко Бесчестия вернулось.</div>`);
    }

    // Parasite/Паразит (Трейт, wdbc-ux8a): контакт дотикал до 0 — заражение
    // завершено, completeInfection сама пишет свои update/флаги/карточку
    // (маршрутизация Опарыш-Паразит vs общий фьюжн). Накопленный здесь
    // updates.parasiticContact=false всё равно применится следом — не мешает.
    if (key === "parasiticContact" && next <= 0) await completeInfection(actor);
  }

  // Удушье: пока есть запас (suffocatingRounds > 0) — просто декремент, без
  // теста, тегом не рискуя (генерик выше это делал бы для всех остальных, но
  // тут флаг на нуле остаться ДОЛЖЕН, поэтому не переиспользуем
  // conditionAdjustFields здесь — тот сам гасит флаг при next<=0).
  // Запас кончился (было уже 0 или обнулился сейчас) — тест T+0 каждый Ход,
  // провал даёт +1 Усталости (книга: «тест T+0 каждую минуту/Ход или +1
  // Усталости»). Потеря сознания/смерть по накоплению Раундов без вздоха —
  // ЗАВИСИТ от механики Без Сознания (wdbc-r5o7.7, следующий тикет этого же
  // эпика, ещё не сделан) — сознательно не реализовано здесь, тег остаётся
  // активным до ручного снятия (персонаж вздохнул — крестик на теге).
  if (conds.suffocating) {
    const cur = Number(conds.suffocatingRounds) || 0;
    if (cur > 0) {
      const next = cur - 1;
      await actor.update({ "system.conditions.suffocatingRounds": next });
      lines.push(`<div class="roll-threshold">${rollIcon("run","#8fb0c4")}Удушье: запас дыхания <b>${cur}</b> → <b>${next}</b>${next <= 0 ? " — запас кончился, дальше тесты T+0" : ""}</div>`);
    } else {
      const tTotal = Number(actor.system?.characteristics?.t?.total) || 0;
      const test = await new Roll("1d100").evaluate();
      const failed = test.total > tTotal;
      if (failed) await addFatigue(actor, 1);
      lines.push(`<div class="roll-threshold">${rollIcon("run","#8fb0c4")}Удушье: тест T+0 (<b>${tTotal}</b>): <b>${test.total}</b> ${failed ? `<span class="roll-failure">провал → 😓 Усталость +1</span>` : `<span class="roll-success">успех</span>`}</div>`);
    }
  }

  if (!Object.keys(updates).length && !lines.length) return;
  if (Object.keys(updates).length) await actor.update(updates);
  await postConditionCard(actor, lines);
}

/**
 * Конец Хода актора: Кровотечение (1d10 − Обескровливание: 1-5 → +1
 * Обескровливания, ≤0 → смерть независимо от Ран — стр. «Раны и Урон»,
 * «Кровотечение») и Горение (1d10 E(Fl), игнорирует AP брони, T.b всё же
 * поглощает — «получает урон, игнорирующего броню»; полностью поглощённый
 * T.b урон даёт тест T+0 вместо Усталости). Смерть — только строка в
 * карточке (как «Душа разорвана» у Выжигания Души, hooks.mjs) — в системе
 * нет отдельного флага «мёртв», решение фиксирует ГМ.
 * Тушение/остановка (существующие кнопки) не трогаются.
 */
export async function processConditionTurnEnd(actor) {
  const conds = actor?.system?.conditions;
  if (!conds) return;
  const lines = [];

  // Саркофаг Дредноута (стр. 57): иммунитет к Кровотечению — тело пилота
  // физически неспособно истечь кровью, поэтому сама проверка (и риск
  // случайной смерти на плохом броске) не имеет смысла, а не просто смягчена.
  const immuneBleeding = hasRuleFlag(actor, "sarcophagus.immuneBleedingFatigue");
  if (conds.bleeding && immuneBleeding) {
    lines.push(`<div class="roll-threshold">${rollIcon("blood", "#ff6b6b")}Кровотечение: иммунитет саркофага — урон не применяется</div>`);
  } else if (conds.bleeding) {
    const roll = await new Roll("1d10").evaluate();
    const level = Number(conds.haemorrhagingLevel) || 0;
    const eff = roll.total - level;
    if (eff <= 0) {
      lines.push(`<div class="roll-threshold">${rollIcon("blood", "#ff6b6b")}Кровотечение: 1d10 <b>${roll.total}</b> − Обескровливание ${level} = <b>${eff}</b> → <span class="roll-failure"><b>СМЕРТЬ</b> (независимо от количества Ран)</span></div>`);
    } else if (eff <= 5) {
      const newLevel = level + 1;
      await actor.update(conditionAdjustFields(actor, "haemorrhaging", 1));
      lines.push(`<div class="roll-threshold">${rollIcon("blood", "#ff6b6b")}Кровотечение: 1d10 <b>${roll.total}</b> − ${level} = <b>${eff}</b> → +1 Обескровливание (<b>${newLevel}</b>)</div>`);
    } else {
      lines.push(`<div class="roll-threshold">${rollIcon("blood", "#ff6b6b")}Кровотечение: 1d10 <b>${roll.total}</b> − ${level} = <b>${eff}</b> → обошлось</div>`);
    }
  }

  // Саркофаг Дредноута (стр. 57): электрошок в конце Хода снимает Оглушение
  // целиком (не декремент stunnedRounds, как в processConditionTurnStart) —
  // кроме Галлюцинаций: если Оглушение вызвано ими (conds.hallucinogenic),
  // электрошок по мозгу их не лечит.
  if (conds.stunned && !conds.hallucinogenic && hasRuleFlag(actor, "sarcophagus.autoWakeFromStun")) {
    await actor.update(conditionRemoveFields("stunned"));
    lines.push(`<div class="roll-threshold">${rollIcon("bolt", "#8fd0ff")}Электрошок саркофага снял Оглушение</div>`);
  }

  // Морозное Сердце (wdbc-5knb): щит с kind:"shieldVsCondition" на "burning"
  // можно бросить ПРОТИВ этого тика ДО того, как считать урон, — при успехе
  // Горение снимается целиком (rollShieldAgainstConditionTick сам обновляет
  // actor и постит свою карточку), и обычный тик 1d10 ниже не считается
  // вовсе. damageSubtype:"flame" даёт сработать override рейтинга
  // (kind:"shieldSubtype") того же щита — 1-75 против E(Fl), как и при
  // обычном попадании.
  const burningExtinguishedByShield = conds.burning
    && await rollShieldAgainstConditionTick(actor, "burning", { damageSubtype: "flame" });

  // Cooler/Морозное Сердце (wdbc-3pv5): окно из processConditionTurnStart
  // (или выданное только что, если загорелся уже ПОСЛЕ своего начала Хода —
  // ensureBurningGrace идемпотентна) гасит и сам тик. Расходуем ровно один
  // Ход окна здесь — processConditionTurnStart его не трогает, только читает.
  let burningGraceActive = false;
  if (conds.burning && !burningExtinguishedByShield) {
    const { rounds, roll: graceRoll, sourceName } = await ensureBurningGrace(actor);
    if (rounds > 0) {
      burningGraceActive = true;
      const next = rounds - 1;
      await actor.update({ "system.conditions.burningGraceRounds": next });
      // wdbc-lm83: имя сработавшего предмета, не жёстко «Cooler».
      lines.push(`<div class="roll-threshold">${rollIcon("fire","#8fd0ff")}${esc(sourceName || "Охлаждение")}: тик Горения пропущен${graceRoll ? ` (выдано 1d5 = <b>${graceRoll.total}</b>)` : ""} — осталось Ходов: <b>${next}</b></div>`);
    }
  }

  if (conds.burning && !burningExtinguishedByShield && !burningGraceActive) {
    const roll = await new Roll("1d10").evaluate();
    const tb = Number(actor.system?.characteristics?.t?.bonus) || 0;
    const fireAp = fireproofBurningApBonus(actor);
    const net = Math.max(0, roll.total - tb - fireAp);
    if (net > 0) {
      const { currentWounds, newWounds, newCritical, maxWounds, gotCritical } = await applyWoundLoss(actor, net);
      await addFatigue(actor, 1);
      const destroyed = gotCritical && newCritical >= woundDeathThreshold(maxWounds);
      lines.push(`<div class="roll-threshold">${rollIcon("fire", "#ff8a3a")}Горение: 1d10 <b>${roll.total}</b> − T.b ${tb}${fireAp ? ` − AP(×2) ${fireAp}` : ""} = <b>${net}</b> урона E(Fl)${fireAp ? "" : ", игнор брони"}. Раны: ${currentWounds} → ${newWounds}${gotCritical ? ` (крит. <b>${newCritical}</b>)` : ""} · 😓 Усталость +1${destroyed ? ` — <b>уничтожен</b>` : ""}</div>`);
    } else {
      const tTotal = Number(actor.system?.characteristics?.t?.total) || 0;
      const test = await new Roll("1d100").evaluate();
      const failed = test.total > tTotal;
      if (failed) await addFatigue(actor, 1);
      lines.push(`<div class="roll-threshold">${rollIcon("fire", "#ff8a3a")}Горение: 1d10 <b>${roll.total}</b> целиком в T.b${fireAp ? ` + AP(×2) ${fireAp}` : ""} — тест T+0 (<b>${tTotal}</b>): <b>${test.total}</b> ${failed ? `<span class="roll-failure">провал → 😓 Усталость +1</span>` : `<span class="roll-success">успех</span>`}</div>`);
    }
  }

  // Радиация (стр. 30-31, wdbc-r5o7.6): «периодический 1 урон в T» — фикс,
  // не бросок, в отличие от Горения выше; «при накоплении 10/20/30... — тест
  // T+0, провал даёт лучевую болезнь» — доза (radiationLevel) растёт на 1 с
  // тем же тиком, что и сам урон (книга не разводит «урон» и «дозу» по
  // разным источникам, второе — просто счётчик первого). Урон — в T
  // (system.charDamage.t, тот же ручной знаковый Мод., что у Гангрены,
  // combat/gangrene.mjs), НЕ Раны: книга прямо говорит «урон в T». Лучевая
  // болезнь — не своё Состояние из CONDITIONS_DEF (в книге это осложнение
  // Радиации, не отдельный тег листа), а флаг актора с собственным
  // worldTime-тиком раз в 8 часов, combat/radiation.mjs.
  if (conds.radiation) {
    const before = Number(actor.system.charDamage?.t) || 0;
    const after  = before - 1;
    const level  = Number(conds.radiationLevel) || 0;
    const newLevel = level + 1;
    await actor.update({ "system.charDamage.t": after, ...conditionAdjustFields(actor, "radiation", 1) });
    let sicknessNote = "";
    if (newLevel % 10 === 0) {
      const tTotal = Number(actor.system?.characteristics?.t?.total) || 0;
      const test = await new Roll("1d100").evaluate();
      const failed = test.total > tTotal;
      if (failed) await actor.setFlag("warhammer-dbc", "radiationSickness", true);
      sicknessNote = ` · Доза ${newLevel} — тест T+0 (<b>${tTotal}</b>): <b>${test.total}</b> ${failed
        ? `<span class="roll-failure">провал → лучевая болезнь</span>`
        : `<span class="roll-success">успех</span>`}`;
    }
    lines.push(`<div class="roll-threshold">${rollIcon("warp", "#ffe14d")}Радиация: урон T <b>1</b> (Мод. T: ${before}→${after})${sicknessNote}</div>`);
  }

  if (lines.length) await postConditionCard(actor, lines);
}
