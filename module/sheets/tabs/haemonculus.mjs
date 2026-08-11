// module/sheets/tabs/haemonculus.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ВКЛАДКА ГЕМУНКУЛА — лестница Стадий Ковена, бюджеты Идеалов и две таблицы
//  трейтов (Плоть с 1-й Стадии, Варп с 4-й). Таблицы и правила счёта живут в
//  constants/haemonculus.mjs, здесь — то, что видит вкладка, и четыре действия
//  её кнопок.
//
//  Функции принимают актора, а не лист: лист остаётся точкой входа, но в
//  расчёт не входит, и вкладка проверяется без Foundry
//  (test/sheets/haemonculus.test.mjs).
// ════════════════════════════════════════════════════════════════════════════

import { HAEM_STAGES, HAEM_FLESH_TRAITS, HAEM_WARP_TRAITS, HAEM_TRAIT_MAP,
         haemState, traitCost } from "../../constants/haemonculus.mjs";

/** Сводка Гемункула для вкладки: лестница ступеней, бюджеты, таблицы. */
export function haemonculusContext(actor) {
  const st = haemState(actor);
  const h  = actor.system.haemonculus || {};

  const ladder = HAEM_STAGES.map(s => ({
    stage: s.stage, name: s.name, gain: s.gain, cost: s.stage ? s.cost : 0, inf: s.inf,
    req: s.req, sample: s.sample, benefits: s.benefits,
    open: s.stage <= st.stage, isCurrent: s.stage === st.stage
  }));

  const budgets = st.split
    ? [pool("Идеал Плоти", st.pools.flesh), pool("Идеал Варпа", st.pools.warp)]
    : [pool("Общий пул", st.pools.shared)];
  function pool(label, p) {
    const cap = p.cap || 0;
    return { label, cap, spent: p.spent, over: p.spent > cap,
             pct: cap ? Math.min(100, Math.round(p.spent / cap * 100)) : 0 };
  }

  // Строка таблицы: определение трейта + текущее состояние покупки.
  const rows = (defs, kind) => defs.map(d => {
    const taken = (h[kind] || []).find(e => e.key === d.key);
    const ranks = taken ? Math.max(1, Number(taken.ranks) || 1) : 0;
    return { key: d.key, name: d.name, take: d.take, up: d.up, note: d.note,
             noCor: kind === "warp" && d.cor === false,
             taken: !!taken, ranks, cost: taken ? traitCost(d, ranks) : 0 };
  });

  return {
    ...st, current: HAEM_STAGES[st.stage], ladder, budgets,
    anyTable: st.fleshOpen || st.warpOpen,
    tables: [
      { kind: "flesh", title: "ИДЕАЛ ПЛОТИ", open: st.fleshOpen, needStage: 1,
        rows: rows(HAEM_FLESH_TRAITS, "flesh") },
      { kind: "warp",  title: "ИДЕАЛ ВАРПА", open: st.warpOpen,  needStage: 4,
        corNote: true, cor: st.warpCor, rows: rows(HAEM_WARP_TRAITS, "warp") }
    ]
  };
}

/** Взойти на следующую ступень / откатить текущую. */
export async function haemStep(actor, delta) {
  const cur  = Number(actor.system.haemonculus?.stage) || 0;
  const next = Math.max(0, Math.min(5, cur + delta));
  if (next === cur) return;
  if (delta > 0) {
    const s = HAEM_STAGES[next];
    const ok = await Dialog.confirm({
      title: `Стадия ${next} — ${s.name}`,
      content: `<p><b>Стоимость:</b> ${s.cost} xp${s.inf ? `, требуется Inf ${s.inf}` : ""}.</p>`
             + `<p><b>Требования:</b> ${s.req}</p>`
             + (s.sample ? `<p><b>Образец:</b> ${s.sample}</p>` : "")
             + `<p>Опыт списывается вручную во вкладке РАЗВИТИЕ — ступени идут отдельной веткой.</p>`
    });
    if (!ok) return;
  }
  await actor.update({ "system.haemonculus.stage": next });
}

/** Взять или убрать трейт из таблицы Идеала. */
export async function haemToggleTrait(actor, kind, key) {
  const def = HAEM_TRAIT_MAP[kind]?.[key];
  if (!def) return;
  const list = foundry.utils.duplicate(actor.system.haemonculus?.[kind] || []);
  const i = list.findIndex(e => e.key === key);
  if (i >= 0) list.splice(i, 1);
  else list.push({ key, ranks: 1 });
  await actor.update({ [`system.haemonculus.${kind}`]: list });
}

/** Изменить число рейтингов взятого трейта. */
export async function haemRank(actor, kind, key, delta) {
  const def = HAEM_TRAIT_MAP[kind]?.[key];
  if (!def || def.up == null) return;
  const list = foundry.utils.duplicate(actor.system.haemonculus?.[kind] || []);
  const e = list.find(x => x.key === key);
  if (!e) return;
  e.ranks = Math.max(1, (Number(e.ranks) || 1) + delta);
  await actor.update({ [`system.haemonculus.${kind}`]: list });
}
