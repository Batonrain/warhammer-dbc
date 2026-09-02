// module/sheets/tabs/dreadnought-panel.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Панель «ЗДРАВОМЫСЛИЕ» на вкладке БОЙ — видна только персонажу, которого
//  какой-то Дредноут в мире держит своим пилотом (Книга Машин, стр. 57-58).
//
//  Максимум и сработавшие пороги уже посчитаны в prepareDerivedData
//  (system.sanity.max / .thresholds) — от мира они не зависят. А вот сам факт
//  «этот персонаж сейчас пилот» знает только Дредноут (место экипажа с ролью
//  pilot хранит uuid пилота), и это приходится спрашивать у game.actors — тем
//  же приёмом, что и «ВЕРХОМ» (mount-panel.mjs): синхронно, по уже переданному
//  списку акторов, а не через fromUuid, чтобы панель не мигала пустой на
//  каждой перерисовке.
// ════════════════════════════════════════════════════════════════════════════

import { isDreadnoughtPilot, dreadnoughtOf, sanityRecoveryTalentsOf,
         hasElectrostimulators, electrostimulatorBoost,
         hasFerumInfernus, ferumInfernusThreshold, ferumInfernusActive,
         SARCOPHAGUS } from "../../rules/dreadnought.mjs";

/**
 * Короткие метки сработавших порогов для чипов панели — полное описание
 * эффекта смотрят в книге (Здравомыслие, стр. 57), тут только ориентир.
 */
const THRESHOLD_LABELS = {
  50: "провалы Навыков I/F",
  40: "штраф на общение",
  30: "штраф Command/Logic/Lore",
  20: "тест W или атака",
  10: "Ярость",
  0:  "Ярость навсегда"
};

export function dreadnoughtPanelContext(actor, actors = []) {
  if (actor?.type !== "character") return { sanityAvailable: false };
  if (!isDreadnoughtPilot(actor.uuid, actors)) return { sanityAvailable: false };

  const raw = actor.system?.sanity ?? {};
  const max = Math.max(0, Number(raw.max) || 0);
  const value = Math.max(0, Math.min(max, Number(raw.value) || 0));
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const thresholds = Array.isArray(raw.thresholds) ? raw.thresholds : [];
  const dread = dreadnoughtOf(actor.uuid, actors);

  // Электростимуляторы — снаряжение самого Дредноута (стр. 58), не пилота:
  // кнопка видна, только когда оно реально стоит на этой машине.
  const es = actor.system?.electrostim ?? {};
  const wpBonus = actor.system?.characteristics?.wp?.bonus ?? 0;
  const boost = electrostimulatorBoost(wpBonus);
  const electrostim = hasElectrostimulators(dread?.items ?? []) ? {
    active: !!es.active,
    amount: Number(es.amount) || 0,
    boostAmount: boost.amount,
    delayMinutes: boost.delayMinutes
  } : null;

  // «Ферум Инфернус» — Талант на самом пилоте, не снаряжение техники.
  const infTotal = actor.system?.characteristics?.inf?.total ?? 0;
  const ferumInfernus = hasFerumInfernus(actor.items ?? []) ? {
    threshold: ferumInfernusThreshold(infTotal),
    active: ferumInfernusActive(value, infTotal)
  } : null;

  // Раны/Аблативные против варп-оружия — уже посчитаны в prepareDerivedData
  // (module/rules/character.mjs, wdbc-drn): effectiveMax/sarcophagusWarpWounds
  // не зависят от мира, только warpWounds.available (нечего лечить/восполнять)
  // проверяется здесь же, для галочки в шаблоне.
  const w = actor.system?.wounds ?? {};
  const woundsValue = Number(w.value) || 0;
  const effectiveMax = Number(w.effectiveMax ?? w.max) || 0;
  const warpWoundsRaw = actor.system?.sarcophagusWarpWounds ?? {};
  const warpWounds = (Number(warpWoundsRaw.max) || 0) > 0 ? {
    value: Number(warpWoundsRaw.value) || 0,
    max: Number(warpWoundsRaw.max) || 0
  } : null;

  return {
    sanityAvailable: true,
    sanity: {
      value, max, pct,
      // Низкое Здравомыслие — опасность, поэтому направление обратное шкалам
      // Безумия/Порчи: чем меньше осталось, тем тревожнее цвет.
      level: pct <= 20 ? "over" : pct <= 50 ? "heavy" : "ok",
      dreadnoughtName: dread?.name ?? "",
      thresholds: thresholds.map(t => ({ value: t, label: THRESHOLD_LABELS[t] ?? "" })),
      // Кнопки разового восстановления 2d10 — по Талантам на листе (стр. 58).
      // Трату Очка Бесчестия и сам бросок делает клик-обработчик листа.
      recoveries: sanityRecoveryTalentsOf(actor.items ?? []).map(t =>
        ({ key: t.key, label: t.label, hint: t.hint })),
      electrostim,
      ferumInfernus,
      // Гибернация (стр. 57) — основной способ восстановить Здравомыслие:
      // раз в полную неделю в ней 1d10, пока флаг стоит (тикает кнопка листа).
      hibernation: { active: !!actor.system?.hibernation?.active }
    },
    // Прочие числовые пункты Саркофага (стр. 57, wdbc-drn), не связанные со
    // Здравомыслием — отдельный блок, чтобы не раздувать sanity выше не по теме.
    sarcophagus: {
      auspexRange: SARCOPHAGUS.auspexRange,
      poisonBonus: SARCOPHAGUS.poisonBonus,
      woundsEffectiveMax: effectiveMax,
      // Кнопка лечения (1 Рана/10 мин, стр. 57) видна, только если реально
      // есть что лечить — тикать вручную, тот же принцип, что Ферум Инфернус.
      healAvailable: woundsValue < effectiveMax,
      warpWounds,
      interred: !!actor.system?.sarcophagusInterred,
      helplessNow: !!actor.system?.sarcophagusHelplessNow
    }
  };
}
