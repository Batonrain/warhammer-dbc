// module/sheets/tabs/mount-panel.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Блок «ВЕРХОМ» на вкладке БОЙ (корбук стр. 477-478).
//
//  Блока нет, пока скакун не выбран, — только узкая полоса-приглашение с зоной
//  переноса: пустая панель со всеми переключателями у пехотинца занимала бы
//  половину вкладки БОЙ ни за чем.
//
//  Скорость скакуна в текущем Ходу — состояние боя, а не свойство персонажа,
//  и переключается она руками: система не знает, сколько метров прошёл токен и
//  каким действием, а от этого зависят и штраф стрельбы, и доступные углы
//  поворота, и высота падения. Один переключатель честнее трёх догадок.
//
//  Пороги и таблицы берутся из rules/mount.mjs, сводка — из combat/mount.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { MOUNT_SPEEDS, MOUNT_ROLES, MOUNT_TRAIT_DEFS, RIDER_ACTOR_TYPES,
         MOUNT_ACTOR_TYPES, isBike, mountTraits, riderControl, testMod, STAY_MOD,
         handsNeeded, bonusHalfAction, sizeFits, pairInitiative, passengerCount,
         maneuverMods, skidInfo, mountRangedPenalty, isBroken,
         possessionOf, isPossessed } from "../../rules/mount.mjs";

const rootEl = root => (root?.jquery ? root[0] : root);

/** Русские подписи Черт верхового боя для строки «Черты» в панели. */
const TRAIT_LABELS = {
  ablativePlating: "Аблативное Бронирование", allTerrain: "Вездеход", aquatic: "Водный",
  blades: "Лезвия", flyer: "Летающий", hoverer: "Парящий",
  integralWeapon: "Интегрированное Оружие", legion: "Легион", machine: "Машина",
  maneuverable: "Манёвренный", sidecar: "Коляска", stand: "Стойка",
  unruly: "Непослушный", warTrained: "Боевая Тренировка", daemonic: "Демонический"
};

/**
 * Контекст блока. `mountActor` находится синхронно по списку акторов мира: на
 * листе он нужен при каждой перерисовке, а `fromUuid` — обещание, и панель
 * мигала бы пустой на каждом рендере.
 */
export function mountPanelContext(actor, actors = []) {
  if (!RIDER_ACTOR_TYPES.includes(actor?.type)) return { mountAvailable: false };

  const state = actor.system?.mount ?? {};
  const mount = state.uuid ? actors.find(a => a?.uuid === state.uuid) : null;

  if (!mount) {
    return {
      mountAvailable: true, mountActor: null,
      mountSpeeds: speedOptions(state.speed),
      mountRoles: roleOptions(state.role)
    };
  }

  const traits     = mountTraits(mount);
  const control    = riderControl(actor, mount, traits);
  const speedKey   = state.speed in MOUNT_SPEEDS ? state.speed : "still";
  const passengers = passengerCount(mount, actors);
  const bike       = isBike(mount);
  const hands      = handsNeeded(speedKey, mount, { traits, linked: !!state.linked });
  const man        = maneuverMods(actor, mount, { passengers, traits });
  const skid       = skidInfo(speedKey, actor, mount, { passengers, traits });
  const possessed  = isPossessed(mount);
  const init       = pairInitiative(actor, mount, { sync: !!state.sync, possessed });

  return {
    mountAvailable: true,
    mountActor: {
      uuid: mount.uuid, name: mount.name, img: mount.img,
      kind: bike ? "Байк" : "Скакун",
      // У байка запас — Структура, у живого скакуна — Раны: показываем то, что
      // у него на самом деле есть, а не общее «здоровье».
      poolLabel: bike ? "Структура" : "Раны",
      poolValue: bike ? (mount.system?.structure?.value ?? 0) : (mount.system?.wounds?.value ?? 0),
      poolMax:   bike ? (mount.system?.structure?.max   ?? 0) : (mount.system?.wounds?.max   ?? 0),
      broken: bike && isBroken(mount),
      size: mount.system?.sizeTotal ?? mount.system?.size ?? 0
    },
    mountIsBike: bike,
    mountSpeeds: speedOptions(speedKey),
    mountRoles:  roleOptions(state.role),
    mountSync:   !!state.sync,
    mountLinked: !!state.linked,
    mountSkidUsed: !!state.skidUsed,
    mountControl: {
      label: control.label, value: control.value,
      trained: !control.combined,
      stayMod: testMod(STAY_MOD, mount)
    },
    // Штраф стрельбы показывается для ОБЫЧНОГО оружия: интегрированное и
    // турель в Коляске считаются от своего оружия, а не от седла, и подставлять
    // их в общую строку значило бы обещать скидку всему арсеналу.
    mountRanged: mountRangedPenalty(speedKey, mount),
    mountPossession: possessed ? possessionOf(mount) : null,
    mountHands: hands,
    mountBonusAction: bonusHalfAction(actor, mount, traits),
    mountSizeFits: sizeFits(actor, mount),
    mountPassengers: passengers,
    mountManoeuvre: man.mod,
    mountManoeuvreParts: man.parts,
    mountSkidAllowed: skid.allowed,
    mountSkidBlocked: skid.blockedBySidecar,
    mountInitiative: init,
    mountTraitChips: Object.entries(traits).map(([key, rating]) => ({
      key,
      label: TRAIT_LABELS[key] || key,
      rating: MOUNT_TRAIT_DEFS[key]?.rated && rating ? rating : null
    }))
  };
}

const speedOptions = current => Object.entries(MOUNT_SPEEDS).map(([key, def]) => ({
  key, label: def.label, ranged: def.ranged,
  selected: key === (current in MOUNT_SPEEDS ? current : "still")
}));

const roleOptions = current => Object.entries(MOUNT_ROLES).map(([key, def]) => ({
  key, label: def.label, selected: key === (current || "rider")
}));

// ── Правка связи ──────────────────────────────────────────────────────────

/** Сесть в седло. Размер проверяется, но не запрещает: решение за столом. */
export async function setMount(actor, target) {
  if (!target) return;
  if (!MOUNT_ACTOR_TYPES.includes(target.type)) {
    return ui.notifications?.warn("Скакуном может быть Персонаж, Демон, миньон или Техника (байк).");
  }
  if (target.uuid === actor.uuid) {
    return ui.notifications?.warn("Сесть верхом на самого себя нельзя.");
  }
  if (!sizeFits(actor, target)) {
    ui.notifications?.warn(
      `«${target.name}» не крупнее седока на Размер — по книге он такого не понесёт (стр. 477). Связь всё равно заведена.`);
  }
  await actor.update({ "system.mount.uuid": target.uuid, "system.mount.skidUsed": false });
}

/** Спешиться: связь снимается, скорость возвращается к стоянке. */
export async function clearMount(actor) {
  await actor.update({
    "system.mount.uuid": "", "system.mount.speed": "still", "system.mount.skidUsed": false
  });
}

// ── Слушатели ─────────────────────────────────────────────────────────────

/**
 * Кнопки и переключатели панели. Диалоги верховых тестов подтягиваются лениво
 * (`await import`): combat/mount.mjs тянет за собой Roll и ChatMessage, а лист
 * рисуется и там, где ни одного броска не будет.
 */
export function activateMountPanelListeners(root, actor, { editable = true } = {}) {
  const el = rootEl(root);
  if (!el?.querySelector) return;

  el.querySelectorAll(".mount-open-link").forEach(node =>
    node.addEventListener("click", () => {
      if (!node.dataset.uuid) return;
      fromUuid(node.dataset.uuid).then(d => d?.sheet?.render(true)).catch(() => {});
    }));

  if (!editable) return;

  el.querySelectorAll(".mount-speed-select").forEach(node =>
    node.addEventListener("change", ev =>
      actor.update({ "system.mount.speed": ev.currentTarget.value })));

  el.querySelectorAll(".mount-role-select").forEach(node =>
    node.addEventListener("change", ev =>
      actor.update({ "system.mount.role": ev.currentTarget.value })));

  el.querySelectorAll(".mount-flag-toggle").forEach(node =>
    node.addEventListener("change", ev =>
      actor.update({ [`system.mount.${ev.currentTarget.dataset.flag}`]: ev.currentTarget.checked })));

  el.querySelectorAll(".mount-dismount-btn").forEach(node =>
    node.addEventListener("click", () => clearMount(actor)));

  el.querySelectorAll(".mount-action-btn").forEach(node =>
    node.addEventListener("click", async ev => {
      const action = ev.currentTarget.dataset.mountAction;
      const mod = await import("../../combat/mount.mjs");
      switch (action) {
        case "turn":    return mod.showTurnDialog(actor);
        case "skid":    return mod.showSkidDialog(actor);
        case "terrain": return mod.showMountTerrainDialog(actor);
        case "hit":     return mod.showHitAllocationDialog(actor);
        case "damage":  return mod.showMountDamageTest(actor);
        case "saddle":  return mod.saddleTest(actor, { kind: "acrobatics", reason: "проверка вручную" });
        case "repair": {
          const mount = await mod.mountOf(actor);
          return mount ? mod.showBikeRepairDialog(mount) : null;
        }
      }
    }));

  // Зона переноса: скакуна перетаскивают из боковой панели или со сцены.
  const zone = el.querySelector(".mount-drop-zone");
  if (!zone) return;
  zone.addEventListener("dragover", ev => { ev.preventDefault(); zone.classList.add("social-drop-hover"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("social-drop-hover"));
  zone.addEventListener("drop", async ev => {
    ev.preventDefault();
    ev.stopPropagation();
    zone.classList.remove("social-drop-hover");
    let data = null;
    try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch { /* не наш дроп */ }
    if (!data?.uuid) return;
    const doc = await fromUuid(data.uuid).catch(() => null);
    await setMount(actor, doc?.documentName === "Token" ? doc.actor : doc);
  });
}
