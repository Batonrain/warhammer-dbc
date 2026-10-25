// module/combat/burning-cover.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Горящие укрытия (Талант «Pyromaniac / Пироман», вторая половина) — Foundry-
//  обвязка. Правила и модель состояния — rules/burning-cover.mjs.
//
//  Три момента:
//   1. Поджог. Игрок, разместивший шаблон огнемёта (кнопка .wh-place-template-btn),
//      получает список зон Укрытия (Region с поведением cover), которые шаблон
//      накрывает; бросает 1d5+1 Раундов и просит ГМа записать состояние: сцену
//      игроки не правят (Region правит владелец сцены), поэтому запись идёт через
//      сокет activeGM — тот же relay-приём, что у Вырубания (combat/takedown.mjs).
//   2. Конец Хода. Токен, стоящий в горящей зоне, когда его Ход закончился,
//      автоматически Загорается (processBurningCoverTurnChange, зовётся ГМ-клиентом
//      из hooks.mjs по updateCombat).
//   3. Гашение. Зона гаснет со сменой Раунда после срока и по концу боя; цвет и
//      видимость возвращаются прежними.
//  Подсветка на карте — штатные свойства Region (огненный цвет, «видна всем»),
//  собственной отрисовки нет.
// ════════════════════════════════════════════════════════════════════════════

import { COVER_TYPE } from "../regions/cover.mjs";
import { pxPerMeter } from "./templates.mjs";
import { esc } from "../helpers/utils.mjs";
import { conditionApplyFields } from "../sheets/tabs/conditions.mjs";
import {
  BURNING_COVER_NS, BURNING_COVER_FLAG, BURNING_COVER_DURATION,
  burningCoverUntil, isCoverBurning, turnEndRound,
  coverIgnitionPatch, coverExtinguishPatch, regionsOverlapBySampling
} from "../rules/burning-cover.mjs";

/** Это зона Укрытия (поведение cover, не отключённое)? */
export function isCoverRegion(region) {
  return [...(region?.behaviors ?? [])].some(b => b.type === COVER_TYPE && !b.disabled);
}

/** Запись в сцену делает один ГМ: активный (при двух ГМах онлайн иначе были бы двойные карточки и записи). */
function isActiveGM() {
  const active = game.users?.activeGM;
  return !!game.user?.isGM && (!active || active.id === game.user.id);
}

const flagOf = region =>region?.flags?.[BURNING_COVER_NS]?.[BURNING_COVER_FLAG] ?? null;

/** Высота пробной точки: 0, а если зона начинается выше — её нижняя граница (зона с высотным диапазоном). */
function sampleElevation(region) {
  const b = Number(region?.elevation?.bottom);
  return Number.isFinite(b) && b > 0 ? b : 0;
}

/**
 * Зоны Укрытия текущей сцены, которые накрывает шаблон («попавшие в шаблон
 * огнемёта»). Пересечение — сэмплом точек зоны Укрытия через testPoint шаблона.
 * @param {RegionDocument} templateRegion  эфемерный Region шаблона (placeAttackTemplate)
 * @returns {RegionDocument[]}
 */
export function coverRegionsUnderTemplate(templateRegion, scene = canvas?.scene) {
  if (!templateRegion || !scene) return [];
  const step = Math.max(4, pxPerMeter() / 2);
  const out = [];
  for (const region of scene.regions ?? []) {
    if (!isCoverRegion(region) || region === templateRegion) continue;
    const elevation = sampleElevation(region);
    const hit = regionsOverlapBySampling(region.bounds, step,
      (x, y) => region.testPoint({ x, y, elevation }),
      (x, y) => templateRegion.testPoint({ x, y, elevation }));
    if (hit) out.push(region);
  }
  return out;
}

/**
 * Сторона игрока: накрытые шаблоном укрытия загораются на 1d5+1 Раундов.
 * @returns {Promise<RegionDocument[]>} зоны, которые подожжены (пусто — ничего не накрыто / нет боя)
 */
export async function igniteCoversUnderTemplate(templateRegion, { attackerName = "" } = {}) {
  const regions = coverRegionsUnderTemplate(templateRegion);
  if (!regions.length) return [];
  const combat = game.combat;
  if (!combat) {
    ui.notifications.warn("⚠️ Пироман: горящие укрытия отсчитывают Раунды боя — начните бой.");
    return [];
  }

  const roll = await new Roll(BURNING_COVER_DURATION).evaluate();
  const untilRound = burningCoverUntil(combat.round, roll.total);
  const payload = {
    sceneId: canvas.scene.id, regionIds: regions.map(r => r.id),
    untilRound, combatId: combat.id
  };

  if (game.user.isGM) {
    await applyBurningCovers(payload);
  } else if (game.users?.activeGM) {
    game.socket?.emit("system.warhammer-dbc", { action: "burnCovers", userId: game.user.id, ...payload });
  } else {
    ui.notifications.warn("⚠️ Пироман: Мастера нет в игре — укрытия подожечь некому.");
    return [];
  }

  const names = regions.map(r => esc(r.name)).join(", ");
  await ChatMessage.create({
    speaker: { alias: attackerName || "Пироман" },
    content: `<div class="wh-roll-result">
      <div class="roll-header">🔥 Пироман: горящие укрытия</div>
      <div class="roll-outcome">Загорелись: <b>${names}</b> — на <b>${roll.total}</b> Раунд(ов), до начала Раунда <b>${untilRound}</b>.
      Кто закончит свой Ход в такой зоне — загорится сам.</div>
    </div>`,
    rolls: [roll],
    sound: CONFIG.sounds.dice
  });
  return regions;
}

/**
 * Сторона ГМа: записать состояние «горит» на зоны. Проверяет сам, что это
 * зоны Укрытия (запрос пришёл по сокету от любого клиента).
 */
export async function applyBurningCovers({ sceneId, regionIds, untilRound, combatId }) {
  if (!game.user.isGM) return 0;
  const scene = game.scenes?.get(sceneId);
  if (!scene || !Array.isArray(regionIds)) return 0;
  const until = Number(untilRound);
  if (!Number.isFinite(until)) return 0;
  let n = 0;
  for (const id of regionIds) {
    const region = scene.regions?.get(id);
    if (!region || !isCoverRegion(region)) continue;
    await region.update(coverIgnitionPatch(region, { untilRound: until, combatId: String(combatId ?? "") }));
    n++;
  }
  return n;
}

/** Погасить зону: вернуть прежний цвет и видимость. */
async function extinguishRegion(region) {
  await region.update(coverExtinguishPatch(flagOf(region)));
}

/** Автоматически поджечь персонажа (единая точка наложения Состояния: иммунитет учтён). */
async function igniteActor(actor, regionName) {
  if (!actor?.system?.conditions || actor.type === "horde" || actor.type === "vehicle") return;
  if (actor.system.conditions.burning) return;
  const fields = conditionApplyFields("burning", null, actor);
  const burned = Object.keys(fields).length > 0;
  if (burned) await actor.update(fields);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">🔥 Горящее укрытие → ${esc(actor.name)}</div>
      <div class="roll-outcome"><span class="roll-failure">${burned
        ? `Закончил(а) Ход в горящей зоне «${esc(regionName)}» — автоматически Загорается`
        : `Закончил(а) Ход в горящей зоне «${esc(regionName)}», но иммунен(на) к Горению`}</span></div>
    </div>`
  });
}

/**
 * ГМ-клиент, при смене хода в бою: (1) токен, чей Ход только что закончился и
 * кто стоит в горящей зоне, загорается; (2) зоны, чей срок вышел, гаснут.
 * Порядок важен: сперва конец Хода — в последний горящий Раунд зона должна
 * успеть поджечь стоящего в ней, потом уже гаснуть со сменой Раунда.
 * @param {Combat} combat
 * @param {object} changed  diff updateCombat
 * @param {Combatant|null} prevCombatant  чей Ход только что закончился
 */
export async function processBurningCoverTurnChange(combat, changed, prevCombatant) {
  if (!isActiveGM() || !combat) return;
  try {
    const ctx = { round: turnEndRound(combat.round, changed), combatId: combat.id };
    if (prevCombatant?.actor) {
      const regions = prevCombatant.token?.regions ?? prevCombatant.actor.getActiveTokens?.()?.[0]?.document?.regions;
      for (const region of regions ?? []) {
        if (isCoverRegion(region) && isCoverBurning(flagOf(region), ctx)) {
          await igniteActor(prevCombatant.actor, region.name);
          break;
        }
      }
    }
    // Гашение: зона не горит в НАСТОЯЩЕМ раунде (срок вышел или флаг чужого боя).
    const now = { round: combat.round, combatId: combat.id };
    for (const region of (combat.scene ?? canvas?.scene)?.regions ?? []) {
      const flag = flagOf(region);
      if (flag && !isCoverBurning(flag, now)) await extinguishRegion(region);
    }
  } catch (err) {
    console.error("warhammer-dbc | горящие укрытия:", err);
  }
}

/**
 * Бой кончился — потушить горящие укрытия ЭТОГО боя (цвет и видимость вернуть). Зоны другого
 * живого боя не трогаются; флаг без боя (combatId пуст) гаснет вместе с любым.
 * @param {Combat} [combat]  удалённый бой; без него гаснет всё
 */
export async function clearAllBurningCovers(combat = null) {
  if (!isActiveGM()) return;
  for (const scene of game.scenes ?? []) {
    for (const region of scene.regions ?? []) {
      const flag = flagOf(region);
      if (!flag) continue;
      if (combat && flag.combatId && flag.combatId !== combat.id) continue;
      await extinguishRegion(region);
    }
  }
}
