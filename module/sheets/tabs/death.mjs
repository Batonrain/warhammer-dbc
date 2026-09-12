// module/sheets/tabs/death.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Смерть (стр. 232-233): диалог «Спасение» рядом с Кардио-монитором
//  (bc-death-toggle, templates/actor/parts/tab-effects.hbs) — доступен, только
//  пока констатирована смерть (флаг warhammer-dbc.deceased). Три пути:
//  Чудесное Спасение и Божественная Защита (оба всем — разница только в
//  цене и тяжести последствий, книга не требует для второй никакого
//  Таланта, несмотря на одноимённый Талант Пси-стойкости — совпадение
//  перевода названий, не связанные механики; wdbc-80du), и Замедленная
//  Анимация (только Астартес с установленной Сус-ан Мембраной,
//  Раны не ниже −15). «Игрушка Богов» — напоминание текстом, не гейт: ГМ и
//  игрок сами решают, вынужден ли персонаж воспользоваться Спасением.
//  «Воскресить» — отдельная кнопка без формулы вовсе: последствия того, ЧТО
//  и КАК воскресило персонажа (стр. 233, «Воскрешение» — чистая нарративная
//  глава без единой цифры в книге) — на усмотрение ГМа и игроков.
// ════════════════════════════════════════════════════════════════════════════

import { rollIcon } from "../../constants/roll-icons.mjs";
import { esc } from "../../helpers/utils.mjs";
import { postTestCard } from "../../helpers/test-card.mjs";
import {
  fatePoolLabel, MIRACULOUS_SAVE, DIVINE_PROTECTION, SUS_AN_TEST_MOD,
  hasSusAnMembrane, susAnEligible, fateSaveFails,
  toyOfGodsApplies
} from "../../rules/death-save.mjs";
import { computeWoundHealing } from "./wounds.mjs";
import { conditionApplyFields } from "./conditions.mjs";
import { hasRuleFlag } from "../../rules/flags.mjs";
import { spendFromInfamyPool, changeActorInfamy } from "../../apps/infamy-points.mjs";
import { SUNDERING_CAPABILITY } from "../../rules/sundering.mjs";
import { defaultSpawnSunderingFn } from "../../combat/sundering.mjs";
import {
  eternalWarriorEligible, eternalWarriorFreeSaveAvailable, markEternalWarriorUsed
} from "../../combat/eternal-warrior.mjs";
import { collectTestMods } from "../../rules/roll-mods.mjs";
import { KISS_OF_DEATH_FLAG } from "../../rules/kiss-of-death.mjs";

const NS = "warhammer-dbc";

// Все карточки Спасения — одной формы: шапка «череп + название пути» и один
// блок строк. Сборка и публикация — общий helpers/test-card.mjs (wdbc-kuun);
// звук кубика только там, где кубик действительно катался (Замедленная
// Анимация и бросок пула — с ним, «Воскресить» — без).
async function _postCard(actor, header, lines, rolls = []) {
  await postTestCard(actor, {
    icon: rollIcon("skull", "#ff6b6b"), title: `${esc(header)} — ${esc(actor.name)}`,
    threshold: `<div class="roll-threshold">${lines.join("<br/>")}</div>`
  }, { rolls, sound: rolls.length > 0 });
}

/**
 * Чудесное Спасение и Божественная Защита расплачиваются пулом Судьбы/Бесчестья
 * одинаково. eternalWarrior: null (обычная стоимость по cfg), "free" (Вечный
 * Воин, путь 1 — 0 пула/0 Порчи, отмечает разовый заряд сессии), "flat" (путь
 * 2 — фиксированная 1 Очко Бесчестия, без кубика, без Порчи).
 */
async function _resolveFateSave(actor, kind, cfg, { restoreToZero, resurrectNote, eternalWarrior = null }) {
  const pool = fatePoolLabel(actor);
  const current = Number(actor.system.fate?.value) || 0;
  const free = eternalWarrior === "free" || eternalWarrior === "flat";

  let fateRoll = null, rolledLoss;
  if (eternalWarrior === "free") rolledLoss = 0;
  else if (eternalWarrior === "flat") rolledLoss = 1;
  else {
    fateRoll = await new Roll(cfg.fateDie).evaluate();
    rolledLoss = fateRoll.total + (cfg.fateFlat || 0);
  }
  // Kiss of Death/Поцелуй Смерти (Слаанеш, wdbc-1rno): «Спасение от смерти,
  // вызванной этой атакой, тратит двойное количество Бесчестия или Очков
  // Судьбы» — метка одноразовая (снимается ниже при ЛЮБОМ исходе попытки),
  // Вечный Воин (free/flat) книга не упоминает — обе фиксированные цены не
  // трогаем, удваивать «0» и «1 без кубика» смысла нет. rolledLoss остаётся
  // «как выпало» для подписи брейкдауна, loss — уже удвоенная сумма списания.
  const kissOfDeathDoubled = !free && !!actor.getFlag?.("warhammer-dbc", KISS_OF_DEATH_FLAG);
  const loss = kissOfDeathDoubled ? rolledLoss * 2 : rolledLoss;
  // Временный запас (wdbc-e728, Voice of God и т.п.) гасит цену Спасения первым.
  const spend = await spendFromInfamyPool(actor, loss, "system.fate.value");
  const failed = fateSaveFails(current, spend.poolSpent);
  const tempNote = spend.tempSpent ? `, из них ${spend.tempSpent} из временного запаса` : "";
  const kissNote = kissOfDeathDoubled ? ", ×2 Поцелуй Смерти" : "";
  const lossLabel = fateRoll ? `(${cfg.fateFlat ? `${cfg.fateFlat}+` : ""}${fateRoll.total}=${rolledLoss}${kissNote}${tempNote})` : `${loss}${kissNote}${tempNote}`;

  if (failed) {
    const upd = { "system.fate.value": spend.poolValue };
    if (kissOfDeathDoubled) upd["flags.warhammer-dbc.-=" + KISS_OF_DEATH_FLAG] = null;
    await actor.update(upd);
    await _postCard(actor, kind, [
      `Пул ${pool}: <b>${current}</b> − ${lossLabel} → опустился бы до 0 и ниже.`,
      `<span class="roll-failure">Провал — Боги отвернулись. Персонаж мёртв по-настоящему.</span>`
    ], fateRoll ? [fateRoll] : []);
    return;
  }

  if (eternalWarrior === "free") await markEternalWarriorUsed(actor);

  const corRoll = free ? null : await new Roll(cfg.corDie).evaluate();
  const corGain = corRoll ? corRoll.total : 0;
  const newFate = spend.poolValue;
  const newCor  = (Number(actor.system.corruption?.value) || 0) + corGain;
  const updates = {
    "system.fate.value": newFate,
    "system.corruption.value": Math.min(100, newCor)
  };
  updates[`flags.${NS}.deceased`] = false;
  if (kissOfDeathDoubled) updates[`flags.${NS}.-=${KISS_OF_DEATH_FLAG}`] = null;
  if (restoreToZero) {
    Object.assign(updates, computeWoundHealing(actor.system, Math.max(0, -(Number(actor.system.wounds?.value) || 0)) + (Number(actor.system.wounds?.critical) || 0)));
  }
  await actor.update(updates);

  const lines = [
    `Пул ${pool}: <b>${current}</b> − ${loss}${kissNote}${tempNote} → <b>${newFate}</b>.`,
    free
      ? `Порча: без изменений (Вечный Воин, ${eternalWarrior === "free" ? "раз за сессию" : "дальнобойная смерть"} — бесплатно в Ярости).`
      : `Порча: +${corGain} → <b>${Math.min(100, newCor)}</b>${newCor > 100 ? " (потолок 100)" : ""}.`,
    `<span class="roll-success">Успех — персонаж жив. Кардиомонитор перезапущен.</span>`
  ];
  if (resurrectNote) lines.push(resurrectNote);
  await _postCard(actor, kind, lines, [fateRoll, corRoll].filter(Boolean));
}

export async function doMiraculousSave(actor, { eternalWarrior = null } = {}) {
  // Руническая Вязь «Прах Феникса» (wdbc-unku): тратит только 1d5 Порчи/Бесчестия
  // вместо обычного 1d10 — тот же MIRACULOUS_SAVE, только corDie сужен.
  const cfg = hasRuleFlag(actor, "runicWeave.ashesOfThePhoenix")
    ? { ...MIRACULOUS_SAVE, corDie: "1d5" }
    : MIRACULOUS_SAVE;
  await _resolveFateSave(actor, "Чудесное Спасение", cfg, {
    restoreToZero: true,
    resurrectNote: "Урон и эффекты смертельного попадания откатываются — персонаж как будто не получал этот удар.",
    eternalWarrior
  });
}

export async function doDivineProtection(actor, { eternalWarrior = null } = {}) {
  await _resolveFateSave(actor, "Божественная Защита", DIVINE_PROTECTION, {
    restoreToZero: true,
    resurrectNote: "Персонаж без сознания до конца сцены/боя, а до конца сессии может совершать только полудвижения. "
      + "Если Inf/Cor теперь 50+ и есть безопасная база — можно чудом переместиться туда (по решению игрока/ГМа).",
    eternalWarrior
  });
}

/** Замедленная Анимация — не тратит Судьбу/Бесчестье, отдельный тест W+30 (Сус-ан Мембрана). */
export async function doSusAnimation(actor) {
  const w = Number(actor.system.characteristics?.wp?.total) || 0;
  // Общий сбор модификаторов (wdbc-asuc): тест W+30 считался мимо реестра —
  // ни Усталость, ни Черты, ни Состояния в него не входили. Диалога с
  // галочками у кнопки нет, поэтому collectTestMods.
  const ruleMods = collectTestMods(actor, { kind: "skill", char: "wp" });
  const threshold = w + SUS_AN_TEST_MOD + ruleMods.total;
  const roll = await new Roll("1d100").evaluate();
  const success = roll.total <= threshold;

  const lines = [`W <b>${w}</b>+${SUS_AN_TEST_MOD}${ruleMods.parts.map(p => ` ${p}`).join("")} → порог <b>${threshold}</b>, бросок <b>${roll.total}</b>.`];
  if (success) {
    // Беспомощность отдельно не ставим (wdbc-r5o7.7): «Без сознания» теперь
    // сама производит Беспомощность для любого читателя conditions.helpless
    // (rules/character.mjs, derived data) — дублирующая запись годами могла
    // разойтись, если кто-то снимал один флаг и забывал другой.
    await actor.update({
      [`flags.${NS}.deceased`]: false,
      ...conditionApplyFields("unconscious", null, actor)
    });
    lines.push(`<span class="roll-success">Успех — десантник входит в Замедленную Анимацию вместо смерти.</span>`);
    lines.push("Без сознания и Беспомощен. Диагностика −60 (For.Lore (Astartes Implants) снимает штраф). "
      + "Вывод — операция в апотекарионе, Medicae−40, медик с For.Lore (Astartes Implants)+0, 12−Успехи ч. (мин. 3).");
  } else {
    lines.push(`<span class="roll-failure">Провал — тело не выдерживает, десантник мёртв.</span>`);
  }
  await _postCard(actor, "Замедленная Анимация", lines, [roll]);
}

/**
 * Разделение/Sundering (Дар Тзинча, wdbc-1rno): «на смерти — 1 Очко
 * Бесчестия → тело исчезает, появляются 2 копии, действующие в его
 * Инициативу». В отличие от Чудесного Спасения/Божественной Защиты НЕ
 * снимает флаг deceased — тело чемпиона реально «исчезло», он не то чтобы
 * жив; deceased снимается только в конце сцены (module/combat/sundering.mjs::
 * revertSunderingOnSceneEnd), когда чемпион фактически возвращается на поле.
 */
export async function doSundering(actor) {
  await changeActorInfamy(actor, -1);
  await defaultSpawnSunderingFn(actor.uuid);
  await _postCard(actor, "Разделение", [
    "1 Очко Бесчестия → тело исчезает, на его месте появляются 2 копии чемпиона " +
      "(S/T−20, 9 Ран, Размер−1, Демонический(+1)/Материал Кошмаров/Варп-нестабильность), " +
      "действующие в его Инициативу, с его снаряжением и поддерживаемыми психосилами.",
    "В конце сцены обе копии исчезают, чемпион возникает с 0 Ран на месте одной из них (выбор игрока).",
    "Если обе копии падут раньше конца сцены — это смерть персонажа как обычно, Спасение открыто снова."
  ]);
}

export async function doResurrect(actor) {
  await actor.setFlag(NS, "deceased", false);
  await _postCard(actor, "Воскрешение", [
    "Кардиомонитор перезапущен вручную — персонаж воскрешён.",
    "Формулы в книге для этого нет (стр. 233 — чистый нарратив): что, как и какой ценой его вернуло, решают ГМ и игроки."
  ]);
}

export function showDeathSaveDialog(actor) {
  if (!actor?.getFlag?.(NS, "deceased")) {
    ui.notifications.warn(`${actor.name}: смерть не констатирована.`);
    return;
  }
  const pool = fatePoolLabel(actor);
  const canSusAn  = hasSusAnMembrane(actor) && susAnEligible(actor);
  const phoenix = hasRuleFlag(actor, "runicWeave.ashesOfThePhoenix");
  const miracCorNote = phoenix ? "1d5 Порчи (Прах Феникса)" : "1d10 Порчи";
  const toyNote = toyOfGodsApplies(actor)
    ? `<div class="atk-range-info" style="font-size:0.82em;color:#e0a83a;">⚠ Игрушка Богов: на первом смертельном ранении сессии Покровительство обычно обязывает воспользоваться Спасением/Защитой, если это не подняло бы Cor до 100 — решение за столом.</div>`
    : "";

  // Eternal Warrior/Вечный Воин (wdbc-sk8s): в Ярости следующий Miraculous/Divine
  // бесплатен (раз за сессию), либо всегда за фиксированную 1 Очко Бесчестия при
  // дальнобойной смерти вне дистанции Натиска — «дистанция Натиска до убийцы»
  // движком не отслеживается вовсе, флажок ниже — самоподтверждение игрока
  // (тот же честный компромисс, что у Deadly Effectiveness).
  const ewEligible = eternalWarriorEligible(actor);
  const ewFreeAvail = ewEligible && eternalWarriorFreeSaveAvailable(actor);
  const ewNote = ewEligible
    ? `<div class="atk-range-info" style="font-size:0.82em;color:#9a7fe0;">
        ☠ Вечный Воин (в Ярости): следующее Спасение/Защита ниже бесплатно —
        <label style="display:block;margin-top:2px;"><input type="radio" name="ew-mode" value="free" ${ewFreeAvail ? "checked" : "disabled"}/>
          раз за сессию${ewFreeAvail ? "" : " (уже потрачено)"}</label>
        <label style="display:block;"><input type="radio" name="ew-mode" value="flat" ${ewFreeAvail ? "" : "checked"}/>
          дальнобойная смерть вне дистанции Натиска — за 1 Очко Бесчестия (не тратит заряд сессии)</label>
        <label style="display:block;"><input type="radio" name="ew-mode" value="" />обычная стоимость (не использовать Вечного Воина)</label>
      </div>`
    : "";

  // Sundering/Разделение (Дар Тзинча, wdbc-1rno) — только у носителя Дара,
  // не показываем всем отключённой кнопкой (в отличие от Замедленной
  // Анимации выше — та книжно доступна любому Астартес, просто не всегда
  // условия выполнены; Разделение без самого Дара не существует вообще).
  const hasSundering = hasRuleFlag(actor, SUNDERING_CAPABILITY);

  const opt = (key, label, note, enabled = true) => `
    <button type="button" class="wh-death-action" data-action="${key}" ${enabled ? "" : "disabled"}
      style="width:100%;text-align:left;margin:3px 0;${enabled ? "" : "opacity:0.45;"}">
      <b>${label}</b><br/><span style="font-size:0.8em;">${note}</span>
    </button>`;

  const content = `
    <div class="wh-wizard-form" style="padding:6px;">
      <div class="atk-dlg-header"><span class="atk-weapon-name">${rollIcon("skull","#ff6b6b")}Спасение от смерти</span></div>
      ${toyNote}
      ${ewNote}
      ${opt("miraculous", "Чудесное Спасение", `1d10+10 ${pool} и ${miracCorNote} — провал, если пул опустится до 0.`)}
      ${opt("divine", "Божественная Защита", `1d5+5 ${pool} и 1d5 Порчи — провал, если пул опустится до 0. `
        + "Дешевле Чудесного Спасения, но персонаж без сознания до конца сцены/боя и до конца сессии — только полудвижения.")}
      ${opt("susan", "Замедленная Анимация", canSusAn
        ? `Тест W+30 (не тратит ${pool}/Порчу). Только Астартес с Сус-ан Мембраной, Раны не ниже −15.`
        : "Только Астартес с установленной Сус-ан Мембраной и Ранами не ниже −15.", canSusAn)}
      ${hasSundering ? opt("sundering", "Разделение (Тзинч)",
        "1 Очко Бесчестия — тело исчезает, появляются 2 копии (S/T−20, 9 Ран, Размер−1), действующие в вашу Инициативу. "
        + "В конце сцены обе исчезают, вы возвращаетесь с 0 Ран на месте одной из них.") : ""}
    </div>`;

  return foundry.applications.api.DialogV2.wait({
    window: { title: "Спасение от смерти" },
    classes: ["wh-attack-dialog", "warhammer-dbc"],
    position: { width: 420 },
    content,
    rejectClose: false,
    buttons: [{ action: "close", label: "Закрыть" }],
    render: (event, dialog) => {
      const form = dialog.element.querySelector("form") || dialog.element;
      form.querySelectorAll(".wh-death-action:not([disabled])").forEach(b => b.addEventListener("click", async () => {
        const key = b.dataset.action;
        const ewChecked = form.querySelector('input[name="ew-mode"]:checked')?.value || null;
        const eternalWarrior = ewChecked || null;
        if (key === "miraculous") await doMiraculousSave(actor, { eternalWarrior });
        else if (key === "divine") await doDivineProtection(actor, { eternalWarrior });
        else if (key === "susan") await doSusAnimation(actor);
        else if (key === "sundering") await doSundering(actor);
        dialog.close();
      }));
    }
  });
}
