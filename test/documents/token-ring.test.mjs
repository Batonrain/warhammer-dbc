// test/documents/token-ring.test.mjs
//
// Круглый токен из портрета. Foundry умеет рисовать токен кольцом: картинка
// обрезается по кругу и вписывается в клетку, вместо того чтобы лечь на сцену
// портретом во весь рост. Включается это полем prototypeToken.ring.enabled.
//
// Включаем в ПОДГОТОВКЕ данных, а не при создании актора: так кольцо получают
// и уже созданные персонажи, и все существа бестиария — без миграции и без
// правки паков. Тот же приём в системе pf2e: там кольцо тоже проставляется
// подготовкой, а не хранится у каждого актора.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";

/** Актор без живого Foundry: нужен только прототип токена. */
const actorLike = (ring = {}) => {
  const a = Object.create(WarhammerActor.prototype);
  a.prototypeToken = { ring: { enabled: false, subject: { scale: 1, texture: null }, ...ring } };
  return a;
};

describe("кольцо токена", () => {
  it("включается при подготовке данных", () => {
    const actor = actorLike();

    actor.prepareBaseData();

    expect(actor.prototypeToken.ring.enabled).toBe(true);
  });

  // Картинку кольцу отдельно не задаём: без своей текстуры Foundry берёт
  // картинку самого токена, а она у нас равна портрету. Задать её значило бы
  // закрепить портрет в поле, которое ГМ потом не переопределит выбором токена.
  it("своей картинки кольцу не назначает", () => {
    const actor = actorLike();

    actor.prepareBaseData();

    expect(actor.prototypeToken.ring.subject.texture).toBe(null);
  });
});
