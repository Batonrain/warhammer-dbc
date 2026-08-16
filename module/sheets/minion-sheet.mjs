// module/sheets/minion-sheet.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Лист МИНЬОНА (корбук стр. 111-113) — тот же лист персонажа, но короче.
//
//  Убрано то, чего у слуги не бывает: Архетип и Элитный архетип, Родной мир,
//  Предсказание и три Стремления. Судьбу Миньона определяет не биография, а
//  Талант Хозяина, и половина шапки персонажа у него стояла бы пустой.
//
//  Добавлено то, что есть только у него: Лояльность (значение и максимум идут
//  от Характеристики Хозяина, стр. 113), Сила и Группа Миньона, и аватар
//  Хозяина — клик по нему открывает его лист.
//
//  Вкладки остаются от персонажа: Характеристики, Навыки, снаряжение и Трейты
//  у слуги обычные, и переписывать их незачем. Своих Миньонов у Миньона не
//  бывает, поэтому СОЦИУМ ему тоже показывается — но блок Миньонов там пуст.
// ════════════════════════════════════════════════════════════════════════════

import { WarhammerCharacterSheet } from "./actor-sheet.mjs";
import { whenEditable, onTab, filePicker } from "./v2-helpers.mjs";
import { MINION_GROUPS, MINION_TIERS, MINION_TIER_ORDER } from "../constants/minions.mjs";
import { minionLoyalty, speechNote } from "../rules/minion-build.mjs";

/** Клик по аватару Хозяина открывает его лист. */
async function onOpenMaster() {
  const uuid = this.actor.system?.masterUuid;
  if (!uuid) return ui.notifications?.warn("Хозяин не назначен.");
  const master = await fromUuid(uuid).catch(() => null);
  if (!master) return ui.notifications?.warn("Хозяин не найден — возможно, лист удалён.");
  master.sheet?.render(true);
}

/** Кнопка «🔄» у Лояльности: перечитать её у Хозяина. */
async function onSyncLoyalty() {
  const master = await fromUuid(this.actor.system?.masterUuid || "").catch(() => null);
  if (!master) return ui.notifications?.warn("Хозяин не назначен или не найден.");
  const base = minionLoyalty(master, this.actor.system?.minionType);
  if (!base) return ui.notifications?.warn("У Миньона не выбрана группа — не от чего считать Лояльность.");
  await this.actor.update({ "system.loyalty.max": base, "system.loyalty.value": base });
}

function onAvatar() {
  const FP = filePicker();
  return new FP({ type: "image", current: this.actor.img, callback: p => this._setAvatar(p) }).render(true);
}

export class WarhammerMinionSheet extends WarhammerCharacterSheet {
  static DEFAULT_OPTIONS = {
    classes: ["warhammer-dbc", "sheet", "actor", "minion-sheet"],
    position: { width: 820, height: 860 },
    actions: {
      tab: onTab,
      minionAvatar:      whenEditable(onAvatar),
      minionOpenMaster:  onOpenMaster,
      minionSyncLoyalty: whenEditable(onSyncLoyalty)
    }
  };

  static PARTS = {
    body: {
      template: "systems/warhammer-dbc/templates/actor/minion-sheet.hbs",
      root: true,
      scrollable: [".sheet-body", ".skills-advance-scroll"]
    }
  };

  // «РАЗВИТИЕ» у Миньона своё: опыт он получает только если Превосходящий
  // (треть за сессию, стр. 113), а обычный слуга не растёт вовсе. Вкладку
  // оставляем — там же живут купленные Таланты и Навыки, — но Стремлений и
  // Архетипа в ней нет, их не показывает шапка.
  static TABS = {
    primary: {
      initial: "stats",
      tabs: [
        { id: "stats",     label: "ПОКАЗАТЕЛИ" },
        { id: "combat",    label: "БОЙ" },
        { id: "effects",   label: "ТЕЛО" },
        { id: "abilities", label: "СПОСОБНОСТИ" },
        { id: "psy",       label: "ПСИ" },
        { id: "gear",      label: "СНАРЯЖЕНИЕ" },
        { id: "advance",   label: "РАЗВИТИЕ" },
        { id: "notes",     label: "ЗАПИСИ" }
      ]
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const s = this.actor.system ?? {};

    const group = s.minionType || "";
    const tier  = s.minionTier || "";
    const master = await fromUuid(s.masterUuid || "").catch(() => null);

    context.minion = {
      group, tier,
      groupLabel: MINION_GROUPS[group]?.label || "—",
      tierLabel:  MINION_TIERS[tier]?.label   || "—",
      groupOptions: Object.entries(MINION_GROUPS)
        .map(([key, def]) => ({ key, label: def.label, selected: key === group })),
      tierOptions: MINION_TIER_ORDER
        .map(key => ({ key, label: MINION_TIERS[key].label, selected: key === tier })),
      loyalty: { value: s.loyalty?.value ?? 0, max: s.loyalty?.max ?? 0 },
      // Лояльность идёт от Характеристики Хозяина и меняется вместе с ней —
      // подпись показывает, от какой именно, чтобы кнопка «🔄» не выглядела
      // произволом.
      loyaltyFrom: MINION_GROUPS[group]?.masterChar?.toUpperCase() || "",
      isHorde: !!MINION_TIERS[tier]?.isHorde,
      magnitude: { value: s.magnitude?.value ?? 0, max: s.magnitude?.max ?? 0 },
      speech: speechNote({
        fel: s.characteristics?.fel?.total,
        int: s.characteristics?.int?.total
      }),
      master: master
        ? { uuid: master.uuid, name: master.name, img: master.img }
        : null
    };

    return context;
  }
}
