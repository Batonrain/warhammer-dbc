// module/sheets/hull-picker.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Выбор Корпуса корабля из библиотеки — открывается кликом по слоту «Корпус»
//  в шапке листа корабля. Второй путь к тому же результату — перетащить
//  предмет типа shipHull из компендиума на лист (ship-sheet.mjs::_onDropItem).
//
//  Окно говорит на языке остальных пикеров системы (wh-item-picker), как
//  sheets/race-picker.mjs — та же липкая шапка групп, поиск, раскрытие строки.
//
//  Строка показывает то, по чему Корпус выбирают: SP/HI/ARM/SPD/MN — не всю
//  простыню характеристик, остальное — в раскрытии.
// ════════════════════════════════════════════════════════════════════════════

import { hullGroupList, hullIdFromItem } from "../apps/ship-hull-library.mjs";
import { applyHull, actorHullItem } from "../apps/ship-hull.mjs";
import { esc } from "../helpers/utils.mjs";
import { centerPicker } from "./picker-ui.mjs";

/** SP/HI/ARM/SPD·MN одной строкой — то, по чему сравнивают корпуса. */
function hullMeta(h) {
  const hb = h.hull || {}, hc = h.chars || {};
  return `SP ${h.sp || 0} · HI ${hb.hullIntegrity || 0} · ARM ${hc.armour || 0} · `
       + `${hc.speed || 0} SPD/${hc.manoeuvrability >= 0 ? "+" : ""}${hc.manoeuvrability || 0} MN`;
}

/** Полная сетка характеристик + свойства — в раскрытии строки. */
function hullDetail(h) {
  const hb = h.hull || {}, hc = h.chars || {};
  const rows = [
    ["SPC", hb.spaceMax], ["P.Gen", hb.powerGen], ["T", hb.turnArc], ["WC", hb.weaponCapacity],
    ["DT", hc.detection], ["VS", hc.voidShields], ["TR", hc.turretRating]
  ].filter(([, v]) => v !== undefined && v !== "");
  const grid = rows.map(([k, v]) => `<span class="rp-char" title="${esc(k)}"><b>${esc(k)}</b>${esc(String(v))}</span>`).join("");
  const aspects = h.aspects ? `<p class="rp-desc-text">${esc(h.aspects)}</p>` : "";
  const desc = h.desc ? `<p class="rp-desc-text">${esc(h.desc)}</p>` : "";
  return (grid ? `<div class="rp-chars">${grid}</div>` : "") + aspects + desc;
}

function hullRows(currentId) {
  return hullGroupList().map(g => `
    <div class="pick-group">
      <div class="pick-group-head">${esc(g.label)} <span class="pick-count">${g.hulls.length}</span></div>
      <div class="pick-group-body">${g.hulls
        .sort((a, b) => (a.sp || 0) - (b.sp || 0))
        .map(h => `
    <div class="pick-row${h.id === currentId ? " rp-current" : ""}" data-key="${esc(h.id)}"
         data-name="${esc(h.name.toLowerCase())}">
      <div class="pick-head">
        <button type="button" class="pick-exp" title="Показать подробности">▸</button>
        <span class="pick-name rp-pick">${esc(h.name)}</span>
        <span class="pick-req">${esc(hullMeta(h))}</span>
        ${h.id === currentId
          ? `<span class="rp-current-mark" title="Сейчас выбран">✓</span>`
          : `<button type="button" class="pick-add rp-pick" title="Выбрать">＋</button>`}
      </div>
      <div class="pick-desc" style="display:none;">${hullDetail(h)}</div>
    </div>`).join("")}</div>
    </div>`).join("");
}

/** @param {Actor} actor */
export async function openHullPicker(actor) {
  const currentId = hullIdFromItem(actorHullItem(actor)) || "";
  const body = hullRows(currentId);
  const empty = !body.trim();

  await foundry.applications.api.DialogV2.wait({
    window: { title: "Выбор Корпуса" },
    classes: ["warhammer-dbc", "wh-holo", "wh-item-picker-dialog", "wh-race-picker"],
    position: { width: 560, height: 640 },
    content: `<div class="wh-item-picker">
      <input type="text" class="pick-search" placeholder="Поиск по названию…" autofocus/>
      <div class="pick-list">${body}</div>
      <div class="rp-empty" style="display:${empty ? "" : "none"};">
        ${empty ? "Библиотека корпусов не загружена или пуста." : "Ничего не найдено."}
      </div>
    </div>`,
    buttons: [{ action: "close", label: "Закрыть", default: true }],
    rejectClose: false,
    render: (_event, dialog) => {
      const root = dialog.element;

      const choose = async key => { dialog.close(); await applyHull(actor, key); };
      root.querySelectorAll(".rp-pick").forEach(el =>
        el.addEventListener("click", () => choose(el.closest(".pick-row").dataset.key)));

      root.querySelectorAll(".pick-exp").forEach(btn =>
        btn.addEventListener("click", () => {
          const desc = btn.closest(".pick-row").querySelector(".pick-desc");
          if (!desc) return;
          const open = desc.style.display !== "none";
          desc.style.display = open ? "none" : "";
          btn.textContent = open ? "▸" : "▾";
        }));

      root.querySelector(".pick-search")?.addEventListener("input", ev => {
        const q = ev.currentTarget.value.trim().toLowerCase();
        let shown = 0;
        root.querySelectorAll(".pick-row").forEach(el => {
          const hit = !q || el.dataset.name.includes(q);
          el.classList.toggle("pick-hidden", !hit);
          if (hit) shown++;
        });
        root.querySelectorAll(".pick-group").forEach(g => {
          const vis = g.querySelectorAll(".pick-row:not(.pick-hidden)").length;
          g.classList.toggle("pick-hidden", !vis);
          const c = g.querySelector(".pick-count");
          if (c) c.textContent = vis;
        });
        const emptyEl = root.querySelector(".rp-empty");
        if (emptyEl && !empty) emptyEl.style.display = shown ? "none" : "";
      });

      centerPicker(globalThis.$(root));
    }
  });
}
