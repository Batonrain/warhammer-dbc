import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { buildPropertyChatBlock, resolveWeaponPropsList } from "../../module/combat/weapon-properties.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

function lasgun(mode) {
  const flags = mode ? { "warhammer-dbc.powerMode": mode } : {};
  return weaponFor({
    magazineCur: 30, magazineMax: 30, rof_single: 1,
    special: "Моды: Power Setting",
    weaponProps: [{ key: "reliable" }]
  }, { id: "las", name: "Лазган", flags });
}

async function shoot(mode, roll) {
  const weapon = lasgun(mode);
  const actor = actorFor({ items: [weapon] });
  captured.dice = [roll, 5];
  await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
  return card();
}

describe("Надёжное: подпись на карточке показывает фактический порог клина режима Power Setting", () => {
  it("обычный режим — заклинивает только на 100", async () => {
    const html = await shoot("", 50);
    expect(html).toContain("Надёжное: заклинивает только на 100");
  });

  it("Усиление — клин с 96", async () => {
    const html = await shoot("boost", 50);
    expect(html).not.toContain("заклинивает только на 100");
    expect(html).toContain("Надёжное: заклинивает на 96+");
  });

  it("Перегрузка — клин с 91", async () => {
    const html = await shoot("overload", 50);
    expect(html).not.toContain("заклинивает только на 100");
    expect(html).toContain("Надёжное: заклинивает на 91+");
  });
});

describe("buildPropertyChatBlock: порог клина", () => {
  const props = resolveWeaponPropsList([{ key: "reliable" }]);

  it("без jamAt — исходное напоминание", () => {
    expect(buildPropertyChatBlock(props)).toContain("заклинивает только на 100");
  });

  it("jamAt null — не заклинивает", () => {
    expect(buildPropertyChatBlock(props, { jamAt: null })).toContain("Надёжное: не заклинивает");
  });
});
