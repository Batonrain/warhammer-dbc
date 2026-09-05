// module/combat/movement-terrain.mjs
// ════════════════════════════════════════════════════════════════════════
//  Трудный Ландшафт (пехота) — тест A+0 при Беге/Натиске через зону,
//  стр. 29 корбука. Модификатор ландшафта берётся автоматически из
//  Region Behavior под токеном (module/regions/difficult-terrain.mjs).
//  Кнопка вызова — в меню токена (Token HUD), по образцу «Облик токена»
//  (module/apps/token-variants.mjs). Аналог для Техники — showTerrainDialog
//  в module/combat/vehicle.mjs (своя таблица штрафов, своя механика урона).
// ════════════════════════════════════════════════════════════════════════

import { _degWord, esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, thresholdLine, outcomeHtml } from "../helpers/test-card.mjs";
import { getTerrainInfoForToken } from "../regions/difficult-terrain.mjs";
import { getItemMechanics } from "../apps/mechanics.mjs";
import { entryWhenOk } from "../rules/mech-when.mjs";
import { isBlindedActor } from "../rules/predicates.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";

const sgn = (n) => `${n >= 0 ? "+" : ""}${n}`;

// ─── Иммунитет к отдельным свойствам ландшафта (kind:"terrainIgnore") ─────
// Живой скан предметов актора — ничего не кэшируется отдельно, см. коммент
// в шапке mechanics.mjs про kind:"terrainIgnore".
function ignoredTerrainKeysForActor(actor) {
  const keys = new Set();
  if (!actor) return keys;
  for (const item of actor.items) {
    for (const group of getItemMechanics(item)) {
      for (const entry of group.entries || []) {
        if (entry.kind !== "terrainIgnore") continue;
        if (!entryWhenOk(actor, entry, item)) continue;
        for (const k of entry.ignoreTerrainProps || []) keys.add(k);
      }
    }
  }
  return keys;
}

/**
 * Модификатор трудного ландшафта под токеном ПОСЛЕ вычета свойств, которые
 * актор игнорирует (Механика предмета, kind:"terrainIgnore"), и с учётом
 * Ослепления (стр. 30-31, wdbc-r5o7.4): «весь незнакомый ландшафт — Трудный
 * +0» (тест нужен даже вне реальной зоны, но без доп. штрафа) и «−20 против
 * настоящего Трудного Ландшафта» (доп. штраф ТОЛЬКО когда актор и так уже в
 * зоне — Ослепление не создаёт зону там, где её нет, оно делает трудным то,
 * что уже трудно, ЕЩЁ трудней).
 * @returns {{inTerrain: boolean, mod: number, labels: string[], ignoredLabels: string[]}}
 */
function effectiveTerrainInfo(tokenDoc, actor) {
  const raw = getTerrainInfoForToken(tokenDoc);
  const ignored = ignoredTerrainKeysForActor(actor);
  const active = raw.props.filter(p => !ignored.has(p.key));
  const skipped = raw.props.filter(p => ignored.has(p.key));
  const blinded = isBlindedActor(actor);
  const blindedPenalty = (blinded && raw.inTerrain) ? -20 : 0;
  return {
    inTerrain: raw.inTerrain || blinded,
    // Настоящая зона под токеном (Region), в отличие от Ослепления, которое
    // лишь ОБЯЗЫВАЕТ тестировать — сама по себе SPD не режет (та половина
    // уже посчитана отдельно, rules/character.mjs, для Поваленного; у
    // Ослепления в книге такого пункта нет). Нужно только для текста
    // подсказки ниже (showDifficultTerrainDialog) — не путать игрока, что
    // SPD «уже уменьшена зоной», когда зоны физически нет.
    realTerrain: raw.inTerrain,
    blinded,
    mod: active.reduce((s, p) => s + p.mod, 0) + raw.extraMod + blindedPenalty,
    labels: [...active.map(p => p.label), ...(blindedPenalty ? ["Ослеплён (−20)"] : blinded ? ["Ослеплён"] : [])],
    ignoredLabels: skipped.map(p => p.label)
  };
}

// ─── Тест Трудного Ландшафта (Бег/Натиск через зону) ──────────────────────
// A+0 со штрафом ландшафта зоны + ручная поправка. Провал → падение
// (для пехоты книга не формализует урон от падения — оставлено ГМу).
export async function showDifficultTerrainDialog(actor, tokenDoc = null) {
  if (!actor) return;
  const td = tokenDoc || actor.getActiveTokens()[0]?.document;
  if (!td) return ui.notifications.warn("⚠️ Токен персонажа не найден на сцене.");

  const info = effectiveTerrainInfo(td, actor);
  const ag   = Number(actor.system.characteristics?.ag?.total) || 0;
  const labelsLine = info.labels.length ? ` (${info.labels.join(", ")})` : "";
  const ignoredLine = info.ignoredLabels.length
    ? `<div class="atk-range-info" style="font-size:0.82em;">Игнорирует: ${info.ignoredLabels.join(", ")}</div>` : "";

  new Dialog({
    title: "Трудный Ландшафт",
    content: `
      <form class="wh-vehicle-dialog" style="padding:6px;">
        <div class="atk-dlg-row"><label>Ловкость (Ag):</label><input id="tr-ag" type="number" value="${ag}"/></div>
        <div class="atk-dlg-row"><label>Ландшафт зоны:</label><span>${sgn(info.mod)}${labelsLine}</span></div>
        <div class="atk-dlg-row"><label>Доп. мод:</label><input id="tr-mod" type="number" value="0"/></div>
        ${ignoredLine}
        <div class="atk-range-info" style="font-size:0.82em;">
          Бег/Натиск через трудный ландшафт — тест A+0 или падение (стр. 29).${info.realTerrain
            ? " SPD уже уменьшена вдвое зоной."
            : info.blinded
              ? " Ослеплён считает незнакомый ландшафт Трудным — тест нужен, даже когда сама зона не размечена."
              : ""}
        </div>
      </form>`,
    buttons: {
      roll: { icon: '<i class="fas fa-dice-d10"></i>', label: "Тест!",
        callback: async html => {
          const agVal = parseInt(html.find("#tr-ag").val()) || 0;
          const md    = parseInt(html.find("#tr-mod").val()) || 0;
          await _resolveDifficultTerrain(actor, agVal, info.mod, md, info.labels);
        } },
      cancel: { label: "Отмена" }
    },
    default: "roll"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 420 }).render(true);
}

async function _resolveDifficultTerrain(actor, ag, terrainMod, extraMod, labels) {
  const totalMod  = terrainMod + extraMod;
  // Общий сбор модификаторов (wdbc-1xtl): Порог складывался из Ловкости,
  // модификатора ландшафта и ручной поправки — ни Усталости, ни Перевеса,
  // ни Черт. Диалога с галочками у броска нет, поэтому collectTestMods.
  const ruleMods  = collectTestMods(actor, { kind: "skill", char: "ag" });
  const threshold = ag + totalMod + ruleMods.total;

  const roll   = await new Roll("1d100").evaluate();
  const rv     = roll.total;
  const passed = rv <= threshold;
  const deg    = Math.floor(Math.abs(passed ? threshold - rv : rv - threshold) / 10) + 1;

  const outcome = passed
    ? outcomeHtml(true,  `Успех — ${deg} ${_degWord(deg)}. Устоял на ногах.`)
    : outcomeHtml(false, `Провал — ${deg} ${_degWord(deg)}. Персонаж падает!`);

  // Слагаемые Порога — в скобки общего формата (thresholdLine): раньше здесь
  // рядом стояли и суммарный модификатор, и его разбор, теперь только разбор.
  const parts = [
    `ландшафт ${sgn(terrainMod)}${labels.length ? `: ${labels.join(", ")}` : ""}`,
    extraMod ? `доп. мод ${sgn(extraMod)}` : ""
  ];

  await postTestCard(actor, {
    icon: rollIcon("burst","#b0a080"), title: `Трудный Ландшафт — ${esc(actor.name)}`,
    threshold: thresholdLine({ label: "Ag", base: ag, parts, threshold }),
    rv, outcome
  }, { rolls: [roll] });
}

// ─── Кнопка в меню токена ──────────────────────────────────────────────────
// Показывается владельцу/ГМу, когда токен реально стоит в зоне «Трудный
// ландшафт» — ИЛИ актор Ослеплён (стр. 30-31, wdbc-r5o7.4: весь незнакомый
// ландшафт становится Трудным для него, даже вне настоящей зоны). Техника
// ведёт свой Трудный Ландшафт через отдельное меню (вираж/urban), поэтому
// здесь не участвует.
export function initDifficultTerrainHud() {
  Hooks.on("renderTokenHUD", (hud, html, data) => {
    const tokenDoc = hud.object?.document;
    const actor    = tokenDoc?.actor;
    if (!actor || actor.type === "vehicle") return;

    const info = effectiveTerrainInfo(tokenDoc, actor);
    if (!info.inTerrain) return;

    const isGM = game.user.isGM;
    const owns = actor.isOwner;
    if (!isGM && !owns) return;

    const el = html instanceof HTMLElement ? html : html?.[0];
    if (!el) return;
    const col = el.querySelector(".col.left") || el.querySelector(".col-left")
             || el.querySelector(".left") || el;
    if (el.querySelector(".wh-terrain-btn")) return;   // без дублей при перерисовке

    const modTxt = sgn(info.mod);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "control-icon wh-terrain-btn";
    btn.dataset.action = "whDifficultTerrain";
    btn.title = `Трудный ландшафт (${modTxt}${info.labels.length ? `: ${info.labels.join(", ")}` : ""}) — тест Бега/Натиска`;
    btn.innerHTML = `<i class="fas fa-person-falling"></i><span class="wh-terrain-mod">${modTxt}</span>`;
    btn.addEventListener("click", ev => {
      ev.preventDefault();
      ev.stopPropagation();
      showDifficultTerrainDialog(actor, tokenDoc);
    });
    col.appendChild(btn);
  });
}
