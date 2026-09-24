// test/combat/attack-id-collision.test.mjs
//
// wdbc-bjy1.11: attackId склеивался из Date.now() и счётчика клиента. У
// каждого клиента счётчик свой, поэтому две атаки в одну миллисекунду с
// разных компьютеров давали один attackId, и гейт «одна Реакция на одно
// Действие» съедал Реакцию защитника на второй. Два клиента имитируются
// двумя свежими загрузками модуля при одинаковом времени.

import "../support/foundry-stub.mjs";
import { describe, it, expect, vi, afterEach } from "vitest";

const attackIdOf = html => html.match(/data-attack-id="([^"]+)"/)?.[1];

async function freshClient() {
  vi.resetModules();
  return import("../../module/combat/attack-card.mjs");
}

describe("attackId: два клиента в одну миллисекунду", () => {
  afterEach(() => vi.restoreAllMocks());

  it("первые атаки двух клиентов в одну мс получают разные attackId", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const a = await freshClient();
    const b = await freshClient();
    const idA = attackIdOf(a.defenseSection({}, { wp: {} }));
    const idB = attackIdOf(b.defenseSection({}, { wp: {} }));
    expect(idA).toBeTruthy();
    expect(idA).not.toBe(idB);
  });
});
