import fs from "fs";
import vm from "vm";
import assert from "assert";

const html = fs.readFileSync("index.html", "utf8");
const gate = fs.readFileSync("lib/htms-gate.js", "utf8");
const sw = fs.readFileSync("sw.js", "utf8");
const scripts = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const main = scripts.sort((a, b) => b.length - a.length)[0];

new vm.Script(main, { filename: "index-inline.js" });
new vm.Script(sw, { filename: "sw.js" });

const unlockAt = main.indexOf("let unlockSecret=");
const homeNavAt = main.indexOf("let homeNavBound=");
const initAt = main.indexOf("i18next.init(");
assert.ok(unlockAt >= 0, "unlockSecret declared");
assert.ok(homeNavAt >= 0, "homeNavBound declared");
assert.ok(initAt >= 0, "i18next.init present");
assert.ok(unlockAt < initAt, "unlockSecret must be declared before i18next.init");
assert.ok(homeNavAt < initAt, "homeNavBound must be declared before i18next.init");
assert.equal((main.match(/let unlockSecret=/g) || []).length, 1, "unlockSecret declared once");
assert.equal((main.match(/let homeNavBound=/g) || []).length, 1, "homeNavBound declared once");
assert.ok(main.includes("function tryUnlock"), "tryUnlock exists");
assert.ok(main.includes("HTMSGate.matchCode"), "unlock uses case-insensitive match");
assert.ok(gate.includes('TEACHER_CODE = "bteacher"'), "teacher code is bteacher");
assert.ok(!/TEACHER_CODE = "HTMST"/.test(gate), "old teacher code removed");
assert.equal("BTeacher".toLowerCase(), "bteacher");
assert.ok(main.includes("function finishUnlock"), "finishUnlock exists");
assert.ok(main.includes("HTMSGate.bounceToCanonical"), "unlock bounces stale Vercel hosts");
assert.ok(main.includes("insertLineBreak"), "Enter is not swallowed by the mask");
assert.ok(html.includes('action="/index.html"'), "unlock form stays on site root");
assert.ok(html.includes('id="home-hub"'), "homepage hub cards exist");
assert.ok(html.includes('class="home-help"') && html.includes("function toggleHomeHelp"), "PWA and offline help collapse");
assert.ok(!html.includes('id="home-nav-menu"'), "dropdown menu removed");
assert.ok(html.includes('data-i18n="sectionTools"') && html.includes('data-i18n="sectionNotes"') && html.includes('data-i18n="sectionPastPapers"') && html.includes('data-i18n="sectionLab"'), "four section names kept");
assert.ok(html.includes('id="unlock-screen"') && html.includes('class="container"'), "unlock and container present");
const unlockPos = html.indexOf('id="unlock-screen"');
const containerPos = html.indexOf('class="container"');
assert.ok(unlockPos < containerPos, "unlock screen is outside container");

assert.ok(gate.includes('CANONICAL_HOST = "dse-econ-bafs-tools.vercel.app"'), "canonical host set");
assert.ok(gate.includes("if (bounceToCanonical()) return;"), "stale Vercel hosts bounce first");
assert.ok(gate.includes('origin + "/index.html?lang="'), "homeUrl is origin-absolute");

function needsCanonicalBounce(host) {
  host = (host || "").toLowerCase();
  if (!host || host === "localhost" || host === "127.0.0.1" || host === "[::1]" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  if (!/\.vercel\.app$/i.test(host)) return false;
  return host !== "dse-econ-bafs-tools.vercel.app";
}
assert.equal(needsCanonicalBounce("dse-econ-bafs-tools.vercel.app"), false);
assert.equal(needsCanonicalBounce("localhost"), false);
assert.equal(needsCanonicalBounce("127.0.0.1"), false);
assert.equal(needsCanonicalBounce("dse-econ-bafs-tools-wchunsansam.vercel.app"), true);
assert.equal(needsCanonicalBounce("dse-econ-bafs-tools-git-main-wchunsansam.vercel.app"), true);

assert.ok(/ebb-pwa-v\d+/.test(sw), "service worker cache versioned");
assert.ok(sw.includes("if (!fresh || !fresh.ok)"), "network 404 falls back to cache");
assert.ok(sw.includes("CANONICAL_ORIGIN"), "service worker knows production host");

const replaced = [];
const loc = {
  hostname: "dse-econ-bafs-tools-wchunsansam.vercel.app",
  pathname: "/index.html",
  search: "?lang=zh-hk",
  hash: "",
  replace(url) { replaced.push(url); }
};
const bounceSrc = `
const CANONICAL_HOST = "dse-econ-bafs-tools.vercel.app";
${gate.slice(
  gate.indexOf("function isLocalHost"),
  gate.indexOf("if (bounceToCanonical()) return;")
)}
bounceToCanonical();
`;
vm.runInNewContext(bounceSrc, { location: loc });
assert.equal(replaced[0], "https://dse-econ-bafs-tools.vercel.app/index.html?lang=zh-hk");

const stay = [];
vm.runInNewContext(bounceSrc, {
  location: {
    hostname: "dse-econ-bafs-tools.vercel.app",
    pathname: "/index.html",
    search: "",
    hash: "",
    replace(url) { stay.push(url); }
  }
});
assert.equal(stay.length, 0, "production host must not bounce");

console.log("ok home unlock init order and canonical bounce");
