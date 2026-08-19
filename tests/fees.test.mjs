/*
  კალკულატორის ტესტი.

  ორიგინალი გვერდის შედეგები tests/fixtures.json-შია, ბრაუზერში გაზომილი.
  ტესტი იმავე კოდს ამოწმებს, რომელიც საიტზე მიდის: assets/words.js და assets/fees.js.
  fees.js-ის DOM-ის ნაწილი აქ არ სრულდება, მხოლოდ ლოგიკა და ტექსტები.

  გაშვება:  node tests/fees.test.mjs
*/
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

// words.js window-ზე იწერება, ამიტომ ყალბ window-ს ვაწვდი
const fakeWindow = {};
new Function("window", read("assets/words.js"))(fakeWindow);

// fees.js-იდან მხოლოდ ლოგიკის ნაწილს ვიღებ, DOM-ის მიბმა აქ არ გვჭირდება
const feesSource = read("assets/fees.js").split("/* ---------- DOM ---------- */")[0];
const { calculators, texts } = new Function(
  "window",
  feesSource + "\nreturn { calculators, texts };"
)(fakeWindow);

const { cases } = JSON.parse(read("tests/fixtures.json"));

/*
  შენიშვნის შაბლონს გვერდიდან ვიღებ და არა ტესტში ვწერ: ასე HTML-ის შეცვლა
  ტესტისთვის შეუმჩნეველი ვერ დარჩება. ჩანაცვლება იგივეა, რაც fees.js-ში.
*/
const noteTemplate = read("tarifi/index.html").match(/data-note="([^"]*)"/)[1];

const noteFor = (r) =>
  r.heirs > 1
    ? noteTemplate
        .replace("{heirs}", String(r.heirs))
        .replace("{share}", fakeWindow.gelWords.amountPhrase(r.share))
    : "";

let passed = 0;
const failures = [];

const check = (label, actual, expected) => {
  if (actual === expected) { passed++; return; }
  failures.push({ label, expected, actual });
};

cases.forEach((c, i) => {
  const id = `#${i + 1} ${c.kind}`;
  const r = calculators[c.kind](c.in);

  check(`${id} fee`, r.fee, c.fee);
  check(`${id} extra`, r.extra, c.extra);
  check(`${id} vat`, r.vat, c.vat);
  check(`${id} total`, r.total, c.total);
  check(`${id} text`, texts[c.kind](r), c.text);

  if (c.note !== undefined) check(`${id} note`, noteFor(r), c.note);
});

// ცალკე შემოწმება: უვარგისი შეყვანა არ უნდა გატეხოს
const junk = [
  ["signature", { pages: "-3", people: "x", copies: "", projectMode: "other", projectAmount: "-5", vat: true }],
  ["copy", { pages: "0", copies: "-2", copyingMode: "yes", copyingTetri: "abc", vat: true }],
  ["transaction", { value: "-100", vat: true }],
  ["inheritance", { value: "", heirs: "0", vat: false }],
];

junk.forEach(([kind, input]) => {
  const r = calculators[kind](input);
  const finite = [r.fee, r.extra, r.vat, r.total].every(Number.isFinite);
  check(`junk ${kind} stays finite`, finite, true);
  check(`junk ${kind} text is a string`, typeof texts[kind](r), "string");
});

console.log(`checks passed: ${passed}`);

if (failures.length) {
  console.log(`\nFAILURES: ${failures.length}\n`);
  failures.slice(0, 6).forEach((f) => {
    console.log(f.label);
    console.log("  expected: " + f.expected);
    console.log("  actual:   " + f.actual);
    console.log("");
  });
  process.exit(1);
}

console.log("all cases match the original");
