// module/combat/clear-jam.mjs
// ════════════════════════════════════════════════════════════════════════════
//  РАСКЛИН (стр. 35, wdbc-x1nz.2.52): «Действие: Полное действие. Тип:
//  Физическое, Ментальное. Персонаж делает тест на Tech-Use+0 или
//  Trade(Weaponsmith)+0. В случае Успеха он снимает Клин с оружия.»
//
//  Раньше «Расклинить» снимало Клин мгновенно и без броска (см. историю
//  git у weapon-properties.mjs::clearWeaponJam) — честно признанное
//  упрощение, теперь заменённое настоящим тестом.
//
//  Выбор навыка не спрашивается диалогом: игрок физически не выигрывает от
//  выбора худшего варианта («+0 ИЛИ +0» — книга не даёт причины взять то,
//  что хуже), поэтому берётся автоматически лучший из двух, как читерский
//  диалог-на-диалоге тут не нужен (тот же принцип «минимум ручного счёта»,
//  что у charSwapWhy/лучшего Кубика в других местах). Ситуативные модификаторы
//  (collectTestMods) сейчас умеют разбирать только плоские Навыки — для
//  Trade(Weaponsmith) берётся голый total группового Навыка без них: под
//  Trade(Weaponsmith) в реестре правил пока нет ни одной находки, которая
//  требовала бы обратного.
//
//  ВОССТАНОВЛЕНИЕ ПАТРОНОВ (стр. 41, wdbc-x1nz.2.61): отдельная, не связанная
//  с Расклином механика — Клин портит 2×RoF патронов в магазине (module/
//  combat/attack.mjs), они уходят в system.jammedAmmo и возвращаются в
//  magazineCur тестом Trade(Weaponsmith)+10 вне боя (rollRestoreJammedAmmo
//  ниже) — без ОД, без гейта на активный энкаунтер, и это ТОЛЬКО этот навык,
//  не «или Tech-Use», как у самого Расклина.
// ════════════════════════════════════════════════════════════════════════════

import { canClearJam } from "./weapon-properties.mjs";
import { spendActionPoints } from "./action-economy.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";

/** Запись Trade(Weaponsmith)/Оружейник в групповых Навыках актора, если она есть. */
function tradeWeaponsmithEntry(actor) {
  const list = Array.isArray(actor?.system?.groupSkills?.trade) ? actor.system.groupSkills.trade : [];
  return list.find(e => /weaponsmith|оружейник/i.test(e.specialty || e.name || "")) || null;
}

/** Лучший из Tech-Use/Trade(Weaponsmith) — сам расчёт, без броска (для превью/тестов). */
export function clearJamOption(actor) {
  const techUse = actor?.system?.skills?.techUse?.total ?? -20;
  const ws = tradeWeaponsmithEntry(actor);
  const wsTotal = ws ? (Number(ws.total) || 0) : null;
  if (wsTotal != null && wsTotal > techUse) {
    return { skillKey: "trade", label: `Trade (${ws.specialty || ws.name})`, base: wsTotal };
  }
  return { skillKey: "techUse", label: "Tech-Use", base: techUse };
}

/**
 * «Расклин»: Полное действие (2 ОД), тест Tech-Use+0 или Trade(Weaponsmith)+0
 * (автовыбор лучшего). Успех снимает Клин; провал тратит действие впустую —
 * книга не даёт иных последствий провала.
 */
export async function rollClearJam(actor, item) {
  if (!actor || !item?.system?.jammed) return;
  if (!canClearJam(item)) {
    return ui.notifications?.warn(`${item.name}: заклинивание пока не расклинить — заблокировано до конца этого Раунда.`);
  }
  if (!await spendActionPoints(actor, 2, { physical: true })) {
    return ui.notifications?.warn("⚠️ Не хватает ОД на Расклин (Полное действие).");
  }

  const { skillKey, label, base } = clearJamOption(actor);
  const ruleMods = skillKey === "techUse"
    ? collectTestMods(actor, { kind: "skill", skill: "techUse", char: "int" })
    : { total: 0, parts: [] };
  const threshold = base + ruleMods.total;

  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const success = rv <= threshold;
  if (success) await item.update({ "system.jammed": false, "system.jamLockedRound": 0 });

  const dice = await roll.render();
  await postTestCard(actor, {
    icon: rollIcon("wrench", "#c9a86a"),
    title: `${esc(actor.name)} — Расклин: ${esc(item.name)}`,
    threshold: rollStatLine({ label, base, parts: ruleMods.parts, threshold, rv }),
    outcome: success
      ? outcomeHtml(true, "Успех — Клин снят")
      : outcomeHtml(false, "Провал — оружие всё ещё заклинено"),
    sections: [
      `<details class="roll-dice-details"><summary>${rollIcon("wrench", "#c9a86a")}Показать кубы</summary>${dice}</details>`
    ]
  }, { rolls: [roll] });
}

/**
 * Восстановление патронов, испорченных Клином (стр. 41, wdbc-x1nz.2.61):
 * тест Trade(Weaponsmith)+10 — в отличие от Расклина выше, ТОЛЬКО этот
 * навык (книга не даёт альтернативы Tech-Use), и вне боя — не Полное
 * действие, ОД не тратятся, чинится между стычками, не гейтуется энкаунтером.
 * Успех возвращает всё system.jammedAmmo обратно в magazineCur (не выше
 * magazineMax); провал ничего не портит дальше — просто патроны остаются
 * испорченными до следующей попытки.
 */
export async function rollRestoreJammedAmmo(actor, item) {
  if (!actor || !item || !(Number(item.system?.jammedAmmo) > 0)) return;

  const ws = tradeWeaponsmithEntry(actor);
  const base = ws ? (Number(ws.total) || 0) : -20;
  const label = `Trade (${ws?.specialty || ws?.name || "Weaponsmith"})`;
  const threshold = base + 10;

  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const success = rv <= threshold;
  if (success) {
    const sys = item.system;
    const restored = Number(sys.jammedAmmo) || 0;
    const newMag = Math.min(sys.magazineMax || 0, (sys.magazineCur || 0) + restored);
    await item.update({ "system.jammedAmmo": 0, "system.magazineCur": newMag });
  }

  const dice = await roll.render();
  await postTestCard(actor, {
    icon: rollIcon("wrench", "#c9a86a"),
    title: `${esc(actor.name)} — Восстановление патронов: ${esc(item.name)}`,
    threshold: rollStatLine({ label, base, parts: ["+10"], threshold, rv }),
    outcome: success
      ? outcomeHtml(true, "Успех — испорченные Клином патроны восстановлены")
      : outcomeHtml(false, "Провал — патроны всё ещё испорчены"),
    sections: [
      `<details class="roll-dice-details"><summary>${rollIcon("wrench", "#c9a86a")}Показать кубы</summary>${dice}</details>`
    ]
  }, { rolls: [roll] });
}
