// module/sheets/tabs/combat.mjs
//
// Вкладка БОЙ: состязательные приёмы, кнопка атаки у оружия, лечение, Очки
// Боли Друкхари и Стойка/База. Обычные Приёмы выбираются прямо в диалоге атаки
// (attack-dialog.mjs) и своих кнопок на этой вкладке не имеют — но Стойка/База
// персистентны на акторе (system.meleeStance/meleeBase), диалог их только
// читает как стартовое значение, поэтому свои кнопки здесь тоже есть (клик
// пишет то же поле, что и диалог — расхождения не будет).
// Состязания (Повалить/Финт/Давление/Напролом) — отдельный встречный тест без
// диалога атаки вовсе (combat/techniques.mjs), поэтому свои кнопки сохраняют.
//
// Функции принимают актора, а не лист. Свёртка «Состязаний» осталась на листе:
// это состояние окна, а не актора.

import { MELEE_CONTESTS } from "../../constants/combat.mjs";
import { showAttackDialog } from "../attack-dialog.mjs";
import { _showContestDialog } from "../../combat/techniques.mjs";
import { showGrappleDialog } from "../../combat/grapple.mjs";
import { beginTargeting } from "../../combat/aim.mjs";
import { showHealingDialog } from "./healing.mjs";
import { painChange, openPainSoulBurnDialog } from "./pain.mjs";
import { useDisabledArmourPeriodicTest, promptDisabledArmourForkTest } from "../../combat/armor-mods.mjs";
import { repairArmorCorrosion, extractPiercingWound, applyCripplingTrigger } from "../../combat/damage.mjs";
import { spendActionPoints, spendReaction, resetActionEconomy } from "../../combat/action-economy.mjs";
import {
  declareHalfMove, declareFullMove, declareCharge, declareRun,
  showClimbDialog, showJumpDialog, showSwimDialog, showFallDialog, showFlightDialog,
  showMarchDialog
} from "../../combat/movement-actions.mjs";
import { on } from "../../helpers/utils.mjs";

export function activateCombatListeners(root, actor) {

  on(root, ".weapon-attack-roll", "click", ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (!item) return;
    // Стрельба по клику: у стрелкового/метательного оружия без уже выбранной
    // цели — сперва прицеливание перекрестием, диалог откроется по выбору цели.
    // Ближний бой и уже назначенная цель — сразу диалог (прежнее поведение).
    const isRanged = item.system?.weaponClass && item.system.weaponClass !== "melee";
    const hasTarget = (game.user?.targets?.size ?? 0) > 0;
    if (isRanged && !hasTarget && canvas?.ready) {
      beginTargeting(actor, item, () => showAttackDialog(actor, item));
    } else {
      showAttackDialog(actor, item);
    }
  });

  // Бросок дальнобойного оружия БЕЗ цели (тестовый или «на глазок»): открывает
  // тот же диалог атаки напрямую, минуя перекрестие прицеливания — авто-расчёт
  // по защите цели (Уклонение/Парирование) просто не заполняется, порог и урон
  // считаются как обычно. Раньше единственный путь к «без цели» был спрятан
  // за скрытой горячей клавишей Пробел внутри прицеливания (module/combat/aim.mjs).
  on(root, ".weapon-attack-notarget", "click", ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (!item) return;
    showAttackDialog(actor, item);
  });

  // ── Лечение и Очки Боли ──────────────────────────────────────────────────
  on(root, ".wounds-heal-btn", "click", () => showHealingDialog(actor));

  // ── Перевес выключенной силовой брони: тест раз в T.b часов (стр. 233) ──
  on(root, ".disabled-armour-periodic-test-btn", "click", () => useDisabledArmourPeriodicTest(actor));
  on(root, ".disabled-armour-fork-test-btn", "click", () => promptDisabledArmourForkTest(actor));

  on(root, ".pain-absorb-btn", "click", () => painChange(actor, +1, "absorb"));
  on(root, ".pain-spend-btn", "click", () => painChange(actor, -1, "spend"));
  on(root, ".pain-soulburn-btn", "click", () => openPainSoulBurnDialog(actor));

  // ── Состязания (Повалить/Финт/Давление/Напролом) ─────────────────────────
  on(root, ".technique-btn", "click", ev => {
    const techDef = MELEE_CONTESTS[ev.currentTarget.dataset.technique];
    if (techDef) _showContestDialog(actor, techDef);
  });

  // ── Стойка/База — то же actor.update, что читает как стартовое значение
  // и умеет сменить на разовый бросок диалог атаки (attack-dialog.mjs):
  // клик здесь виден и там, и наоборот, без отдельной синхронизации.
  on(root, ".technique-btn-stance", "click", ev => {
    const key = ev.currentTarget.dataset.stance;
    if (key) actor.update({ "system.meleeStance": key });
  });
  on(root, ".technique-btn-base", "click", ev => {
    const key = ev.currentTarget.dataset.base;
    if (key) actor.update({ "system.meleeBase": key });
  });

  // ── Свойства оружия wdbc-plsf: Corrosive/Piercing/Crippling — блок под
  // бронёй на этой же вкладке (character-context.mjs hasWeaponPropWounds).
  on(root, ".wh-sheet-corrosion-repair-btn", "click", ev => {
    repairArmorCorrosion(actor, ev.currentTarget.dataset.loc);
  });
  on(root, ".wh-sheet-piercing-extract-btn", "click", ev => {
    extractPiercingWound(actor, ev.currentTarget.dataset.loc);
  });
  on(root, ".wh-sheet-crippling-trigger-btn", "click", ev => {
    const ds = ev.currentTarget.dataset;
    applyCripplingTrigger(actor, parseInt(ds.rating || "0"), ds.location || "");
  });

  // ── Борьба (стр. 12) — кнопка видна, пока активно conditions.grappling
  // (выставляется module/combat/grapple.mjs после попадания Приёмом «Захват»).
  on(root, ".grapple-btn", "click", () => showGrappleDialog(actor));

  // ── Экономика действий (стр. 12): ручная трата для действий без своей
  // кнопки в другом месте листа — Уклонение/Парирование уже тратят Реакцию
  // сами (module/combat/defense.mjs). Вне активного Encounter кнопки
  // остаются кликабельны, но ничего не списывают (spendActionPoints/
  // spendReaction сами проверяют game.combat?.started).
  on(root, ".ae-spend-btn", "click", async ev => {
    const kind = ev.currentTarget.dataset.aeSpend;
    if (kind === "ap") {
      const cost = parseInt(ev.currentTarget.dataset.aeCost) || 1;
      if (!await spendActionPoints(actor, cost)) ui.notifications.warn("⚠️ Не хватает ОД.");
    } else if (kind === "reaction") {
      if (!await spendReaction(actor)) ui.notifications.warn("⚠️ Не хватает Реакций.");
    }
  });
  on(root, ".ae-reset-btn", "click", () => resetActionEconomy(actor));

  // ── Движение (стр. 28-32): боевые типы + отдельные механики + марши ─────
  // Та же панель кнопок, что открывает Token HUD-кнопка «Движение»
  // (module/combat/movement-actions.mjs).
  const MOVE_ACTIONS = {
    halfmove: declareHalfMove, fullmove: declareFullMove,
    charge: declareCharge,     run: declareRun,
    climb: showClimbDialog, jump: showJumpDialog, swim: showSwimDialog,
    fall: showFallDialog,   fly: showFlightDialog,
    "march-accelerated": a => showMarchDialog(a, "accelerated"),
    "march-run":         a => showMarchDialog(a, "run"),
    "march-forced":      a => showMarchDialog(a, "forced")
  };
  on(root, ".wh-move-btn", "click", ev => {
    const fn = MOVE_ACTIONS[ev.currentTarget.dataset.moveAction];
    if (fn) fn(actor);
  });
}
