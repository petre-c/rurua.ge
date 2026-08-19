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
const { calculators, texts, RATES, CATALOGUE, byId, priceOne } = new Function(
  "window",
  feesSource + "\nreturn { calculators, texts, RATES, CATALOGUE, byId, priceOne };"
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

/*
  ხელმოწერაზე ორიგინალს განზრახ არ ვყვებით.

  ორიგინალი ხელმოწერის საზღაურს გვერდების რაოდენობაზეც ამრავლებს. დადგენილების 31-ე
  მუხლის მე-3 პუნქტით გვერდები მხოლოდ განაკვეთს ირჩევენ: „თითოეული ხელმოწერისთვის".
  ამიტომ ამ სახის შემთხვევებში მოსალოდნელ თანხას თავად ვთვლით დადგენილების წესით და
  ვამოწმებთ, რომ ორიგინალის ციფრს მართლა გავცდით. დანარჩენი სახეები fixtures-ს ემთხვევა.
*/
const signatureRate = (pages) =>
  RATES.signaturePerPage.find((row) => pages <= row.upToPages).factor;

const decreeSignature = (input) => {
  const pages = Math.max(1, Math.round(Number(input.pages)) || 1);
  const people = Math.max(1, Math.round(Number(input.people)) || 1);
  const copies = Math.max(1, Math.round(Number(input.copies)) || 1);

  const fee = signatureRate(pages) * people * copies;
  const extra = input.projectMode === "none" ? 0
    : input.projectMode === "ten" ? 10
    : Math.max(0, Number(input.projectAmount) || 0);
  const vat = input.vat ? Math.round((fee + extra) * RATES.vatPercent) / 100 : 0;

  return { fee, extra, vat, total: fee + extra + vat + RATES.registryFee };
};

let divergences = 0;

cases.forEach((c, i) => {
  const id = `#${i + 1} ${c.kind}`;
  const r = calculators[c.kind](c.in);

  if (c.kind === "signature") {
    const want = decreeSignature(c.in);

    check(`${id} fee, დადგენილებით`, r.fee, want.fee);
    check(`${id} extra`, r.extra, want.extra);
    check(`${id} vat`, r.vat, want.vat);
    check(`${id} total`, r.total, want.total);
    // ტექსტი იმავე ყალიბისაა, მხოლოდ თანხა იცვლება, ამიტომ ჯამის ფრაზას ვეძებთ შიგნით
    check(`${id} text carries the total`, texts[c.kind](r).includes(fakeWindow.gelWords.amountPhrase(r.total)), true);

    if (want.fee !== c.fee) divergences++;
    return;
  }

  check(`${id} fee`, r.fee, c.fee);
  check(`${id} extra`, r.extra, c.extra);
  check(`${id} vat`, r.vat, c.vat);
  check(`${id} total`, r.total, c.total);
  check(`${id} text`, texts[c.kind](r), c.text);

  if (c.note !== undefined) check(`${id} note`, noteFor(r), c.note);
});

// მრავალგვერდიან შემთხვევებში ორიგინალს უნდა გავცდეთ, თორემ შესწორება არ მუშაობს
check("signature diverges from the original on multi-page cases", divergences > 0, true);

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

/*
  სრული კატალოგის შემოწმება. ეს ნაწილი ორიგინალს არ ეყრდნობა, პირდაპირ დადგენილების
  ციფრებს ვამოწმებთ, მუხლების მითითებით.
*/
const fee = (id, input = {}) => byId(id).calc(input).fee;

check("31.1 ანდერძი", fee("will"), 16);
check("31.1 ანდერძი, შემცირებული", fee("will", { conc: true }), 10);
check("31.3 ხელმოწერა, 12 გვერდი, 3 ხელმოწერა", fee("sign", { pages: 12, signs: 3 }), 9);
check("31.5 ასლი, 5 გვერდი", fee("copy-accuracy", { pages: 5 }), 10);
check("31.7 მინდობილობა", fee("poa"), 18);
check("31.8 მინდობილობა, იურიდიული", fee("poa-legal"), 30);
check("23.1 გარიგება 10 000-ზე", fee("deal", { value: 10000 }), 82.5);
check("23.2 ცალმხრივი, ნახევარი", fee("deal-one", { value: 10000 }), 41.25);
check("23.3 ზედა ზღვარი", fee("deal", { value: 50000000 }), 10000);
check("29.2 ა დეპოზიტი, ქვედა ზღვარი", fee("deposit", { value: 1000, months: 3 }), 12);
check("29.2 ბ გირავნობა, ქვედა ზღვარი", fee("pledge-order", { value: 100 }), 5);
check("23¹ იპოთეკა 100 001-ზე", fee("mortgage", { value: 100001 }), 500);
check("23¹ იპოთეკა, კომპანია 30 მლნ", fee("mortgage-corp", { value: 30000000 }), 10000);
check("26.1 პრივატიზება, ზედა ზღვარი", fee("privatisation", { value: 500000 }), 200);
check("19 შეთანხმებით, 1 000-ზე შეჭრა", fee("company-docs", { agreedSum: 5000 }), 1000);
check("21 შეთანხმებით, 500-ზე შეჭრა", fee("company-minutes", { agreedSum: 900 }), 500);

// სრული ანგარიში: დღგ საზღაურზე, რეესტრის 5 ლარი დღგ-ის გარეშე
const willTotal = priceOne(byId("will"), { vat: true, registry: true });
check("ანდერძი, დღგ", willTotal.vat, 2.88);
check("ანდერძი, რეესტრი", willTotal.registry, 5);
check("ანდერძი, სულ", willTotal.total, 23.88);

// ასლის დამოწმებას რეესტრის საფასური არ ერიცხება, მუხლი 39.1
check("ასლი, რეესტრის საფასურის გარეშე", priceOne(byId("copy-accuracy"), { pages: 2, vat: false, registry: true }).registry, 0);

// ბიუროს გარეთ გასვლის დანამატი 35 ლარით იჭრება, მუხლი 34.2
check("ბიუროს გარეთ, ზღვარი", priceOne(byId("poa"), { outside: true, outsideSum: 90, vat: false }).extra, 35);

// ყველა მოქმედება უნდა დაითვალოს, ცარიელ ველებზეც
const sample = { value: 25000, pages: 4, signs: 2, months: 2, agreedSum: 300, conc: false, vat: true, registry: true, outside: false };
CATALOGUE.forEach((s) => {
  const r = priceOne(s, sample);
  check(`${s.id} რიცხვები`, [r.fee, r.extra, r.vat, r.registry, r.total].every(Number.isFinite), true);
  check(`${s.id} მუხლი`, typeof s.art === "string" && s.art.length > 0, true);
  check(`${s.id} ორივე ენა`, typeof s.ka === "string" && typeof s.en === "string" && s.ka.length > 0 && s.en.length > 0, true);
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

console.log(
  `ყველაფერი ემთხვევა: ასლი, გარიგება და სამკვიდრო ორიგინალს, ხელმოწერა კი დადგენილებას ` +
  `(${divergences} შემთხვევაში ორიგინალს განზრახ ვცდებით)`
);
