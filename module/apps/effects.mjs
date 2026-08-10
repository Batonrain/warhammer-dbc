// module/apps/effects.mjs
// ════════════════════════════════════════════════════════════════════════
//  Вкладка «Эффекты» на листе предмета — общая для всех типов.
//  Каждый эффект — стандартный embedded ActiveEffect Foundry; вкладка
//  создаёт/удаляет/переключает их (компендиум-библиотека warhammer-dbc.
//  effects, из которой раньше был готовый пикер, — удалена: всё авторится
//  через единый Конструктор, см. module/apps/mechanics.mjs).
// ════════════════════════════════════════════════════════════════════════

/**
 * Активен ли предмет прямо сейчас (по его собственным полям состояния) —
 * т.е. должны ли его эффекты (и связанные выдачи — см. syncGrantedEquipment
 * в mechanics.mjs) действовать. Разные типы «активны» по-разному: оружие/
 * броня — когда снаряжены, мод — когда установлен на носитель (и, если он
 * включаемый, ещё и включён), психосила/сила навигатора — пока поддержи-
 * вается (или пассивна), имплант — когда хирургически установлен И не
 * неисправен (flags.warhammer-dbc.installed/disabled — те же флаги, что
 * читает gate в module/documents/actor.mjs для старой системы эффектов, и
 * что переключает .geneseed-state-select в actor-sheet.mjs). Прочие типы
 * (таланты, черты и т.п.) эффектов не выключают в принципе — там нет
 * отдельного «активен ли предмет», эффект действует всегда, пока предмет
 * на акторе.
 */
export function isItemActive(item) {
  const sys = item.system || {};
  switch (item.type) {
    case "weapon": case "armor": return !!sys.equipped;
    case "armorMod": case "weaponMod":
      return !!sys.installedOn && (!sys.activatable || !!sys.active);
    case "psychicPower": return !!sys.isSustained;
    case "techPower": return !!sys.sustained || sys.miracleType === "passive";
    case "navigatorPower": return !!sys.isSustained;
    case "implant":
      return !!item.getFlag("warhammer-dbc", "installed") && !item.getFlag("warhammer-dbc", "disabled");
    default: return true;
  }
}

/**
 * Синхронизирует `disabled` у ВСЕХ эффектов предмета с его текущим активным
 * состоянием (экипировка/установка/sustain — см. isItemActive). Вызывается
 * после любого update, меняющего это состояние. Импланты Геносемени решают
 * это отдельно через свой собственный флаг "disabled" (см. actor-sheet.mjs,
 * .geneseed-state-select) — тоже через эту функцию, но с явным override.
 */
export async function syncItemEffectsDisabled(item, activeOverride) {
  const active = activeOverride !== undefined ? activeOverride : isItemActive(item);
  const updates = item.effects.contents
    .filter(fx => fx.disabled === active)
    .map(fx => ({ _id: fx.id, disabled: !active }));
  if (updates.length) await item.updateEmbeddedDocuments("ActiveEffect", updates);
}

/**
 * Создаёт на предмете новый пустой ActiveEffect (одна строка changes,
 * фаза сразу "final" — иначе GM, забывший переключить фазу в редакторе,
 * получит эффект, который «не работает») и открывает его штатный лист.
 */
export async function createBlankEffect(item) {
  const [fx] = await item.createEmbeddedDocuments("ActiveEffect", [{
    name: "Новый эффект", icon: item.img,
    system: { changes: [{ key: "", type: "add", value: "", phase: "final", priority: 0 }] }
  }]);
  fx?.sheet?.render(true);
  return fx;
}

