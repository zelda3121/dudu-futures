import { copyFile, cp, mkdir } from "node:fs/promises";

await import("./validate.mjs");

await mkdir("dist", { recursive: true });
await copyFile("index.html", "dist/index.html");
await cp("assets", "dist/assets", { recursive: true });
await cp("styles", "dist/styles", { recursive: true });
await mkdir("dist/scripts", { recursive: true });
await copyFile("scripts/risk-model.js", "dist/scripts/risk-model.js");
console.log("Built dist/index.html, assets, styles, and risk model");
