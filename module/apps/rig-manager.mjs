// ════════════════════════════════════════════════════════════════════════
//  Разгрузка — окно размещения предметов по слотам (Warhammer DBC).
//  Слотовая модель: разгрузки (gear с isRig) дают именованные слоты фикс-
//  размера; предмет кладётся в слот, если помещается по размеру. Рюкзаки —
//  контейнеры (любой предмет, доставание = полное действие). Размещение
//  хранится на акторе во флаге warhammer-dbc.stowage = { itemId: location }.
// ════════════════════════════════════════════════════════════════════════

import { STOWABLE_TYPES, itemSizeStr, fits, expandSlots, isContainerRig, RIG_COMFORT_HINT,
         RIG_VARIANT_FLAG } from "../constants/rig.mjs";
import { ITEM_TYPES } from "../constants/items.mjs";

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
    const actor = this.actor;
    if (!actor) return { missing: true };
    const stow = this.actor.getFlag(NS, FLAG) || {};
    const items = actor.items;

    const stowable = items.filter(i => STOWABLE_TYPES.includes(i.type));
    const rigs = items.filter(i => i.type === "gear" && i.system?.isRig);

    // Занятые локации (для списка «не размещено»).
    const locOf = (id) => stow[id];
    const validLocs = new Set();

    const wt = (i) => Number(i.system?.weight) || 0;
    const wsum = (arr) => Math.round(arr.reduce((a, i) => a + wt(i), 0) * 100) / 100;

    const rigViews = rigs.map(rig => {
      const comfort = rig.system?.rig?.comfort || "normal";
      const comfortHint = RIG_COMFORT_HINT[comfort] || "";
      const canQuickDraw = comfort === "normal";        // неудобные не дают Quick Draw
      const backSlot = !!rig.system?.rig?.backSlot;
      if (isContainerRig(rig)) {
        const loc = `bp:${rig.id}`;
        const inBp = stowable.filter(i => locOf(i.id) === loc);
        validLocs.add(loc);
        const contents = inBp.map(i => ({ id: i.id, name: i.name, size: itemSizeStr(i), weight: wt(i) }));
        const addable = stowable
          .filter(i => i.id !== rig.id && !_isValidLoc(locOf(i.id), rigs))
          .map(i => ({ id: i.id, name: i.name, size: itemSizeStr(i) }));
        return { id: rig.id, name: rig.name, container: true, comfortHint, canQuickDraw, backSlot,
          contents, addable, count: contents.length, weight: wsum(inBp) };
      }
      const inRig = [];
      const slots = expandSlots(rig).map(sl => {
        validLocs.add(sl.id);
        const occId = Object.keys(stow).find(iid => stow[iid] === sl.id);
        const occ = occId ? items.get(occId) : null;
        if (occ) inRig.push(occ);
        // Свободные предметы, что влезают в слот. Считаются и для занятого
        // слота: заменить лежащее должно быть можно одним выбором, не убирая
        // предмет заранее.
        const opts = stowable
          .filter(i => i.id !== rig.id && i.id !== occ?.id
                    && !_isValidLoc(locOf(i.id), rigs) && fits(itemSizeStr(i), sl.size))
          .map(i => ({ id: i.id, name: i.name, size: itemSizeStr(i) }));
        return { id: sl.id, size: sl.size, note: sl.note, isMag: sl.isMag,
          awkward: sl.awkward, variants: sl.variants,
          item: occ ? { id: occ.id, name: occ.name, weight: wt(occ) } : null, opts };
      });
      return { id: rig.id, name: rig.name, container: false, comfortHint, canQuickDraw, backSlot,
        slots, count: inRig.length, total: slots.length, weight: wsum(inRig),
        isMagAny: slots.some(s => s.isMag) };
    });

    // Не размещено: стоуимые предметы без валидной локации.
    const unassigned = stowable
      .filter(i => !_isValidLoc(locOf(i.id), rigs))
      .map(i => ({ id: i.id, name: i.name, type: ITEM_TYPES[i.type] || i.type, size: itemSizeStr(i), weight: wt(i) }))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));

    // Спину можно занять только одной разгрузкой — предупреждаем при конфликте.
    const backCount = rigs.filter(r => r.system?.rig?.backSlot).length;

    return {
      actorName: actor.name, hasRigs: rigViews.length > 0, rigs: rigViews, unassigned,
      backConflict: backCount > 1,
      unassignedWeight: wsum(stowable.filter(i => !_isValidLoc(locOf(i.id), rigs)))
    };
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
  }
}

// Валидна ли локация (слот существующей разгрузки или её рюкзак).
function _isValidLoc(loc, rigs) {
  if (!loc) return false;
  if (loc.startsWith("bp:")) return rigs.some(r => r.id === loc.slice(3));
  const rigId = loc.split(":")[0];
  return rigs.some(r => r.id === rigId);
}

export function openRigManager(actor) {
  if (!actor) return null;
  const app = new RigManager(actor);
  app.render(true);
  return app;
}
