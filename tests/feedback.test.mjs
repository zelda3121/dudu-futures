import test from "node:test";
import assert from "node:assert/strict";
import {
  aliasFromDigest,
  cleanMessage,
  countCharacters,
  publicComment,
  visitorDigest
} from "../netlify/lib/feedback.mjs";

test("同一來源會得到固定且不含 IP 的仙俠道號", () => {
  const first = visitorDigest("203.0.113.7", "secret");
  const second = visitorDigest("203.0.113.7", "secret");
  assert.equal(first, second);
  const alias = aliasFromDigest(first);
  assert.match(alias.name, /・.*靈根/);
  assert.match(alias.seal, /^道印 [0-9A-F]{4}$/);
  assert.doesNotMatch(JSON.stringify(alias), /203\.0\.113\.7/);
});

test("留言清理控制字元並保留合理換行", () => {
  assert.equal(cleanMessage("  很好\u0000  \n\n\n請繼續  "), "很好\n\n請繼續");
  assert.equal(countCharacters("御風✨"), 3);
});

test("公開留言不洩漏內部欄位", () => {
  const visible = publicComment({
    id: "1", category: "praise", message: "好用", author: "玄霄道友",
    seal: "道印 ABCD", createdAt: "2026-08-14T00:00:00Z", status: "visible",
    ipHash: "never-public"
  });
  assert.equal(visible.status, undefined);
  assert.equal(visible.ipHash, undefined);
});
