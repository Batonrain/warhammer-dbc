// module/sheets/attack/dialog.mjs
// ══════════════════════════════════════════════════════════════════════════
//  ПОДКЛЮЧЕНИЕ ОКНА АТАКИ: кнопки, обработчики полей, пересчёт порога на
//  лету (wdbc-uh56).
//
//  Вынесено из showAttackDialog (1733 строки). Это единственное место, где
//  функцию вообще можно разрезать: замер ширины интерфейса по всей её длине
//  показал 90–106 значений в середине и узкие места только по краям. Здесь
//  шов ОДНОСТОРОННИЙ — последний оператор функции, после него ничего нет, и
//  значения идут только внутрь.
//
//  Цена честная: внутрь идёт много значений, и они приняты одним объектом.
//  Это и есть тот «явный объект состояния диалога», без которого разрезать
//  остальное нельзя, — заведён там, где направление одностороннее.
// ══════════════════════════════════════════════════════════════════════════

import { rollIcon } from "../../constants/roll-icons.mjs";
import { esc } from "../../helpers/utils.mjs";
import { _executeAttackRoll } from "../../combat/attack.mjs";
import { spendActionPoints, apCostForActionType, spendReaction } from "../../combat/action-economy.mjs";
import { deathDanceNextCost, markDeathDanceUsed } from "../../combat/death-dance.mjs";
import { markRoundCapabilityUsed } from "../../apps/game-session.mjs";
import { AUTO_HIT_CAPABILITY, FULL_ATTACK_CAPABILITY, readAttackForm } from "./form.mjs";

export function openAttackDialog(ctx) {
  const {
    actor,
    item,
    content,
    techniqueOpts,
    isMelee,
    wp,
    stance,
    gripKey,
    profIdx,
    meleeBaseKey,
    dyn0,
    resolvedAttack,
    rofModes,
    ammoConds,
    aimTargets,
    mountPair,
    oneVsHundred,
    fanningActive,
    autoHitAvailable,
    fullAttackForced,
    forcedDefenceReroll,
    helplessAutoMelee,
    badgesHtml,
    breakdownHtml,
    pillsHtml,
    thresholdOf,
    thresholdParts,
    resolveSelectionSafe,
    computeBaseOptions,
    computeGripOptions,
    computeManeuverOptions,
    computeStanceOptions
  } = ctx;
  return foundry.applications.api.DialogV2.wait({
    window: { title: `Атака: ${item.name}` },
    classes: ["warhammer-dbc", "wh-holo", "wh-attack-dialog", "wh-atk-dialog"],
    position: { width: 420 },
    content,
    // Закрыть окно — это отмена, а не ошибка: вызывающий ждёт null, а не бросок.
    rejectClose: false,
    buttons: [
      {
        action: "roll", label: "Бросок!", icon: "fas fa-dice-d10", class: "roll", default: true,
        callback: async (event, button) => {
          const f = readAttackForm(button.form, ammoConds);

          if (f.autoFail) {
            await ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: actor }),
              content: `<div class="wh-roll-result">
                <div class="roll-header">${rollIcon("sword")}${esc(item.name)}</div>
                <div class="roll-outcome">
                  <span class="roll-failure">Автоматический провал (Ослеплён)</span>
                </div></div>`
            });
            return false;
          }

          const sel = resolveSelectionSafe(f);

          if (sel.blocked) {
            await ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: actor }),
              content: `<div class="wh-roll-result">
                <div class="roll-header">${rollIcon("sword")}${esc(item.name)}</div>
                <div class="roll-outcome">
                  <span class="roll-failure">Защитная Стойка без щита — атака запрещена (стр. 15)</span>
                </div></div>`
            });
            return false;
          }

          // Экономика действий (стр. 12, wdbc-niv7): рукопашная атака тратит
          // ОД по actionType выбранной Базы (MELEE_BASES) — Натиск/Полная
          // Атака и т.п. уже несут это поле. Стрелковые режимы (стр. 32,
          // раздел «Стрельба»): Одиночный Выстрел/Короткая/Длинная/Широкая
          // Очередь — все Полудействие; Стрельба на Подавление — Полное
          // действие (Караул в этом диалоге не выбирается).
          // Запрещённый Приём (Cheap Shot, стр. 166, wdbc-hmcx): вместо ОД
          // тратит Реакцию — sel.cheapShotActive уже вынудил Базу быть
          // "standard" (resolveSelection), здесь остаётся только сменить
          // ресурс списания на тот же spendReaction, что у Уклонения/Парирования.
          if (isMelee && sel.cheapShotActive) {
            if (!await spendReaction(actor)) {
              ui.notifications.warn("⚠️ Не хватает Реакций (Запрещённый Приём).");
              return false;
            }
          } else {
            const apCost = isMelee
              ? apCostForActionType(sel.bDef.actionType)
              : apCostForActionType(f.rofMode === "suppression" ? "Полное действие" : "Полудействие");
            if (!await spendActionPoints(actor, apCost, { physical: true })) {
              ui.notifications.warn("⚠️ Не хватает ОД.");
              return false;
            }
          }

          // Стойка/База — персистентны на акторе (как радио на вкладке БОЙ),
          // Хват/Профиль — во флагах предмета (как раньше в HUD): выбор в этом
          // диалоге должен остаться в силе и после закрытия окна, а не сбрасываться.
          const actorUpdates = { "system.aiming": "none" };
          if (isMelee && sel.stanceKey !== stance) actorUpdates["system.meleeStance"] = sel.stanceKey;
          if (isMelee && !fullAttackForced && sel.baseKey !== meleeBaseKey) actorUpdates["system.meleeBase"] = sel.baseKey;
          await actor.update(actorUpdates);
          if (sel.gKey !== gripKey) await item.setFlag?.("warhammer-dbc", "hudGrip", sel.gKey);
          if (sel.pIdx !== profIdx) await item.setFlag?.("warhammer-dbc", "hudProfile", sel.pIdx);
          // Локус Сокрушения тратится реальным броском — отменённая или
          // закрытая атака способность не расходует (см. meleeBaseKey выше).
          if (fullAttackForced) await markRoundCapabilityUsed(actor, FULL_ATTACK_CAPABILITY);

          // Локус Неизбежности — тем же приёмом: тратится реальным броском,
          // не открытием окна. Штраф −10 ставится сразу же (до начала
          // следующего Хода актора, снимает action-economy.mjs).
          const autoHitUsed = autoHitAvailable && f.autoHit;
          if (autoHitUsed) {
            await markRoundCapabilityUsed(actor, AUTO_HIT_CAPABILITY);
            await actor.setFlag("warhammer-dbc", "inevitabilityPenalty", true);
          }

          // Приём выбран в этом же окне — свежий techniqueOpts под конкретный
          // выбор (targetDodgeMod/targetParryMod/chatNote и т.п. зависят от него).
          const finalTechniqueOpts = isMelee ? {
            ...techniqueOpts,
            technique:      sel.maneuverKey,
            techniqueLabel: sel.mDef.label,
            techniqueNote:  sel.mDef.note,
            chatNote:       sel.mDef.chatNote,
            targetDodgeMod: sel.targetDodgeMod,
            targetParryMod: sel.targetParryMod,
            extraBonus:     sel.mDef.wsBonus,
            stanceLabel:    sel.stDef.label
          } : techniqueOpts;

          // Беспомощная цель: рукопашная — всегда, стрелковая — только если
          // отмечена галочка «в упор / в рукопашной» (см. specificMods выше).
          const helplessAutoHit = helplessAutoMelee || f.autoSuccess;

          await _executeAttackRoll(
            actor, item, f.char, thresholdOf(f),
            f.rofMode || rofModes[0]?.value,
            aimTargets.find(t => t.value === f.aimVal),
            {
              forceHit: helplessAutoHit, doubleDamage: helplessAutoHit,
              fixedSuccessDeg: autoHitUsed ? 1 : undefined,
              // Быстрая/Молниеносная — теперь Приём (стр. 14), а не отдельная
              // галочка: множитель попаданий включается выбором пилюли.
              isSwift: sel.maneuverKey === "swift", isLightning: sel.maneuverKey === "lightning",
              isAllOut: f.allOut,
              // База рукопашной («Натиск» и т.п.): rofMode у рукопашной всегда
              // "melee", по нему Brutal Charge не отличить (wdbc-ревью стопки 3).
              baseKey: sel.baseKey ?? null,
              // Переброс от правила (Локус Буйства) или общий Кубик —
              // бросок катает несколько кубов и оставляет один — см.
              // combat/attack.mjs. crit — расширение диапазона Критического
              // Успеха/Провала тем же правилом (kind:"critRangeMod"); сам
              // натуральный диапазон 1-5/96-100 применяется уже в attack.mjs.
              reroll: f.reroll || (oneVsHundred ? { mode: "keepBest", rolls: 2 } : undefined),
              crit: resolvedAttack.crit,
              forcedDefenceReroll,
              techniqueOpts: finalTechniqueOpts,
              dmgBonus: f.dmgBonus, changeSoulless: f.changeSoulless,
              meleeShot: f.meleeShot,
              shortRange: f.shortRange, maximal: f.maximal, bandIdx: f.bandIdx,
              profile: sel.prof, attackNote: sel.note,
              weaponOff: f.weaponOff, gripKey: sel.gKey,
              gripProps: sel.gDef ? sel.gDef.addProps : [],
              gripDmgFlat: sel.gDef ? sel.gDef.dmgFlat : 0,
              gripSbHalf: sel.gDef ? sel.gDef.sbHalf : false,
              // Fanning / Быстрый Курок (wdbc-fy33): RoF 2..BS.b по выбору
              // заменяет фиксированный sys.rof_full только в режиме "full".
              rofCapOverride: (fanningActive && f.rofMode === "full") ? f.fanningRof : 0,
              // Условные эффекты боеприпаса, отмеченные игроком (стр. 203).
              ammoCondProps:  f.ammoSel.flatMap(c => c.wp || []),
              ammoCondDmg:    f.ammoSel.reduce((n, c) => n + (c.dmg || 0), 0),
              ammoCondLabels: f.ammoSel.map(c => c.label),
              // Свойства оружия от правила (wdbc-w8z4) — уже отобраны по `when`
              // выше (resolvedAttack), attack.mjs только доливает их в _entries.
              ruleProps: resolvedAttack.weaponProps,
              aimingLabel: (f.aiming !== "none" && !wp.noAim)
                ? (f.aiming === "half" ? `Полу-прицеливание (+${f.aimBonus})` : `Полное прицеливание (+${f.aimBonus})`)
                : "",
              // Кого выцелили в паре: урон применяют к листу, а на сцене у пары
              // обычно один токен — без этой строки попадание во всадника ушло
              // бы скакуну просто потому, что кликнули по видимому токену.
              mountNote: mountPair && f.mountPick && f.aimVal
                ? (f.mountPick === "rider"
                    ? `Верхом: попадание во ВСАДНИКА — ${mountPair.rider.name}`
                    : `Верхом: попадание в скакуна — ${mountPair.mount.name}`)
                : (mountPair
                    ? `Верхом: не-Избирательная атака — попадание в скакуна (${mountPair.mount.name}), дубль на броске — во всадника (${mountPair.rider.name})`
                    : "")
            }
          );
          return true;
        }
      },
      // `false`, а не `null`: `null` DialogV2 подменяет на сам action («cancel»)
      // — см. комментарий у pickFromList (sheets/item-sheet.mjs).
      { action: "cancel", label: "Отмена", callback: () => false }
    ],
    render: (event, dialog) => {
      const form      = dialog.element.querySelector("form");
      const display   = form.querySelector("#atk-total-display");
      const breakdown = form.querySelector("#atk-threshold-breakdown");
      const hint      = form.querySelector(".av-adv-hint");

      const badgesEl        = form.querySelector("#atk-badges");
      const noteEl          = form.querySelector("#atk-gripnote");
      const stanceNoteEl    = form.querySelector("#atk-stance-note");
      const baseNoteEl      = form.querySelector("#atk-base-note");
      const maneuverNoteEl  = form.querySelector("#atk-maneuver-note");
      const basePillsEl     = form.querySelector("#atk-base-pills");
      const stancePillsEl   = form.querySelector("#atk-stance-pills");
      const gripPillsEl     = form.querySelector("#atk-grip-pills");
      const maneuverPillsEl = form.querySelector("#atk-maneuver-pills");
      let lastStanceKey = dyn0.stanceKey;
      let lastBaseKey   = dyn0.baseKey;
      let lastProfIdx   = dyn0.pIdx;
      let lastGKey      = dyn0.gKey;

      const updateTotal = () => {
        const f = readAttackForm(form, ammoConds);
        // Стойка/База/Приём/Хват/Профиль меняются прямо в форме — заголовок и
        // сводки эффектов должны обновляться вместе с порогом, иначе бейджи и
        // заметки показывают устаревший выбор до следующего открытия окна.
        const sel = resolveSelectionSafe(f);
        if (badgesEl)       badgesEl.innerHTML       = badgesHtml(sel);
        if (noteEl)         noteEl.innerHTML         = sel.note;
        if (stanceNoteEl)   stanceNoteEl.innerHTML   = sel.stDef.note;
        if (baseNoteEl)     baseNoteEl.innerHTML     = sel.bDef.note;
        if (maneuverNoteEl) maneuverNoteEl.innerHTML = sel.mDef.note;
        // База зависит от выбранной Стойки (Частокол запрещает Натиск, стр. 15)
        // И от Хвата (Хвост временно даёт Cheap Shot, см. computeBaseOptions) —
        // перерисовываем пилюли только когда что-то из этого реально
        // поменялось, чтобы не сбрасывать фокус на каждый несвязанный ввод.
        if (basePillsEl && (sel.stanceKey !== lastStanceKey || sel.gKey !== lastGKey)) {
          lastStanceKey = sel.stanceKey;
          lastGKey      = sel.gKey;
          basePillsEl.innerHTML = pillsHtml("atk-base", computeBaseOptions(sel.stanceKey, sel.gKey), sel.baseKey);
        }
        // Смена Профиля меняет категорию оружия (у альт-профиля своя «голова»,
        // см. categoryFor выше) — вместе с ней и доступность Стойки/Хвата, а
        // через Тренировку — и Приёма. Приём вдобавок зависит от Базы (см. ниже).
        const profChanged = sel.pIdx !== lastProfIdx;
        if (stancePillsEl && profChanged) {
          stancePillsEl.innerHTML = pillsHtml("atk-stance", computeStanceOptions(sel.pIdx), sel.stanceKey);
        }
        if (gripPillsEl && profChanged) {
          gripPillsEl.innerHTML = pillsHtml("atk-grip", computeGripOptions(sel.pIdx), sel.gKey);
        }
        // Приём зависит от выбранной Базы (стр. 14, MELEE_MANEUVERS[*].bases) И
        // от категории по Профилю — перерисовываем при смене любого из них.
        if (maneuverPillsEl && (sel.baseKey !== lastBaseKey || profChanged)) {
          maneuverPillsEl.innerHTML = pillsHtml("atk-maneuver", computeManeuverOptions(sel.baseKey, sel.pIdx), sel.maneuverKey);
        }
        lastBaseKey = sel.baseKey;
        lastProfIdx = sel.pIdx;
        if (sel.blocked) {
          display.textContent = "ЗАБЛОКИРОВАНО";
          display.style.color = "#8b0000";
          if (breakdown) breakdown.innerHTML = "";
          return;
        }
        if (f.autoFail) {
          display.textContent = "ПРОВАЛ";
          display.style.color = "#8b0000";
          if (breakdown) breakdown.innerHTML = "";
          return;
        }
        if (helplessAutoMelee || f.autoSuccess) {
          display.textContent = "АВТО-УСПЕХ ×2";
          display.style.color = "#ff6b6b";
          if (breakdown) breakdown.innerHTML = "";
          return;
        }
        // wdbc-53lh: один вызов thresholdParts даёт и итог, и построчную
        // разбивку под ним — сумма списка равна показанному итогу по построению
        // (thresholdOf выше — тот же total, просто без списка).
        const { parts: bdParts, total } = thresholdParts(f);
        display.textContent = total;
        display.style.color = "";
        if (breakdown) breakdown.innerHTML = breakdownHtml(bdParts);
        // Блок ситуативных свёрнут по умолчанию, поэтому его сводка должна быть
        // видна в заголовке — иначе авто-отметки (Усталость, Ослеплён) молча
        // уходят в порог, и непонятно, откуда взялся модификатор.
        if (f.sitPicked.length) {
          const names = f.sitPicked.map(cb =>
            (cb.closest?.("label")?.textContent ?? "").trim().replace(/\s+/g, " "));
          const sign  = f.sitMods > 0 ? "+" : "";
          hint.classList.add("is-active");
          hint.textContent =
            `— активно ${f.sitPicked.length}${f.sitMods ? ` (${sign}${f.sitMods})` : ""}: ${names.join(", ")}`;
        } else {
          hint.classList.remove("is-active");
          hint.textContent = "— разверни, если нужны";
        }
      };

      // Death Dance / Смертельный Танец (wdbc-sk8s) — кнопка живёт своим
      // слушателем рядом с общим updateTotal: активна только при выбранной
      // Базе «Натиск» и хватающих Очках Судьбы на эскалирующую цену (см.
      // module/combat/death-dance.mjs). Добавляет +A.b в то же поле «Бонус
      // урона», что игрок и так может вписать руками — не отдельный путь
      // в attack.mjs.
      const ddBtn    = form.querySelector("#atk-death-dance-btn");
      const ddStatus = form.querySelector("#atk-death-dance-status");
      if (ddBtn) {
        const refreshDeathDance = () => {
          const sel = resolveSelectionSafe(readAttackForm(form, ammoConds));
          const isCharge   = sel.baseKey === "charge";
          const cost       = deathDanceNextCost(actor);
          const fate       = actor.system.fate?.value ?? 0;
          const affordable = cost === 0 || fate >= cost;
          ddBtn.disabled   = !isCharge || !affordable;
          ddBtn.classList.toggle("av-pill-disabled", !isCharge || !affordable);
          ddStatus.textContent = !isCharge
            ? "— доступно только при Базе «Натиск»"
            : cost === 0
              ? "— бесплатно (первый раз в этом бою)"
              : `— цена ${cost} Очков Судьбы${affordable ? "" : " (не хватает)"}`;
        };
        ddBtn.addEventListener("click", async ev => {
          ev.preventDefault();
          const sel = resolveSelectionSafe(readAttackForm(form, ammoConds));
          if (sel.baseKey !== "charge") return;
          const cost = deathDanceNextCost(actor);
          const fate = actor.system.fate?.value ?? 0;
          if (cost > 0) {
            if (fate < cost) return ui.notifications.warn("Не хватает Очков Судьбы для повторного Смертельного Танца.");
            await actor.update({ "system.fate.value": fate - cost });
          }
          await markDeathDanceUsed(actor);
          const agBonus  = Number(actor.system.characteristics?.ag?.bonus) || 0;
          const dmgInput = form.querySelector("#atk-dmg-bonus");
          dmgInput.value = (parseInt(dmgInput.value) || 0) + agBonus;
          ui.notifications.info(`Смертельный Танец: +${agBonus} к Бонусу урона (Brutal Charge).`);
          refreshDeathDance();
          updateTotal();
        });
        form.addEventListener("change", refreshDeathDance);
        form.addEventListener("input",  refreshDeathDance);
        refreshDeathDance();
      }

      // Один слушатель на форму вместо списка селекторов: события всплывают,
      // и новая галочка в разметке не требует правки этого места.
      form.addEventListener("change", updateTotal);
      form.addEventListener("input",  updateTotal);
      // Сворачивание «Ситуативные модификаторы» — подгоняем высоту окна.
      form.querySelector(".av-adv")
          ?.addEventListener("toggle", () => dialog.setPosition({ height: "auto" }));
      updateTotal();
    }
  }).then(res => res === false ? null : res);
}
