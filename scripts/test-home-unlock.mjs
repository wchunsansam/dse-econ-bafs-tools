import fs from "fs";
import vm from "vm";
import assert from "assert";

const html = fs.readFileSync("index.html", "utf8");
const scripts = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const main = scripts.sort((a, b) => b.length - a.length)[0];

new vm.Script(main, { filename: "index-inline.js" });

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
assert.ok(html.includes('id="unlock-screen"') && html.includes('class="container"'), "unlock and container present");
const unlockPos = html.indexOf('id="unlock-screen"');
const containerPos = html.indexOf('class="container"');
assert.ok(unlockPos < containerPos, "unlock screen is outside container");
console.log("ok home unlock init order");
