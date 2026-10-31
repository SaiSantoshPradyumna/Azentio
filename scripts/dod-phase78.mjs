import Database from "better-sqlite3";

const base = process.env.BASE ?? "http://127.0.0.1:3110";
const db = new Database("data/app.db");

async function otp(email) {
  await fetch(`${base}/api/auth/otp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const row = db
    .prepare(
      "SELECT message FROM notifications WHERE channel = 'dev_outbox' AND message LIKE ? ORDER BY rowid DESC LIMIT 1",
    )
    .get(`%${email}%`);
  const m = row.message.match(/code (\d{6})/);
  const res = await fetch(`${base}/api/auth/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, code: m[1] }),
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const raw = setCookie[0] ?? res.headers.get("set-cookie") ?? "";
  const sid = raw.match(/sid=([^;]+)/)?.[1];
  if (!sid) throw new Error(`no sid for ${email}: ${await res.text()}`);
  return sid;
}

const cookie = (sid) => ({ cookie: `sid=${sid}` });

const maya = await otp("maya@aurora.example");
const empMedia = await fetch(`${base}/api/media/media-employee-live`, { headers: cookie(maya) });
console.log("client->employee media", empMedia.status);

const anonQ = await fetch(`${base}/api/moderation/queue`);
const anonM = await fetch(`${base}/api/media/media-employee-live`);
console.log("AT-01 anon", anonQ.status, anonM.status);

const dev = await otp("dev.emp@azentio.com");
const range = await fetch(`${base}/api/media/media-employee-live`, {
  headers: { ...cookie(dev), Range: "bytes=0-9" },
});
console.log("Range", range.status, range.headers.get("content-range"), range.headers.get("accept-ranges"));

const putDeny = await fetch(`${base}/api/content/home.banner`, {
  method: "PUT",
  headers: { ...cookie(dev), "content-type": "application/json" },
  body: JSON.stringify({ body: "should fail" }),
});
console.log("dev.emp PUT", putDeny.status);

const kavya = await otp("kavya.pub@azentio.com");
const putOk = await fetch(`${base}/api/content/home.banner`, {
  method: "PUT",
  headers: { ...cookie(kavya), "content-type": "application/json" },
  body: JSON.stringify({
    body: "Azentio builds intelligence for Islamic FIs — AAOIFI / IFSB / IIFM aware (demo).",
  }),
});
console.log("kavya PUT", putOk.status);

const priya = await otp("priya.admin@azentio.com");
const runner = await fetch(`${base}/api/admin/test-runner`, {
  method: "POST",
  headers: cookie(priya),
});
const body = await runner.json();
console.log(
  "runner",
  runner.status,
  `${body.passed}/${(body.results || []).length}`,
  (body.results || []).map((r) => `${r.id}:${r.pass ? "PASS" : "FAIL"}`).join(" "),
);
if (body.results) {
  for (const r of body.results.filter((x) => !x.pass)) {
    console.log("FAIL detail", r.id, r.detail);
  }
}
