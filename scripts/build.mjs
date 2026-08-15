import { copyFile, cp, mkdir } from "node:fs/promises";

await import("./validate.mjs");

await mkdir("dist", { recursive: true });
await copyFile("index.html", "dist/index.html");
await cp("assets", "dist/assets", { recursive: true });
await cp("styles", "dist/styles", { recursive: true });
console.log("Built dist/index.html, assets, and styles");
