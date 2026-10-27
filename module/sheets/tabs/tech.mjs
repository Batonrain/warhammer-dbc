// module/sheets/tabs/tech.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Техночудеса и ресурсы Механикум. Функции принимают актора, а не лист.
// ════════════════════════════════════════════════════════════════════════════

import { SKILLS_DEF } from "../../constants/skills.mjs";
import { COIL_FATIGUE_COST, coilFatigueRelief, electooChargeGain } from "../../rules/potentia-coil.mjs";
import { fatigueChangeFields, announceFatigueChange } from "./conditions.mjs";
import { DAMAGE_TYPES } from "../../constants/items.mjs";
import { rollIcon } from "../../constants/roll-icons.mjs";
import { techIcon } from "../../constants/tech-icons.mjs";
import { ironModForQuality, leastQuality } from "../../constants/implant-mechanics.mjs";
import { _degWord, resolveCharFormula, esc } from "../../helpers/utils.mjs";
import { syncItemEffectsDisabled } from "../../apps/effects.mjs";
import { collectTestMods } from "../../rules/roll-mods.mjs";
import { postTestCard, rollStatLine } from "../../helpers/test-card.mjs";
import { resolveWeaponPropsList, buildTargetEffectButtons, buildPropertyChatBlock,
         aggregateAuto, applyDamageDiceMods } from "../../combat/weapon-properties.mjs";
import { rollExtremeDamage } from "../../combat/attack.mjs";
import { rollInfoguard, infoguardInteractionSection } from "../../apps/infoguard.mjs";
import { showDelegateTestPicker } from "../../rules/delegate-test.mjs";
import { triggerAttackAnimation } from "../../integrations/autoanimations.mjs";
import { findTechImperative } from "../../constants/tech-imperatives.mjs";
import { applyImperative } from "../../rules/imperative.mjs";
import { isPsalmUnseenFortressItem, psalmUnseenFortressGrant } from "../../rules/psalm-unseen-fortress.mjs";
import { hasElectrovigour } from "../../rules/electrovigour.mjs";
import { pickReroll } from "../../rules/reroll-pick.mjs";
import { markUnseenDetectedUntilNextTurn } from "../../rules/unseen-attack.mjs";
import { testOutcome } from "../../rules/roll-outcome.mjs";
import { fieldFailsTechPower } from "../../rules/null-zones.mjs";
import { techActivationCost } from "../../rules/digital-hatred.mjs";
import { hasGlimpseOfOmniscience, hasOmnimnesis, hasDecompile, hasOverclock, hasRecompile, hasVotiveMass,
         COGNITION_REROLL_COST, DECOMPILE_COST, RECOMPILE_COST, OVERCLOCK_ENERGY_COST,
         OVERCLOCK_SELF_DAMAGE_PER_COG, OVERCLOCK_FLAG, overclockMax, votiveMassCost,
         recompileSources, processCostTotal, settleProcessCost, PROCESS_PAID_FLAG } from "../../rules/technomystic-talents.mjs";
import { applyCharDamage } from "../../combat/char-damage.mjs";
import { isEncounterActive, spendActionPoints } from "../../combat/action-economy.mjs";
import { tokenDistance } from "../../combat/facing.mjs";
import { inMeleeContact } from "../../combat/rig-steal.mjs";
import { writeToTarget } from "../../combat/gm-relay.mjs";
import { hasApocryphaCoil, hasCloudCognition, hasMotiveEucharist, planCoilTransfer, planCloudCognition,
         planMotiveEucharist, cloudCognitionCap, receivedNow, CLOUD_COGNITION_MAX, MOTIVE_EUCHARIST_MAX,
         CLOUD_COGNITION_TURN_FLAG, MOTIVE_EUCHARIST_TURN_FLAG, CLOUD_COGNITION_RECEIVED_FLAG }
  from "../../rules/technomystic-resources.mjs";

/** Карточка-уведомление Техножреца (компиляция, Разгон, Процессы, Декомпиляция) — ни броска, ни Порога. */
async function techNote(actor, title, line) {
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result"><div class="roll-header">${rollIcon("chart", "#8fd0ff")}${esc(title)}</div><div class="roll-threshold">${line}</div></div>`
  }, game.settings.get("core", "rollMode")));
}

/**
 * Быстрая компиляция Славословия за ⚙ (Sahara 3-2501).
 *
 *  - Вотивная Месса: «скомпилировать Славословие за полное ментальное действие,
 *    вместо <Рейтинг>×5 Минут, потратив <Рейтинг>×4 ⚙»;
 *  - Рекомпиляция: «за ментальное полудействие потратить 1 ⚙, чтобы заменить
 *    одно скомпилированное Славословие другим равного или меньшего рейтинга».
 *
 * Показывается только если Талант есть и ⚙ хватает. Время действия (полное/
 * полудействие) система не списывает — Ментальное действие ведёт стол.
 * @returns {Promise<boolean>} true — Славословие скомпилировано здесь
 */
async function offerFastCompile(actor, item, x) {
  const have = Number(actor.system.cognition?.value) || 0;
  const votiveCost = votiveMassCost(x);
  const votive = hasVotiveMass(actor) && have >= votiveCost;
  const swaps = (hasRecompile(actor) && have >= RECOMPILE_COST) ? recompileSources([...(actor.items ?? [])], item) : [];
  if (!votive && !swaps.length) return false;

  const buttons = [];
  if (votive) buttons.push({ action: "votive", label: `Вотивная Месса: −${votiveCost} ⚙, скомпилировать сразу` });
  for (const p of swaps) buttons.push({ action: `recompile:${p.id}`, label: `Рекомпиляция: заменить «${p.name}» (−${RECOMPILE_COST} ⚙)` });
  buttons.push({ action: "manual", label: `Обычная компиляция (${x}×5 минут)`, default: true });

  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: `Компиляция: ${item.name}` },
    content: `<p>«${esc(item.name)}» не скомпилировано. Когниции: <b>${have}</b>.</p>`,
    buttons: buttons.map(b => ({ ...b, callback: () => b.action })),
    rejectClose: false
  });

  if (choice === "votive") {
    await actor.update({ "system.cognition.value": Math.max(0, have - votiveCost) });
    await item.update({ "system.compiled": true });
    await techNote(actor, `Вотивная Месса: ${item.name}`,
      `Скомпилировано за полное ментальное действие: ${techIcon("cognition")} Когниция −<b>${votiveCost}</b> (${x}×4) вместо ${x * 5} минут.`);
    return true;
  }
  const m = /^recompile:(.+)$/.exec(String(choice ?? ""));
  if (m) {
    const old = swaps.find(p => p.id === m[1]);
    if (!old) return false;
    await actor.update({ "system.cognition.value": Math.max(0, have - RECOMPILE_COST) });
    await old.update({ "system.compiled": false });
    await item.update({ "system.compiled": true });
    await techNote(actor, `Рекомпиляция: ${item.name}`,
      `Вместо «${esc(old.name)}» скомпилировано «${esc(item.name)}» за ментальное полудействие: ${techIcon("cognition")} Когниция −<b>${RECOMPILE_COST}</b>.`);
    return true;
  }
  return false;
}

/** Активация Техночуда: Когниция + Энергия + тест Tech-Use (Ментальное) + урон. */
export async function activateTechMiracle(actor, item) {
  const sys      = item.system;
  // Цифровая Ненависть (rules/digital-hatred.mjs, Sahara 3-2501): −1 ⚙ к цене
  // активации (не Процессов) вредящего Техночуда, если ВСЕ цели — Ненавистные.
  // Цели — Foundry-таргет, тот же источник, что у Императива ниже.
  const hatredTargets = [...(game.user?.targets ?? [])].map(t => t.actor ?? null);
  const { cost: baseCogCost, discount: hatredDiscount } = techActivationCost(actor, item, hatredTargets);
  // Омнимнезис добавляет к цене ⚙ переброса (ниже) — поэтому let.
  let   cogCost  = baseCogCost;
  let   enCost   = sys.energyCost || 0;
  const cog      = actor.system.cognition || { value: 0, max: 0 };
  const en       = actor.system.energy || { value: 0, max: 0 };

  // Мононить «Поцелуй Мимика» (Volunteer Actor/Доброволец Актёр, wdbc-ux8a):
  // за доп. 10 сек/1м мононити персонаж лишается возможности творить
  // техночудеса — тот же гейт, что module/sheets/tabs/psychic.mjs у психосил.
  if (actor.system.conditions?.mimicWireBlocksPowers) {
    ui.notifications.warn(`«${item.name}»: мононить блокирует техночудеса.`);
    return;
  }

  if (cogCost > (cog.value || 0)) {
    ui.notifications.warn(`Недостаточно Когниции: нужно ${cogCost}, есть ${cog.value || 0}.`);
    return;
  }

  // ── Славословие: требует предварительной компиляции (X×5 минут) ──────────
  // Может быть primary-типом (X = sys.rating) ИЛИ элементом extraTypes на
  // предмете другого primary-типа (напр. «Императив (I.b×2), Славословие(1)»
  // — wdbc-lp7r) — тогда X свой, из самого extraType, а sys.rating занят под
  // основной тип. isItemActive (module/apps/effects.mjs) уже читает оба
  // случая тем же способом — держим гейт активации в согласии с ним.
  const slavoExtra = (sys.extraTypes || []).find(e => e.type === "slavoslovie");
  const isSlavo = sys.miracleType === "slavoslovie" || !!slavoExtra;
  if (isSlavo && !sys.compiled) {
    const x = sys.miracleType === "slavoslovie" ? (sys.rating || 1) : (slavoExtra?.x || 1);
    // Вотивная Месса и Рекомпиляция (rules/technomystic-talents.mjs, Sahara 3-2501):
    // быстрые способы компиляции за ⚙ вместо X×5 минут. Предлагаются, только если
    // Талант есть и ⚙ хватает; отказ — обычная компиляция ниже.
    const compiledNow = await offerFastCompile(actor, item, x);
    if (compiledNow) return;
    // Уведомление «идёт компиляция», а не карточка теста: ни броска, ни Порога
    // — на общий сборщик helpers/test-card.mjs не переводится (wdbc-kuun).
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `
          <div class="wh-roll-result">
            <div class="roll-header">${rollIcon("chart","#8fd0ff")}Компиляция Славословия: ${esc(item.name)}</div>
            <div class="roll-threshold">Требуется компиляция <b>${x}×5 = ${x * 5}</b> минут. Держится как Процесс с Ценой ½X = <b>${Math.ceil(x / 2)}</b> Когниции.</div>
            <div class="roll-outcome"><span class="roll-success">Отметьте «Скомпилировано» на листе техночуда, затем активируйте.</span></div>
          </div>`
    }, game.settings.get("core", "rollMode")));
    return;
  }

  // ── Железо (Технофокусы): наименее качественный из установленных ─────────
  // Poor −10 / Good +5 / Best +10 к тесту и к I.b в формулах. Если требуемый
  // имплант не установлен — Техночудо нельзя использовать.
  const QLABEL = { poor: "Poor.Q", common: "Comm.Q", good: "Good.Q", best: "Best.Q" };
  let ironMod = 0, ironLine = "", ironIbDelta = 0;
  const ironReqRaw = String(sys.iron || "").trim();
  if (ironReqRaw) {
    const reqs    = ironReqRaw.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    const focus   = actor.system.techFocus || [];
    const matched = [], missing = [];
    for (const req of reqs) {
      const rl  = req.toLowerCase();
      const hit = focus.find(f => {
        const fl = f.name.toLowerCase();
        return fl.includes(rl) || fl.split("/").some(p => p.trim() && rl.includes(p.trim()));
      });
      if (hit) matched.push(hit); else missing.push(req);
    }
    if (missing.length) {
      ui.notifications.warn(`Нет нужного Железа (Технофокуса): ${missing.join(", ")}. Техночудо нельзя использовать без него.`);
      return;
    }
    const worstQ = leastQuality(matched.map(m => m.quality)) || "common";
    ironMod      = ironModForQuality(worstQ);
    ironIbDelta  = Math.trunc(ironMod / 10); // best +1 I.b, poor −1, good/comm 0
    ironLine     = `Железо (${matched.map(m => `${m.name.split("/")[0].trim()} ${QLABEL[m.quality]}`).join(", ")}) → тест ${ironMod >= 0 ? "+" : ""}${ironMod}`;
  }

  const skKey      = sys.testSkill || "techUse";
  const skillDef   = SKILLS_DEF[skKey];
  const skillLabel = skillDef?.label ?? "Tech-Use";
  const sk         = actor.system.skills?.[skKey];
  const base       = sk?.total ?? -20;
  // Общий сбор модификаторов (wdbc-ct65.2): раньше здесь стояла одна
  // Усталость, а «+10 к тестам Технопользования» с Черты или импланта в
  // активацию Техночуда не попадало — путь шёл мимо реестра правил.
  const ruleMods   = collectTestMods(actor, { kind: "skill", skill: skKey, char: skillDef?.char ?? "int" });
  const testMod    = sys.testMod || 0;
  const eff        = base + ruleMods.total + testMod + ironMod;
  const allRolls   = [];

  // ── Компенсатор (X): тест Т−(10×X) снижает цену в ⚡ на 1 за Успех ─────────
  // Мод. Качества Железа НЕ применяется. Бонус имплантов (Печь/Инферния/Solar).
  let compLine = "";
  let compX = sys.miracleType === "compensator" ? (sys.rating || 0) : 0;
  const compExtra = (sys.extraTypes || []).find(e => e.type === "compensator");
  if (compExtra) compX = Math.max(compX, compExtra.x || 0);
  if (compX > 0 && enCost > 0) {
    const compBonus = actor.system.techCompBonus || 0;
    const tTot   = actor.system.characteristics?.t?.total ?? 0;
    const compTh = tTot - 10 * compX + compBonus;
    // Electrovigour (wdbc-u0by): «Преимущество на тесты Т на Техночудеса с
    // типом Компенсатор» — безусловно, авто (кнопка активации без диалога).
    const electro = hasElectrovigour(actor);
    const cRolled = [];
    for (let i = 0; i < (electro ? 2 : 1); i++) cRolled.push(await new Roll("1d100").evaluate());
    allRolls.push(...cRolled);
    const cPicked = pickReroll(cRolled.map(r => r.total), "keepBest");
    const cRoll  = cRolled[cPicked.index];
    const { success: cSucc, deg: cDeg } = testOutcome(cRoll.total, compTh);
    const reduce = cSucc ? Math.min(enCost, cDeg) : 0;
    const enBefore = enCost;
    enCost = Math.max(0, enCost - reduce);
    const electroNote = cPicked.dropped.length ? `, Электрорвение: Преимущество, отброшено ${cPicked.dropped.join(", ")}` : "";
    compLine = rollStatLine({
      label: `Компенсатор (X${compX})`, base: tTot,
      parts: [`T−${10 * compX}`, ...(compBonus ? [`+${compBonus}`] : [])],
      threshold: compTh, rv: cRoll.total, rerollNote: electroNote
    }) + `<div class="roll-threshold" style="font-size:0.85em;">${cSucc ? `−${reduce} ⚡ (${enBefore}→${enCost})` : `Провал, цена ${enCost} ⚡`}</div>`;
  }

  // Проверка Энергии — после снижения Компенсатором, до основного теста
  if (enCost > (en.value || 0)) {
    ui.notifications.warn(`Недостаточно Энергии (Катушка Потенции): нужно ${enCost}, есть ${en.value || 0}.`);
    return;
  }

  // ── Основной тест активации ──────────────────────────────────────────────
  const roll    = await new Roll("1d100").evaluate();
  allRolls.push(roll);
  // Поле Дискорданта (rules/null-zones.mjs): цель — или сам техножрец, если
  // цели нет, — в поле: «автоматически проваливаются… считается как
  // Критический Провал». Куб брошен для истории, в зачёт идёт 100.
  const fieldTarget = [...(game.user?.targets ?? [])][0]?.actor ?? null;
  const fieldFail = fieldFailsTechPower(actor, fieldTarget);
  // Провал — и при пороге ≥ 100, где «100 ≤ порога» иначе прошло бы Успехом.
  let rv      = fieldFail ? 100 : roll.total;
  let success = !fieldFail && rv <= eff;
  let deg     = Math.floor(Math.abs(rv - eff) / 10) + 1;

  // Омнимнезис: «потратить 1 ⚙, чтобы перебросить тест I на активацию Техночуда».
  // Спрашиваем только после провала (по успеху переброс обычно не нужен) и если
  // ⚙ хватает на переброс сверх цены активации. Поле Дискорданта перебросом не
  // обходится — оно не бросок, а автопровал. Переброс заменяет результат.
  let omnimnesisLine = "";
  if (!success && !fieldFail && hasOmnimnesis(actor)
      && (cog.value || 0) - cogCost >= COGNITION_REROLL_COST) {
    const again = await foundry.applications.api.DialogV2.confirm({
      window: { title: `Омнимнезис — ${actor.name}` },
      content: `<p>Активация «${esc(item.name)}» провалена (бросок <b>${rv}</b> при Пороге <b>${eff}</b>). Потратить <b>${COGNITION_REROLL_COST} ⚙</b> и перебросить?</p>`,
      yes: { label: `Перебросить (−${COGNITION_REROLL_COST} ⚙)` }, no: { label: "Нет" },
      rejectClose: false
    });
    if (again) {
      const roll2 = await new Roll("1d100").evaluate();
      allRolls.push(roll2);
      cogCost += COGNITION_REROLL_COST;
      omnimnesisLine = `Омнимнезис: −${COGNITION_REROLL_COST} ⚙, переброс ${rv} → ${roll2.total}`;
      rv = roll2.total;
      success = rv <= eff;
      deg = Math.floor(Math.abs(rv - eff) / 10) + 1;
    }
  }

  // Трата ресурсов: Когниция ⚙ — всегда (до теста), Энергия ⚡ — только при Успехе.
  const resUpd = {};
  if (cogCost > 0)            resUpd["system.cognition.value"] = Math.max(0, (cog.value || 0) - cogCost);
  if (enCost  > 0 && success) resUpd["system.energy.value"]    = Math.max(0, (en.value  || 0) - enCost);

  // Псалом Незримой Крепости (wdbc-173l): +2 аблативные Раны за Успех этой
  // активации — переоформляет прошлый Купол, не складывает между активациями
  // (module/rules/psalm-unseen-fortress.mjs).
  let psalmSection = "";
  const FLAG = "warhammer-dbc", PSALM_FLAG = "psalmUnseenFortressAblative";
  if (success && isPsalmUnseenFortressItem(item)) {
    const prevContribution = Number(actor.getFlag(FLAG, PSALM_FLAG)) || 0;
    const result = psalmUnseenFortressGrant(actor.system, prevContribution, deg);
    resUpd["system.wounds.ablative"] = result.ablative;
    resUpd["system.wounds.ablativeMax"] = result.ablativeMax;
    resUpd[`flags.${FLAG}.${PSALM_FLAG}`] = result.contribution;
    psalmSection = `<div class="roll-threshold">Купол Рефрактора: <b>${result.contribution}</b> аблативных Ран (2×${deg} Успех${deg === 1 ? "" : "а"})</div>`;
  }

  if (Object.keys(resUpd).length) await actor.update(resUpd);

  // Славословие: при успехе компиляция расходуется (одноразово)
  if (isSlavo && success) await item.update({ "system.compiled": false });

  // Свойства атаки Техночуда — тот же движок, что у оружия и психосил (стр.
  // 166-170): раньше поля для них не было вовсе, и Экстремальный урон/Рвущее/
  // Проверенное для техночудес не считались — только текстом в «Эффекте».
  const atkProps = resolveWeaponPropsList(sys.weaponProps);
  const wp       = aggregateAuto(atkProps);

  // Урон (если задан и активация удалась)
  let dmgSection = "";
  if (success && sys.damage) {
    // Качество Железа модифицирует I.b в формулах эффектов/дальности (best +1, poor −1).
    let chars = actor.system.characteristics;
    if (ironIbDelta && chars?.int) {
      chars = foundry.utils.deepClone(chars);
      chars.int.bonus = (chars.int.bonus || 0) + ironIbDelta;
    }
    const f = applyDamageDiceMods(
      resolveCharFormula(String(sys.damage).replace(/\bX\b/gi, sys.rating || 0), chars, actor.system.corruptionBonus ?? 0),
      wp
    );
    try {
      const dmgRoll = await new Roll(f).evaluate();
      allRolls.push(dmgRoll);
      // Экстремальный урон (стр. 166-170) — тот же расчёт, что у оружия/психосил.
      const ext = await rollExtremeDamage(dmgRoll, { wp, damageType: sys.damageType, hitLocation: "Торс", attacker: actor });
      if (ext.exRoll) allRolls.push(ext.exRoll);
      const dt  = DAMAGE_TYPES[sys.damageType] || sys.damageType;
      const pen = sys.penetration || 0;
      const extStr = ext.hasExtreme ? `
          <div class="roll-extreme-block">
            <b>Экстремальный урон</b> · d5: ${ext.extremeLevel}
            ${ext.critEffect ? `<div class="roll-crit-effect">${ext.critEffect}</div>` : ""}
          </div>` : "";
      dmgSection = `
          <div class="roll-damage-section">
            <div class="roll-damage-label">Урон (${dt}, Проб. ${pen}): <b>${dmgRoll.total}</b></div>
            <button class="wh-apply-dmg-btn" type="button"
              data-damage="${dmgRoll.total}" data-penetration="${pen}"
              data-damage-type="${sys.damageType}" data-damage-subtype="${sys.damageSubtype || ""}"
              data-hit-location="Торс"
              data-weapon-name="${item.name}" data-attacker="${actor.name}" data-attacker-uuid="${actor.uuid}"
              data-felling="${wp.fellingRating ?? 0}"
              data-primitive="${wp.primitive ? 1 : 0}"
              data-ignore-shield="${wp.ignoreShield ? 1 : 0}"
              data-warp-soak="${wp.warpSoak ? 1 : 0}"
              data-lance="${wp.lance ? 1 : 0}"
              data-sanctified="${wp.sanctified ? 1 : 0}"
              data-has-extreme="${ext.hasExtreme ? 1 : 0}">
              Применить урон: ${dmgRoll.total} → Торс
            </button>
          </div>${extStr}`;
    } catch(e) { ui.notifications.warn(`Не удалось бросить урон: ${sys.damage}`); console.error(e); }
  }

  // Свойства атаки: памятки + кнопки эффектов на цель — то же, что у оружия/психосил.
  let attackPropsSection = "";
  if (success && atkProps.length) {
    const propBlock  = buildPropertyChatBlock(atkProps);
    const effectBtns = buildTargetEffectButtons(atkProps, { hit: true });
    attackPropsSection = (propBlock || "") + (effectBtns || "");
  }

  const cogIco = techIcon("cognition");
  const enIco  = techIcon("energy");
  const costLine = [
    cogCost ? `${cogIco} Когниция −<b>${cogCost}</b>${hatredDiscount ? ` <span title="Цифровая Ненависть: все цели — Ненавистные">(Цифровая Ненависть −${hatredDiscount})</span>` : ""}` : "",
    // Цена дошла до 0 только благодаря скидке — без подсказки игрок не поймёт, куда делась Когниция.
    (!cogCost && hatredDiscount) ? `${cogIco} Когниция −<b>0</b> <span title="Цифровая Ненависть: все цели — Ненавистные">(Цифровая Ненависть −${hatredDiscount})</span>` : "",
    enCost  ? `${enIco} Энергия −<b>${enCost}</b>`    : "",
    (sys.sustained && sys.sustainCost) ? `Поддержание ${sys.sustainCost} ${cogIco}/Ход` : ""
  ].filter(Boolean).join(" | ");

  // Автоматизация «vs Инфограждение» (Numerica Curse/Delving, Scrapcode
  // Injection, Techsorcism Purge) и усиливающих чудес (Techsorcism Ward,
  // Vox Warding) — module/apps/infoguard.mjs.
  const infoguardSection = await infoguardInteractionSection(actor, item, { success });

  // ── Императив (wdbc-yu32): раздача временного баффа целям, взятым из
  // Foundry-таргета (game.user.targets) — тот же приём, что у Bone Song/
  // Песни Стремительности (combat/bone-song.mjs, combat/song-of-swiftness.mjs).
  // Бонус остаётся редактируемым числом (диалог), «до конца следующего Хода
  // или до замены» гейтит module/rules/imperative.mjs.
  let imperativeSection = "";
  const imperativeConfig = success ? findTechImperative(item) : null;
  if (imperativeConfig) {
    const targets = [...(game.user.targets ?? [])].map(t => t.actor).filter(Boolean);
    if (!targets.length) {
      imperativeSection = `<div class="roll-threshold" style="font-size:0.85em;">${rollIcon("warn","#ffb84d")}Императив: цели не выбраны — наведите Foundry-таргет на согласных целей и активируйте снова.</div>`;
    } else {
      const raw = await foundry.applications.api.DialogV2.wait({
        window: { title: imperativeConfig.label },
        content: `<label>Бонус/штраф на Избегания: <input type="number" name="bonus" value="${imperativeConfig.evasionBonus}" autofocus/></label>
          <p style="font-size:0.85em;opacity:.8;">${esc(imperativeConfig.evasionRecoilNote)}</p>`,
        buttons: [
          { action: "apply", label: "Наложить", default: true,
            callback: (_ev, button) => button.form.querySelector('[name="bonus"]')?.value },
          { action: "cancel", label: "Отмена", callback: () => null }
        ],
        rejectClose: false
      });
      if (raw === null || raw === undefined) {
        imperativeSection = `<div class="roll-threshold" style="font-size:0.85em;">Императив: наложение отменено.</div>`;
      } else {
        const chosen = Number(raw) || 0;
        const bonuses = {
          evasionBonus: chosen,
          // wdbc-hdxj: recoil-специфичный знак («кроме Отскока в укрытие»,
          // Evasion −20/Fortress +20) — фиксирован книгой, НЕ следует за
          // отредактированным chosen выше; читается декларацией «планирую
          // Отскочить в укрытие?» в диалоге Уклонения (imperative-bonuses.mjs
          // ::evasionImperativeBonus, planningRecoil).
          evasionRecoilBonus: imperativeConfig.evasionRecoilBonus,
          coverApDelta: imperativeConfig.coverApDelta,
          coverApFloorRatio: imperativeConfig.coverApFloorRatio,
          coverApCeilRatio: imperativeConfig.coverApCeilRatio
        };
        for (const targetActor of targets) {
          await applyImperative(targetActor, { sourceItem: item, casterActor: actor, label: imperativeConfig.label, bonuses });
        }
        imperativeSection = `<div class="roll-threshold">${rollIcon("bolt","#ffd24d")}${esc(imperativeConfig.label)}: ${chosen >= 0 ? "+" : ""}${chosen} на Избегания → ${targets.map(t => esc(t.name)).join(", ")}. До конца следующего Хода или до замены.</div>
          <div class="roll-threshold" style="font-size:0.85em;opacity:.8;">${esc(imperativeConfig.evasionRecoilNote)}</div>`;
      }
    }
  }

  const techDice = (await Promise.all(allRolls.map(r => r.render()))).join("");
  await postTestCard(actor, {
    icon: rollIcon("gear", "#8fd0ff"), title: `Техночудо: ${esc(item.name)}`,
    threshold: rollStatLine({
      label: skillLabel, base,
      parts: [...(testMod !== 0 ? [`${testMod >= 0 ? "+" : ""}${testMod}`] : []), ...ruleMods.parts],
      threshold: eff, rv
    }),
    lines: [
      ironLine ? `<div class="roll-threshold" style="font-size:0.85em;">${ironLine}</div>` : "",
      compLine,
      omnimnesisLine ? `<div class="roll-threshold" style="font-size:0.85em;">${omnimnesisLine}</div>` : "",
      costLine ? `<div class="roll-threshold">${costLine}</div>` : "",
      sys.range ? `<div class="roll-threshold" style="font-size:0.85em;">Дальность: <b>${sys.range}</b></div>` : ""
    ],
    outcome: fieldFail
      ? `<span class="roll-failure">Поле Дискорданта: Критический Провал — техночудо сорвано, импланты сбоят.</span>`
      : success
      ? `<span class="roll-success">Активировано — ${deg} ${_degWord(deg)}</span>`
      : `<span class="roll-failure">Сбой — ${deg} ${_degWord(deg)}</span>`,
    sections: [
      dmgSection, psalmSection, attackPropsSection, infoguardSection, imperativeSection,
      sys.effect ? `<div class="roll-threshold">${sys.effect}</div>` : "",
      `<details class="roll-dice-details"><summary>${rollIcon("chart","#8fd0ff")}Показать кубы</summary>${techDice}</details>`
    ]
  }, { rolls: allRolls });
  // Automated Animations (если установлен и включён) — module/integrations/autoanimations.mjs.
  triggerAttackAnimation({ actor, item, hit: success });
}

// ── Генерация Когниции/Энергии от имплантов Кибернетики Механикум ──────────
export async function techGenResource(actor, item, { res, amount, fromCognition }) {
  if (!item) return;
  const QL   = { poor: "Poor.Q", common: "Comm.Q", good: "Good.Q", best: "Best.Q" };
  const q    = item.system.quality || "common";
  const sys  = actor.system;
  const cog  = sys.cognition || { value: 0, max: 0 };
  const en   = sys.energy    || { value: 0, max: 0, maxTotal: 0 };
  const enMax = en.maxTotal ?? en.max ?? 0;
  const src  = item.name.split("/")[0].trim();
  const upd  = {};
  let msg = "";

  if (fromCognition > 0) {
    // Конверсия ⚙→⚡ (Двигатель Холодного Синтеза). Цена по Качеству.
    const ratio  = (q === "poor" || q === "good") ? 4 : 3; // ⚙ за 1⚡
    const gained = Math.floor((cog.value || 0) / ratio);
    const room   = Math.max(0, enMax - (en.value || 0));
    const gain   = Math.min(gained, room);
    if (gain <= 0) {
      ui.notifications.warn(room <= 0 ? "Катушка Потенции уже заполнена." : `Недостаточно Когниции (нужно ${ratio}⚙ на 1⚡).`);
      return;
    }
    const spend = gain * ratio;
    upd["system.cognition.value"] = Math.max(0, (cog.value || 0) - spend);
    upd["system.energy.value"]    = Math.min(enMax, (en.value || 0) + gain);
    msg = `${src}: −${spend} ⚙ → +${gain} ⚡ (${ratio}⚙/1⚡, ${QL[q]})`;
  } else if (res === "energy") {
    const room = Math.max(0, enMax - (en.value || 0));
    const gain = Math.min(amount, room);
    if (gain <= 0) { ui.notifications.warn("Катушка Потенции уже заполнена."); return; }
    upd["system.energy.value"] = (en.value || 0) + gain;
    msg = `${src}: +${gain} ⚡`;
  } else {
    const gain = Math.min(amount, Math.max(0, (cog.max || 0) - (cog.value || 0)));
    if (gain <= 0) { ui.notifications.warn("Когниция уже на максимуме."); return; }
    upd["system.cognition.value"] = (cog.value || 0) + gain;
    msg = `${src}: +${gain} ⚙`;
  }
  await actor.update(upd);
  const pretty = msg.replace(/⚙/g, techIcon("cognition")).replace(/⚡/g, techIcon("energy"));
  // Сводка по энергосистеме — уведомление, не карточка теста (ни броска, ни
  // Порога): на общий сборщик не переводится (wdbc-kuun).
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result"><div class="roll-header">${techIcon("energy")} Энергосистема Механикум</div><div class="roll-threshold">${pretty}</div></div>`
  }, game.settings.get("core", "rollMode")));
}

/** Сводка энергосистемы в чат — уведомление, не карточка теста. */
async function energyNote(actor, text) {
  const pretty = text.replace(/⚡/g, techIcon("energy"));
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result"><div class="roll-header">${techIcon("energy")} Катушка Потенции</div><div class="roll-threshold">${pretty}</div></div>`
  }, game.settings.get("core", "rollMode")));
}

/**
 * Катушка Потенции (книга): «Персонаж может тратить заряды, снимая Усталость
 * по цене 2к1, но не убирая потребность во сне (в т.ч. вне своего Хода)».
 * Смена Усталости — общим путём fatigueChangeFields (обморок/пробуждение).
 */
export async function coilRelieveFatigue(actor) {
  const en = actor.system.energy || { value: 0 };
  const res = coilFatigueRelief({ energy: en.value, fatigue: actor.system.fatigue?.value });
  if (!res.ok) {
    ui.notifications.warn(res.reason === "fatigue" ? "Усталости нет — снимать нечего."
      : `Мало зарядов: нужно ${COIL_FATIGUE_COST}⚡.`);
    return;
  }
  const fat = fatigueChangeFields(actor, res.fatigue);
  await actor.update({ "system.energy.value": res.energy, ...fat.fields });
  await announceFatigueChange(actor, fat);
  await energyNote(actor, `−${COIL_FATIGUE_COST} ⚡ → −1 Усталости (осталось ⚡ ${res.energy}, Усталость ${res.fatigue}). Потребность во сне не снимается.`);
}

/**
 * Электу-Индукторы (книга): «за полное действие заряжать Катушки Потенции от
 * электросети или от батарей тестом Tech-Use+0, восстанавливая 1 заряд за
 * каждый Успех до максимума». Модификатор по Качеству Индукторов — запись
 * Конструктора с областью coilCharge (Poor.Q — сам в Пороге, Good/Best —
 * галочкой в диалоге); мощность источника
 * и разряд батареи — решение ГМа.
 */
export async function coilCharge(actor, rollSkill, { apocrypha = false } = {}) {
  // Катушка Апокрифа (Талант Техномистика, пачка J): «заряжать саму Катушку Апокрифу
  // через Электу-Индукторы за полное действие как обычно, вместо основной».
  if (apocrypha && !hasApocryphaCoil(actor)) return;
  const def = SKILLS_DEF.techUse;
  const sk  = actor.system.skills?.techUse;
  const r = await rollSkill(apocrypha ? "⚡ Зарядка Катушки Апокрифа (Tech-Use)" : "⚡ Зарядка Катушки Потенции (Tech-Use)",
    sk?.total ?? -20, def?.char ?? "int", { skill: "techUse", coilCharge: true });
  if (!r) return;
  const en = (apocrypha ? actor.system.apocryphaEnergy : actor.system.energy) || { value: 0 };
  const max = apocrypha ? (en.max ?? 0) : (en.maxTotal ?? en.max ?? 0);
  const gain = electooChargeGain({ success: r.success, deg: r.deg, energy: en.value, max });
  if (gain <= 0) {
    if (r.success) ui.notifications.info(apocrypha ? "Катушка Апокрифа уже заполнена." : "Катушка Потенции уже заполнена.");
    return;
  }
  await actor.update({ [apocrypha ? "system.apocryphaEnergy.value" : "system.energy.value"]: (Number(en.value) || 0) + gain });
  await energyNote(actor, `Электу-Индукторы${apocrypha ? " → Катушка Апокрифа" : ""}: +${gain} ⚡ (${r.deg} ${_degWord(r.deg)}, максимум ${max}).`);
}

// ── Таланты Техномистика, перекладывающие ресурсы (пачка J, Sahara 3-2501) ───

/** Одна цель Foundry-таргета: { token, actor } либо null (нет цели / целей несколько). */
function singleTargetOf() {
  const targets = [...(game.user?.targets ?? [])];
  if (targets.length !== 1) return null;
  const token = targets[0];
  const tActor = token.actor ?? token.document?.actor ?? null;
  return tActor ? { token, actor: tActor } : null;
}

/** Диалог «сколько?» с одной кнопкой «go» и числом n (1…max). Возвращает число либо null. */
async function askAmount(actor, title, text, max) {
  const raw = await foundry.applications.api.DialogV2.wait({
    window: { title: `${title} — ${actor.name}` },
    content: `<p>${text}</p><label>Сколько (1–${max}): <input type="number" name="n" value="${max}" min="1" max="${max}" autofocus/></label>`,
    buttons: [
      { action: "go", label: "Передать", default: true, callback: (_ev, button) => button.form.querySelector('[name="n"]')?.value },
      { action: "cancel", label: "Отмена", callback: () => null }
    ],
    rejectClose: false
  });
  if (raw === null || raw === undefined || raw === "cancel") return null;
  return Math.max(1, Math.min(max, parseInt(raw) || 1));
}

/**
 * Катушка Апокрифа: перенос ⚡ между основной Катушкой и Апокрифой «за полудействие
 * без всяких тестов». Направление и число выбирает игрок; ОД списываются только
 * когда есть что переносить. Заряды Апокрифы напрямую не тратятся: Усталость,
 * Техночудеса и Разгон берут только из основной Катушки.
 */
export async function apocryphaTransfer(actor) {
  if (!hasApocryphaCoil(actor)) return;
  const en = actor.system.energy || { value: 0, max: 0 };
  const ap = actor.system.apocryphaEnergy || { value: 0, max: 0 };
  const mainMax = en.maxTotal ?? en.max ?? 0;
  const cap = Math.max(1, Math.max(Number(en.value) || 0, Number(ap.value) || 0, Number(ap.max) || 0));
  const pick = await foundry.applications.api.DialogV2.wait({
    window: { title: `Перенос ⚡ — ${actor.name}` },
    content: `<p>Полудействие, без теста. Основная Катушка: <b>${en.value ?? 0}</b> / ${mainMax}; Апокрифа: <b>${ap.value ?? 0}</b> / ${ap.max ?? 0}.</p>
      <label>⚡: <input type="number" name="n" value="1" min="1" max="${cap}" autofocus/></label>`,
    buttons: [
      { action: "toApocrypha", label: "→ в Апокрифу", default: true,
        callback: (_ev, button) => ({ direction: "toApocrypha", n: button.form.querySelector('[name="n"]')?.value }) },
      { action: "fromApocrypha", label: "← в основную",
        callback: (_ev, button) => ({ direction: "fromApocrypha", n: button.form.querySelector('[name="n"]')?.value }) },
      { action: "cancel", label: "Отмена", callback: () => null }
    ],
    rejectClose: false
  });
  if (!pick || typeof pick !== "object") return;
  const plan = planCoilTransfer({ direction: pick.direction, amount: parseInt(pick.n) || 1,
    main: { value: en.value, max: mainMax }, apoc: { value: ap.value, max: ap.max } });
  if (!plan.ok) {
    ui.notifications.warn(plan.reason === "source" ? "Перенос: в Катушке-источнике нет зарядов."
      : plan.reason === "full" ? "Перенос: в приёмной Катушке нет свободного места (она полна)."
      : "Перенос: укажите число ⚡ от 1.");
    return;
  }
  if (!await spendActionPoints(actor, 1)) { ui.notifications.warn("Перенос ⚡ — полудействие: не хватает ОД."); return; }
  await actor.update({ "system.energy.value": plan.main, "system.apocryphaEnergy.value": plan.apoc });
  const dirText = pick.direction === "toApocrypha" ? "основная → Апокрифа" : "Апокрифа → основная";
  await energyNote(actor, `Катушка Апокрифа, перенос (${dirText}): <b>${plan.moved}</b> ⚡. Основная ${plan.main} / ${mainMax}, Апокрифа ${plan.apoc} / ${ap.max ?? 0}.`);
}

/** Цель вне досягаемости / в Ноосфере? Возвращает текст отказа либо "". */
function transferBlock(actor, tgt, { radius = null, contact = false } = {}) {
  if (!tgt) return "Отметьте ровно одну цель (Foundry-таргет).";
  if (tgt.actor === actor || tgt.actor?.uuid === actor.uuid) return "Цель — не вы сами.";
  const mine = actor.getActiveTokens?.()[0] ?? null;
  if (mine) {
    if (contact && !inMeleeContact(mine, tgt.token)) return "Цель не в базовом контакте.";
    if (radius != null) {
      const d = tokenDistance(mine, tgt.token);
      if (d != null && d > radius) return `Цель вне радиуса ${radius} м (до неё ≈ ${Math.round(d)} м).`;
    }
  }
  return "";
}

/**
 * Облачная Когниция: «Если он подключен к Ноосфере, раз в Ход за свободное действие
 * пройти тест Tech-Use(I)+0, чтобы передать до 2 своей ⚙ любому согласному
 * подключенному к Ноосфере существу в радиусе I×2м. Цель не может восстановить
 * так более ½I.b (окр.▲) ⚙ в Раунд». Запись в цель — через ГМ-релей
 * (combat/gm-relay.mjs); «раз в Ход» следим только в бою (как Разгон).
 */
export async function cloudCognition(actor, rollSkill) {
  if (!hasCloudCognition(actor)) return;
  const warn = text => ui.notifications.warn(`Облачная Когниция: ${text}`);
  if (!actor.system.noosphereConnected) return warn("вы не подключены к Ноосфере (тумблер на вкладке ТЕХ).");
  if (isEncounterActive() && actor.getFlag?.("warhammer-dbc", CLOUD_COGNITION_TURN_FLAG)) return warn("уже использована в этом Ходу.");
  const tgt = singleTargetOf();
  const radius = Math.max(0, Number(actor.system.characteristics?.int?.total) || 0) * 2;
  const block = transferBlock(actor, tgt, { radius });
  if (block) return warn(block);
  if (!tgt.actor.system?.noosphereConnected) return warn(`${tgt.actor.name} не подключён к Ноосфере.`);
  const cap = cloudCognitionCap(tgt.actor);
  const inCombat = isEncounterActive();
  const receivedOf = () => inCombat ? receivedNow(tgt.actor.getFlag?.("warhammer-dbc", CLOUD_COGNITION_RECEIVED_FLAG), game.combat?.id) : 0;
  const planNow = amount => planCloudCognition({ amount, giverCognition: actor.system.cognition?.value,
    receiver: tgt.actor.system.cognition, received: receivedOf(), cap });
  const pre = planNow(CLOUD_COGNITION_MAX);
  if (!pre.ok) {
    return warn(pre.reason === "giver" ? "у вас нет Когниции для передачи."
      : pre.reason === "full" ? `у ${tgt.actor.name} Когниция уже полна.`
      : `${tgt.actor.name} уже получил(а) потолок ½I.b (${cap}) ⚙ в этом Раунде.`);
  }
  const n = await askAmount(actor, "Облачная Когниция",
    `Передать ⚙ → <b>${esc(tgt.actor.name)}</b> (Tech-Use+0; цель получит не больше ${pre.moved} ⚙).`, pre.moved);
  if (n == null) return;
  const def = SKILLS_DEF.techUse;
  const sk  = actor.system.skills?.techUse;
  const r = await rollSkill("☁ Облачная Когниция (Tech-Use)", sk?.total ?? -20, def?.char ?? "int",
    { skill: "techUse", noosphere: true });
  if (!r) return;
  // Попытка потрачена, даже если тест провален («раз в Ход» — на каждую попытку).
  if (inCombat) await actor.setFlag("warhammer-dbc", CLOUD_COGNITION_TURN_FLAG, true);
  if (!r.success) {
    await techNote(actor, "Облачная Когниция", `Tech-Use+0 провален (${r.deg} ${_degWord(r.deg)}) — ${techIcon("cognition")} ${esc(tgt.actor.name)} ничего не получил(а).`);
    return;
  }
  const plan = planNow(n);   // свежие числа: пока шёл тест, кто-то мог и поменять
  if (!plan.ok) return warn("передать уже нечего (цель заполнилась или потолок Раунда исчерпан).");
  if (!await writeToTarget(tgt.actor, { kind: "grantCognition", amount: plan.moved }, actor)) return;
  await actor.update({ "system.cognition.value": (Number(actor.system.cognition.value) || 0) - plan.moved });
  await techNote(actor, "Облачная Когниция",
    `${techIcon("cognition")} −<b>${plan.moved}</b> у ${esc(actor.name)}, +<b>${plan.moved}</b> у ${esc(tgt.actor.name)} (потолок Раунда цели ${cap}).`);
}

/**
 * Мотивное Причастие: «раз в Ход за свободное действие передать до 3 своей ⚡
 * любому согласному персонажу в базовом контакте» — подпитывая его Катушки
 * Потенции. Основная Катушка цели заполняется первой, излишек — в Апокрифу.
 */
export async function motiveEucharist(actor) {
  if (!hasMotiveEucharist(actor)) return;
  const warn = text => ui.notifications.warn(`Мотивное Причастие: ${text}`);
  if (isEncounterActive() && actor.getFlag?.("warhammer-dbc", MOTIVE_EUCHARIST_TURN_FLAG)) return warn("уже использовано в этом Ходу.");
  const tgt = singleTargetOf();
  const block = transferBlock(actor, tgt, { contact: true });
  if (block) return warn(block);
  const tEn = tgt.actor.system?.energy;
  const receiver = () => ({
    main: { value: tgt.actor.system.energy?.value, max: tgt.actor.system.energy?.maxTotal ?? tgt.actor.system.energy?.max },
    apoc: hasApocryphaCoil(tgt.actor) && (Number(tgt.actor.system.apocryphaEnergy?.max) || 0) > 0
      ? { value: tgt.actor.system.apocryphaEnergy.value, max: tgt.actor.system.apocryphaEnergy.max } : null
  });
  if (!tEn) return warn(`у ${tgt.actor.name} нет Катушки Потенции.`);
  const planNow = amount => planMotiveEucharist({ amount, giverEnergy: actor.system.energy?.value, receiver: receiver() });
  const pre = planNow(MOTIVE_EUCHARIST_MAX);
  if (!pre.ok) {
    return warn(pre.reason === "giver" ? "в вашей Катушке нет ⚡ для передачи."
      : `Катушки ${tgt.actor.name} полны — подпитывать нечего (или Катушка не установлена).`);
  }
  const n = await askAmount(actor, "Мотивное Причастие",
    `Передать ⚡ → <b>${esc(tgt.actor.name)}</b> (свободное действие; цель примет не больше ${pre.moved} ⚡).`, pre.moved);
  if (n == null) return;
  const plan = planNow(n);
  if (!plan.ok) return warn("передать уже нечего.");
  if (!await writeToTarget(tgt.actor, { kind: "grantEnergy", amount: plan.moved }, actor)) return;
  await actor.update({ "system.energy.value": (Number(actor.system.energy.value) || 0) - plan.moved });
  if (isEncounterActive()) await actor.setFlag("warhammer-dbc", MOTIVE_EUCHARIST_TURN_FLAG, true);
  await energyNote(actor, `Мотивное Причастие: −<b>${plan.moved}</b> ⚡ у ${esc(actor.name)}, +<b>${plan.moved}</b> ⚡ у ${esc(tgt.actor.name)}`
    + `${plan.toApoc ? ` (из них ${plan.toApoc} — в его Катушку Апокрифа)` : ""}.`);
}

/**
 * Ноосферное Сканирование (стр. 367, wdbc-1rno.2): «При Успехе засечь это
 * Техночудо, в т.ч. позволяя Избегать от него, если это Незримая атака.
 * Успешное Ноосферное Сканирование остаётся активным до начала следующего
 * Хода персонажа». Успех — persistent-флаг rules/unseen-attack.mjs,
 * читаемый ЛЮБОЙ Незримой атакой против этого актора до начала его
 * следующего Хода (снимается тем же тактом, что и другие временные
 * состояния — module/hooks.mjs::updateCombat), не только техночудесной:
 * система не различает источник детекта той же ценой, что уже принята для
 * реактивного теста (module/combat/unseen-attack.mjs — обе Психочутьё и
 * Технология предлагаются против ЛЮБОЙ Незримой атаки, не только
 * своего типа источника).
 */
export async function rollTechScan(actor, rollSkill) {
  const def = SKILLS_DEF.techUse;
  const sk  = actor.system.skills?.techUse;
  // noosphere — «тесты работы с Ноосферой» (Ноосферное Подключение даёт по
  // Качеству −10/+5/+10 записью Конструктора с этой областью).
  const scan = () => rollSkill("📡 Ноосферное Сканирование (Tech-Use)", sk?.total ?? -20, def?.char ?? "int", { skill: "techUse", noosphere: true });
  let r = await scan();

  // Проблеск Всеведенья (Sahara 3-2501): «потратить 1 ⚙, чтобы перебросить тест
  // Ноосферного Сканирования». Предлагаем после провала — по успеху переброс
  // нужен редко. Переброс — новое Сканирование (новое окно теста), результат
  // заменяет прежний.
  const cog = Number(actor.system.cognition?.value) || 0;
  if (r && !r.success && hasGlimpseOfOmniscience(actor) && cog >= COGNITION_REROLL_COST) {
    const again = await foundry.applications.api.DialogV2.confirm({
      window: { title: `Проблеск Всеведенья — ${actor.name}` },
      content: `<p>Ноосферное Сканирование провалено. Потратить <b>${COGNITION_REROLL_COST} ⚙</b> (есть ${cog}) и перебросить?</p>`,
      yes: { label: `Перебросить (−${COGNITION_REROLL_COST} ⚙)` }, no: { label: "Нет" },
      rejectClose: false
    });
    if (again) {
      await actor.update({ "system.cognition.value": cog - COGNITION_REROLL_COST });
      r = await scan();
    }
  }

  if (r?.success) {
    await markUnseenDetectedUntilNextTurn(actor);
    // Декомпиляция: «засекая неизвестное Техночудо, потратить 1 ⚙, чтобы распознать
    // его, как если бы знал сам». Какое чудо засечено — решает ГМ, поэтому спрашиваем
    // при каждом успешном Сканировании и пишем в чат, что расшифровано.
    const cogNow = Number(actor.system.cognition?.value) || 0;
    if (hasDecompile(actor) && cogNow >= DECOMPILE_COST) {
      const decompile = await foundry.applications.api.DialogV2.confirm({
        window: { title: `Декомпиляция — ${actor.name}` },
        content: `<p>Сканирование успешно. Если засечено <b>неизвестное</b> вам Техночудо — потратить <b>${DECOMPILE_COST} ⚙</b> (есть ${cogNow}), чтобы распознать его, как будто вы знаете его сами?</p>`,
        yes: { label: `Распознать (−${DECOMPILE_COST} ⚙)` }, no: { label: "Нет" },
        rejectClose: false
      });
      if (decompile) {
        await actor.update({ "system.cognition.value": cogNow - DECOMPILE_COST });
        await techNote(actor, "Декомпиляция",
          `${techIcon("cognition")} Когниция −<b>${DECOMPILE_COST}</b>: засечённое неизвестное Техночудо распознано, как если бы ${esc(actor.name)} знал(а) его сам(а) — ГМ раскрывает его название и действие.`);
      }
    }
  }
  return r;
}

/**
 * Разгон (Sahara 3-2501): «Раз в Ход за свободное действие потратить 1 ⚡, чтобы
 * восстановить себе до I.b ⚙, но за каждую восстановленную ⚙ нанести себе 2
 * урона в I». Количество ⚙ выбирает игрок; урон ложится в Интеллект сразу
 * (combat/char-damage.mjs::applyCharDamage, не поглощается). «Раз в Ход» — метка
 * overclockThisTurn, которую гасит начало следующего Хода (rules/turn-flags.mjs).
 */
export async function overclock(actor) {
  if (!hasOverclock(actor)) return;
  // «Раз в Ход» следим только в бою: вне Encounter Хода нет, а метку некому погасить.
  if (isEncounterActive() && actor.getFlag?.("warhammer-dbc", OVERCLOCK_FLAG)) {
    return ui.notifications.warn("Разгон уже использован в этом Ходу.");
  }
  const max = overclockMax(actor);
  if (max <= 0) {
    const energy = Number(actor.system.energy?.value) || 0;
    return ui.notifications.warn(energy < OVERCLOCK_ENERGY_COST
      ? `Разгон: нужно ${OVERCLOCK_ENERGY_COST} ⚡, в Катушке ${energy}.`
      : "Разгон: Когниция уже на максимуме (или I.b = 0) — восстанавливать нечего.");
  }
  const raw = await foundry.applications.api.DialogV2.wait({
    window: { title: `Разгон — ${actor.name}` },
    content: `<p>−${OVERCLOCK_ENERGY_COST} ⚡. Сколько ⚙ восстановить (1–${max})? Каждая стоит ${OVERCLOCK_SELF_DAMAGE_PER_COG} урона в Интеллект.</p>
      <label>⚙: <input type="number" name="n" value="${max}" min="1" max="${max}" autofocus/></label>`,
    buttons: [
      { action: "go", label: "Разогнать", default: true, callback: (_ev, button) => button.form.querySelector('[name="n"]')?.value },
      { action: "cancel", label: "Отмена", callback: () => null }
    ],
    rejectClose: false
  });
  if (raw === null || raw === undefined) return;
  const n = Math.max(1, Math.min(max, parseInt(raw) || 1));
  const cog = actor.system.cognition;
  const damage = n * OVERCLOCK_SELF_DAMAGE_PER_COG;
  await actor.update({
    "system.energy.value": Math.max(0, (Number(actor.system.energy.value) || 0) - OVERCLOCK_ENERGY_COST),
    "system.cognition.value": Math.min(Number(cog.max) || 0, (Number(cog.value) || 0) + n)
  });
  if (isEncounterActive()) await actor.setFlag("warhammer-dbc", OVERCLOCK_FLAG, true);
  const hit = await applyCharDamage(actor, "int", damage);
  await techNote(actor, "Разгон",
    `${techIcon("energy")} −${OVERCLOCK_ENERGY_COST}, ${techIcon("cognition")} +<b>${n}</b>; самоповреждение: <b>${hit.applied}</b> урона в Интеллект (${hit.before} → ${hit.after}).`);
}

/**
 * Начало Хода (кнопка «↻»): +½ I.b ⚙ — и сводка цены Процессов, которую книга
 * списывает сразу после восстановления («в начале каждого своего Хода, после
 * восстановления ⚙, персонаж тратит цену Процессов»). С Цифровым Откровением и
 * Ноосферной Набожностью сумма меньше (rules/technomystic-talents.mjs::
 * processCostTotal). Решение владельца 25.10.2026: система списывает сумму САМА,
 * один раз за Ход — в бою это держит метка processCostPaidThisTurn (гаснет с
 * началом следующего Хода, rules/turn-flags.mjs). Вне боя Хода нет, метки тоже:
 * каждое «↻» считается началом нового Хода. Не хватило ⚙ — списывается всё, что
 * есть, остаток назван в карточке: какие Процессы отключить, решает игрок (книга).
 */
async function cognitionRest(actor) {
  const cog = actor.system.cognition || { value: 0, max: 0, regen: 0 };
  const pc = processCostTotal(actor);
  const inCombat = isEncounterActive();
  const alreadyPaid = inCombat && !!actor.getFlag?.("warhammer-dbc", PROCESS_PAID_FLAG);
  // Повторное «↻» в том же Ходу ничего не восстанавливает: начало Хода уже было (ревью 25.10.2026).
  const nv  = alreadyPaid ? (cog.value || 0) : Math.min(cog.max || 0, (cog.value || 0) + (cog.regen || 0));
  const settle = alreadyPaid ? { pay: 0, after: nv, shortfall: 0 } : settleProcessCost(nv, pc.total);
  await actor.update({ "system.cognition.value": settle.after });
  if (!alreadyPaid && inCombat && pc.total > 0) await actor.setFlag("warhammer-dbc", PROCESS_PAID_FLAG, true);
  if (pc.base > 0 || pc.revelation || pc.piety) {
    const parts = [`Цена Процессов в этот Ход: ${techIcon("cognition")} <b>${pc.total}</b>`];
    if (pc.revelation) parts.push(`Цифровое Откровение −${pc.revelation}`);
    if (pc.piety) parts.push(`Ноосферная Набожность −${pc.piety}`);
    const tail = alreadyPaid
      ? `Цена в этом Ходу уже списана ранее — Когниция сейчас ${settle.after}.`
      : `Списано: ${techIcon("cognition")} <b>${settle.pay}</b> (было ${nv}, стало ${settle.after}).`
        + (settle.shortfall > 0 ? ` Не хватило <b>${settle.shortfall}</b> ⚙ — отключите лишние Процессы.` : "");
    await techNote(actor, "Начало Хода: Процессы",
      `${parts.join(", ")}${pc.base !== pc.total ? ` (без Талантов ${pc.base})` : ""}. ${tail}`);
  }
}

export function activateTechListeners(html, actor, { rollSkill } = {}) {
  html.find(".tech-add-btn").click(async ev => {
    ev.preventDefault();
    const item = await Item.create({ name: "Новое Техночудо", type: "techPower" }, { parent: actor });
    item?.sheet?.render(true);
  });
  html.find(".tech-sustain-cb").change(async ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (item) { await item.update({ "system.sustained": ev.currentTarget.checked }); await syncItemEffectsDisabled(item); }
  });
  html.find(".tech-activate-btn").click(ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (item) activateTechMiracle(actor, item);
  });
  html.find(".cognition-input").change(ev => {
    actor.update({ "system.cognition.value": parseInt(ev.currentTarget.value) || 0 });
  });
  html.find(".energy-input").change(ev => {
    actor.update({ "system.energy.value": parseInt(ev.currentTarget.value) || 0 });
  });
  html.find(".energy-max-input").change(ev => {
    actor.update({ "system.energy.max": parseInt(ev.currentTarget.value) || 0 });
  });
  html.find(".cognition-rest-btn").click(async ev => {
    ev.preventDefault();
    await cognitionRest(actor);
  });
  html.find(".cognition-overclock-btn").click(async ev => {
    ev.preventDefault();
    await overclock(actor);
  });
  html.find(".tech-scan-btn").click(() => {
    if (rollSkill) rollTechScan(actor, rollSkill);
  });
  // Импланты Механикум: Катушка Потенции снимает Усталость 2⚡ за 1,
  // Электу-Индукторы заряжают её тестом Tech-Use (rules/potentia-coil.mjs).
  html.find(".coil-fatigue-btn").click(ev => { ev.preventDefault(); coilRelieveFatigue(actor); });
  html.find(".coil-charge-btn").click(ev => { ev.preventDefault(); if (rollSkill) coilCharge(actor, rollSkill); });
  // Таланты Техномистика, перекладывающие ресурсы (пачка J): Катушка Апокрифа, Облачная Когниция, Мотивное Причастие.
  html.find(".coil-apoc-transfer-btn").click(ev => { ev.preventDefault(); apocryphaTransfer(actor); });
  html.find(".coil-apoc-charge-btn").click(ev => { ev.preventDefault(); if (rollSkill) coilCharge(actor, rollSkill, { apocrypha: true }); });
  html.find(".cognition-cloud-btn").click(ev => { ev.preventDefault(); if (rollSkill) cloudCognition(actor, rollSkill); });
  html.find(".coil-motive-btn").click(ev => { ev.preventDefault(); motiveEucharist(actor); });
  html.find(".tech-infoguard-roll-btn").click(ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (item) rollInfoguard(item);
  });
  // Делегирование (wdbc-uez7): цель эффекта — владелец предмета (сам actor
  // этой вкладки), исполнителя выбирает пикер.
  html.find(".tech-infoguard-delegate-btn").click(ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (!item) return;
    showDelegateTestPicker(actor, {
      title: `Делегировать Инфограждение: ${item.name}`, kind: "infoguard",
      label: `Инфограждение: ${item.name}`, buttonLabel: "Наложить Инфограждение",
      extra: { itemId: item.id }
    });
  });
  // Кнопки генерации ⚙/⚡ от имплантов Кибернетики Механикум
  html.find(".tech-gen-btn").click(ev => {
    const d = ev.currentTarget.dataset;
    const item = actor.items.get(d.itemId);
    techGenResource(actor, item, {
      res: d.res, amount: parseInt(d.amount) || 0,
      fromCognition: parseInt(d.fromCog) || 0
    });
  });
  // Тумблеры энергосистем (Печь Плоти / Солнечный Конвертер)
  html.find(".tech-toggle-cb").change(async ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (item) await item.setFlag("warhammer-dbc", "techActive", ev.currentTarget.checked);
  });
}
