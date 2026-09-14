// module/regions/vortex-zone.mjs
// ═══════════════════════════════════════════════════════════════════════════
//  Vortex of Doom / Вихрь Рока (wdbc-ufns, стр. 313 — сверено book-proofreader
//  по прямому рендеру страницы, не OCR):
//
//  «Х = ½Успехи(окр.▲). Профиль: 3d10+Х I(Cr), Pen 2×Х, Blast (Х),
//  Linger (?/1d10) — так напечатано в книге, первое число не указано автором.
//  В начале Хода псайкер W+5×тPR−5×Х; др. псайкеры с Mind Over Matter в
//  Х×10м могут Реакцией тоже бросить. Победитель (по Успехам/тPR/W) тратит
//  Успехи на ±1 Х или сдвиг на 1 м (Linger). Если контроль перехватил другой
//  псайкер — он в след. Ход проходит тест без траты Реакции, но создатель
//  Вихря тоже сохраняет право перехватывать контроль без Реакции до
//  завершения силы. Никто не прошёл — Х +1d10−6, случайный сдвиг. Х=0 —
//  развеивается.»
//
//  Персистентный Region (тот же класс инфраструктуры, что уже даёт
//  graviton-zone.mjs — «рейтинг тикает на начале Хода, удаляется при 0» —
//  и linger-zone.mjs — «дрейф по розе смещения», module/combat/scatter.mjs).
//  Вихрь — их комбинация ПЛЮС не существовавший раньше в проекте кусок:
//  «несколько кандидатов в радиусе МОГУТ вмешаться встречным тестом,
//  победитель меняется».
//
//  ── Сознательное упрощение «одновременных Реакций» ─────────────────────────
//  Книга подразумевает состязание нескольких одновременных claim'ов. Foundry-
//  чат асинхронный — ждать «пока все решат реагировать» реализовать нечем (то
//  же ограничение, что у ЛЮБОГО делегированного теста в проекте, module/
//  rules/delegate-test.mjs, там оно тоже не решается «дождаться всех»).
//  Вместо N-стороннего турнира — ПОПАРНОЕ состязание: тест контроллера
//  становится «текущим чемпионом» (behavior.system.championRoll), КАЖДЫЙ клик
//  «Вмешаться Реакцией» сравнивается с ЭТИМ сохранённым чемпионом и, если
//  побеждает, сам становится новым чемпионом (контролёром). Это даёт корректный
//  результат при последовательных Реакциях (обычный темп стола) и достаточно
//  честный при одновременных (кто раньше кликнул — тот и сравнивался первым,
//  ровно как в реальной игре побеждает тот, кто быстрее объявил Реакцию).
//
//  ── Трата Успехов победителем ───────────────────────────────────────────────
//  «±1 Х или сдвиг на 1м» — по одному эффекту за Успех, а не одним диалогом
//  сразу на все: тот же принцип «эффект — кнопка», что и у остальных ручных
//  применений в проекте (buildTargetEffectButtons). championRoll.spendLeft
//  считает оставшиеся траты; кнопки исчезают, когда spendLeft доходит до 0.
// ═══════════════════════════════════════════════════════════════════════════

import { pxPerMeter } from "../combat/templates.mjs";
import { SCATTER_ROSE } from "../combat/scatter.mjs";
import { itemHasName } from "../rules/predicates.mjs";
import { esc } from "../helpers/utils.mjs";
import { spendReaction, canSpendReaction } from "../combat/action-economy.mjs";

// Foundry v14: системный тип, без префикса пакета — см. остальные *_ZONE_TYPE.
export const VORTEX_ZONE_TYPE = "vortexZone";

/** Порог теста поддержания контролёра: W + 5×тPR − 5×Х (книга, стр. 313). */
function sustainThreshold(actor, xValue) {
  const w   = Number(actor?.system?.characteristics?.wp?.total) || 0;
  const tpr = Number(actor?.system?.psyker?.currentRating) || 0;
  return w + 5 * tpr - 5 * xValue;
}

/** Степень(и) успеха того же способа, что весь остальной проект. */
function degOf(rv, threshold) {
  return Math.floor(Math.abs(rv - threshold) / 10) + 1;
}

/**
 * Итог одного броска теста поддержания — для контролёра И для реагирующего
 * псайкера одинаково (книга: «тоже бросить», без иной формулы).
 * @returns {Promise<{success:boolean, deg:number, rv:number, threshold:number, tpr:number, w:number}>}
 */
async function rollSustainTest(actor, xValue) {
  const threshold = sustainThreshold(actor, xValue);
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const success = rv <= threshold;
  const deg = degOf(rv, threshold);
  return {
    success, deg, rv, threshold, roll,
    tpr: Number(actor?.system?.psyker?.currentRating) || 0,
    w:   Number(actor?.system?.characteristics?.wp?.total) || 0
  };
}

/**
 * Сравнение исходов по книжному тай-брейку «Успехи/тPR/W» (стр. 313) —
 * возвращает true, если `challenger` СТРОГО обходит `champion`. Провал не
 * может обойти успех; между двумя провалами сравнение бессмысленно (сюда не
 * попадают — оба провала уже уходят в отдельную ветку «никто не прошёл»).
 */
export function beatsChampion(challenger, champion) {
  if (!champion) return challenger.success;
  if (challenger.success !== champion.success) return challenger.success;
  if (challenger.deg !== champion.deg) return challenger.deg > champion.deg;
  if (challenger.tpr !== champion.tpr) return challenger.tpr > champion.tpr;
  return challenger.w > champion.w;
}

export class VortexZoneBehaviorType extends foundry.data.regionBehaviors.RegionBehaviorType {

  /** @override */
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      itemUuid:       new fields.StringField({ required: true, initial: "" }),
      ownerUuid:      new fields.StringField({ required: true, initial: "" }),
      // Кто СЕЙЧАС контролирует Вихрь — меняется, когда реагирующий псайкер
      // выигрывает состязание (см. шапку файла). Изначально = ownerUuid.
      controllerUuid: new fields.StringField({ required: true, initial: "" }),
      xValue:         new fields.NumberField({ required: true, integer: true, initial: 1 }),
      // «Вперёд» для дрейфа — тот же приём, что у LingerZoneBehaviorType:
      // фиксируется один раз при размещении (направление от кастера к точке
      // взрыва), дальше дрейф крутится относительно него.
      facingDeg:      new fields.NumberField({ required: true, initial: 0 }),
      // Текущий «чемпион» состязания за КОНТРОЛЬ на этом Ходу — обнуляется
      // (null) на каждом новом processVortexTurnStart, живёт до следующего.
      // spendLeft — сколько Успехов чемпион ещё не потратил (±1Х/дрейф).
      championRv: new fields.NumberField({ required: false, initial: null, nullable: true }),
      championThreshold: new fields.NumberField({ required: false, initial: null, nullable: true }),
      championDeg: new fields.NumberField({ required: false, initial: 0 }),
      championTpr: new fields.NumberField({ required: false, initial: 0 }),
      championW:   new fields.NumberField({ required: false, initial: 0 }),
      championSuccess: new fields.BooleanField({ required: false, initial: false }),
      spendLeft:   new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 })
    };
  }
}

/** Кто владеет предметом «Mind Over Matter» среди токенов сцены в радиусе (метры) от точки региона. */
function eligibleReactors(region, xValue, excludeActorUuid) {
  const scene = region?.parent;
  if (!scene) return [];
  const px = pxPerMeter();
  const shapeData = region.toObject().shapes[0];
  const cx = shapeData?.x ?? 0, cy = shapeData?.y ?? 0;
  const radiusPx = Math.max(0, xValue) * 10 * px;
  const out = [];
  for (const token of scene.tokens.contents) {
    const actor = token.actor;
    if (!actor || actor.uuid === excludeActorUuid) continue;
    const dx = (token.x + (token.width * scene.grid.size) / 2) - cx;
    const dy = (token.y + (token.height * scene.grid.size) / 2) - cy;
    if (Math.hypot(dx, dy) > radiusPx) continue;
    const knows = actor.items.some(i => i.type === "psychicPower" && itemHasName(i, "Mind Over Matter"));
    if (knows) out.push(token);
  }
  return out;
}

/** Карточка исхода одного броска теста поддержания (контролёр ИЛИ реагирующий). */
function sustainCardHtml(actorName, outcome, { isController } = {}) {
  const label = isController ? "Поддержание Вихря" : "Реакция: перехват контроля";
  const outcomeHtml = outcome.success
    ? `<span class="roll-success">Успех — ${outcome.deg} ст.</span>`
    : `<span class="roll-failure">Провал — ${outcome.deg} ст.</span>`;
  return `<div class="wh-roll-result">
    <div class="roll-header">🌀 ${label} — ${esc(actorName)}</div>
    <div class="roll-threshold">W ${outcome.w} + 5×тPR ${outcome.tpr} − 5×Х → Порог: <b>${outcome.threshold}</b></div>
    <div class="roll-dice">Бросок: <b>${outcome.rv}</b></div>
    <div class="roll-outcome">${outcomeHtml}</div>
  </div>`;
}

/**
 * Разместить Вихрь — вызывается после успешной манифестации (psychic.mjs
 * через hooks.mjs::wh-vortex-place-btn). Тот же blastCircleShape, что у
 * обычного Взрывного/Гравитонного/Linger.
 * @returns {Promise<RegionDocument|null>} null — размещение отменено (ПКМ).
 */
export async function placeVortexZone(shape, xValue, ownerUuid, itemUuid, name = "Вихрь Рока") {
  if (!canvas.ready) throw new Error("Нет активной сцены");
  const region = await canvas.regions.placeRegion({
    name,
    shapes: [shape],
    color: game.user.color.toString(),
    highlightMode: "coverage",
    displayMeasurements: true,
    behaviors: [{
      name: "Вихрь Рока",
      type: VORTEX_ZONE_TYPE,
      system: { itemUuid, ownerUuid, controllerUuid: ownerUuid, xValue: Math.max(1, xValue), facingDeg: 0 }
    }]
  });
  if (!region) return null;

  await ChatMessage.create({
    speaker: { alias: "Система" },
    content: `<div class="wh-roll-result">
      <div class="roll-outcome">🌀 Вихрь Рока «${esc(region.name)}» размещён (Х=${xValue}). Каждый Ход контролёра —
      тест поддержания; др. псайкеры с Mind Over Matter в ${xValue * 10}м могут Реакцией перехватить контроль.</div>
    </div>`
  });

  return region;
}

/**
 * Дёрнуть все Вихри, ПОДКОНТРОЛЬНЫЕ combatant'у, на начале его Хода: тест
 * поддержания, приглашения на Реакцию другим псайкерам в радиусе, провал —
 * случайный дрейф Х. Вызывается из hooks.mjs по updateCombat, тот же паттерн,
 * что и processShooterTurnStart/processGravitonShooterTurnStart.
 */
export async function processVortexTurnStart(combatant) {
  if (!game.user.isGM || !combatant?.actor) return;
  const controllerUuid = combatant.actor.uuid;

  const combatScene = combatant.combat?.scene ?? canvas?.scene;
  for (const scene of combatScene ? [combatScene] : []) {
    for (const region of scene.regions) {
      const behavior = region.behaviors.find(b => b.type === VORTEX_ZONE_TYPE && !b.disabled);
      if (!behavior || behavior.system.controllerUuid !== controllerUuid) continue;
      await _resolveTurnStart(region, behavior);
    }
  }
}

async function _resolveTurnStart(region, behavior) {
  const sys = behavior.system;
  const controllerActor = await fromUuid(sys.controllerUuid).catch(() => null);
  if (!controllerActor) return;

  const outcome = await rollSustainTest(controllerActor, sys.xValue);
  await ChatMessage.create({ speaker: { alias: "Система" }, content: sustainCardHtml(controllerActor.name, outcome, { isController: true }) });

  if (outcome.success) {
    await behavior.update({
      "system.championRv": outcome.rv, "system.championThreshold": outcome.threshold, "system.championDeg": outcome.deg,
      "system.championTpr": outcome.tpr, "system.championW": outcome.w, "system.championSuccess": true, "system.spendLeft": outcome.deg
    });
    await _postSpendCard(region, behavior, controllerActor.name);
  } else {
    // «Никто не прошёл» здесь означает «контролёр провалил, и Реакций пока
    // нет» — случайный дрейф применяется сразу (без Реакции ждать нечего,
    // см. шапку файла про попарное состязание): если позже кто-то всё же
    // отреагирует и выиграет, он получает контроль и свою трату Успехов
    // отдельно, дрейф уже состоявшийся не откатывается.
    await behavior.update({
      "system.championRv": outcome.rv, "system.championThreshold": outcome.threshold, "system.championDeg": outcome.deg,
      "system.championTpr": outcome.tpr, "system.championW": outcome.w, "system.championSuccess": false, "system.spendLeft": 0
    });
    await _applyRandomDrift(region, behavior);
  }

  await _inviteReactors(region, behavior, controllerActor);
}

/** Х +1d10−6 (диапазон −5..+4) — «никто не прошёл» (книга, стр. 313), плюс случайный дрейф по розе. */
async function _applyRandomDrift(region, behavior) {
  const deltaRoll = await new Roll("1d10").evaluate();
  const delta = deltaRoll.total - 6;
  const newX = Math.max(0, (behavior.system.xValue ?? 0) + delta);

  const dirRoll = await new Roll("1d8").evaluate();
  const rose = SCATTER_ROSE[dirRoll.total - 1];
  await _driftRegion(region, behavior, rose);

  await ChatMessage.create({
    speaker: { alias: "Система" },
    content: `<div class="wh-roll-result">
      <div class="roll-outcome">🌀 Контролёр провалил тест поддержания — Х ${delta >= 0 ? "+" : ""}${delta}
      (1d10−6=<b>${delta}</b>) → <b>${newX}</b>. Случайный дрейф: ${rose.icon} <b>${rose.label}</b>.</div>
    </div>`
  });

  if (newX <= 0) return _dissipate(region, behavior);
  await behavior.update({ "system.xValue": newX });
}

async function _driftRegion(region, behavior, rose) {
  const px = pxPerMeter();
  const angleDeg = (behavior.system.facingDeg + rose.deg) % 360;
  const rad = Math.toRadians(angleDeg);
  const dx = Math.cos(rad) * px;
  const dy = Math.sin(rad) * px;
  const shapeData = region.toObject().shapes[0];
  await region.update({ shapes: [{ ...shapeData, x: shapeData.x + dx, y: shapeData.y + dy }] });
}

/** Зона развеялась (Х=0) — снять Region, уведомить. */
async function _dissipate(region, behavior) {
  await ChatMessage.create({
    speaker: { alias: "Система" },
    content: `<div class="wh-roll-result"><div class="roll-outcome">🌀 Вихрь Рока «${esc(region.name)}» развеялся (Х=0).</div></div>`
  });
  await region.parent?.deleteEmbeddedDocuments("Region", [region.id]);
}

/** Пригласить владельцев других псайкеров-кандидатов вмешаться Реакцией. */
async function _inviteReactors(region, behavior, controllerActor) {
  const reactors = eligibleReactors(region, behavior.system.xValue, controllerActor.uuid);
  if (!reactors.length) return;

  const payload = {
    regionId: region.id, sceneId: region.parent?.id ?? "", behaviorId: behavior.id,
    itemUuid: behavior.system.itemUuid
  };
  for (const token of reactors) {
    const actor = token.actor;
    const owner = game.users?.players?.find(u => u.active && actor.testUserPermission?.(u, "OWNER"));
    const recipients = owner ? [owner.id] : (game.users?.filter(u => u.isGM).map(u => u.id) ?? []);
    await ChatMessage.create({
      whisper: recipients.length ? recipients : undefined,
      speaker: { alias: "Система" },
      content: `<div class="wh-roll-result">
        <div class="roll-header">🌀 Вихрь Рока: перехватить контроль?</div>
        <div class="roll-threshold">«${esc(actor.name)}» знает Mind Over Matter и в радиусе Вихря — можно вмешаться
        Реакцией (встречный тест на тех же условиях, что у контролёра).</div>
        <button type="button" class="wh-vortex-react-btn"
          data-actor-uuid="${esc(actor.uuid)}" data-payload="${esc(JSON.stringify(payload))}">
          🔮 Вмешаться Реакцией
        </button>
      </div>`
    });
  }
}

/**
 * Клик «Вмешаться Реакцией» — reactingActor бросает тот же тест, сравнивается
 * с текущим чемпионом (championRv/... на behavior), при победе становится
 * новым контролёром и получает кнопки траты Успехов.
 */
export async function reactToVortex(reactingActor, { regionId, sceneId, behaviorId }) {
  const scene = game.scenes?.get(sceneId) ?? canvas?.scene;
  const region = scene?.regions?.get(regionId);
  const behavior = region?.behaviors?.get(behaviorId);
  if (!region || !behavior || behavior.type !== VORTEX_ZONE_TYPE) {
    return ui.notifications?.warn("Вихрь уже не существует (развеялся/удалён).");
  }
  if (!(await spendReactionOrWarn(reactingActor))) return;

  const outcome = await rollSustainTest(reactingActor, behavior.system.xValue);
  const champion = behavior.system.championRv == null ? null : {
    success: behavior.system.championSuccess, deg: behavior.system.championDeg,
    tpr: behavior.system.championTpr, w: behavior.system.championW
  };

  const won = beatsChampion(outcome, champion);
  await ChatMessage.create({ speaker: { alias: "Система" }, content: sustainCardHtml(reactingActor.name, outcome) });

  if (!won) {
    return ChatMessage.create({
      speaker: { alias: "Система" },
      content: `<div class="wh-roll-result"><div class="roll-outcome">Контроль над Вихрем не перехвачен — текущий чемпион сильнее.</div></div>`
    });
  }

  await behavior.update({
    "system.controllerUuid": reactingActor.uuid,
    "system.championRv": outcome.rv, "system.championThreshold": outcome.threshold, "system.championDeg": outcome.deg,
    "system.championTpr": outcome.tpr, "system.championW": outcome.w, "system.championSuccess": outcome.success,
    "system.spendLeft": outcome.success ? outcome.deg : 0
  });
  await ChatMessage.create({
    speaker: { alias: "Система" },
    content: `<div class="wh-roll-result"><div class="roll-outcome">🌀 «${esc(reactingActor.name)}» перехватывает контроль над Вихрем!</div></div>`
  });
  if (outcome.success) await _postSpendCard(region, behavior, reactingActor.name);
}

async function spendReactionOrWarn(actor) {
  if (!canSpendReaction(actor)) {
    ui.notifications?.warn(`«${actor.name}»: не осталось Реакций.`);
    return false;
  }
  return spendReaction(actor);
}

/** Кнопки траты Успехов победителя: ±1 Х / сдвиг на 1м, по одной за Успех. */
async function _postSpendCard(region, behavior, winnerName) {
  const left = behavior.system.spendLeft ?? 0;
  if (left <= 0) return;
  const payload = { regionId: region.id, sceneId: region.parent?.id ?? "", behaviorId: behavior.id };
  await ChatMessage.create({
    speaker: { alias: "Система" },
    content: `<div class="wh-roll-result">
      <div class="roll-header">🌀 «${esc(winnerName)}» тратит Успехи (осталось ${left})</div>
      <button type="button" class="wh-vortex-spend-btn" data-action="x+1" data-payload="${esc(JSON.stringify(payload))}">+1 Х</button>
      <button type="button" class="wh-vortex-spend-btn" data-action="x-1" data-payload="${esc(JSON.stringify(payload))}">−1 Х</button>
      <button type="button" class="wh-vortex-spend-btn" data-action="drift" data-payload="${esc(JSON.stringify(payload))}">Сдвиг 1м</button>
    </div>`
  });
}

/** Клик по кнопке траты: списывает 1 Успех, применяет эффект, X=0 — развеивает. */
export async function spendVortexSuccess({ regionId, sceneId, behaviorId }, action) {
  const scene = game.scenes?.get(sceneId) ?? canvas?.scene;
  const region = scene?.regions?.get(regionId);
  const behavior = region?.behaviors?.get(behaviorId);
  if (!region || !behavior || behavior.type !== VORTEX_ZONE_TYPE) {
    return ui.notifications?.warn("Вихрь уже не существует (развеялся/удалён).");
  }
  const left = behavior.system.spendLeft ?? 0;
  if (left <= 0) return ui.notifications?.warn("Успехи уже потрачены.");

  if (action === "drift") {
    const dirRoll = await new Roll("1d8").evaluate();
    const rose = SCATTER_ROSE[dirRoll.total - 1];
    await _driftRegion(region, behavior, rose);
    await behavior.update({ "system.spendLeft": left - 1 });
    return ChatMessage.create({
      speaker: { alias: "Система" },
      content: `<div class="wh-roll-result"><div class="roll-outcome">🌀 Вихрь смещён на 1м ${rose.icon} <b>${rose.label}</b> (Успех потрачен).</div></div>`
    });
  }

  const delta = action === "x+1" ? 1 : -1;
  const newX = Math.max(0, (behavior.system.xValue ?? 0) + delta);
  await behavior.update({ "system.xValue": newX, "system.spendLeft": left - 1 });
  await ChatMessage.create({
    speaker: { alias: "Система" },
    content: `<div class="wh-roll-result"><div class="roll-outcome">🌀 Х ${delta > 0 ? "+1" : "−1"} → <b>${newX}</b> (Успех потрачен).</div></div>`
  });
  if (newX <= 0) await _dissipate(region, behavior);
}

/**
 * Убрать ВСЕ ещё живые Вихри — бой закончился, считать Ходы больше не от
 * чего (тот же принцип, что и clearAllLingerZones/clearAllGravitonZones).
 * Вызывается из hooks.mjs по deleteCombat.
 */
export async function clearAllVortexZones() {
  if (!game.user.isGM) return;
  for (const scene of game.scenes) {
    const ids = [];
    for (const region of scene.regions) {
      if ([...region.behaviors].some(b => b.type === VORTEX_ZONE_TYPE)) ids.push(region.id);
    }
    if (ids.length) await scene.deleteEmbeddedDocuments("Region", ids);
  }
}
