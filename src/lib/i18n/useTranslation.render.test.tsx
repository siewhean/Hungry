import assert from "node:assert/strict";
import { createElement } from "react";
import test, { afterEach } from "node:test";

import { SUPPORTED_LOCALES, setOfferedLocalesForTests } from "@/lib/i18n/locales";
import { useLanguageStore } from "@/store/useLanguageStore";
import { cleanup, render } from "@/test/render";

import { useTranslation } from "./useTranslation";

afterEach(async () => {
  await cleanup();
  setOfferedLocalesForTests(undefined);
});

test("useTranslation re-renders in the new language when the choice changes", async () => {
  setOfferedLocalesForTests(SUPPORTED_LOCALES);
  useLanguageStore.setState({ preference: "en" });
  const box: { current: ReturnType<typeof useTranslation> | null } = { current: null };
  function Probe() {
    box.current = useTranslation();
    return null;
  }
  const view = await render(createElement(Probe));
  assert.equal(box.current?.t("tab.profile"), "Profile");

  useLanguageStore.setState({ preference: "zh" });
  await view.settle();
  assert.equal(box.current?.locale, "zh");
  assert.equal(box.current?.t("tab.profile"), "我的");
});
