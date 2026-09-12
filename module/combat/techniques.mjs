import { CHARACTERISTICS }                  from "../constants/characteristics.mjs";
import { esc, _degWord }                    from "../helpers/utils.mjs";
import { rollIcon }                         from "../constants/roll-icons.mjs";
import { MELEE_STANCES }                    from "../constants/combat.mjs";
import { ruleRerollsHtml }                  from "../rules/roll-mods.mjs";
import { pickReroll }                       from "../rules/reroll-pick.mjs";
import { testOutcome }                      from "../rules/roll-outcome.mjs";
import { hasRuleFlag, ruleFlagLabels }      from "../rules/flags.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { postTestCard, thresholdLine, outcomeHtml } from "../helpers/test-card.mjs";
import { DANCE_OF_DECEPTION_CAPABILITY, danceOfDeceptionFeintOptions } from "../rules/dance-of-deception.mjs";
import { spendFromInfamyPool } from "../apps/infamy-points.mjs";
import { tempInfamyAmount } from "../rules/temp-infamy.mjs";

export async function _showContestDialog(actor, techDef) {
  // Повалить и Напролом — Athletics(S) vs Athletics(S), Финт/Давление — WS vs WS.
  const isKnock  = techDef.label === "Повалить" || techDef.label === "Напролом";

  // Стойка (стр. 15) даёт бонус «на все тесты WS», но Агрессивная явно
  // исключает встречные тесты против Финта — то есть Давление его получает,
  // а Финт нет. techDef.stanceWs отмечает это на самом Давлении (только
  // оно из контестов — настоящий тест WS вs WS без исключения книги).
  const stanceKey      = actor.system.meleeStance || "standard";
  const stanceWsBonus  = techDef.stanceWs ? (MELEE_STANCES[stanceKey]?.wsBonus ?? 0) : 0;

  // Плоский бонус источника, не зависящего от Стойки/характеристики — напр.
  // Мутация Tentacle/Щупальце даёт +20 на все тесты Борьбы (module/combat/
  // grapple.mjs::tentacleTechDef), независимо от того, какой характеристикой
  // их сдают.
  const extraBonus = techDef.extraBonus ?? 0;

  // Определяем характеристику по умолчанию. techDef.defaultChar — явное
  // указание (действия Борьбы, стр. 12: Athletics(S) или Acrobatics(A) —
  // ни то, ни другое не WS/Повалить-Напролом, поэтому нужна отдельная ручка,
  // а не растягивать isKnock ещё сильнее).
  const defaultChar = techDef.defaultChar || (isKnock ? "s" : "ws");
  const baseVal     = (actor.system.characteristics[defaultChar]?.total ?? 0)
                     + (defaultChar === "ws" ? stanceWsBonus : 0)
                     + extraBonus;

  // Строим опции для выбора характеристики
  const charOptions = Object.entries(CHARACTERISTICS).map(([key, meta]) => {
    let val = actor.system.characteristics[key]?.total ?? 0;
    if (key === "ws" && stanceWsBonus) val += stanceWsBonus;
    val += extraBonus;
    return `<option value="${key}" ${key === defaultChar ? "selected" : ""}>
      ${meta.abbr} — ${meta.label} (${val})
    </option>`;
  }).join("");

  // Dance of Deception/Танец Обмана (wdbc-1rno, Слаанеш): у Финта — доп.
  // варианты Навыком вместо WS+0. Техника задаётся общим статичным объектом
  // MELEE_CONTESTS (constants/combat.mjs), актор-специфичные варианты в него
  // не положить — гейт по имени, тот же приём, что isKnock выше.
  const danceOfDeceptionActive = techDef.label === "Финт" && hasRuleFlag(actor, DANCE_OF_DECEPTION_CAPABILITY);
  const danceOptions = danceOfDeceptionActive ? danceOfDeceptionFeintOptions(actor) : [];
  const danceOptionsHtml = danceOptions.map(o =>
    `<option value="${esc(o.key)}">${esc(o.label)} (${o.value})</option>`).join("");
  const danceFreeActionHtml = danceOfDeceptionActive
    ? `<div class="atk-dlg-row">
         <label><input type="checkbox" id="dance-free-action"/>
           💃 Танец Обмана: потратить Очко Бесчестия — Финт как свободное действие</label>
       </div>`
    : "";

  const stanceBonusNote = stanceWsBonus
    ? `<div style="font-size:0.85em;color:#8fd0ff;margin-bottom:6px;">
         ${rollIcon("sword")}Стойка: ${MELEE_STANCES[stanceKey].label} (${stanceWsBonus >= 0 ? "+" : ""}${stanceWsBonus}), уже в WS выше
       </div>`
    : "";

  // Опциональные перебросы правил (wdbc-u0by, Truth-Seer/Defiance) — этот
  // диалог раньше вообще не читал реестр правил (та же дыра, что была у
  // Парирования до фикса, module/combat/defense.mjs). Список считается по
  // характеристике ПО УМОЛЧАНИЮ при открытии — тот же компромисс, что у
  // общего диалога теста Навыка (mods не пересчитываются реактивно при
  // смене дропдауна): честное самоподтверждение игрока всё равно решает,
  // применять ли галочку, форма Состязания не проверяет роль/условие сама.
  const rr = ruleRerollsHtml(actor, { kind: "skill", char: defaultChar });

  const extraBonusNote = extraBonus
    ? `<div style="font-size:0.85em;color:#8fd0ff;margin-bottom:6px;">
         ${rollIcon("sword")}${techDef.extraBonusLabel ?? "Бонус"}: ${extraBonus >= 0 ? "+" : ""}${extraBonus}, уже учтён выше
       </div>`
    : "";

  // Иммунитет цели (wdbc-egll, напр. mutation.tentacle.suckerGrip у Щупальца
  // 4-5) — предупреждение, не блокировка: тот же принцип «галочка, не тихий
  // запрет», что и у прочих модификаторов (resolve-test.mjs). Бросок можно
  // всё равно сделать (цель может смениться, или стол решит иначе).
  const target = [...(game.user?.targets ?? [])][0]?.actor ?? null;
  const immune = techDef.targetImmunityFlag && target && hasRuleFlag(target, techDef.targetImmunityFlag);
  const immuneLabels = immune ? ruleFlagLabels(target, techDef.targetImmunityFlag).join(", ") : "";
  const immunityNote = immune
    ? `<div style="font-size:0.85em;color:#e08a3a;margin-bottom:6px;">
         ⚠️ ${esc(target.name)}: нельзя обезоружить${immuneLabels ? ` (${esc(immuneLabels)})` : ""} — бросок пройдёт, но эффект списывается вручную
       </div>`
    : "";

  new Dialog({
    title: techDef.label,
    content: `
      <form class="wh-attack-form">
        <div class="atk-dlg-header">
          <span class="atk-weapon-name">${techDef.label}</span>
        </div>
        ${techDef.chatNote
          ? `<div class="atk-technique-chatnote" style="margin-bottom:6px;">
               ${techDef.chatNote}
             </div>`
          : ""}
        <div style="font-size:0.88em;color:#5a4a30;margin-bottom:8px;padding:4px 6px;
                    background:rgba(0,0,0,0.05);border-left:3px solid #7a5c2e;">
          ${techDef.note}
        </div>
        ${stanceBonusNote}
        ${extraBonusNote}
        ${immunityNote}

        <div class="atk-dlg-row">
          <label>Характеристика:</label>
          <select id="contest-char">${charOptions}${danceOptionsHtml}</select>
        </div>

        <div class="atk-dlg-row">
          <label>Ваш бросок с:</label>
          <input id="contest-self" type="number" value="${baseVal}" readonly/>
        </div>

        <div class="atk-dlg-row">
          <label>Доп. модификатор:</label>
          <input id="contest-mod" type="number" value="${techDef.defaultMod ?? 0}"/>
        </div>

        <div class="atk-dlg-row atk-total-row">
          <label>Итоговый порог:</label>
          <span id="contest-total-display">${baseVal}</span>
        </div>
        ${rr.html}
        ${danceFreeActionHtml}
      </form>`,
    buttons: {
      roll: {
        icon: '<i class="fas fa-dice-d10"></i>', label: "Бросок!",
        callback: async html => {
          const charKey  = html.find("#contest-char").val();
          // Dance of Deception (wdbc-1rno): выбранный пункт — не сырая
          // Характеристика, а один из вариантов danceOptions (Навык).
          const danceOpt = danceOptions.find(o => o.key === charKey);
          const charMeta = danceOpt ? null : CHARACTERISTICS[charKey];
          const selfVal  = parseInt(html.find("#contest-self").val()) || 0;
          const mod      = parseInt(html.find("#contest-mod").val())  || 0;
          // Общий сбор модификаторов (wdbc-ct65.3): встречный тест приёма
          // шёл мимо реестра правил — «Цель» в окне игрок правил руками.
          // Навыком (danceOpt) — ctx несёт и char (Ловкость), и сам Навык,
          // как у обычного броска Навыка (actor-sheet.mjs::_rollSkill).
          const ruleMods = collectTestMods(actor, danceOpt
            ? { kind: "skill", char: danceOpt.charKey, skill: danceOpt.skillKey }
            : { kind: "skill", char: charKey });
          const eff      = selfVal + mod + ruleMods.total;

          // Dance of Deception — свободное действие за Очко Бесчестия
          // (wdbc-1rno): Состязания не списывают ОД программно вовсе (см.
          // заголовок rules/dance-of-deception.mjs) — механизируема только
          // цена, тем же путём, что обычная трата Бесчестия (_ipSpend).
          let freeActionNote = "";
          if (danceOfDeceptionActive && html.find("#dance-free-action").is(":checked")) {
            const poolPath = actor.sheet?._infamyPath ?? "system.fate.value";
            const curIp = Math.max(0, Number(foundry.utils.getProperty(actor, poolPath)) || 0);
            if (curIp < 1 && tempInfamyAmount(actor) < 1) {
              ui.notifications?.warn("Танец Обмана: нет Очков Бесчестия — Финт остаётся обычным действием.");
            } else {
              const spend = await spendFromInfamyPool(actor, 1, poolPath);
              await actor.update({ [poolPath]: spend.poolValue });
              freeActionNote = `<div class="roll-threshold">💃 Танец Обмана: потрачено 1 Очко Бесчестия — Финт проведён как свободное действие.</div>`;
            }
          }

          // Опциональный переброс правил (wdbc-u0by) — тот же приём чтения,
          // что actor-sheet.mjs::_showSkillRollDialog (.rule-reroll-opt:checked).
          const rerollEl = html.find(".rule-reroll-opt:checked");
          const rerollIdx = parseInt(rerollEl?.data?.("idx") ?? "-1");
          const useReroll = rerollIdx >= 0;
          const mode = rerollEl?.data?.("mode") || "keepBest";
          const rolled = [];
          for (let i = 0; i < (useReroll ? 2 : 1); i++) rolled.push(await new Roll("1d100").evaluate());
          const picked = pickReroll(rolled.map(r => r.total), mode);
          const roll   = rolled[picked.index];
          const rv     = picked.value;
          const { success: hit, deg } = testOutcome(rv, eff);
          const outcome  = hit
            ? outcomeHtml(true,  `Успех — ${deg} ${_degWord(deg)}`)
            : outcomeHtml(false, `Провал — ${deg} ${_degWord(deg)}`);
          // Подписи модификаторов, а не только ручное число (wdbc-kuun):
          // Порог уже считался с Усталостью и Чертами, но в карточке этого
          // видно не было — тот же дефект, что живая проверка нашла в
          // Командовании и Ударе Ассасина.
          const modParts = [
            mod !== 0 ? `${mod >= 0 ? "+" : ""}${mod}` : "",
            ...ruleMods.parts
          ];
          const rerollLabel = rr.rerolls?.[rerollIdx]?.label;
          const rerollNote = picked.dropped.length
            ? `<div class="roll-defense-note">${rerollLabel || "Переброс"}: отброшено ${picked.dropped.join(", ")}</div>`
            : "";

          // Карточка — общим сборщиком (wdbc-kuun). Блок «Приём: …» остался
          // над шапкой (prelude), слагаемые Порога перечисляются в скобках
          // через запятую вместо « · ».
          await postTestCard(actor, {
            prelude: `
              <div class="roll-technique-block">${rollIcon("sword")}Приём: <b>${techDef.label}</b>
                ${techDef.chatNote
                  ? `<div class="roll-technique-note">${techDef.chatNote}</div>`
                  : ""}
              </div>`,
            title: techDef.label,
            threshold: thresholdLine({
              label: danceOpt ? danceOpt.label : (charMeta?.abbr ?? charKey), base: selfVal, parts: modParts, threshold: eff
            }),
            rv, rerollNote, outcome,
            sections: [
              hit
                ? `<div class="roll-location" style="font-size:0.88em;margin-top:3px;">
                     ${rollIcon("spark","#8fd0ff")}${techDef.note}
                   </div>`
                : "",
              hit && immune
                ? `<div class="roll-location" style="font-size:0.88em;margin-top:3px;color:#e08a3a;">
                     ⚠️ ${esc(target.name)}: нельзя обезоружить${immuneLabels ? ` (${esc(immuneLabels)})` : ""} — эффект Приёма не применяется
                   </div>`
                : "",
              freeActionNote
            ]
          }, { rolls: [roll] });

          // Опциональный колбэк на успех (техника несёт реальный эффект,
          // не только прозу-заметку — сейчас только «Заломить», grapple.mjs).
          // Необязателен: у Повалить/Напролом/Финта/Давления его нет, они не
          // меняют поведение.
          if (hit && techDef.onSuccess) await techDef.onSuccess(actor, { deg });
        }
      },
      cancel: { label: "Отмена" }
    },
    default: "roll",
    render: html => {
      // При смене характеристики — обновляем базовое значение
      html.find("#contest-char").on("change", ev => {
        const key = ev.currentTarget.value;
        const danceOpt = danceOptions.find(o => o.key === key);
        let val;
        if (danceOpt) {
          val = danceOpt.value;
        } else {
          val = actor.system.characteristics[key]?.total ?? 0;
          if (key === "ws" && stanceWsBonus) val += stanceWsBonus;
          val += extraBonus;
        }
        html.find("#contest-self").val(val);
        _updateTotal(html);
      });
      html.find("#contest-mod").on("input", () => _updateTotal(html));

      function _updateTotal(html) {
        const base = parseInt(html.find("#contest-self").val()) || 0;
        const mod  = parseInt(html.find("#contest-mod").val())  || 0;
        html.find("#contest-total-display").text(base + mod);
      }

      _updateTotal(html);
    },
    close: () => {}
  }, { classes: ["dialog", "wh-attack-dialog"], width: 400 }).render(true);
}