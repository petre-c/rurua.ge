/*
  გვერდის და კოდის შესაბამისობის ტესტი.

  fees.js ველებს data-* ატრიბუტებით პოულობს. თუ HTML-ში ატრიბუტს გადავარქმევთ ან
  დაგვავიწყდება, კალკულატორი ჩუმად გაფუჭდება: ველი არ გამოჩნდება ან თანხა არ განახლდება.
  ეს ტესტი ორივე გვერდზე ამოწმებს, რომ კოდი და მარკაპი ერთმანეთს ემთხვევა.

  გაშვება:  node tests/page.test.mjs
*/
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const fakeWindow = {};
new Function("window", read("assets/words.js"))(fakeWindow);

const feesSource = read("assets/fees.js").split("/* ---------- DOM ---------- */")[0];
const { CATALOGUE } = new Function("window", feesSource + "\nreturn { CATALOGUE };")(fakeWindow);

let passed = 0;
const failures = [];
const check = (label, actual, expected) => {
  if (actual === expected) { passed++; return; }
  failures.push({ label, expected, actual });
};

const attrs = (html, name) =>
  new Set([...html.matchAll(new RegExp(`${name}="([^"]*)"`, "g"))].map((m) => m[1]));

// ველები, რომლებსაც fees.js კითხულობს სრული სიის ბლოკში
const NEEDED_INPUTS = ["value", "pages", "signs", "months", "agreedSum", "outsideSum", "conc", "outside", "registry", "vat"];
const NEEDED_OUTPUTS = ["fee", "extra", "registry", "vat", "total"];
const NEEDED_ROWS = ["extra", "registry", "vat"];

// კატალოგში გამოყენებული ყველა needs, პლუს ბიუროს გარეთ დანამატის ველი
const catalogueNeeds = new Set(["outsideSum"]);
CATALOGUE.forEach((s) => s.needs.forEach((n) => catalogueNeeds.add(n)));

["tarifi/index.html", "en/fees/index.html"].forEach((page) => {
  const html = read(page);

  check(`${page}: სრული სიის ბლოკი`, html.includes("data-picker"), true);
  check(`${page}: სიის select`, html.includes("data-picker-select"), true);
  check(`${page}: შენიშვნის ადგილი`, html.includes("data-picker-note"), true);

  const ins = attrs(html, "data-in");
  NEEDED_INPUTS.forEach((name) => check(`${page}: data-in="${name}"`, ins.has(name), true));

  const outs = attrs(html, "data-out");
  NEEDED_OUTPUTS.forEach((name) => check(`${page}: data-out="${name}"`, outs.has(name), true));

  const rows = attrs(html, "data-row");
  NEEDED_ROWS.forEach((name) => check(`${page}: data-row="${name}"`, rows.has(name), true));

  const needs = attrs(html, "data-needs");
  catalogueNeeds.forEach((name) => check(`${page}: data-needs="${name}"`, needs.has(name), true));

  // ოთხი დეტალური კალკულატორი ტექსტის გენერაციით ადგილზე უნდა იყოს
  ["signature", "copy", "transaction", "inheritance"].forEach((kind) =>
    check(`${page}: data-calc="${kind}"`, html.includes(`data-calc="${kind}"`), true)
  );

  // ორიგინალი დოკუმენტების ბმულები
  check(`${page}: დადგენილების PDF`, html.includes("dadgenileba.pdf"), true);
  check(`${page}: matsne`, html.includes("matsne.gov.ge/ka/document/view/1549252"), true);

  /*
    ტერმინი „შეღავათიანი პირი" არც დადგენილებაშია და არც პალატის გვერდზე, და ნოტარიუსმა
    ცალკე მოითხოვა მისი მოშორება: შემცირებული განაკვეთი დადგენილების ნაწილია და არა
    ნოტარიუსის ფასდაკლება. ამიტომ სიტყვა გვერდზე არ უნდა გამოჩნდეს.
  */
  check(`${page}: „შეღავათიან" არ ხმარობს`, html.includes("შეღავათიან"), false);
});

console.log(`checks passed: ${passed}`);

if (failures.length) {
  console.log(`\nFAILURES: ${failures.length}\n`);
  failures.forEach((f) => console.log(`${f.label}\n  expected: ${f.expected}\n  actual:   ${f.actual}\n`));
  process.exit(1);
}

console.log("მარკაპი და კოდი ემთხვევა ორივე გვერდზე");
