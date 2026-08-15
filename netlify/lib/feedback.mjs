import { createHash } from "node:crypto";

const ORIGINS = [
  "青石塢", "暮雲澗", "寒星嶺", "霧隱谷", "赤砂洲", "白蘆渡", "蒼木原", "落月坡",
  "斷霞峰", "靜水潭", "玄竹林", "孤鶴島", "紫煙澤", "風雷坪", "古泉洞", "青崖坊"
];

const ROOTS = [
  "金靈根", "木靈根", "水靈根", "火靈根", "土靈根", "風靈根", "雷靈根", "冰靈根",
  "霧靈根", "光靈根", "影靈根", "雙靈根", "山靈根", "泉靈根", "星靈根", "月靈根"
];

const PATHS = [
  "斂息散修", "守拙丹師", "藏鋒劍修", "問心符師", "尋脈陣師", "煉霞器師", "聽泉藥師", "逐風靈舟客",
  "拾礦探脈人", "觀星卜修", "御獸山人", "靈植洞主", "巡山客卿", "護脈執事", "鑑寶居士", "閉關道人"
];

export function visitorDigest(ip, salt) {
  return createHash("sha256")
    .update(`${salt || "dudu-futures"}:${ip || "unknown"}`)
    .digest("hex");
}

export function aliasFromDigest(digest) {
  const pick = (offset, list) => parseInt(digest.slice(offset, offset + 8), 16) % list.length;
  const origin = ORIGINS[pick(0, ORIGINS)];
  const root = ROOTS[pick(8, ROOTS)];
  const path = PATHS[pick(16, PATHS)];
  const seal = digest.slice(24, 28).toUpperCase();
  return {
    name: `${origin}・${root}${path}`,
    seal: `道印 ${seal}`
  };
}

export function cleanMessage(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function countCharacters(value) {
  return Array.from(value).length;
}

export function publicComment(comment) {
  return {
    id: comment.id,
    category: comment.category,
    message: comment.message,
    author: comment.author,
    seal: comment.seal,
    createdAt: comment.createdAt
  };
}
