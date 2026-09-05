import { CHARACTERISTICS }                  from "../constants/characteristics.mjs";
import { esc, _degWord }                    from "../helpers/utils.mjs";
import { rollIcon }                         from "../constants/roll-icons.mjs";
import { MELEE_STANCES }                    from "../constants/combat.mjs";
import { ruleRerollsHtml }                  from "../rules/roll-mods.mjs";
import { pickReroll }                       from "../rules/reroll-pick.mjs";
import { testOutcome }                      from "../rules/roll-outcome.mjs";
import { hasRuleFlag, ruleFlagLabels }      from "../rules/flags.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";

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
          <select id="contest-char">${charOptions}</select>
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
      </form>`,
    buttons: {
      roll: {
        icon: '<i class="fas fa-dice-d10"></i>', label: "Бросок!",
        callback: async html => {
          const charKey  = html.find("#contest-char").val();
          const charMeta = CHARACTERISTICS[charKey];
          const selfVal  = parseInt(html.find("#contest-self").val()) || 0;
          const mod      = parseInt(html.find("#contest-mod").val())  || 0;
          // Общий сбор модификаторов (wdbc-ct65.3): встречный тест приёма
          // шёл мимо реестра правил — «Цель» в окне игрок правил руками.
          const ruleMods = collectTestMods(actor, { kind: "skill", char: charKey });
          const eff      = selfVal + mod + ruleMods.total;

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
          const rollMode = game.settings.get("core", "rollMode");
          const outcome  = hit
            ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}</span>`
            : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}</span>`;
          const modStr   = mod !== 0 ? ` ${mod >= 0 ? "+" : ""}${mod}` : "";
          const rerollLabel = rr.rerolls?.[rerollIdx]?.label;
          const rerollNote = picked.dropped.length
            ? `<div class="roll-defense-note">${rerollLabel || "Переброс"}: отброшено ${picked.dropped.join(", ")}</div>`
            : "";

                    const messageData = ChatMessage.applyRollMode({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `
              <div class="wh-roll-result">
                <div class="roll-technique-block">${rollIcon("sword")}Приём: <b>${techDef.label}</b>
                  ${techDef.chatNote
                    ? `<div class="roll-technique-note">${techDef.chatNote}</div>`
                    : ""}
                </div>
                <div class="roll-header">${techDef.label}</div>
                <div class="roll-threshold">
                  ${charMeta?.abbr ?? charKey}: <b>${selfVal}</b>${modStr}
                  → Порог: <b>${eff}</b>
                </div>
                <div class="roll-dice">Бросок: <b>${rv}</b></div>
                ${rerollNote}
                <div class="roll-outcome">${outcome}</div>
                ${hit
                  ? `<div class="roll-location" style="font-size:0.88em;margin-top:3px;">
                       ${rollIcon("spark","#8fd0ff")}${techDef.note}
                     </div>`
                  : ""}
                ${hit && immune
                  ? `<div class="roll-location" style="font-size:0.88em;margin-top:3px;color:#e08a3a;">
                       ⚠️ ${esc(target.name)}: нельзя обезоружить${immuneLabels ? ` (${esc(immuneLabels)})` : ""} — эффект Приёма не применяется
                     </div>`
                  : ""}
              </div>`,
            rolls: [roll],
            sound: CONFIG.sounds.dice
          }, rollMode);

          await ChatMessage.create(messageData);

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
        let val = actor.system.characteristics[key]?.total ?? 0;
        if (key === "ws" && stanceWsBonus) val += stanceWsBonus;
        val += extraBonus;
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