// module/sheets/tabs/possession.mjs
//
// Вкладка «Одержимость» (DoomBC_Core 129-132): синергия хоста и вселённого
// низшего демона (Двойной Дух). Считает Симбиоз и его предел, бонусы хоста,
// профиль Проявления по Порче и каталог Даров с пометкой надетых.
//
// Функции принимают актора, а не лист. Расчёт вкладки берётся из actor.system и
// данных книги, поэтому проверяется без Foundry; Проявление, наоборот, бросает
// куб и пишет в чат — ему нужна заглушка (test/support/foundry-stub.mjs).

import { TWIN_SPIRIT_DEMONS, twinSpiritMeta, manifestProfile,
         POSSESSION_GIFTS, POSSESSION_TALENTS } from "../../constants/possession.mjs";
import { giftNamesOf } from "../../rules/predicates.mjs";

// Группировка каталога Даров Одержимого по группам (для вкладки «Одержимость»).
// activeSet — имена Даров, реально надетых на актора (подсветка «активен»).
function _groupGifts(activeSet = new Set()) {
  const order = ["Защита","Движение","Трансформация","Оружие","Усилители","Стрельба","Единение"];
  const map = new Map(order.map(g => [g, []]));
  for (const g of POSSESSION_GIFTS) {
    (map.get(g.group) || map.set(g.group, []).get(g.group)).push({
      name: g.name, cost: g.cost ? `${g.cost} xp` : "Базовый", sym: g.sym, text: g.text,
      active: activeSet.has(g.name)
    });
  }
  return order.map(g => ({ group: g, gifts: map.get(g) || [] }));
}

export function possessionContext(actor) {
  const system = actor.system;
  const p    = system.possession || {};
  const meta = twinSpiritMeta(p.demon || "katart");
  const cor  = system.corruption?.value ?? 0;
  const infB = system.characteristics?.inf?.bonus ?? 0;
  const corB = Math.floor(cor / 10);
  const prof = manifestProfile(cor);
  const sym  = Math.max(0, Math.min(5, Number(p.symbiosis) || 0));
  // Симбиоз ограничен min(Inf/15, Cor/15) окр.▼
  const symLimit = Math.max(0, Math.min(5, Math.floor(Math.min(cor, (system.characteristics?.inf?.total ?? 0)) / 15)));
  const wbDemon = Math.floor((p.demonWounds?.max ?? 0) / 10);
  // Активные Дары на акторе (предметы-таланты «… / Дар: X») и лимит по профилю.
  const activeGiftSet = giftNamesOf(actor);
  return {
    p, meta, cor, prof, sym, symLimit,
    demonOptions: TWIN_SPIRIT_DEMONS.map(d => ({ key: d.key, label: d.label, godLabel: (twinSpiritMeta(d.key).godLabel), selected: d.key === (p.demon || "katart") })),
    symOptions: [0,1,2,3,4,5].map(n => ({ n, selected: n === sym })),
    symPips: [1,2,3,4,5].map(n => ({ on: n <= sym, over: n > symLimit })),
    socialBonus: sym * 10,
    hostWBonus:  sym * 5,
    controlHours: Math.max(1, 10 - wbDemon),
    naturalArmour: corB,
    regen: Math.ceil(corB / 2),
    demonWShield: `1-${p.demonWounds?.max ?? 0}`,
    giftGroups: _groupGifts(activeGiftSet),
    // Таланты архетипа: только Неделимого + бога вселённого демона.
    talents: POSSESSION_TALENTS.filter(t => t.god === "Неделимый" || t.god === meta.godLabel),
    greaterPossessed: !!p.greaterPossessed,
    // Проявление: состояние и применённые авто-бонусы
    manifested: !!p.manifested,
    applied: (system.possessionActive?.applied) || [],
    activeGiftCount: activeGiftSet.size,
    giftLimit: prof.gifts,
    giftsOver: activeGiftSet.size > prof.gifts,
    // Руны True Tongue (генерируются в шаблоне; сюда — сид анимации по богу)
    runeSeed: (p.demon || "katart").length * 7 % 12
  };
}

/**
 * Проявление демона и обратное заключение (полудействие). Вход в Проявление —
 * тест Cor+20; при Провале Порча растёт на единицу, но форма всё равно
 * включается: демон уже наружу.
 */
export async function toggleManifest(actor) {
  const sys  = actor.system;
  const p    = sys.possession || {};
  const now  = !p.manifested;
  const meta = twinSpiritMeta(p.demon || "katart");
  const updates = { "system.possession.manifested": now };

  if (now) {
    const cor    = sys.corruption?.value ?? 0;
    const target = Math.min(100, cor + 20);
    const roll   = await (new Roll("1d100")).evaluate();
    const success = roll.total <= target;
    if (!success) updates["system.corruption.value"] = Math.min(100, cor + 1);
    const body = `
      <div class="wh-poss-card" style="--gc:${meta.color}">
        <div class="wh-poss-card-h">⛧ ПРОЯВЛЕНИЕ — ${meta.label} (${meta.godLabel})</div>
        <div class="wh-poss-card-r">Тест Cor+20: <b>${roll.total}</b> против <b>${target}</b> —
          <span class="${success ? "ok" : "bad"}">${success ? "Успех" : "Провал: +1 Порчи"}</span></div>
        <div class="wh-poss-card-n">Демон перестраивает тело в боевую форму. Броня/одежда сплавляются с формой.</div>
      </div>`;
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: body });
  } else {
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="wh-poss-card" style="--gc:${meta.color}"><div class="wh-poss-card-h">Демон заключён — смертная форма</div></div>`
    });
  }
  await actor.update(updates);
}

export function activatePossessionListeners(html, actor) {
  html.find(".poss-manifest-btn").on("click", async ev => {
    ev.preventDefault();
    await toggleManifest(actor);
  });
}
