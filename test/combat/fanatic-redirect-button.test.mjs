// test/combat/fanatic-redirect-button.test.mjs
//
// Кнопка «Перехват» (attack-card.mjs::fanaticRedirectButtons) в обработчике
// карточки hooks.mjs: урон берётся с главной кнопки «Применить урон» той же
// группы попадания (с её правками), цель — носитель Fanatic по data-force-target
// без выделения токена, плата за перехват — до применения урона.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("../../module/combat/damage.mjs", async (importOriginal) => ({
  ...(await importOriginal()),
  applyDamageToActor: vi.fn(async () => {}),
  showApplyDamageDialog: vi.fn(async () => {})
}));
vi.mock("../../module/combat/fanatic-redirect.mjs", async (importOriginal) => ({
  ...(await importOriginal()),
  payFanaticIntercept: vi.fn()
}));

const { applyDamageToActor, showApplyDamageDialog } = await import("../../module/combat/damage.mjs");
const { payFanaticIntercept } = await import("../../module/combat/fanatic-redirect.mjs");

const hooks = {};
globalThis.Hooks.on = (name, fn) => { hooks[name] = fn; };
const { registerHooks } = await import("../../module/hooks.mjs");
registerHooks();

const mainDataset = { damage: "13", penetration: "4", damageType: "impact", hitLocation: "Рука",
  weaponName: "Силовой меч", melee: "1", attackerUuid: "Actor.att", weaponUuid: "Item.w1" };
const redirectDataset = { mirrorHit: "1", fanaticUuid: "Actor.f1", forceTarget: "Scene.s.Token.f1" };

const fanatic = { uuid: "Actor.f1", name: "Телохранитель", isOwner: true };
const fanaticTargetActor = { uuid: "Actor.f1", name: "Телохранитель" };

/** Карточка с группой попадания: главная кнопка и «Перехват» — нажать «Перехват». */
async function clickRedirect({ withMain = true, message = { id: "msg-1" } } = {}) {
  const group = { querySelector: sel => (sel === ".wh-apply-dmg-btn" && withMain ? main : null) };
  const main = { dataset: mainDataset, closest: () => group };
  let onClick = null;
  const btn = { dataset: redirectDataset, closest: sel => (sel === ".roll-dmg-hit-group" ? group : null),
    addEventListener: (ev, fn) => { if (ev === "click") onClick = fn; } };
  hooks.renderChatMessageHTML(message, {
    dataset: {}, querySelector: () => null, addEventListener: () => {},
    querySelectorAll: sel => (sel.includes(".wh-fanatic-redirect-btn") ? [btn] : [])
  });
  await onClick({ preventDefault() {}, currentTarget: btn });
}

beforeEach(() => {
  resetCaptured();
  applyDamageToActor.mockClear();
  showApplyDamageDialog.mockClear();
  payFanaticIntercept.mockReset();
  payFanaticIntercept.mockResolvedValue({ ok: true, free: true });
  globalThis.fromUuid = async uuid => ({
    "Actor.f1": fanatic,
    "Scene.s.Token.f1": { documentName: "Token", actor: fanaticTargetActor }
  })[uuid] ?? null;
});
afterEach(() => { delete globalThis.fromUuid; });

describe("кнопка «Перехват» Фанатика", () => {
  it("применяет урон главной кнопки группы носителю, без диалога выбора цели", async () => {
    await clickRedirect();
    expect(showApplyDamageDialog).not.toHaveBeenCalled();
    expect(applyDamageToActor).toHaveBeenCalledTimes(1);
    const [target, dmg] = applyDamageToActor.mock.calls[0];
    expect(target).toBe(fanaticTargetActor);
    expect(dmg).toMatchObject({ rawDamage: 13, penetration: 4, hitLocation: "Рука", weaponName: "Силовой меч", melee: true });
  });

  it("платит за перехват этим носителем и карточкой до применения урона", async () => {
    const message = { id: "msg-7" };
    await clickRedirect({ message });
    expect(payFanaticIntercept).toHaveBeenCalledWith(fanatic, message);
    expect(payFanaticIntercept.mock.invocationCallOrder[0])
      .toBeLessThan(applyDamageToActor.mock.invocationCallOrder[0]);
  });

  it("нет Реакции — урон не применяется, стол предупреждён", async () => {
    payFanaticIntercept.mockResolvedValue({ ok: false });
    await clickRedirect();
    expect(applyDamageToActor).not.toHaveBeenCalled();
    expect(captured.warnings.join("\n")).toContain("нет Реакции");
  });

  it("не владелец носителя — не перехватывает и не платит", async () => {
    fanatic.isOwner = false;
    try {
      await clickRedirect();
    } finally { fanatic.isOwner = true; }
    expect(payFanaticIntercept).not.toHaveBeenCalled();
    expect(applyDamageToActor).not.toHaveBeenCalled();
  });

  it("нет главной кнопки в группе — предупреждение вместо урона", async () => {
    await clickRedirect({ withMain: false });
    expect(applyDamageToActor).not.toHaveBeenCalled();
    expect(captured.warnings.join("\n")).toContain("Не найдено попадание");
  });
});
