// module/sheets/elite-picker.mjs
//
// Элитные архетипы в шапке листа (корбук 91): подбор подходящих расе, пикер и
// дополнительные поля (кнопка «+» рядом с основным архетипом). Поле остаётся
// текстовым — свой архетип всегда можно вписать руками.
//
// Функции принимают актора, а не лист: список подходящих зависит только от расы
// и субрасы, поэтому проверяется без Foundry.

import { ELITE_ARCHETYPES } from "../constants/elite-archetypes.mjs";
import { esc } from "../helpers/utils.mjs";

// Метки рас из книги → ключи рас и субрас листа.
const RACE_LABELS = {
  "Космодесантник": ["astartes"],
  "Человек":        ["human", "ogryn", "ratling", "navigator", "squat"],
  // Метка «Друкхари» покрывает и субрасы — так сказано в книге.
  "Друкхари":       ["drukhari", "truebornDrukhari", "mandrake", "wrack"],
  "Друкхари Истиннорожденный": ["truebornDrukhari"],
  "Сслит":          ["sslyth"],
  "Мандрагора":     ["mandrake"],
  "Развалина":      ["wrack"]
};

/** Подходит ли метка расы элитного архетипа расе персонажа. */
export function eliteRaceMatch(actor, entry) {
  const r = String(entry.race || "Любая");
  if (/люб/i.test(r)) return true;
  const race = actor.system.race || "";
  const sub  = actor.system.subrace || "";
  // Метка может перечислять несколько рас через запятую.
  return r.split(/[,/]/).some(part => {
    const keys = RACE_LABELS[part.trim()];
    if (!keys) return false;
    return keys.includes(race) || keys.includes(sub);
  });
}

/**
 * Пикер элитных архетипов: подходящие сверху, остальные — под спойлером.
 * extraIndex — индекс в system.eliteArchetypesExtra (доп. поля из шапки,
 * кнопка «+»); без него пишет в основное system.eliteArchetype.
 */
export function openElitePicker(actor, extraIndex = null) {
  const cur = extraIndex == null
    ? (actor.system.eliteArchetype || "")
    : (actor.system.eliteArchetypesExtra?.[extraIndex] || "");
  const fit = [], rest = [];
  for (const e of ELITE_ARCHETYPES) (eliteRaceMatch(actor, e) ? fit : rest).push(e);

  const card = (e, dim) => `
    <button type="button" class="ep-item ${dim ? "dim" : ""} ${e.name === cur ? "on" : ""}"
            data-name="${e.name}">
      <span class="ep-name">${e.name}</span>
      <span class="ep-meta">${e.race}${e.god ? " · " + e.god : ""}</span>
      <span class="ep-req">${e.req || ""}</span>
    </button>`;

  const dlg = new Dialog({
    title: "Элитный архетип",
    content: `<form class="wh-elite-picker">
      <input type="text" class="ep-search" placeholder="Поиск по названию или требованиям…"/>
      <div class="ep-sec">Доступные расе (${fit.length})</div>
      <div class="ep-list">${fit.map(e => card(e, false)).join("") || '<div class="ep-none">Для этой расы записей нет — впишите свой архетип вручную.</div>'}</div>
      ${rest.length ? `<details class="ep-rest"><summary>Прочие архетипы (${rest.length}) — требования не выполнены</summary>
        <div class="ep-list">${rest.map(e => card(e, true)).join("")}</div></details>` : ""}
      <div class="ep-custom">
        <label>Свой архетип</label>
        <input type="text" class="ep-own" value="${esc(cur)}" placeholder="Название своего элитного архетипа"/>
        <button type="button" class="ep-own-set">Записать</button>
      </div>
    </form>`,
    buttons: { close: { label: "Закрыть" } },
    default: "close",
    render: html => {
      const put = async (name) => {
        if (extraIndex == null) {
          await actor.update({ "system.eliteArchetype": name });
        } else {
          const arr = foundry.utils.deepClone(actor.system.eliteArchetypesExtra || []);
          arr[extraIndex] = name;
          await actor.update({ "system.eliteArchetypesExtra": arr });
        }
        dlg.close();
      };
      html.find(".ep-item").click(ev => put(ev.currentTarget.dataset.name));
      html.find(".ep-own-set").click(() => put(html.find(".ep-own").val().trim()));
      html.find(".ep-own").on("keydown", ev => {
        if (ev.key === "Enter") { ev.preventDefault(); put(ev.currentTarget.value.trim()); }
      });
      html.find(".ep-search").on("input", ev => {
        const q = ev.currentTarget.value.trim().toLowerCase();
        html.find(".ep-item").each((_, el) => {
          el.classList.toggle("ep-hidden", !!q && !el.textContent.toLowerCase().includes(q));
        });
      });
    }
  }, { classes: ["dialog", "warhammer-dbc", "wh-holo"], width: 560, height: 620 });
  dlg.render(true);
}

/**
 * Шапка листа: основной архетип открывается пикером, доп. архетипы — простой
 * текстовый список поверх system.eliteArchetype (тот остаётся первым/главным).
 */
export function activateEliteListeners(html, actor) {
  html.find(".elite-pick-btn").click(() => openElitePicker(actor));

  const getExtra = () => foundry.utils.deepClone(actor.system.eliteArchetypesExtra || []);
  html.find(".elite-add-btn").click(async ev => {
    ev.preventDefault();
    const arr = getExtra(); arr.push("");
    await actor.update({ "system.eliteArchetypesExtra": arr });
  });
  html.find(".elite-extra-input").on("change", async ev => {
    const i = parseInt(ev.currentTarget.dataset.index);
    const arr = getExtra(); if (arr[i] === undefined) return;
    arr[i] = ev.currentTarget.value;
    await actor.update({ "system.eliteArchetypesExtra": arr });
  });
  html.find(".elite-extra-remove").click(async ev => {
    ev.preventDefault();
    const i = parseInt(ev.currentTarget.dataset.index);
    const arr = getExtra(); arr.splice(i, 1);
    await actor.update({ "system.eliteArchetypesExtra": arr });
  });
  html.find(".elite-extra-pick-btn").click(ev =>
    openElitePicker(actor, parseInt(ev.currentTarget.dataset.index)));
}
