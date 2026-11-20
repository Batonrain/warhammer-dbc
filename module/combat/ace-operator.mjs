// module/combat/ace-operator.mjs
// Ас Оператор / Ace Operator (Талант Пилота): «Персонаж может потратить Очко Бесчестия, чтобы
// уменьшить число Провалов на вождение техники на A.b, потенциально превращая Провал в Успех, но не
// больше 1 Успеха.» Кнопка на проваленных карточках Виража и Трудного Ландшафта (combat/vehicle.mjs):
// Очко платит водитель, раз на карточку; новая карточка пересчитывает последствия.

import { esc, _degWord } from "../helpers/utils.mjs";
import { postTestCard, outcomeHtml } from "../helpers/test-card.mjs";
import { runCardOnce } from "./card-once.mjs";
import { actorHasInfamyPoint, actorInfamyPath, spendFromInfamyPool } from "../apps/infamy-points.mjs";
import { hasItemNamed } from "../rules/req-atom.mjs";

/** Одно Очко Бесчестия общей точкой пула (временный запас первым, Пустота Парии запрещает). */
async function spendInfamyPoint(actor, what) {
  if (!actorHasInfamyPoint(actor)) { ui.notifications?.warn(`Нет Очка Бесчестия — ${what} не активирован.`); return false; }
  const path = actorInfamyPath(actor);
  const spend = await spendFromInfamyPool(actor, 1, path);
  if (!spend) return false;
  if (spend.poolSpent) await actor.update({ [path]: spend.poolValue });
  return true;
}

export const hasAceOperator = actor => hasItemNamed(actor, "Ace Operator", ["talent"]);

/** Сколько Провалов остаётся после Аса Оператора (0 — Успех на 1 Успех). */
export function aceOperatorLeft(failures, agilityBonus) {
  return Math.max(0, (Number(failures) || 0) - Math.max(0, Number(agilityBonus) || 0));
}

/** Кнопка для проваленной карточки вождения. kind: "terrain" | "swerve". */
export function aceOperatorButtonHtml(driver, vehicle, { kind, failures, hits = 1, walker = false } = {}) {
  if (!driver || !vehicle || !(failures > 0) || !hasAceOperator(driver)) return "";
  const ab = Number(driver.system?.characteristics?.ag?.bonus) || 0;
  return `<div class="roll-defense-section"><button type="button" class="wh-ace-operator-btn"
    data-driver-uuid="${esc(driver.uuid)}" data-vehicle-uuid="${esc(vehicle.uuid)}" data-kind="${kind}"
    data-failures="${failures}" data-hits="${hits}" data-walker="${walker ? 1 : 0}"
    title="Потратить Очко Бесчестия: Провалов меньше на A.b (${ab}), не больше 1 Успеха">⚜ Ас Оператор: Очко Бесчестия → −${ab} Провалов</button></div>`;
}

export async function useAceOperator(message, ds) {
  const driver = await fromUuid(ds.driverUuid).catch(() => null);
  const vehicle = await fromUuid(ds.vehicleUuid).catch(() => null);
  if (!driver || !vehicle) return ui.notifications.warn("⚠️ Водитель или машина не найдены.");
  if (!driver.isOwner && !game.user.isGM) return ui.notifications.warn("⚠️ Тратить Очко может только владелец водителя.");
  return runCardOnce(message, "aceOperatorUsed", async () => {
    if (!(await spendInfamyPoint(driver, "Ас Оператор"))) return false;
    const failures = Number(ds.failures) || 0;
    const ab = Number(driver.system?.characteristics?.ag?.bonus) || 0;
    const left = aceOperatorLeft(failures, ab);
    const head = `Ас Оператор (${esc(driver.name)}): Провалов ${failures} − A.b ${ab}`;
    let outcome, sections = [];
    if (ds.kind === "swerve") {
      outcome = left === 0
        ? outcomeHtml(true, `${head} — Вираж удался, 1 Успех: снимает одно попадание.`)
        : outcomeHtml(false, `${head} — всё ещё Провал, ${left} ${_degWord(left)}.`);
    } else {
      const walker = ds.walker === "1";
      outcome = left === 0
        ? outcomeHtml(true, `${head} — Успех, 1 Успех. ${walker ? "Шагоход не спотыкается." : "Ходовая не повреждена."}`)
        : outcomeHtml(false, `${head} — Провал, ${left} ${_degWord(left)}.`);
      if (left > 0 && !walker) {
        sections.push(`<div class="roll-damage-section"><div class="roll-damage-label">Непоглощаемый урон в Ходовую: <b>${left}</b> (вместо урона с прошлой карточки)</div>
          <button class="wh-vehicle-track-dmg-btn" type="button" data-actor-id="${vehicle.id}" data-dmg="${left}">Применить ${left} урона в Ходовую (Структура)</button></div>`);
      }
    }
    await postTestCard(vehicle, { icon: "⚜", title: `Ас Оператор — ${esc(vehicle.name)}`, outcome, sections }, { sound: false });
    return true;
  }, "Ас Оператор с этой карточки уже использован.");
}

// ── Танковый Командир / Tank Commander ──────────────────────────────────────
// «Когда персонаж занимает станцию командира машины, весь экипаж может действовать в Инициативу
// командира.» Кнопка Таланта: экипаж машины, где носитель сидит на станции commander, получает его
// Инициативу (чуть ниже — порядок внутри экипажа сохраняется, командир первым).

export const hasTankCommander = actor => hasItemNamed(actor, "Tank Commander", ["talent"]);

/** Машина, где актор на станции командира. */
export function commandedVehicle(actor, vehicles) {
  return [...(vehicles ?? [])].find(v => v?.type === "vehicle" && (v.system?.stations ?? [])
    .some(s => String(s?.role ?? "").trim().toLowerCase() === "commander" && s?.uuid
      && (s.uuid === actor?.uuid || s.uuid === actor?.token?.uuid))) ?? null;
}

/** Новые Инициативы экипажа: командир first, остальные — init − 0.01×k. */
export function crewInitiatives(commanderInit, crewIds) {
  return crewIds.map((id, k) => ({ id, value: Math.round((Number(commanderInit) - 0.01 * (k + 1)) * 100) / 100 }));
}

export async function useTankCommander(actor) {
  if (!actor || !hasTankCommander(actor)) return ui.notifications.warn("⚠️ У актора нет Таланта Танковый Командир.");
  const combat = game.combat;
  if (!combat) return ui.notifications.warn("⚠️ Нет боя.");
  const vehicle = commandedVehicle(actor, game.actors);
  if (!vehicle) return ui.notifications.warn("⚠️ Персонаж не сидит на станции командира машины (вкладка «Экипаж»).");
  const me = combat.combatants.find(c => c.actor?.uuid === actor.uuid || c.actorId === actor.id);
  if (!me || me.initiative == null) return ui.notifications.warn("⚠️ Сначала бросьте Инициативу командира.");
  const crewUuids = (vehicle.system?.stations ?? []).map(s => s?.uuid).filter(u => u && u !== actor.uuid);
  const crew = combat.combatants.filter(c => c.id !== me.id && crewUuids.includes(c.actor?.uuid));
  if (!crew.length) return ui.notifications.warn("⚠️ Никого из экипажа нет в бою.");
  if (!game.user.isGM && crew.some(c => !c.isOwner)) return ui.notifications.warn("⚠️ Менять Инициативу чужого экипажа может ГМ.");
  for (const { id, value } of crewInitiatives(me.initiative, crew.map(c => c.id))) await combat.setInitiative(id, value);
  await postTestCard(actor, {
    icon: "🛡", title: `Танковый Командир — ${esc(vehicle.name)}`,
    lines: [`<div class="roll-threshold">Экипаж (${crew.map(c => esc(c.name)).join(", ")}) действует в Инициативу командира ${esc(actor.name)} (${me.initiative}). Короткая Команда экипажу раз в Ход — свободным действием, за столом.</div>`]
  }, { sound: false });
}
