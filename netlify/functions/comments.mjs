import { randomUUID } from "node:crypto";
import { getStore } from "@netlify/blobs";
import {
  aliasFromDigest,
  cleanMessage,
  countCharacters,
  publicComment,
  visitorDigest
} from "../lib/feedback.mjs";

const COMMENT_PREFIX = "comment/";
const MAX_COMMENTS = 60;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 3;

function response(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

function identityFor(context) {
  const salt = process.env.DUDU_HASH_SALT || context.site?.id || "dudu-futures-v3";
  const digest = visitorDigest(context.ip, salt);
  return { digest, alias: aliasFromDigest(digest) };
}

async function listComments(store, limit) {
  const { blobs } = await store.list({ prefix: COMMENT_PREFIX });
  const keys = blobs.map(entry => entry.key).sort().reverse().slice(0, limit);
  const rows = await Promise.all(keys.map(key => store.get(key, { type: "json" })));
  return rows
    .filter(comment => comment?.status === "visible")
    .map(publicComment);
}

async function enforcePostRate(digest, now) {
  const store = getStore({ name: "dudu-feedback-rate", consistency: "strong" });
  const key = `visitor/${digest.slice(0, 32)}`;
  const current = await store.get(key, { type: "json" });
  const recent = Array.isArray(current?.posts)
    ? current.posts.filter(time => Number.isFinite(time) && now - time < RATE_WINDOW_MS)
    : [];

  if (recent.length >= RATE_LIMIT) {
    const retryAfter = Math.max(1, Math.ceil((RATE_WINDOW_MS - (now - recent[0])) / 1000));
    return { allowed: false, retryAfter };
  }

  recent.push(now);
  await store.setJSON(key, { posts: recent });
  return { allowed: true, retryAfter: 0 };
}

export default async (request, context) => {
  const store = getStore({ name: "dudu-feedback", consistency: "strong" });
  const { digest, alias } = identityFor(context);

  if (request.method === "GET") {
    const requested = Number(new URL(request.url).searchParams.get("limit"));
    const limit = Number.isFinite(requested)
      ? Math.min(MAX_COMMENTS, Math.max(10, Math.trunc(requested)))
      : 40;
    const comments = await listComments(store, limit);
    return response({
      comments,
      alias,
      privacy: "原始 IP 僅用於產生匿名道號，不會寫入留言資料。"
    });
  }

  if (request.method !== "POST") {
    return response({ error: "不支援此請求方式。" }, 405);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 4096) return response({ error: "留言內容過長。" }, 413);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return response({ error: "留言格式不正確。" }, 400);
  }

  // Hidden honeypot: respond successfully without persisting bot submissions.
  if (cleanMessage(payload.website)) {
    return response({ accepted: true, alias });
  }

  const message = cleanMessage(payload.message);
  const length = countCharacters(message);
  if (length < 4 || length > 240) {
    return response({ error: "留言請輸入 4–240 個字。" }, 400);
  }

  const category = payload.category === "praise" ? "praise" : "suggestion";
  const now = Date.now();
  const rate = await enforcePostRate(digest, now);
  if (!rate.allowed) {
    return response({ error: "修行需要留白，請稍後再留言。", retryAfter: rate.retryAfter }, 429);
  }

  const id = randomUUID();
  const comment = {
    id,
    category,
    message,
    author: alias.name,
    seal: alias.seal,
    createdAt: new Date(now).toISOString(),
    status: "visible"
  };
  const key = `${COMMENT_PREFIX}${String(now).padStart(13, "0")}-${id}`;
  await store.setJSON(key, comment, { onlyIfNew: true });

  return response({ comment: publicComment(comment), alias }, 201);
};

export const config = {
  path: "/api/comments",
  rateLimit: {
    windowLimit: 60,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
