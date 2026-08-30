// module/regions/linger-zone.mjs
// ═══════════════════════════════════════════════════════════════════════════
//  Свойство оружия «Остаётся» (Linger, корбук). Пользователь уточнил правило
//  дословно (сессия 24.08.2026) поверх краткой сводки из книги:
//
//  «Если у этого свойства есть только один рейтинг, то это X. Второй
//  рейтинг — Y — значит, что шаблон каждый Раунд в начале Хода стрелка
//  смещается на Y м (в случайном направлении согласно кубику смещения как
//  для взрыва, если не сказано иначе), нанося попадания по всем целям на
//  его пути.» + «Х — это сколько Раундов Encounter существует шаблон,
//  после чего в начале хода породившего этот лингер актора исчезает.»
//
//  Т.е. ОБА эффекта — и истечение срока, и дрейф — привязаны к одному и
//  тому же событию: началу Хода именно СТРЕЛКА (не любой смены Раунда и не
//  «начала хода токена внутри зоны» — тот отдельный, региональный триггер
//  ниже). Поэтому здесь два независимых механизма:
//    1. Region-события TOKEN_ENTER/TOKEN_TURN_START — «кто попал под зону
//       прямо сейчас» (любой токен, впервые за ход).
//    2. processShooterTurnStart(combatant), дёргается из hooks.mjs по
//       смене хода в бою — «жив ли ещё сам шаблон» и «пора ли дрейфовать»,
//       привязано именно к ходу СОЗДАТЕЛЯ зоны, а не к региону.
//
//  Родственный, но ДРУГОЙ механизм по сравнению с разовым Шаблоном
//  (module/combat/templates.mjs, wdbc-1pa.2): там Region эфемерный
//  (create:false, тестируется и сразу выбрасывается), здесь — настоящий,
//  ПЕРСИСТЕНТНЫЙ Region + RegionBehaviorType, по образцу уже готового
//  difficult-terrain.mjs — только зона не рисуется ГМом заранее, а
//  создаётся программно в момент атаки (та же геометрия из templates.mjs).
// ═══════════════════════════════════════════════════════════════════════════

import { tokensInRegion } from "../combat/templates.mjs";
import { applyDamageToActor } from "../combat/damage.mjs";
import { SCATTER_ROSE } from "../combat/scatter.mjs";
import { esc } from "../helpers/utils.mjs";

export const LINGER_ZONE_TYPE = "warhammer-dbc.lingerZone";

export class LingerZoneBehaviorType extends foundry.data.regionBehaviors.RegionBehaviorType {

  /** @override */
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      // X — сколько «начал хода стрелка» шаблон переживает, прежде чем
      // исчезнуть на очередном начале его хода (см. заголовок файла).
      roundsTotal: new fields.NumberField({ required: true, integer: true, initial: 1, min: 1 }),
      // Сколько раз уже сработало начало хода стрелка с момента создания.
      turnsPassed: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      // Y — на сколько метров дрейфует за одно срабатывание; 0 — не дрейфует.
      driftMeters: new fields.NumberField({ required: true, initial: 0, min: 0 }),
      // «Вперёд» (deg:0 розы смещения) для дрейфа — направление стрелок→точка
      // первого размещения, зафиксированное один раз при создании зоны
      // (после первого размещения «линии огня» уже нет, дальше — только
      // фиксированная система отсчёта).
      facingDeg: new fields.NumberField({ required: true, initial: 0 }),
      // Тот же damageData, что и «Применить урон» (module/combat/damage.mjs,
      // applyDamageToActor) — переиспользуется на каждого, кто впервые за ход
      // оказался в зоне («один бросок урона на всех», как и у самого Взрывного).
      damageData: new fields.ObjectField({ required: true, initial: {} }),
      // {[tokenId]: "round-turn"} — последний ход, когда токен уже получил
      // попадание от этой зоны; дедуп «впервые за ход».
      hitLog: new fields.ObjectField({ required: true, initial: {} })
    };
  }

  /* ---------------------------------------- */
  //  Кто физически в зоне прямо сейчас — независимо от того, чей это ход.

  static async #onTrigger(event) {
    if (!game.user.isGM) return; // одна запись в БД на всех клиентов, не N
    const combat = game.combat;
    if (!combat) return; // «на поле боя» — вне боя зона не действует

    const { token } = event.data;
    const actor = token.actor;
    if (!actor) return;

    const round = event.data.round ?? combat.round;
    const turn  = event.data.turn  ?? combat.turn;
    const key = `${round}-${turn}`;
    if (this.hitLog[token.id] === key) return; // уже задело в этот ход

    await this.behavior.update({ [`system.hitLog.${token.id}`]: key });
    await applyDamageToActor(actor, this.damageData);
  }

  /** @override */
  static events = {
    [CONST.REGION_EVENTS.TOKEN_ENTER]:      this.#onTrigger,
    [CONST.REGION_EVENTS.TOKEN_TURN_START]: this.#onTrigger
  };

  /* ---------------------------------------- */
  //  Дрейф — вызывается извне (processShooterTurnStart), не Region-событие:
  //  срабатывает от хода стрелка, а не от присутствия кого-либо в зоне.

  /** Сместить зону на driftMeters по розе смещения и задеть всех на пути. */
  async _drift() {
    const region = this.region;
    if (!region) return;
    const px = canvas.dimensions.distancePixels;

    const dirRoll = await new Roll("1d8").evaluate();
    const rose = SCATTER_ROSE[dirRoll.total - 1];
    const angleDeg = (this.facingDeg + rose.deg) % 360;
    const rad = Math.toRadians(angleDeg);
    const dx = Math.cos(rad) * this.driftMeters * px;
    const dy = Math.sin(rad) * this.driftMeters * px;

    const before = new Map(tokensInRegion(region).map(t => [t.id, t]));

    const shapeData = region.toObject().shapes[0];
    await region.update({ shapes: [{ ...shapeData, x: shapeData.x + dx, y: shapeData.y + dy }] });

    for (const t of tokensInRegion(region)) before.set(t.id, t); // объединение «было ∪ стало» — путь дрейфа
    for (const token of before.values()) {
      if (token.actor) await applyDamageToActor(token.actor, this.damageData);
    }

    await ChatMessage.create({
      speaker: { alias: "Система" },
      content: `<div class="wh-roll-result">
        <div class="roll-outcome">☁️ Зона «${esc(region.name)}» сместилась на <b>${this.driftMeters}м</b>
        ${rose.icon} <b>${rose.label}</b> (роза, направление ${rose.n}/8).</div>
      </div>`
    });
  }
}

/* ---------------------------------------- */

/**
 * Создать персистентный Region с зоной «Остаётся» на текущей сцене — та же
 * фигура (круг/конус из templates.mjs), что и у разового Шаблона, только
 * с прикреплённым RegionBehaviorType и сроком жизни в «ходах стрелка».
 * @param {object} shape         Данные фигуры (blastCircleShape/sprayConeShape).
 * @param {object} damageData    damageData для applyDamageToActor — переносится
 *                               с исходного попадания без изменений.
 * @param {number} rounds        roundsTotal (X) — сколько ходов стрелка зона держится.
 * @param {number} [driftMeters] Y — на сколько метров зона дрейфует каждый ход стрелка; 0 — не дрейфует.
 * @param {string} [name]
 * @returns {Promise<RegionDocument|null>}  null — размещение отменено (ПКМ).
 */
export async function placeLingerZone(shape, damageData, rounds, driftMeters = 0, name = "Остаётся") {
  if (!canvas.ready) throw new Error("Нет активной сцены");
  // create:true (по умолчанию) — в отличие от разового Шаблона, зона должна
  // пережить момент размещения и реагировать на события следующих ходов.
  const region = await canvas.regions.placeRegion({
    name,
    shapes: [shape],
    color: game.user.color.toString(),
    highlightMode: "coverage",
    displayMeasurements: true,
    behaviors: [{
      name: "Остаётся",
      type: LINGER_ZONE_TYPE,
      system: { roundsTotal: rounds, turnsPassed: 0, driftMeters, facingDeg: 0, damageData, hitLog: {} }
    }]
  });
  if (!region) return null;

  // «Вперёд» для будущего дрейфа = направление стрелок → место первого
  // размещения, зафиксированное один раз (позиция региона уже известна,
  // в отличие от момента создания behaviors выше).
  if (driftMeters > 0 && damageData.attackerUuid) {
    const attackerActor = await fromUuid(damageData.attackerUuid);
    // Именно placeable (второй аргумент false): у TokenDocument нет .center.
    const attackerToken = attackerActor?.getActiveTokens?.(true)?.[0];
    if (attackerToken) {
      const shapeData = region.toObject().shapes[0];
      const ac = attackerToken.center;
      let facingDeg = Math.toDegrees(Math.atan2(shapeData.y - ac.y, shapeData.x - ac.x));
      if (facingDeg < 0) facingDeg += 360;
      const behavior = region.behaviors.find(b => b.type === LINGER_ZONE_TYPE);
      await behavior?.update({ "system.facingDeg": facingDeg });
    }
  }

  return region;
}

/**
 * Дёрнуть все зоны «Остаётся», созданные атакующим `combatant`, на начале
 * его Хода: посчитать очередной ход, удалить зону, если её X ходов вышло,
 * иначе продрейфовать (если Y > 0). Вызывается из hooks.mjs по updateCombat
 * при смене хода (любого — свой ход стрелка вычисляется здесь же).
 * @param {Combatant} combatant  Актуальный combat.combatant (чей ход начался).
 */
export async function processShooterTurnStart(combatant) {
  if (!game.user.isGM || !combatant?.actor) return;
  const attackerUuid = combatant.actor.uuid;

  // Зоны живут на сцене боя (там их размещали) — полный обход всех сцен
  // мира на каждую смену хода был бы и тратой, и ошибкой: _drift()/
  // tokensInRegion читают canvas, который валиден только для текущей сцены.
  const combatScene = combatant.combat?.scene ?? canvas?.scene;
  for (const scene of combatScene ? [combatScene] : []) {
    const toDelete = [];
    for (const region of scene.regions) {
      const behavior = region.behaviors.find(b => b.type === LINGER_ZONE_TYPE && !b.disabled);
      if (!behavior || behavior.system.damageData?.attackerUuid !== attackerUuid) continue;

      const turnsPassed = (behavior.system.turnsPassed ?? 0) + 1;
      if (turnsPassed >= (behavior.system.roundsTotal ?? 1)) {
        toDelete.push(region.id);
        continue;
      }
      await behavior.update({ "system.turnsPassed": turnsPassed });
      if (behavior.system.driftMeters > 0) await behavior.system._drift();
    }
    if (toDelete.length) await scene.deleteEmbeddedDocuments("Region", toDelete);
  }
}

/**
 * Убрать ВСЕ ещё живые зоны «Остаётся» — бой закончился, считать ходы
 * больше не от чего («X ходов стрелка» вне боя не имеет смысла).
 * Вызывается из hooks.mjs по deleteCombat.
 */
export async function clearAllLingerZones() {
  if (!game.user.isGM) return;
  for (const scene of game.scenes) {
    const ids = [];
    for (const region of scene.regions) {
      if ([...region.behaviors].some(b => b.type === LINGER_ZONE_TYPE)) ids.push(region.id);
    }
    if (ids.length) await scene.deleteEmbeddedDocuments("Region", ids);
  }
}
