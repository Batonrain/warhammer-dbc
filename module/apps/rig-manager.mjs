// ════════════════════════════════════════════════════════════════════════
//  Разгрузка — окно размещения предметов по слотам (Warhammer DBC).
//  Слотовая модель: разгрузки (gear с isRig) дают именованные слоты фикс-
//  размера; предмет кладётся в слот, если помещается по размеру. Рюкзаки —
//  контейнеры (любой предмет, доставание = полное действие). Размещение
//  хранится на акторе во флаге warhammer-dbc.stowage = { itemId: location }.
// ════════════════════════════════════════════════════════════════════════

import { RIG_VARIANT_FLAG, rigManagerData } from "../constants/rig.mjs";

const { Application } = foundry.appv1.api;
const NS = "warhammer-dbc";
const FLAG = "stowage";

export class RigManager extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["warhammer-dbc", "wh-holo", "wh-rig"],
      template: "systems/warhammer-dbc/templates/apps/rig-manager.hbs",
      width: 640, height: 720, resizable: true,
      scrollY: [".wh-rig-scroll"]
    });
  }
  constructor(actor, options = {}) {
    super(options);
    this.actorId = actor.id;
    this.options.id = "wh-rig-" + actor.id;
  }
  get actor() { return game.actors.get(this.actorId); }
  get title() { return `Разгрузка — ${this.actor?.name || ""}`; }

  // ВАЖНО: update() рекурсивно МЕРЖИТ объекты флага, поэтому удаление ключа —
  // только через синтаксис `-=`, иначе «убрать из слота» не работает.
  async _assign(itemId, location) {
    const upd = { [`flags.${NS}.${FLAG}.${itemId}`]: location };
    // Слот вмещает один предмет: кладя новый, прежнего выкладываем. Рюкзак
    // (bp:) — контейнер, там соседи законны.
    if (!location.startsWith("bp:")) {
      const stow = this.actor.getFlag(NS, FLAG) || {};
      for (const [iid, loc] of Object.entries(stow))
        if (loc === location && iid !== itemId) upd[`flags.${NS}.${FLAG}.-=${iid}`] = null;
    }
    await this.actor.update(upd);
    this.render(false);
  }
  async _unassign(itemId) {
    await this.actor.update({ [`flags.${NS}.${FLAG}.-=${itemId}`]: null });
    this.render(false);
  }
  /**
   * Сменить вариант слота (кобура → ножны → петля). Лежащее в слоте выкладываем:
   * новый вариант может быть другого размера, и предмет в него уже не влезет.
   */
  async _setVariant(slotId, variantKey) {
    const rig = this.actor?.items?.get(String(slotId).split(":")[0]);
    if (!rig) return;
    await this._clearSlot(slotId);
    await rig.update({ [`flags.${NS}.${RIG_VARIANT_FLAG}.${slotId}`]: variantKey });
    this.render(false);
  }

  async _clearSlot(slotId) {
    const stow = this.actor.getFlag(NS, FLAG) || {};
    const upd = {};
    for (const [iid, loc] of Object.entries(stow)) if (loc === slotId) upd[`flags.${NS}.${FLAG}.-=${iid}`] = null;
    if (Object.keys(upd).length) { await this.actor.update(upd); this.render(false); }
  }

  getData() {
    if (!this.actor) return { missing: true };
    return rigManagerData(this.actor);
  }

  activateListeners(html) {
    super.activateListeners(html);
    const el = html[0] ?? html;
    // Назначить предмет в слот
    el.querySelectorAll("[data-slot-assign]").forEach(sel => sel.addEventListener("change", e => {
      const itemId = e.target.value; if (!itemId) return;
      this._assign(itemId, sel.dataset.slotAssign);
    }));
    // Убрать из слота
    el.querySelectorAll("[data-slot-clear]").forEach(b => b.addEventListener("click", () => this._clearSlot(b.dataset.slotClear)));
    // Сменить вариант слота (кобура → ножны → петля)
    el.querySelectorAll("[data-slot-variant]").forEach(sel => sel.addEventListener("change", e =>
      this._setVariant(sel.dataset.slotVariant, e.target.value)));
    // Добавить в рюкзак
    el.querySelectorAll("[data-bp-add]").forEach(sel => sel.addEventListener("change", e => {
      const itemId = e.target.value; if (!itemId) return;
      this._assign(itemId, `bp:${sel.dataset.bpAdd}`);
    }));
    // Достать (сделать не размещённым)
    el.querySelectorAll("[data-item-clear]").forEach(b => b.addEventListener("click", () => this._unassign(b.dataset.itemClear)));
    // Клик по зоне схемы силовой брони — подсветить и проскроллить к слотам той же зоны.
    el.querySelectorAll("[data-slot-region]").forEach(r => r.addEventListener("click", () => {
      const region = r.dataset.slotRegion;
      const rigEl = r.closest(".wr-rig");
      if (!rigEl) return;
      rigEl.querySelectorAll(".wr-slot.hl").forEach(s => s.classList.remove("hl"));
      const matches = [...rigEl.querySelectorAll(".wr-slot-note")].filter(n => n.textContent.trim() === region);
      matches.forEach(n => n.closest(".wr-slot")?.classList.add("hl"));
      matches[0]?.closest(".wr-slot")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }));
  }
}

export function openRigManager(actor) {
  if (!actor) return null;
  const app = new RigManager(actor);
  app.render(true);
  return app;
}
