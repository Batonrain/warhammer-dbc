// module/sheets/tabs/combat.mjs
//
// Вкладка БОЙ: состязательные приёмы, кнопка атаки у оружия, лечение и Очки
// Боли Друкхари. Стойка/База/обычные Приёмы выбираются прямо в диалоге атаки
// (attack-dialog.mjs) и своих кнопок на этой вкладке больше не имеют.
// Состязания (Повалить/Финт/Давление/Напролом) — отдельный встречный тест без
// диалога атаки вовсе (combat/techniques.mjs), поэтому свои кнопки сохраняют.
//
// Функции принимают актора, а не лист. Свёртка «Состязаний» осталась на листе:
// это состояние окна, а не актора.

import { MELEE_CONTESTS } from "../../constants/combat.mjs";
import { showAttackDialog } from "../attack-dialog.mjs";
import { _showContestDialog } from "../../combat/techniques.mjs";
import { beginTargeting } from "../../combat/aim.mjs";
import { showHealingDialog } from "./healing.mjs";
import { painChange, openPainSoulBurnDialog } from "./pain.mjs";
import { useDisabledArmourPeriodicTest, promptDisabledArmourForkTest } from "../../combat/armor-mods.mjs";
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
}
