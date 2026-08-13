import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("uses the registered same-origin web.app Google OAuth handler", () => {
  const source = readFileSync(new URL("../firebase-client.js", import.meta.url), "utf8");

  expect(source).toContain('authDomain: "florida-quantum-computing.web.app"');
  expect(source).not.toContain('authDomain: "florida-quantum-computing.firebaseapp.com"');
});
