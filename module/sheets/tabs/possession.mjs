// module/sheets/tabs/possession.mjs
//
// Вкладка «Одержимость» (DoomBC_Core 129-132): синергия хоста и вселённого
// низшего демона (Двойной Дух). Считает Симбиоз и его предел, бонусы хоста,
// профиль Проявления по Порче и каталог Даров с пометкой надетых.
//
// Функция принимает актора, а не лист: всё берётся из actor.system и данных
// книги, поэтому проверяется без Foundry.

import { TWIN_SPIRIT_DEMONS, twinSpiritMeta, manifestProfile,
         POSSESSION_GIFTS, POSSESSION_TALENTS } from "../../constants/possession.mjs";

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
  // Активные Дары на акторе (предметы-таланты «Дар: …») и лимит по профилю.
  const activeGiftNames = actor.items
    .filter(i => i.type === "talent" && i.name.startsWith("Дар: "))
    .map(i => i.name.replace(/^Дар:\s*/, ""));
  const activeGiftSet = new Set(activeGiftNames);
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
    activeGiftCount: activeGiftNames.length,
    giftLimit: prof.gifts,
    giftsOver: activeGiftNames.length > prof.gifts,
    // Руны True Tongue (генерируются в шаблоне; сюда — сид анимации по богу)
    runeSeed: (p.demon || "katart").length * 7 % 12
  };
}
