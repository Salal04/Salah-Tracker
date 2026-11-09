import assert from "node:assert/strict";
import { test } from "node:test";
import profileHelpers from "../node_modules/.cache/salah-tracker-tests/profile.js";

const { normalizeUserProfile } = profileHelpers;

test("older profiles remain valid without optional profile fields", () => {
  assert.deepEqual(normalizeUserProfile({ name: "Amina", image: "" }), { name: "Amina", image: "" });
});

test("profile normalization preserves optional settings and linked location", () => {
  assert.deepEqual(normalizeUserProfile({
    name: "Amina",
    image: "",
    gender: "Woman",
    schoolOfThought: "Shafi'i",
    location: { city: "Karachi", country: "Pakistan" },
  }), {
    name: "Amina",
    image: "",
    gender: "Woman",
    schoolOfThought: "Shafi'i",
    location: { city: "Karachi", country: "Pakistan" },
  });
});
