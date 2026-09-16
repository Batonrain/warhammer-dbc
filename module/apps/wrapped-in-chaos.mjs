// module/apps/wrapped-in-chaos.mjs
// ════════════════════════════════════════════════════════════════════════
//  Wrapped in Chaos/Укутанный в Хаос (wdbc-1rno) — Foundry-обвязка поверх
//  module/rules/wrapped-in-chaos.mjs. Группа A: "4-5" Дымовая Завеса.
//  "7" Мухи — не здесь: она бьёт АТАКУЮЩЕГО, поэтому реализована прямым
//  чтением цели в module/sheets/attack-dialog.mjs (тот же приём, что уже
//  даёт Цель Повалена/Оглушена), не кнопкой на этом предмете.
// ════════════════════════════════════════════════════════════════════════

import { wrappedInChaosKindByLabel, TAINTED_BLADE_ADDED_FLAG, isWrappedInChaosItem,
         REALITY_RENDING_EXCLUDED_FLAG } from "../rules/wrapped-in-chaos.mjs";
import { placeSmokeZone, getTerrainInfoForToken } from "../regions/difficult-terrain.mjs";
import { blastCircleShape, pxPerMeter } from "../combat/templates.mjs";
import { tokenCenter } from "../combat/facing.mjs";
import { applyWoundLoss } from "../rules/wounds.mjs";
import { isCapabilityAvailable, markCapabilityUsed } from "../rules/cooldown.mjs";
import { tokensWithinRadius } from "../rules/aoe-target.mjs";
import { wearsGasProtection } from "../rules/predicates.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";

const SMOKE_RADIUS_M = 5;
const SHADOW_RADIUS_M = 10;
const SHADOW_THROTTLE_FLAG = "wrappedInChaosShadowTeleport";
const SWEET_MIST_RADIUS_M = 3;
const SWEET_MIST_DURATION_SECONDS = 3 * 60 * 60; // 3 часа игрового времени

/** "4-5" Дымовая Завеса — полудействие, шаблон Smoke(5) (тот же примитив, что у оружейного свойства Дым). */
async function activateSmokeScreen(actor, item) {
  const shape = blastCircleShape(SMOKE_RADIUS_M, pxPerMeter());
  const region = await placeSmokeZone(shape, "Дымовая Завеса");
  if (!region) return; // отменено размещение

  await postTestCard(actor, {
    icon: rollIcon("run", "#8fb0c4"),
    title: `Укутанный в Хаос — ${esc(item.name)}`,
    lines: [
      `<div class="roll-threshold">Дымовая завеса Smoke(${SMOKE_RADIUS_M}) размещена.</div>`,
      `<div class="roll-threshold" style="opacity:.8;">Персонажи с Cor 30+ видят сквозь неё как через чистый воздух — не автоматизировано (в системе нет движка видимости вообще ни для чего).</div>`
    ]
  }, { sound: false });
}

/** Диалог выбора рукопашного оружия — «клинковое» система не классифицирует отдельно, выбор свободный. */
async function promptBlade(blades) {
  const opts = blades.map(w => `<option value="${w.id}">${esc(w.name)}</option>`).join("");
  const content = `<div class="wh-attack-form">
    <div class="atk-dlg-row"><label>Оружие:</label><select id="ooc-blade">${opts}</select></div>
    <div class="sq-hint">1 непоглощ. урона себе → это оружие получает свойство Tainted до конца боя (книга: 12 Раундов — округлено, в системе нет счётчика Раундов для временных свойств оружия).</div>
  </div>`;
  return foundry.applications.api.DialogV2.wait({
    window: { title: "Укутанный в Хаос: Осквернённый Клинок" },
    classes: ["warhammer-dbc", "wh-holo", "wh-attack-dialog"],
    content,
    rejectClose: false,
    buttons: [
      { action: "ok", label: "Осквернить", icon: "fas fa-droplet", default: true,
        callback: (event, button) => String(button.form.querySelector("#ooc-blade").value || "") },
      { action: "cancel", label: "Отмена", callback: () => null }
    ]
  });
}

/** "10" Осквернённый Клинок — 1 непоглощ. урона себе → выбранному рукопашному оружию Tainted (до конца боя). */
async function activateTaintedBlade(actor, item) {
  const blades = [...(actor.items ?? [])].filter(i => i.type === "weapon" && i.system?.weaponClass === "melee" && !i.system?.destroyed);
  if (!blades.length) return ui.notifications?.warn("Осквернённый Клинок: нет рукопашного оружия, чтобы осквернить.");

  const weaponId = await promptBlade(blades);
  if (!weaponId) return;
  const weapon = blades.find(w => w.id === weaponId);
  if (!weapon) return;

  const { currentWounds, newWounds, newCritical, gotCritical } = await applyWoundLoss(actor, 1);

  const already = (weapon.system.weaponProps ?? []).some(p => p.key === "tainted");
  if (!already) {
    await weapon.update({ "system.weaponProps": [...(weapon.system.weaponProps ?? []), { key: "tainted" }] });
    await weapon.setFlag("warhammer-dbc", TAINTED_BLADE_ADDED_FLAG, true);
  }

  await postTestCard(actor, {
    icon: rollIcon("blood", "#8b1a1a"),
    title: `Укутанный в Хаос — ${esc(item.name)}`,
    lines: [
      `<div class="roll-threshold">1 непоглощ. урона себе (Раны ${currentWounds}→${newWounds}${gotCritical ? `, крит. ${newCritical}` : ""}).</div>`,
      `<div class="roll-threshold">«${esc(weapon.name)}» дымится тьмой — свойство Tainted до конца боя.</div>`
    ]
  }, { sound: false });
}

/**
 * Точка телепортации — интерактивное размещение (тот же механизм клика по
 * холсту, что уже даёт placeSmokeZone, regions/difficult-terrain.mjs):
 * временный маркер-регион ставится игроком, координаты снимаются, регион
 * тут же удаляется — первый примитив телепортации в проекте (wdbc-1rno,
 * по прямому запросу пользователя строить его, а не оставлять текстом).
 */
async function pickTeleportPoint() {
  if (!canvas?.ready) return null;
  const region = await canvas.regions.placeRegion({
    name: "Точка Тени",
    shapes: [{ type: "circle", x: 0, y: 0, radius: 1 }]
  });
  if (!region) return null; // ГМ/игрок отменил размещение (ПКМ)
  const shape = region.shapes?.[0];
  const point = shape ? { x: shape.x, y: shape.y } : null;
  await region.delete();
  return point;
}

/**
 * "1" Тень — раз в Раунд за свободное действие телепорт в точку облака
 * (радиус 10м от текущей позиции), только в темноте. Троттлинг — свой,
 * НЕ общий Constructor-throttle диспетчера (тот один на все 10 субмутаций
 * этой Мутации, а "раз в Раунд" нужно только этой одной).
 */
async function activateShadowTeleport(actor, item, tokenDoc) {
  if (!tokenDoc?.parent) return ui.notifications?.warn("Тень: нет токена на сцене — телепортировать некого.");
  if (!getTerrainInfoForToken(tokenDoc).props.some(p => p.key === "dark")) {
    return ui.notifications?.warn("Тень: персонаж не в темноте — облака дыма нет (на свету оно исчезает).");
  }
  if (!isCapabilityAvailable(actor, SHADOW_THROTTLE_FLAG, "round")) {
    return ui.notifications?.warn("Тень: уже использована в этом Раунде — раз в Ход.");
  }

  const point = await pickTeleportPoint();
  if (!point) return; // отменено размещение

  const center = tokenCenter(tokenDoc);
  const distM = Math.hypot(point.x - center.x, point.y - center.y) / pxPerMeter();
  if (distM > SHADOW_RADIUS_M) {
    return ui.notifications?.warn(`Тень: точка дальше ${SHADOW_RADIUS_M}м — вне облака дыма.`);
  }

  const size = canvas.grid.size;
  await tokenDoc.update({
    x: point.x - ((Number(tokenDoc.width) || 1) * size) / 2,
    y: point.y - ((Number(tokenDoc.height) || 1) * size) / 2
  });
  await markCapabilityUsed(actor, SHADOW_THROTTLE_FLAG, "round");

  await postTestCard(actor, {
    icon: rollIcon("run", "#8fb0c4"),
    title: `Укутанный в Хаос — ${esc(item.name)}`,
    lines: [`<div class="roll-threshold">Разбился на клубы дыма и собрался в новом месте (${Math.round(distM)}м).</div>`]
  }, { sound: false });
}

/**
 * "6" Сладкий Туман (только slaanesh) — газ радиусом 3м, снимок в момент
 * активации (не длящаяся зона — тот же снимок-приём, что уже даёт Жар
 * Гнева/Мухи по духу: находки этого тикета не заводят новую живую Зону
 * ради одной субмутации). Респиратор/Противогаз (Головной слот) — иммунитет.
 * Условие sweetMistExpiresAt снимается по worldTime — sweepSweetMistExpiry
 * ниже, зовётся из ТОГО ЖЕ Hooks.on("updateWorldTime", …), что уже двигает
 * виджет Календаря (warhammer-dbc.mjs, по прямому указанию пользователя).
 */
async function activateSweetMist(actor, item, tokenDoc) {
  const targets = [actor];
  if (tokenDoc?.parent) {
    for (const t of tokensWithinRadius(tokenDoc, SWEET_MIST_RADIUS_M, { includeSelf: false })) {
      if (t.actor) targets.push(t.actor);
    }
  }

  const affected = [];
  for (const a of targets) {
    if (wearsGasProtection(a)) continue;
    affected.push(a);
    await a.update({
      "system.conditions.sweetMist": true,
      "system.conditions.sweetMistExpiresAt": game.time.worldTime + SWEET_MIST_DURATION_SECONDS
    });
  }

  await postTestCard(actor, {
    icon: rollIcon("run", "#ff8ad1"),
    title: `Укутанный в Хаос — ${esc(item.name)}`,
    lines: [affected.length
      ? `<div class="roll-threshold">Вдохнули Сладкий Туман: ${affected.map(a => esc(a.name)).join(", ")} — −10 на тесты W (до −20 vs Charm), 3 часа.</div>`
      : `<div class="roll-threshold">Все в радиусе ${SWEET_MIST_RADIUS_M}м защищены Респиратором/Противогазом — газ никого не задел.</div>`]
  }, { sound: false });
}

/**
 * Снятие Сладкого Туман по истечении worldTime — зовётся из хука
 * updateWorldTime (warhammer-dbc.mjs), рядом с checkCalendarWatchTriggers/
 * refreshCalendarWidget: та же точка входа, что уже двигает виджет
 * Календаря, отдельного нового хука не завожено. GM-гейт тот же приём,
 * что уже есть у checkCalendarWatchTriggers (apps/imperial-calendar.mjs) —
 * только основной активный ГМ чистит, не каждый подключённый клиент.
 */
export async function sweepSweetMistExpiry(worldTime) {
  if (!game.users?.activeGM || game.user?.id !== game.users.activeGM.id) return;
  for (const actor of game.actors ?? []) {
    const expiresAt = Number(actor.system?.conditions?.sweetMistExpiresAt) || 0;
    if (!actor.system?.conditions?.sweetMist || !expiresAt || worldTime < expiresAt) continue;
    await actor.update({ "system.conditions.sweetMist": false, "system.conditions.sweetMistExpiresAt": 0 });
  }
}

/** Кнопка «Активировать» — диспетчер по выпавшей субмутации. */
export async function activateWrappedInChaos(actor, item, token) {
  if (!actor) return;
  const tokenDoc = token?.document ?? token;
  const label = item.system?.submutation?.label || "";
  const kind = wrappedInChaosKindByLabel(label);
  if (kind === "smokeScreen") return activateSmokeScreen(actor, item);
  if (kind === "taintedBlade") return activateTaintedBlade(actor, item);
  if (kind === "shadow") return activateShadowTeleport(actor, item, tokenDoc);
  if (kind === "sweetMist") return activateSweetMist(actor, item, tokenDoc);
  return ui.notifications?.warn(label
    ? `Укутанный в Хаос: субмутация «${label}» пока не подключена кодом (wdbc-1rno, в разработке).`
    : "Укутанный в Хаос: субмутация ещё не брошена — сначала бросьте субмутацию на предмете.");
}

/**
 * "9" Рассечение Реальности — «может усилием воли стабилизировать часть
 * пространства, исключив до W.b союзников из эффекта» — не разовая
 * активация, а НАСТРОЙКА постоянно действующей ауры (realityRendingPenalty,
 * module/rules/wrapped-in-chaos.mjs, читается на каждый расчёт входящего
 * урона), поэтому кнопка на листе предмета, тем же приёмом, что apps/
 * organ-of-chaos.mjs (настройка при выдаче/по желанию, не боевое действие
 * через общий диспетчер выше).
 */
async function promptExcluded(candidates, current) {
  const opts = candidates.map(a =>
    `<label class="drug-fx-cb-label"><input type="checkbox" value="${a.uuid}" ${current.includes(a.uuid) ? "checked" : ""}/> ${esc(a.name)}</label>`
  ).join("<br>");
  const content = `<div class="wh-attack-form">
    <div class="atk-dlg-row" style="align-items:flex-start;"><label>Исключить (до W.b):</label>
      <div id="rr-excluded">${opts || "<i>Нет других персонажей на сцене.</i>"}</div></div>
  </div>`;
  return foundry.applications.api.DialogV2.wait({
    window: { title: "Укутанный в Хаос: Рассечение Реальности" },
    classes: ["warhammer-dbc", "wh-holo", "wh-attack-dialog"],
    content,
    rejectClose: false,
    buttons: [
      {
        action: "ok", label: "Сохранить", icon: "fas fa-shield", default: true,
        callback: (event, button) => [...button.form.querySelectorAll("#rr-excluded input:checked")].map(el => el.value)
      },
      { action: "cancel", label: "Отмена", callback: () => null }
    ]
  });
}

/** Нажатие кнопки на листе Мутации — выбор исключённых союзников. */
export async function useStabilizeRealityRending(actor, item) {
  if (!isWrappedInChaosItem(item) || wrappedInChaosKindByLabel(item.system?.submutation?.label) !== "realityRending") return;
  const candidates = [...(game.actors ?? [])].filter(a => a.uuid !== actor?.uuid && a.getActiveTokens?.(false, true)?.length);
  const current = item.getFlag("warhammer-dbc", REALITY_RENDING_EXCLUDED_FLAG) || [];
  const picked = await promptExcluded(candidates, current);
  if (!Array.isArray(picked)) return; // отмена — DialogV2.wait может отдать литерал action, не null
  await item.setFlag("warhammer-dbc", REALITY_RENDING_EXCLUDED_FLAG, picked);
}

/** Кнопка/статус для листа предмета — пусто, если это не «Рассечение Реальности». */
export function stabilizeRealityRendingButtonHtml(item) {
  if (!isWrappedInChaosItem(item) || wrappedInChaosKindByLabel(item.system?.submutation?.label) !== "realityRending") return "";
  const excluded = item.getFlag("warhammer-dbc", REALITY_RENDING_EXCLUDED_FLAG) || [];
  const status = excluded.length ? `Исключено: <b>${excluded.length}</b>` : "Никто не исключён.";
  return `<div class="hand-of-death-panel">
    <div class="hand-of-death-status">${status}</div>
    <button type="button" class="stabilize-reality-rending-btn" data-item-id="${item.id}">
      ${rollIcon("run", "#8fb0c4")}Стабилизировать (выбрать исключённых)
    </button>
  </div>`;
}
