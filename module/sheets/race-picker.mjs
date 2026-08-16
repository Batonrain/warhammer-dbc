// module/sheets/race-picker.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Выбор расы и субрасы из библиотеки — то, что открывается кликом по пустому
//  слоту в шапке листа. Второй путь к тому же результату — перетащить предмет
//  из компендиума; оба ведут в applyRace/applySubrace.
//
//  Субрасы показываются только свои: чужая раса всё равно была бы отклонена
//  применением, и предлагать её значит звать игрока на ошибку.
// ════════════════════════════════════════════════════════════════════════════

import { raceGroupList, subracesOf, raceDef } from "../apps/race-library.mjs";
import { applyRace, applySubrace } from "../apps/races.mjs";
import { esc } from "../helpers/utils.mjs";

const card = (key, name, meta) => `
  <button type="button" class="rp-item" data-key="${esc(key)}">
    <span class="rp-name">${esc(name)}</span>
    <span class="rp-meta">${esc(meta || "")}</span>
  </button>`;

/**
 * @param {Actor} actor
 * @param {{subrace?: boolean}} opts  subrace:true — выбор субрасы текущей расы
 */
export async function openRacePicker(actor, { subrace = false } = {}) {
  const raceKey = actor.system.race || "";

  let body;
  if (subrace) {
    const list = subracesOf(raceKey);
    if (!raceKey) return ui.notifications?.warn("Сначала выберите расу.");
    body = list.length
      ? `<div class="rp-list">${list.map(s => card(s.key, s.label, raceDef(raceKey)?.label)).join("")}</div>`
      : `<div class="rp-none">У расы «${esc(raceDef(raceKey)?.label || raceKey)}» субрас нет — впишите свою в поле под слотом.</div>`;
  } else {
    body = raceGroupList().map(g => `
      <div class="rp-sec">${esc(g.label)}</div>
      <div class="rp-list">${g.races.map(r => card(r.key, r.label, g.label)).join("")}</div>`).join("");
  }

  await foundry.applications.api.DialogV2.wait({
    window: { title: subrace ? "Субраса" : "Раса" },
    classes: ["warhammer-dbc", "wh-holo", "wh-race-picker"],
    position: { width: 520 },
    content: `<div class="rp-body">
      <input type="text" class="rp-search" placeholder="Поиск по названию…"/>
      ${body}
    </div>`,
    buttons: [{ action: "close", label: "Закрыть", default: true }],
    rejectClose: false,
    render: (_event, dialog) => {
      const root = dialog.element;
      root.querySelectorAll(".rp-item").forEach(btn =>
        btn.addEventListener("click", async () => {
          const key = btn.dataset.key;
          dialog.close();
          if (subrace) await applySubrace(actor, key);
          else await applyRace(actor, key);
        }));
      root.querySelector(".rp-search")?.addEventListener("input", ev => {
        const q = ev.currentTarget.value.trim().toLowerCase();
        root.querySelectorAll(".rp-item").forEach(el =>
          el.classList.toggle("rp-hidden", !!q && !el.textContent.toLowerCase().includes(q)));
      });
    }
  });
}
