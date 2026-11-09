import assert from "node:assert/strict";
import { test } from "node:test";
import qazaSetupModule from "../node_modules/.cache/salah-tracker-tests/qaza/setup.js";
import qazaRepositoryModule from "../node_modules/.cache/salah-tracker-tests/qaza/repository.js";

const { QAZA_SETUP_META_KEY, completeQazaSetup, getQazaSetup } = qazaSetupModule;
const { createInMemoryQazaRepository } = qazaRepositoryModule;
const now = new Date("2026-11-10T12:00:00.000Z");

test("saves each Qaza setup choice and the local tracking start date in repository metadata", async () => {
  for (const choice of ["no_previous_qaza", "enter_existing_qaza", "add_qaza_later"]) {
    const repository = createInMemoryQazaRepository();
    const saved = await completeQazaSetup(repository, choice, now);
    assert.equal(saved.choice, choice);
    assert.equal(saved.trackingStartDate, "2026-11-10");
    assert.equal(saved.completedAt, now.toISOString());
    assert.deepEqual(await repository.getMeta(QAZA_SETUP_META_KEY), saved);
    assert.deepEqual(await getQazaSetup(repository), saved);
  }
});

test("does not overwrite a completed setup choice or its start date", async () => {
  const repository = createInMemoryQazaRepository();
  const initial = await completeQazaSetup(repository, "add_qaza_later", now);
  const later = await completeQazaSetup(repository, "no_previous_qaza", new Date("2027-01-01T12:00:00.000Z"));
  assert.deepEqual(later, initial);
});

test("invalid setup metadata is treated as not configured", async () => {
  const repository = createInMemoryQazaRepository();
  await repository.setMeta(QAZA_SETUP_META_KEY, { choice: "unknown", trackingStartDate: "2026-02-30" });
  assert.equal(await getQazaSetup(repository), null);
});
