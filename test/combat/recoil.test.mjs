// test/combat/recoil.test.mjs
//
// «Отскок» (стр. 12, wdbc-9wvm) — UI-половина (module/combat/recoil.mjs):
// кнопка на карточке успешного Уклонения от стрелковой атаки, и исход
// performRecoil (списание пула + разовый флаг AP Укрытия + чат-карточка).
// Данные пула — test/combat/recoil-pool.test.mjs, интеграция с _performDodge
// (isMelee-гейт) — ниже в этом файле.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { _performDodge } from "../../module/combat/defense.mjs";
import { recoilButtonHtml, performRecoil, performPoolRecoil, POOL_RECOIL_COST, showRecoilDialog } from "../../module/combat/recoil.mjs";
import { recoilRemaining } from "../../module/combat/recoil-pool.mjs";
import { addEvasionSurplus, getEvasionPool } from "../../module/combat/evasion-pool.mjs";
import { COVER_TYPE } from "../../module/regions/cover.mjs";

function defender(overrides = {}) {
  const a = actorFor(overrides);
  const store = {};
  a.uuid = "Actor.defender-1";
  a.type = "character";
  a.getFlag = (scope, key) => store[`${scope}.${key}`];
  a.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
  a.unsetFlag = async (scope, key) => { delete store[`${scope}.${key}`]; };
  a.update = async data => {
    for (const [path, value] of Object.entries(data)) {
      if (path === "flags.warhammer-dbc.-=recoilPool") delete store["warhammer-dbc.recoilPool"];
    }
  };
  a.system.movement = { halfMove: 4 };
  return a;
}

const card = () => captured.chat.at(-1)?.content ?? "";
const flush = () => new Promise(r => setTimeout(r, 0));
const ATTACKER = "Actor.attacker-1";

beforeEach(() => {
  resetCaptured();
  captured.dice = [10]; // Ag 35 по умолчанию у actorFor() — гарантированный успех
  globalThis.game.combat = undefined;
});

describe("_performDodge: кнопка Отскока только у успешной СТРЕЛКОВОЙ защиты", () => {
  it("успех, isMelee=false (по умолчанию) — кнопка есть", async () => {
    const d = defender();
    await _performDodge(d, 0, "", 1, "Actor.attacker-1", false);
    expect(card()).toContain("wh-recoil-btn");
    expect(card()).toContain(`data-actor-uuid="${d.uuid}"`);
  });

  it("успех, isMelee=true — кнопки нет (Отскок только от стрелковой)", async () => {
    const d = defender();
    await _performDodge(d, 0, "", 1, "Actor.attacker-1", true);
    expect(card()).toContain("Уклонение успешно");
    expect(card()).not.toContain("wh-recoil-btn");
  });

  it("провал — кнопки нет независимо от isMelee", async () => {
    captured.dice = [96];
    const d = defender();
    await _performDodge(d, 0, "", 1, "Actor.attacker-1", false);
    expect(card()).toContain("Уклонение провалено");
    expect(card()).not.toContain("wh-recoil-btn");
  });

  it("data-actor-uuid на обёртке карточки — контратака-подобный приём для клика", async () => {
    const d = defender();
    await _performDodge(d, 0, "", 1, "Actor.attacker-1", false);
    expect(card()).toContain(`data-actor-uuid="${d.uuid}"`);
  });
});

describe("recoilButtonHtml: остаток пула в подписи", () => {
  it("вне боя — «∞ (вне боя)»", () => {
    const d = defender();
    expect(recoilButtonHtml(d)).toContain("∞ (вне боя)");
  });

  it("в бою — конкретное число метров", () => {
    globalThis.game.combat = { started: true, id: "c1", combatant: { id: "cbt-1" } };
    const d = defender();
    expect(recoilButtonHtml(d)).toContain("остаток 4м");
  });
});

describe("performRecoil: списание пула, разовый флаг Укрытия, чат-карточка", () => {
  beforeEach(() => {
    globalThis.game.combat = { started: true, id: "c1", combatant: { id: "cbt-1" } };
  });

  it("вне Укрытия — полная нивеляция текстом, флаг Укрытия не ставится", async () => {
    const d = defender();
    await performRecoil(d, { meters: 3, intoCover: false, coverAp: 0 });

    expect(card()).toContain("Отскочил на 3м вне предела атаки");
    expect(card()).toContain("все попадания промахиваются");
    expect(d.getFlag("warhammer-dbc", "recoilCoverBonus")).toBeUndefined();
    expect(recoilRemaining(d)).toBe(1);
  });

  it("в Укрытие — ставит разовый флаг AP, карточка называет прибавку", async () => {
    const d = defender();
    await performRecoil(d, { meters: 2, intoCover: true, coverAp: 6 });

    expect(d.getFlag("warhammer-dbc", "recoilCoverBonus")).toBe(6);
    expect(card()).toContain("Отскочил на 2м в Укрытие");
    expect(card()).toContain("+6 AP");
  });

  it("запрошено больше остатка — зажимается, в карточке реально потраченное", async () => {
    const d = defender();
    await performRecoil(d, { meters: 99, intoCover: false, coverAp: 0 });
    expect(card()).toContain("Отскочил на 4м");
    expect(recoilRemaining(d)).toBe(0);
  });
});

describe("performPoolRecoil: банк Успехов → Отскок (wdbc-16ss, Voltagheist Blast)", () => {
  beforeEach(() => {
    globalThis.game.combat = { started: true, id: "c1", combatant: { id: "cbt-1" } };
  });

  it("успехов хватает и дистанция есть — списывает cost, открывает диалог, тратит метры", async () => {
    const d = defender();
    await addEvasionSurplus(d, ATTACKER, 3, 0);

    const promise = performPoolRecoil(d, ATTACKER);
    await flush();
    expect(captured.dialog).toBeTruthy(); // Успехи уже списаны, диалог открылся

    await captured.press("recoil", fakeForm({
      '[name="meters"]': "2", '[name="intoCover"]': false, '[name="coverAp"]': "0"
    }));
    await promise;

    expect(getEvasionPool(d, ATTACKER)).toMatchObject({ successes: 1 }); // 3 − 2 (cost)
    expect(card()).toContain("Отскочил на 2м");
    expect(recoilRemaining(d)).toBe(2); // 4 (halfMove) − 2 (метры)
  });

  it("в банке недостаточно Успехов — предупреждение в чате, диалог не открывается, дистанция не тронута", async () => {
    const d = defender();
    await addEvasionSurplus(d, ATTACKER, 1, 0); // меньше POOL_RECOIL_COST

    await performPoolRecoil(d, ATTACKER);

    expect(captured.dialog).toBeNull();
    expect(card()).toContain("недостаточно Успехов");
    expect(getEvasionPool(d, ATTACKER)).toMatchObject({ successes: 1 });
    expect(recoilRemaining(d)).toBe(4);
  });

  it("банка вовсе нет — тот же путь недостаточности, без ошибки", async () => {
    const d = defender();
    await performPoolRecoil(d, ATTACKER);
    expect(card()).toContain("недостаточно Успехов");
  });

  it("дистанция Отскока в этом Раунде уже исчерпана — предупреждение, банк не тратится", async () => {
    const d = defender();
    await addEvasionSurplus(d, ATTACKER, 5, 0);
    await performRecoil(d, { meters: 4, intoCover: false, coverAp: 0 }); // исчерпать весь пул (halfMove=4)
    resetCaptured();

    await performPoolRecoil(d, ATTACKER);

    expect(captured.dialog).toBeNull();
    expect(getEvasionPool(d, ATTACKER)).toMatchObject({ successes: 5 }); // не тронут
  });

  it("cost списан ДО диалога — отмена диалога Успехи не возвращает (как у Контратаки)", async () => {
    const d = defender();
    await addEvasionSurplus(d, ATTACKER, POOL_RECOIL_COST, 0);

    const promise = performPoolRecoil(d, ATTACKER);
    await flush();
    captured.dismiss();
    await promise;

    expect(getEvasionPool(d, ATTACKER)).toBeNull(); // 2 Усп. списаны безвозвратно
    expect(recoilRemaining(d)).toBe(4); // метры не тронуты — диалог отменён до этого шага
  });
});

describe("showRecoilDialog: подсказанный AP Укрытия учитывает Императив цели (wdbc-yu32)", () => {
  function coverToken(actorUuid, coverAp) {
    const region = { behaviors: [{ type: COVER_TYPE, disabled: false, system: { coverAp } }] };
    return { actor: { uuid: actorUuid }, document: { regions: new Set([region]) } };
  }

  beforeEach(() => { globalThis.canvas.tokens = { placeables: [] }; });

  it("нет активного Императива — подсказка = сырой AP зоны", async () => {
    const d = defender();
    globalThis.canvas.tokens.placeables = [coverToken(d.uuid, 6)];

    const promise = showRecoilDialog(d);
    await flush();
    expect(captured.dialog.content).toContain('value="6"');
    captured.dismiss();
    await promise;
  });

  it("Императив Крепости активен у цели — +8 к подсказанному AP, клапан ×2 от базового", async () => {
    const d = defender();
    d.items.push({ getFlag: (s, k) => (k === "imperativeCarrier" ? true : k === "imperativeBonuses" ? { coverApDelta: 8, coverApCeilRatio: 2 } : undefined) });
    globalThis.canvas.tokens.placeables = [coverToken(d.uuid, 4)];

    const promise = showRecoilDialog(d);
    await flush();
    expect(captured.dialog.content).toContain('value="8"'); // 4+8=12, клапан 4×2=8
    captured.dismiss();
    await promise;
  });
});

// wdbc-zik7: «Отскок из рукопашной считается как Вольт» (п.6, стр. 12) —
// showRecoilDialog добавляет чекбокс «Вольт», только если у актора СЕЙЧАС
// есть враг личного масштаба в Базовом/Глубоком контакте (то же обнаружение,
// что у Свободной Атаки, module/combat/free-attack.mjs::enemyContactTokenDocs);
// performRecoil при volt=true ставит тот же flags.warhammer-dbc.disengageActive,
// что и «Выход из Боя» (declareDisengage, movement-actions.mjs).

const HOSTILE = -1, FRIENDLY = 1;
let _zik7TokenSeq = 0;

/** Токен-заглушка: та же форма, что tokenFor(actor) в recoil.mjs ждёт от placeable. */
function zik7Token(actor, { x = 0, y = 0, width = 1, height = 1, disposition = FRIENDLY } = {}) {
  const id = `zik7-t${++_zik7TokenSeq}`;
  return { actor, document: { id, x, y, width, height, disposition, actor } };
}

/** Форма диалога Отскока — те же селекторы, что showRecoilDialog реально читает. */
function recoilForm({ meters = 3, intoCover = false, coverAp = 0, volt } = {}) {
  const fields = {
    '[name="meters"]': String(meters), '[name="intoCover"]': intoCover, '[name="coverAp"]': String(coverAp)
  };
  if (volt !== undefined) fields['[name="volt"]'] = volt;
  return fakeForm(fields);
}

describe("showRecoilDialog: чекбокс Вольта (wdbc-zik7, п.6) только при рукопашном контакте", () => {
  beforeEach(() => {
    globalThis.game.combat = { started: true, id: "c1", combatant: { id: "cbt-1" } };
    globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [] } };
  });

  it("нет токена на сцене — чекбокс не предлагается, volt=false", async () => {
    const d = defender();
    const promise = showRecoilDialog(d);
    expect(captured.dialog.content).not.toContain('name="volt"');
    await captured.press("recoil", recoilForm());
    expect((await promise).volt).toBe(false);
  });

  it("токен есть, враг не в контакте — чекбокс не предлагается", async () => {
    const d = defender();
    canvas.tokens.placeables = [
      zik7Token(d, { x: 0, y: 0, disposition: FRIENDLY }),
      zik7Token(defender(), { x: 10, y: 10, disposition: HOSTILE })
    ];
    const promise = showRecoilDialog(d);
    expect(captured.dialog.content).not.toContain('name="volt"');
    await captured.press("recoil", recoilForm());
    expect((await promise).volt).toBe(false);
  });

  it("союзник вплотную (не враг) — чекбокс не предлагается", async () => {
    const d = defender();
    canvas.tokens.placeables = [
      zik7Token(d, { x: 0, y: 0, disposition: FRIENDLY }),
      zik7Token(defender(), { x: 1, y: 0, disposition: FRIENDLY })
    ];
    const promise = showRecoilDialog(d);
    expect(captured.dialog.content).not.toContain('name="volt"');
    await captured.press("recoil", recoilForm());
    expect((await promise).volt).toBe(false);
  });

  it("враг личного масштаба вплотную — чекбокс предложен; не отмечен → volt=false", async () => {
    const d = defender();
    canvas.tokens.placeables = [
      zik7Token(d, { x: 0, y: 0, disposition: FRIENDLY }),
      zik7Token(defender(), { x: 1, y: 0, disposition: HOSTILE })
    ];
    const promise = showRecoilDialog(d);
    expect(captured.dialog.content).toContain('name="volt"');
    expect(captured.dialog.content).toContain("п.6");
    await captured.press("recoil", recoilForm({ volt: false }));
    expect((await promise).volt).toBe(false);
  });

  it("враг вплотную, чекбокс отмечен — volt=true", async () => {
    const d = defender();
    canvas.tokens.placeables = [
      zik7Token(d, { x: 0, y: 0, disposition: FRIENDLY }),
      zik7Token(defender(), { x: 1, y: 0, disposition: HOSTILE })
    ];
    const promise = showRecoilDialog(d);
    await captured.press("recoil", recoilForm({ volt: true }));
    expect((await promise).volt).toBe(true);
  });
});

describe("performRecoil: volt (wdbc-zik7) ставит disengageActive и заметку п.6 в карточке", () => {
  beforeEach(() => {
    globalThis.game.combat = { started: true, id: "c1", combatant: { id: "cbt-1" } };
  });

  it("volt не передан (по умолчанию false) — флаг не ставится, заметки нет", async () => {
    const d = defender();
    await performRecoil(d, { meters: 3, intoCover: false, coverAp: 0 });
    expect(d.getFlag("warhammer-dbc", "disengageActive")).toBeUndefined();
    expect(card()).not.toContain("Засчитан как Вольт");
  });

  it("volt=true — ставит flags.warhammer-dbc.disengageActive, постит заметку п.6", async () => {
    const d = defender();
    await performRecoil(d, { meters: 3, intoCover: false, coverAp: 0, volt: true });
    expect(d.getFlag("warhammer-dbc", "disengageActive")).toBe(true);
    expect(card()).toContain("Засчитан как Вольт");
    expect(card()).toContain("Свободную Атаку");
  });

  it("volt=true вместе с intoCover — оба разовых флага независимы", async () => {
    const d = defender();
    await performRecoil(d, { meters: 2, intoCover: true, coverAp: 6, volt: true });
    expect(d.getFlag("warhammer-dbc", "disengageActive")).toBe(true);
    expect(d.getFlag("warhammer-dbc", "recoilCoverBonus")).toBe(6);
  });

  it("пул Отскока списывается как обычно независимо от volt", async () => {
    const d = defender();
    await performRecoil(d, { meters: 3, intoCover: false, coverAp: 0, volt: true });
    expect(recoilRemaining(d)).toBe(1);
  });
});
