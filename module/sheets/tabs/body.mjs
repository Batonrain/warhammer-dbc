// module/sheets/tabs/body.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Вкладка ТЕЛО: тип фигуры, окно имплантации, Жизненные потребности,
//  констатация смерти и сторона имплантов парных органов.
//  Функции принимают актора, а не лист.
// ════════════════════════════════════════════════════════════════════════════

import { openSurgeon } from "../../apps/surgeon.mjs";
import { syncItemEffectsDisabled } from "../../apps/effects.mjs";
import { syncGrantedEquipment } from "../../apps/mechanics.mjs";
import { on } from "../../helpers/utils.mjs";
import { showDeathSaveDialog, doResurrect } from "./death.mjs";
import { VITAL_TIME_FIELD } from "../../constants/vitals.mjs";
import { satisfyAddiction, setAddictionSubstance } from "../../rules/addiction.mjs";

/** Переключить фигуру муж./жен. Значение приходит из data-атрибута кнопки. */
export async function toggleBodyType(actor, current) {
  const next = current === "female" ? "male" : "female";
  await actor.setFlag("warhammer-dbc", "bodyType", next);
  return next;
}

/** Стадия Голода/Жажды/Сна — целое 0…3, за границы не выходит. */
export async function setVital(actor, key, value) {
  const v = Math.max(0, Math.min(3, Math.round(Number(value) || 0)));
  await actor.update({ [`system.vitals.${key}`]: v });
  return v;
}

export async function adjustVital(actor, key, delta) {
  const cur = Math.round(Number(actor.system.vitals?.[key]) || 0);
  return setVital(actor, key, cur + Number(delta));
}

/** «Поесть/Попить/Поспать»: стадия → 0 И метка времени → сейчас (wdbc-jnqj) —
 *  иначе автопрогресс по game.time.worldTime тут же снова поднимет стадию по
 *  старой метке (vitalEffectiveStage в constants/vitals.mjs). */
export async function satisfyVital(actor, key) {
  const field = VITAL_TIME_FIELD[key];
  const update = { [`system.vitals.${key}`]: 0 };
  if (field) update[`system.vitals.${field}`] = game.time?.worldTime ?? 0;
  await actor.update(update);
}

export async function setDeceased(actor, deceased) {
  await actor.setFlag("warhammer-dbc", "deceased", deceased);
}

// wdbc-ycgk.1: полный ре-рендер листа вставляет .bc-death-actions уже в
// конечном виде (показан/скрыт) — обычный CSS-transition на insert/remove
// сработать не успевает. Помним последнее состояние по актору и, если оно
// реально сменилось, на миг форсируем инлайн-стилем ПРОТИВОПОЛОЖНОЕ значение
// перед снятием — тогда браузеру есть от чего анимировать переход к тому,
// что уже задаёт CSS-класс .bc-death-actions--show.
const _lastDeceased = new WeakMap();
function animateDeathActions(root, actor, deceased) {
  const el = root.querySelector(".bc-death-actions");
  if (!el) return;
  const prev = _lastDeceased.get(actor);
  _lastDeceased.set(actor, deceased);
  if (prev === undefined || prev === deceased) return; // первый рендер/без смены — не анимируем
  el.style.transition = "none";
  if (deceased) {
    el.style.maxHeight = "0px"; el.style.opacity = "0";
    el.style.marginTop = "0px"; el.style.marginBottom = "0px";
  } else {
    el.style.maxHeight = "60px"; el.style.opacity = "1";
  }
  void el.offsetHeight; // форс рефлоу — иначе браузер схлопнёт оба присвоения в одно
  el.style.transition = "";
  requestAnimationFrame(() => {
    el.style.maxHeight = "";
    el.style.opacity = "";
    el.style.marginTop = "";
    el.style.marginBottom = "";
  });
}

/** Л/П для имплантов конечностей и глаз: повторный клик по той же стороне снимает её. */
export async function toggleImplantSide(item, side) {
  if (!item) return;
  if (item.getFlag("warhammer-dbc", "bodySide") === side) {
    await item.unsetFlag("warhammer-dbc", "bodySide");
  } else {
    await item.setFlag("warhammer-dbc", "bodySide", side);
  }
}

/** Подсказки при наведении на импланты фигуры — чистый DOM, актор не нужен. */
function attachImplantTooltips(figPanel) {
  let tipEl = figPanel.querySelector(".bc-imp-tip");
  if (!tipEl) {
    tipEl = document.createElement("div");
    tipEl.className = "bc-imp-tip";
    figPanel.appendChild(tipEl);
  }
  figPanel.querySelectorAll(".body-implants .imp-tipwrap[data-tip]").forEach(gEl => {
    gEl.addEventListener("mouseenter", () => {
      tipEl.textContent = gEl.getAttribute("data-tip");
      tipEl.classList.add("show");
    });
    gEl.addEventListener("mousemove", ev => {
      const r = figPanel.getBoundingClientRect();
      const x = Math.min(ev.clientX - r.left + 12, figPanel.clientWidth - 208);
      const y = Math.min(ev.clientY - r.top + 12, figPanel.clientHeight - 44);
      tipEl.style.left = Math.max(4, x) + "px";
      tipEl.style.top  = Math.max(4, y) + "px";
    });
    gEl.addEventListener("mouseleave", () => tipEl.classList.remove("show"));
  });
}

export function activateBodyListeners(root, actor, { openSurgeonWindow = openSurgeon } = {}) {
  on(root, ".bc-sex-toggle", "click", async ev => {
    ev.preventDefault();
    await toggleBodyType(actor, ev.currentTarget.dataset.bodytype || "male");
  });

  on(root, ".bc-surgeon-btn", "click", ev => {
    ev.preventDefault();
    openSurgeonWindow(actor);
  });

  on(root, "[data-vital-adj]", "click", ev => {
    ev.preventDefault();
    const b = ev.currentTarget;
    adjustVital(actor, b.dataset.vitalAdj, b.dataset.dir);
  });
  on(root, "[data-vital-reset]", "click", ev => {
    ev.preventDefault();
    satisfyVital(actor, ev.currentTarget.dataset.vitalReset);
  });

  // Зависимость (wdbc-5inv): «Удовлетворить» сбрасывает таймер, поле —
  // редактируемый объект зависимости (авто-подстановка идёт из submutation
  // только пока поле пустое, см. satisfyAddiction/rules/addiction.mjs).
  on(root, "[data-dep-satisfy]", "click", ev => {
    ev.preventDefault();
    const item = actor.items.get(ev.currentTarget.dataset.depSatisfy);
    if (item) satisfyAddiction(item);
  });
  on(root, "[data-dep-substance]", "change", ev => {
    const item = actor.items.get(ev.currentTarget.dataset.depSubstance);
    if (item) setAddictionSubstance(item, ev.currentTarget.value);
  });

  const figPanel = root.querySelector(".bc-figure-panel");
  if (figPanel) attachImplantTooltips(figPanel);

  // Плавное появление/скрытие блока Спасение/Воскресить (wdbc-ycgk.1) — до
  // прочих слушателей смерти, чтобы состояние «до» бралось не из уже
  // перерисованного DOM.
  animateDeathActions(root, actor, !!actor.getFlag?.("warhammer-dbc", "deceased"));

  // Констатация смерти — останавливает кардиомонитор (плоская линия).
  on(root, ".bc-death-toggle", "change", async ev => {
    await setDeceased(actor, ev.currentTarget.checked);
  });

  // Стр. 232-233 («Смерть»): Спасение — Чудесное/Божественная Защита/
  // Замедленная Анимация; Воскресить — без формулы, только пока «мёртв».
  on(root, ".bc-death-save-btn", "click", () => showDeathSaveDialog(actor));
  on(root, ".bc-resurrect-btn", "click", () => doResurrect(actor));

  on(root, ".bc-side-btn", "click", async ev => {
    ev.preventDefault();
    ev.stopPropagation();
    const el = ev.currentTarget;
    await toggleImplantSide(actor.items.get(el.dataset.itemId), el.dataset.side);
  });
}
