// module/apps/infamy-points.mjs
// ════════════════════════════════════════════════════════════════════════
//  Очки Бесчестия (корбук 438) — общий движок для Демон-Принца и Хаоситов.
//  Пул хранится там, где укажет лист:
//    • Демон-Принц — system.dp.ip (макс = Inf.b), полоса со своим счётчиком;
//    • Хаосит — system.fate.value (это же поле «Очки Бесчестья» в шапке),
//      счётчик в полосе скрыт (showCounter=false), пул виден в шапке.
//  Способности открываются по Порче (Cor); Покровительство Бога даёт
//  преимущество/недостаток и особую кнопку-трату.
// ════════════════════════════════════════════════════════════════════════

import { DP_INFAMY_ABILITIES, DP_PATRON_ABILITIES, DP_PATRONAGE } from "../constants/demon-prince.mjs";
import { esc } from "../helpers/utils.mjs";

// Контекст для общего партиала infamy-strip.hbs.
export function infamyContext(actor, godKey, { ip, ipMax, showCounter = true }) {
  const cor = actor.system.corruption?.value ?? 0;
  const ipAbilities = DP_INFAMY_ABILITIES.map(a => {
    const threshold = (a.key === "success" && godKey === "tzeentch") ? 0 : a.cor;
    const dis = a.disGod === godKey;
    return { ...a, available: cor >= threshold && !dis,
      reason: dis ? "недоступно Богу" : (cor < threshold ? `нужно Cor ${threshold}` : "") };
  });
  return {
    ip, ipMax, cor, showCounter,
    ipPips: Array.from({ length: Math.max(ipMax, 1) }, (_, i) => i < ip),
    ipAbilities,
    patronAbility: DP_PATRON_ABILITIES[godKey] || null,
    patronage: DP_PATRONAGE[godKey] || DP_PATRONAGE.undivided
  };
}

export async function changeInfamy(actor, ipFullPath, ipMax, delta) {
  const cur = Math.max(0, Number(foundry.utils.getProperty(actor, ipFullPath)) || 0);
  await actor.update({ [ipFullPath]: Math.max(0, Math.min(ipMax, cur + delta)) });
}

function ipCard(meta, title, lines) {
  const sig = meta.sigil
    ? `<span class="wh-dp-card-sigil" style="-webkit-mask:url('${meta.sigil}') center/contain no-repeat;mask:url('${meta.sigil}') center/contain no-repeat"></span>`
    : "";
  return `<div class="wh-dp-card" style="--gc:${meta.gc};--gc2:${meta.gc2};">
      <div class="wh-dp-card-h">${sig}${title}</div>
      ${lines.map(l => `<div class="wh-dp-card-r">${l}</div>`).join("")}
    </div>`;
}

export async function restoreInfamy(actor, ipFullPath, ipMax, meta) {
  await actor.update({ [ipFullPath]: ipMax });
  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: ipCard(meta, `⚜ Очки Бесчестия восстановлены — ${esc(actor.name)}`,
      [`Пул полон: <b>${ipMax}</b> Очков Бесчестия.`])
  }, rollMode));
}

// Трата Очка Бесчестия на способность (корбук 438).
export async function spendInfamy(actor, key, { godKey, ipFullPath, ipMax, meta }) {
  const s = actor.system;
  const cor = s.corruption?.value ?? 0;
  const ip = Math.max(0, Math.min(ipMax, Number(foundry.utils.getProperty(actor, ipFullPath)) || 0));
  if (ip < 1) return ui.notifications.warn("Нет Очков Бесчестия. Восстановите их в конце сессии.");

  let ability = DP_INFAMY_ABILITIES.find(a => a.key === key);
  if (!ability && DP_PATRON_ABILITIES[godKey]?.key === key) ability = DP_PATRON_ABILITIES[godKey];
  if (!ability) return;
  if (ability.disGod === godKey) return ui.notifications.warn(`«${ability.label}» недоступно при этом Покровительстве.`);
  const threshold = (ability.key === "success" && godKey === "tzeentch") ? 0 : (ability.cor ?? 0);
  if (cor < threshold) return ui.notifications.warn(`«${ability.label}»: нужно Порчи ≥ ${threshold} (сейчас ${cor}).`);

  const upd = { [ipFullPath]: ip - 1 };
  const lines = [];
  const rolls = [];

  if (key === "surge") {
    upd["system.fatigue.value"] = 0;
    lines.push("Прилив Сил: вся Усталость снята.");
  } else if (key === "heal") {
    if (godKey === "khorne" && s.conditions?.bleeding)
      return ui.notifications.warn("Кхорн: «Исцеление» недоступно при Кровотечении.");
    let dice, base = 0, clearNeg = false, maxHeal;
    if (cor >= 60)      { dice = "1d10"; clearNeg = true; maxHeal = 10; }
    else if (cor >= 20) { dice = "1d5";  base = 1; clearNeg = true; maxHeal = 6; }
    else                { dice = "1d5";  maxHeal = 5; }
    let healed;
    if (godKey === "nurgle") { healed = maxHeal; lines.push("Живучесть Нургла: максимум без броска."); }
    else { const r = await new Roll(dice).evaluate(); rolls.push(r); healed = r.total + base; }
    if (godKey === "khorne") healed = Math.max(1, healed - 2);
    const val = Number(s.wounds?.value) || 0, wmax = Number(s.wounds?.max) || 0;
    upd["system.wounds.value"] = Math.min(wmax, val + healed);
    if (clearNeg) upd["system.wounds.critical"] = 0;
    lines.push(`Исцеление: восстановлено <b>${healed}</b> Ран${clearNeg ? ", сняты Отрицательные Раны" : ""}.`);
  } else if (key === "recover") {
    upd["system.conditions.stunned"] = false;
    upd["system.conditions.stunnedRounds"] = 0;
    lines.push("Приход в себя: снято Оглушение / Ступор / Шок.");
  } else if (key === "success" && godKey === "tzeentch" && cor >= 20) {
    const r = await new Roll("1d5").evaluate(); rolls.push(r);
    lines.push(`Вспышка Гения: +<b>${r.total}</b> Успехов к успешному тесту.`);
  } else {
    lines.push(ability.desc);
  }

  await actor.update(upd);
  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: ipCard(meta, `${ability.icon || "⚜"} ${ability.label} — ${esc(actor.name)}`,
      [...lines, `<span style="font-size:0.82em;opacity:0.8;">Осталось Очков Бесчестия: <b>${ip - 1}</b> / ${ipMax}.</span>`]),
    rolls, sound: rolls.length ? CONFIG.sounds.dice : undefined
  }, rollMode));
}
