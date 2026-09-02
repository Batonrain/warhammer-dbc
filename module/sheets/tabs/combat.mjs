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
import { showSkillfulTortureDialog } from "../../apps/skillful-torture.mjs";
import { frenzyEntryBlocked, markFrenzyExited } from "../../combat/frenzy.mjs";
import { avatarOfSlaughterAvailable, applyAvatarOfSlaughter } from "../../combat/avatar-of-slaughter.mjs";
import { dreadWailAvailable } from "../../combat/dread-wail.mjs";
import { showDreadWailDialog } from "../../apps/dread-wail-dialog.mjs";
import { resplendentRaimentAvailable } from "../../combat/resplendent-raiment.mjs";
import { showResplendentRaimentDialog } from "../../apps/resplendent-raiment-dialog.mjs";
import { adrenalineRushAvailable, applyAdrenalineRush } from "../../combat/adrenaline-rush.mjs";
import { boneSongAvailable, applyBoneSongSingle, applyBoneSongArea } from "../../combat/bone-song.mjs";
import { preservationAvailable, applyPreservationSingle, applyPreservationArea } from "../../combat/preservation.mjs";
import { songOfSwiftnessAvailable, applySongOfSwiftnessSingle, applySongOfSwiftnessArea } from "../../combat/song-of-swiftness.mjs";
import { showWraithboneSongDialog } from "../../apps/wraithbone-song-dialog.mjs";
import { conjureWraithAvailable, applyConjureWraith } from "../../combat/conjure-wraith.mjs";
import { reformationSongAvailable } from "../../combat/reformation-song.mjs";
import { showReformationSongDialog } from "../../apps/reformation-song-dialog.mjs";
import { useDisabledArmourPeriodicTest, promptDisabledArmourForkTest } from "../../combat/armor-mods.mjs";
import { repairArmorCorrosion, extractPiercingWound, applyCripplingTrigger } from "../../combat/damage.mjs";
import { clearWeaponJam } from "../../combat/weapon-properties.mjs";
import { spendActionPoints, spendReaction, resetActionEconomy } from "../../combat/action-economy.mjs";
import { triggerDeadlyEffectiveness } from "../../combat/deadly-effectiveness.mjs";
import { triggerBowToAudience } from "../../combat/bow-to-audience.mjs";
import { triggerSpiritTalk } from "../../combat/spirit-talk.mjs";
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
  on(root, ".skillful-torture-btn", "click", () => showSkillfulTortureDialog(actor));

  // ── Ярость: лимит повторного входа за бой (wdbc-sk8s, module/combat/frenzy.mjs) ──
  // «Однажды выйдя, нельзя войти снова до конца боя» — Frenzy/Ярость, снимается
  // Чертой Butcher's Nails/Гвозди Мясника. Тумблер сам по себе (system.inRage)
  // сохраняется формой Foundry как обычно — здесь только гейт входа и отметка выхода.
  on(root, ".rage-toggle input", "change", async ev => {
    const checked = ev.currentTarget.checked;
    if (checked && frenzyEntryBlocked(actor)) {
      // Слушатель висит на input, а лист (ApplicationV2, submitOnChange) — на
      // form: без stopPropagation форма сабмитнула бы inRage:true из DOM
      // СЛЕДОМ за нашим откатом, и гейт молча проигрывал бы гонку.
      ev.stopPropagation();
      ev.currentTarget.checked = false;
      ui.notifications.warn(`«${actor.name}» уже выходил(а) из Ярости в этом бою — повторный вход запрещён до конца боя (Frenzy/Ярость). Снимается Чертой Butcher's Nails / Гвозди Мясника.`);
      await actor.update({ "system.inRage": false });
      return;
    }
    if (!checked) await markFrenzyExited(actor);
  });

  // ── Аватар Резни (wdbc-sk8s, module/combat/avatar-of-slaughter.mjs) ──────
  on(root, ".avatar-of-slaughter-btn", "click", async () => {
    if (!avatarOfSlaughterAvailable(actor)) {
      return ui.notifications.warn("Аватар Резни уже использован в этом бою.");
    }
    const target = [...(game.user?.targets ?? [])][0]?.actor ?? null;
    if (!target) return ui.notifications.warn("Наведите таргет (T) на видимого противника.");
    await applyAvatarOfSlaughter(actor, target);
  });

  // ── Грозный Вопль (wdbc-sk8s, module/combat/dread-wail.mjs) ──────────────
  on(root, ".dread-wail-btn", "click", async () => {
    if (!dreadWailAvailable(actor)) {
      return ui.notifications.warn("Грозный Вопль уже использован максимум раз в этом бою.");
    }
    await showDreadWailDialog(actor);
  });

  // ── Блистательные Одеяния (wdbc-sk8s, module/combat/resplendent-raiment.mjs) ──
  on(root, ".resplendent-raiment-btn", "click", async () => {
    if (!resplendentRaimentAvailable(actor)) {
      return ui.notifications.warn("Блистательные Одеяния уже использованы в этом бою/сцене.");
    }
    await showResplendentRaimentDialog(actor);
  });

  // ── Прилив Адреналина (wdbc-ks1r, module/combat/adrenaline-rush.mjs) ────
  on(root, ".adrenaline-rush-btn", "click", async () => {
    if (!adrenalineRushAvailable(actor)) {
      return ui.notifications.warn("Прилив Адреналина уже использован в этом бою/сцене.");
    }
    await applyAdrenalineRush(actor);
  });

  // ── Певцы Кости (wdbc-sk8s, module/combat/{bone-song,preservation,song-of-swiftness}.mjs) ──
  on(root, ".bone-song-btn", "click", async () => {
    if (!boneSongAvailable(actor)) {
      return ui.notifications.warn("Костяная Песня уже использована максимум раз в этой сессии.");
    }
    await showWraithboneSongDialog(actor, {
      title: "Костяная Песня", applySingle: applyBoneSongSingle, applyArea: applyBoneSongArea
    });
  });
  on(root, ".preservation-btn", "click", async () => {
    if (!preservationAvailable(actor)) {
      return ui.notifications.warn("Защита уже использована максимум раз в этой сессии.");
    }
    await showWraithboneSongDialog(actor, {
      title: "Защита", applySingle: applyPreservationSingle, applyArea: applyPreservationArea
    });
  });
  on(root, ".song-of-swiftness-btn", "click", async () => {
    if (!songOfSwiftnessAvailable(actor)) {
      return ui.notifications.warn("Песня Стремительности уже использована максимум раз в этой сессии.");
    }
    await showWraithboneSongDialog(actor, {
      title: "Песня Стремительности", applySingle: applySongOfSwiftnessSingle, applyArea: applySongOfSwiftnessArea
    });
  });
  on(root, ".reformation-song-btn", "click", async () => {
    if (!reformationSongAvailable(actor)) {
      return ui.notifications.warn("Reformation Song / Песня Изменений уже использована максимум раз в этой сессии.");
    }
    await showReformationSongDialog(actor);
  });

  // ── Вызвать Психокость (wdbc-sk8s, module/combat/conjure-wraith.mjs) ────
  on(root, ".conjure-wraith-item-btn", "click", async () => {
    if (!conjureWraithAvailable(actor)) {
      return ui.notifications.warn("Вызвать Психокость уже использовано максимум раз в этой сессии.");
    }
    await applyConjureWraith(actor, "item");
  });
  on(root, ".conjure-wraith-weapon-btn", "click", async () => {
    if (!conjureWraithAvailable(actor)) {
      return ui.notifications.warn("Вызвать Психокость уже использовано максимум раз в этой сессии.");
    }
    await applyConjureWraith(actor, "weapon");
  });

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
  on(root, ".wh-sheet-clear-jam-btn", "click", ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (item) clearWeaponJam(item);
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

  // Deadly Effectiveness/Смертоносная Эффективность (wdbc-1rno): игрок сам
  // подтверждает клик «убил после Финта в этом Раунде» — система только
  // считает «раз в Раунд» и +2 ОД (combat/deadly-effectiveness.mjs).
  on(root, ".deadly-effectiveness-btn", "click", async () => {
    if (!await triggerDeadlyEffectiveness(actor)) ui.notifications.warn("⚠️ Уже использовано в этом Раунде.");
  });

  // Bow to the Audience/Поклон Публике (wdbc-1rno): цели берутся из
  // game.user.targets (та же логика, что Bone Song, wdbc-sk8s) — гейт кнопки
  // сам проверяет их наличие и ОД.
  on(root, ".bow-to-audience-btn", "click", () => triggerBowToAudience(actor));

  // Spirit Talk/Духовный Разговор (wdbc-q30d): цель — единственная наведённая
  // Техника, гейт сам проверяет бой/ОД/кулдаун сессии (combat/spirit-talk.mjs).
  on(root, ".spirit-talk-btn", "click", () => triggerSpiritTalk(actor));

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
