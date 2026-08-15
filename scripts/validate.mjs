import { readFile } from "node:fs/promises";

const html = await readFile("index.html", "utf8");
if (!/^<!doctype html>/i.test(html)) throw new Error("index.html 缺少 doctype");

const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
for (const source of scripts) new Function(source);

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicates.length) throw new Error(`重複的 HTML id：${[...new Set(duplicates)].join(", ")}`);

console.log(`Validated index.html: ${scripts.length} scripts, ${ids.length} unique ids`);
