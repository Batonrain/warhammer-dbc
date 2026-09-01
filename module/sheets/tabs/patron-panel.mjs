// module/sheets/tabs/patron-panel.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Блок «ПАТРОН» / «ПРОТЕЖЕ» на вкладке СОЦИУМ (субраса «Наследник», Трейт
//  Помазанник(X) Демона-Принца — races/Наследник, wdbc-yo6r).
//
//  Связь однонаправленная, как у Миньонов (system.masterUuid): смертный сам
//  хранит ссылку на патрона (system.anointed.uuid), а Демон-Принц отдельного
//  списка не хранит — его сторону блок строит по уже оформленным дарам
//  «Помазанник» в system.dp.gifts (targetUuid выбирается при покупке дара,
//  см. demon-prince-sheet.mjs:_buyGift/_pickProtege). Рейтинг X живёт там же,
//  в самом экземпляре дара — это источник истины, а не поле на смертном.
//
//  Пока актора Принца в мире нет (или дар ещё не куплен), смертный может
//  «застолбить» патрона текстом (имя + Бог) — уточняется потом перетаскиванием
//  актора в ту же зону.
// ════════════════════════════════════════════════════════════════════════════

import { DP_GODS } from "../../constants/demon-prince.mjs";
import { rootEl } from "../v2-helpers.mjs";

const godLabel = key => DP_GODS.find(g => g.key === key)?.label || "";

/** Экземпляр дара «Помазанник» на данном Демоне-Принце, нацеленный на actorUuid. */
function anointedGiftFor(dp, actorUuid) {
  const gifts = Array.isArray(dp?.system?.dp?.gifts) ? dp.system.dp.gifts : [];
  return gifts.find(g => g.key === "anointed" && g.targetUuid === actorUuid) || null;
}

/** Контекст блока: своя ветка для смертного (протеже) и для Демона-Принца (патрон). */
export function patronPanelContext(actor, actors = []) {
  if (actor.type === "demonPrince") {
    const gifts = Array.isArray(actor.system?.dp?.gifts) ? actor.system.dp.gifts : [];
    const anointedGifts = gifts.filter(g => g.key === "anointed");

    const proteges = anointedGifts.map(g => {
      const protege = g.targetUuid ? actors.find(a => a?.uuid === g.targetUuid) : null;
      return {
        giftId: g.id, uuid: g.targetUuid || "",
        name: protege?.name || (g.targetUuid ? "(актор недоступен)" : "(цель не выбрана)"),
        img: protege?.img || "icons/svg/mystery-man.svg",
        rating: g.x || 0, missing: !!g.targetUuid && !protege
      };
    });

    // Смертные, что сами вписали этого Принца патроном, но дара под них ещё
    // не оформлено, — не в счёт Фавора, только заявка на виду у ГМа.
    const pending = actors.filter(a =>
      a?.type === "character" && a.system?.anointed?.uuid === actor.uuid &&
      !anointedGifts.some(g => g.targetUuid === a.uuid)
    ).map(a => ({ uuid: a.uuid, name: a.name, img: a.img, rating: a.system.anointed.rating || 0 }));

    return { patronAvailable: true, isProtegeList: true, proteges, patronPending: pending };
  }

  if (actor.type !== "character") return { patronAvailable: false };

  const state = actor.system?.anointed ?? {};
  const dp = state.uuid ? actors.find(a => a?.uuid === state.uuid && a.type === "demonPrince") : null;
  const gift = dp ? anointedGiftFor(dp, actor.uuid) : null;

  return {
    patronAvailable: true, isProtegeList: false,
    patronLinked: !!state.uuid,
    patronActor: dp ? { uuid: dp.uuid, name: dp.name, img: dp.img, godLabel: godLabel(dp.system?.allegiance) } : null,
    patronStub: { name: state.name || "", godKey: state.godKey || "" },
    patronGods: DP_GODS.map(g => ({ key: g.key, label: g.label, selected: g.key === state.godKey })),
    patronConfirmed: !!gift,
    patronRating: gift ? (gift.x || 0) : (state.rating || 0)
  };
}

// ── Правка связи (сторона смертного) ────────────────────────────────────────

/** Привязать смертного к актору Демона-Принца (drag-drop, как setMount). */
export async function setPatronActor(actor, target) {
  if (!target) return;
  if (target.type !== "demonPrince") {
    return ui.notifications?.warn("Патроном может быть только Демон-Принц.");
  }
  if (target.uuid === actor.uuid) return;
  await actor.update({
    "system.anointed.uuid": target.uuid,
    "system.anointed.name": target.name,
    "system.anointed.godKey": target.system?.allegiance || ""
  });
}

/** Снять связь целиком — заглушку тоже, чтобы не путать со старым патроном. */
export async function clearPatronActor(actor) {
  await actor.update({
    "system.anointed.uuid": "", "system.anointed.name": "",
    "system.anointed.godKey": "", "system.anointed.rating": 0
  });
}

export async function setPatronStub(actor, { name, godKey } = {}) {
  const upd = {};
  if (name !== undefined) upd["system.anointed.name"] = name;
  if (godKey !== undefined) upd["system.anointed.godKey"] = godKey;
  if (Object.keys(upd).length) await actor.update(upd);
}

export async function setPatronRating(actor, value) {
  await actor.update({ "system.anointed.rating": Math.max(0, Number(value) || 0) });
}

// ── Слушатели ────────────────────────────────────────────────────────────────

export function activatePatronPanelListeners(root, actor, { editable = true } = {}) {
  const el = rootEl(root);
  if (!el?.querySelector) return;

  el.querySelectorAll(".patron-open-link").forEach(node =>
    node.addEventListener("click", () => {
      if (!node.dataset.uuid) return;
      fromUuid(node.dataset.uuid).then(d => d?.sheet?.render(true)).catch(() => {});
    }));

  if (!editable) return;

  el.querySelectorAll(".patron-clear-btn").forEach(node =>
    node.addEventListener("click", () => clearPatronActor(actor)));

  el.querySelectorAll(".patron-name-input").forEach(node =>
    node.addEventListener("change", ev => setPatronStub(actor, { name: ev.currentTarget.value })));

  el.querySelectorAll(".patron-god-select").forEach(node =>
    node.addEventListener("change", ev => setPatronStub(actor, { godKey: ev.currentTarget.value })));

  el.querySelectorAll(".patron-rating-input").forEach(node =>
    node.addEventListener("change", ev => setPatronRating(actor, ev.currentTarget.value)));

  // Зона переноса: актора Демона-Принца перетаскивают из боковой панели или со сцены.
  const zone = el.querySelector(".patron-drop-zone");
  if (!zone) return;
  zone.addEventListener("dragover", ev => { ev.preventDefault(); zone.classList.add("social-drop-hover"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("social-drop-hover"));
  zone.addEventListener("drop", async ev => {
    ev.preventDefault();
    ev.stopPropagation();
    zone.classList.remove("social-drop-hover");
    let data = null;
    try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch { /* не наш дроп */ }
    if (!data?.uuid) return;
    const doc = await fromUuid(data.uuid).catch(() => null);
    await setPatronActor(actor, doc?.documentName === "Token" ? doc.actor : doc);
  });
}
