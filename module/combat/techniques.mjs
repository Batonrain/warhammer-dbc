import { CHARACTERISTICS }                  from "../constants/characteristics.mjs";
import { _degWord }                         from "../helpers/utils.mjs";
import { rollIcon }                         from "../constants/roll-icons.mjs";
import { MELEE_STANCES }                    from "../constants/combat.mjs";

export async function _showContestDialog(actor, techDef) {
  // Повалить и Напролом — Athletics(S) vs Athletics(S), Финт/Давление — WS vs WS.
  const isKnock  = techDef.label === "Повалить" || techDef.label === "Напролом";

  // Стойка (стр. 15) даёт бонус «на все тесты WS», но Агрессивная явно
  // исключает встречные тесты против Финта — то есть Давление его получает,
  // а Финт нет. techDef.stanceWs отмечает это на самом Давлении (только
  // оно из контестов — настоящий тест WS вs WS без исключения книги).
  const stanceKey      = actor.system.meleeStance || "standard";
  const stanceWsBonus  = techDef.stanceWs ? (MELEE_STANCES[stanceKey]?.wsBonus ?? 0) : 0;

  // Определяем характеристику по умолчанию. techDef.defaultChar — явное
  // указание (действия Борьбы, стр. 12: Athletics(S) или Acrobatics(A) —
  // ни то, ни другое не WS/Повалить-Напролом, поэтому нужна отдельная ручка,
  // а не растягивать isKnock ещё сильнее).
  const defaultChar = techDef.defaultChar || (isKnock ? "s" : "ws");
  const baseVal     = (actor.system.characteristics[defaultChar]?.total ?? 0)
                     + (defaultChar === "ws" ? stanceWsBonus : 0);

  // Строим опции для выбора характеристики
  const charOptions = Object.entries(CHARACTERISTICS).map(([key, meta]) => {
    let val = actor.system.characteristics[key]?.total ?? 0;
    if (key === "ws" && stanceWsBonus) val += stanceWsBonus;
    return `<option value="${key}" ${key === defaultChar ? "selected" : ""}>
      ${meta.abbr} — ${meta.label} (${val})
    </option>`;
  }).join("");

  const stanceBonusNote = stanceWsBonus
    ? `<div style="font-size:0.85em;color:#8fd0ff;margin-bottom:6px;">
         ${rollIcon("sword")}Стойка: ${MELEE_STANCES[stanceKey].label} (${stanceWsBonus >= 0 ? "+" : ""}${stanceWsBonus}), уже в WS выше
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
      </form>`,
    buttons: {
      roll: {
        icon: '<i class="fas fa-dice-d10"></i>', label: "Бросок!",
        callback: async html => {
          const charKey  = html.find("#contest-char").val();
          const charMeta = CHARACTERISTICS[charKey];
          const selfVal  = parseInt(html.find("#contest-self").val()) || 0;
          const mod      = parseInt(html.find("#contest-mod").val())  || 0;
          const eff      = selfVal + mod;

          const roll     = await new Roll("1d100").evaluate();
          const rv       = roll.total;
          const hit      = rv <= eff;
          const deg      = hit
            ? Math.floor((eff - rv) / 10) + 1
            : Math.floor((rv - eff) / 10) + 1;
          const rollMode = game.settings.get("core", "rollMode");
          const outcome  = hit
            ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}</span>`
            : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}</span>`;
          const modStr   = mod !== 0 ? ` ${mod >= 0 ? "+" : ""}${mod}` : "";

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
                <div class="roll-outcome">${outcome}</div>
                ${hit
                  ? `<div class="roll-location" style="font-size:0.88em;margin-top:3px;">
                       ${rollIcon("spark","#8fd0ff")}${techDef.note}
                     </div>`
                  : ""}
              </div>`,
            rolls: [roll],
            sound: CONFIG.sounds.dice
          }, rollMode);

          await ChatMessage.create(messageData);
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