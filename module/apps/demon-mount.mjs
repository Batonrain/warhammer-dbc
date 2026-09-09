// module/apps/demon-mount.mjs
// ════════════════════════════════════════════════════════════════════════
//  Демон-скакун «Рыцаря Бога» вселён в СКАКУНА/ТЕХНИКУ (wdbc-1rno) — третий
//  книжный исход общего noTest-ритуала (см. module/data/item/ritual.mjs::
//  asMount), рядом с asMinion (Истинная Форма — новый Актор-Миньон,
//  module/apps/demon-summon.mjs) и asWeapon (Инфернальный Оруженосец в
//  оружие, module/apps/armiger-weapon.mjs).
//
//  НЕ переиспользует случайную таблицу Осквернения (module/constants/
//  mount-possession.mjs::rollMountProperty, module/apps/veil.mjs::
//  _defileApplyMount) — та таблица завязана на бросок и Связывание (степени
//  успеха демона), а этот ритуал — noTest, без броска вовсе. Книга даёт
//  фиксированное число КАЖДОМУ Богу, поэтому здесь прямая запись
//  flags.warhammer-dbc.mountPossession (та же СТРУКТУРА флага — совместимость
//  с уже читающим её rules/mount.mjs), а не бросок по таблице.
//
//  Бестиарий скрыт от игрока (ownership.PLAYER:"NONE") — Inf демона узнаёт
//  только ГМ, поэтому тот же приём, что у armiger-weapon.mjs: ГМ — напрямую,
//  иначе сокет-релей (action:"bindDemonMount", обработчик — warhammer-dbc.mjs).
//
//  Освобождение демона из скакуна/техники книга НЕ описывает явно (в отличие
//  от оружия Оруженосца, где прямо сказано «оружие всегда уничтожается») —
//  намеренно не реализовано, см. module/constants/capabilities.mjs.
// ════════════════════════════════════════════════════════════════════════

import { findBestiaryActor } from "./demon-summon.mjs";
import { addExtraDamageDie } from "../constants/demon-weapon.mjs";

/** Демоны-скакуны книги — все низшие демонические звери (W.b неважен здесь: бонусы фиксированы числом, не формулой от W.b демона). */
const MELEE_CLASS = "melee";

function shieldItemData(name, ratingMax = 50) {
  return {
    name, type: "forcefield", img: "systems/warhammer-dbc/assets/item-icons/forcefield.svg",
    system: {
      description: "", notes: "", shieldNature: "warp", shieldType: "dome",
      ratingMin: 1, ratingMax, overloadThreshold: 0, currentRating: ratingMax,
      isSpecialRating: false, equipped: true, status: "active", quality: "best",
      availability: 0, weight: 0
    }
  };
}

/**
 * Вселить демона-скакуна Рыцаря Бога в существующего скакуна/технику
 * персонажа (mountUuid — Актор, а не embedded-предмет: скакун/техника всегда
 * отдельный Актор, module/rules/mount.mjs). `riderActor` — сам Ритуалист,
 * нужен только Тзинчу (щит достаётся ОБОИМ).
 * @returns {Promise<{ok:boolean, reason?:string, mountName?:string}>}
 */
export async function bindDemonMount(mountUuid, riderActor, demonName, god = "undivided") {
  const mount = await fromUuid(mountUuid).catch(() => null);
  if (!mount) return { ok: false, reason: "Скакун/машина не выбраны или не найдены — демон остался в Истинной Форме." };
  if (mount.flags?.["warhammer-dbc"]?.mountPossession) {
    return { ok: false, reason: "Этот скакун уже одержим." };
  }

  const src = await findBestiaryActor(demonName);
  const demonInf = src?.system?.characteristics?.inf?.total ?? 0;

  const mountPossession = {
    god, demonName, binding: 0, demonInf,
    // Демон-скакун Рыцаря Бога служит добровольно (проза Дара — «даёт в
    // услужение»), тот же subdued:true, что у демон-Оруженосца в оружии.
    subdued: true, properties: []
  };

  const update = { "flags.warhammer-dbc.mountPossession": mountPossession };

  if (god === "khorne") {
    // +8 AP от стрелковых атак — читается module/combat/damage.mjs (только
    // против !melee); доп. кубик урона Тарана — module/combat/vehicle.mjs.
    mountPossession.apRanged = 8;
    mountPossession.ramExtraDie = true;
    // Доп. кубик урона на РУКОПАШНЫЕ атаки — бьёт по профилю уже имеющегося
    // на скакуне/технике оружия ближнего боя (Рога/Копыта Джаггернаута и
    // т.п.), не по оружию всадника: это атака самого скакуна/машины.
    const meleeWeapons = (mount.items ?? []).filter(i => i.type === "weapon" && (i.system?.weaponClass || MELEE_CLASS) === MELEE_CLASS);
    for (const w of meleeWeapons) {
      await w.update({ "system.damage": addExtraDamageDie(w.system.damage) });
    }
  } else if (god === "nurgle") {
    // +7 Ран или Структуры (в зависимости от природы сосуда) — фикс 7,
    // не рандомное +10 Осквернения (module/apps/veil.mjs::_defileApplyMount).
    if (mount.type === "vehicle") {
      const s = mount.system.structure ?? {};
      update["system.structure.max"] = (Number(s.max) || 0) + 7;
      update["system.structure.value"] = (Number(s.value) || 0) + 7;
    } else {
      const w = mount.system.wounds ?? {};
      update["system.wounds.max"] = (Number(w.max) || 0) + 7;
      update["system.wounds.value"] = (Number(w.value) || 0) + 7;
    }
    // Авто-прохождение Трудного Ландшафта верхом — читает module/combat/
    // mount.mjs::showMountTerrainDialog (module/rules/mount.mjs::mountAutoTerrain).
    mountPossession.autoTerrain = true;
  } else if (god === "slaanesh") {
    // +20 на тесты управления — уже отдельная запись kind:"testMod" на самой
    // Мутации (не трогаем); здесь только пометка одержимости для совместимости
    // с isPossessed()/possessionOf() и честной подписи в интерфейсе скакуна.
  } else if (god === "tzeentch") {
    // Не перегружающийся чародейский щит-купол 1-50 — И скакуну/технике, И
    // всаднику (module/data/item/forcefield.mjs), тот же профиль, что у
    // готовых Даров с похожей прозой (module/combat/preservation.mjs,
    // module/sheets/demon-prince-sheet.mjs::_buildGiftItems).
    await mount.createEmbeddedDocuments("Item", [shieldItemData(`Чародейский Купол Тзинча (${mount.name})`)]);
    if (riderActor) {
      await riderActor.createEmbeddedDocuments("Item", [shieldItemData(`Чародейский Купол Тзинча (${demonName || "Диск Тзинча"})`)]);
    }
  }

  await mount.update(update);
  return { ok: true, mountName: mount.name };
}

/** ГМ — напрямую; иначе сокет-релей (обработчик — warhammer-dbc.mjs, action:"bindDemonMount"). */
export async function defaultBindDemonMountFn(mountUuid, riderActor, demonName, god) {
  if (!mountUuid || !demonName) return;
  if (game.user?.isGM) {
    const res = await bindDemonMount(mountUuid, riderActor, demonName, god);
    if (!res.ok) ui.notifications?.warn(res.reason);
    return;
  }
  if (!game.users?.activeGM) {
    ui.notifications?.warn("Нет активного Мастера — скакун/техника не осквернены, свяжите демона вручную во вкладке «Осквернение».");
    return;
  }
  game.socket?.emit("system.warhammer-dbc",
    { action: "bindDemonMount", userId: game.user?.id, mountUuid, riderUuid: riderActor?.uuid || "", demonName, god });
}
