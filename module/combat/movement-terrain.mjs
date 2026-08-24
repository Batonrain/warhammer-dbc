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
import { getTerrainInfoForToken } from "../regions/difficult-terrain.mjs";
import { getItemMechanics } from "../apps/mechanics.mjs";
import { entryWhenOk } from "../rules/mech-when.mjs";

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
 * актор игнорирует (Механика предмета, kind:"terrainIgnore").
 * @returns {{inTerrain: boolean, mod: number, labels: string[], ignoredLabels: string[]}}
 */
function effectiveTerrainInfo(tokenDoc, actor) {
  const raw = getTerrainInfoForToken(tokenDoc);
  const ignored = ignoredTerrainKeysForActor(actor);
  const active = raw.props.filter(p => !ignored.has(p.key));
  const skipped = raw.props.filter(p => ignored.has(p.key));
  return {
    inTerrain: raw.inTerrain,
    mod: active.reduce((s, p) => s + p.mod, 0) + raw.extraMod,
    labels: active.map(p => p.label),
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
          Бег/Натиск через трудный ландшафт — тест A+0 или падение (стр. 29). SPD уже уменьшена вдвое зоной.
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
  const threshold = ag + totalMod;

  const roll   = await new Roll("1d100").evaluate();
  const rv     = roll.total;
  const passed = rv <= threshold;
  const deg    = Math.floor(Math.abs(passed ? threshold - rv : rv - threshold) / 10) + 1;

  const outcome = passed
    ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}. Устоял на ногах.</span>`
    : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}. Персонаж падает!</span>`;

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("burst","#b0a080")}Трудный Ландшафт — ${esc(actor.name)}</div>
        <div class="roll-threshold">
          Ag <b>${ag}</b> ${sgn(totalMod)} (ландшафт ${sgn(terrainMod)}${labels.length ? `: ${labels.join(", ")}` : ""}${extraMod ? `, доп. мод ${sgn(extraMod)}` : ""}) → Порог <b>${threshold}</b>
        </div>
        <div class="roll-dice">${rollIcon("dice","#6fe6ff")}1d100: <b>${rv}</b></div>
        <div class="roll-outcome">${outcome}</div>
      </div>`,
    rolls: [roll], sound: CONFIG.sounds.dice
  }, game.settings.get("core", "rollMode")));
}

// ─── Кнопка в меню токена ──────────────────────────────────────────────────
// Показывается владельцу/ГМу, только когда токен реально стоит в зоне
// «Трудный ландшафт». Техника ведёт свой Трудный Ландшафт через отдельное
// меню (вираж/urban), поэтому здесь не участвует.
export function initDifficultTerrainHud() {
  Hooks.on("renderTokenHUD", (hud, html, data) => {
    const tokenDoc = hud.object?.document;
    const actor    = tokenDoc?.actor;
    if (!actor || actor.type === "vehicle") return;

    const raw = getTerrainInfoForToken(tokenDoc);
    if (!raw.inTerrain) return;
    const info = effectiveTerrainInfo(tokenDoc, actor);

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
