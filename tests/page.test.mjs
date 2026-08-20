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

/*
  მთავარი გვერდები.

  issue #20: საზღაურის ბლოკი ჰეროში აღარ უნდა იყოს. ახლა გვერდის ბოლოშია, კონტაქტის
  შემდეგ, ცალკე სექციაში. პოზიციას ვამოწმებთ და არა მხოლოდ არსებობას, თორემ ჰეროში
  დაბრუნება შეუმჩნეველი დარჩება.

  ადრე ეს შემოწმება ვიზიტის სექციას ეყრდნობოდა. ვიზიტი აღარ არსებობს, ამიტომ ღუზა
  კონტაქტია: არარსებულ ატრიბუტზე indexOf -1-ს აბრუნებს და შედარება ყალბად გადიოდა.
*/
[["index.html", "tarifi/"], ["en/index.html", "fees/"]].forEach(([page, href]) => {
  const html = read(page);

  const contactAt = html.indexOf('id="contact"');
  const ctaAt = html.indexOf('class="cta-calc');
  const feesAt = html.indexOf('id="fees"');

  check(`${page}: საზღაურის სექცია არსებობს`, feesAt > -1, true);
  check(`${page}: კონტაქტის სექცია არსებობს`, contactAt > -1, true);
  check(`${page}: ბლოკი გვერდის ბოლოშია, კონტაქტის შემდეგ`, feesAt > contactAt, true);
  check(`${page}: ბლოკი საზღაურის სექციაშია`, ctaAt > feesAt, true);

  // ვიზიტის სექცია მოხსნილია, მკვდარი ღუზა არსად უნდა დარჩეს
  check(`${page}: ვიზიტის სექცია აღარ არის`, html.includes('id="visit"'), false);
  check(`${page}: ვიზიტზე ბმული აღარ არის`, html.includes('href="#visit"'), false);

  // ელფოსტა ჰეროშია, ტელეფონის გვერდით
  const heroEnd = html.indexOf('</section>', html.indexOf('class="hero"'));
  check(`${page}: ელფოსტა ჰეროშია`, html.lastIndexOf('mailto:tikarurua@gmail.com', heroEnd) > -1, true);
  check(`${page}: ბმული საზღაურის გვერდზე`, html.includes(`class="cta-calc cta-calc-block" href="${href}"`), true);

  // ერთადერთი ბლოკი უნდა იყოს, ჰეროს დუბლიკატი არ დარჩენილიყო.
  // მხოლოდ <a>-ს ვითვლით: შიგნით cta-calc-ico, -text და -arrow კლასებიცაა.
  check(`${page}: ერთი ბლოკი`, (html.match(/<a class="cta-calc/g) || []).length, 1);
});

/*
  issue #19: 31-ე მუხლის სრული ცხრილი საზღაურის გვერდზე. დადგენილებაში თექვსმეტი
  მოქმედებაა, ამიტომ ცხრილში თექვსმეტი სტრიქონი უნდა იყოს.
*/
["tarifi/index.html", "en/fees/index.html"].forEach((page) => {
  const html = read(page);
  const from = html.search(/<h3 class="tariff-h3">(მყარი განაკვეთები|Fixed rates)/);
  const to = html.indexOf("</table>", from);

  check(`${page}: 31-ე მუხლის ცხრილი მოიძებნა`, from > -1 && to > from, true);

  const rows = (html.slice(from, to).match(/<tr>/g) || []).length;
  check(`${page}: თექვსმეტი მოქმედება პლუს სათაური`, rows, 17);
});

/*
  ქვეგვერდების ნავიგაცია. ../#visit და ../#services მთავარ გვერდზე აღარ არსებობს,
  ამიტომ ბმულებმა ცოცხალ სექციებზე უნდა მიუთითოს.
*/
["tarifi/index.html", "en/fees/index.html"].forEach((page) => {
  const html = read(page);
  check(`${page}: მკვდარი ../#visit ბმული`, html.includes('href="../#visit"'), false);
  check(`${page}: მკვდარი ../#services ბმული`, html.includes('href="../#services"'), false);
  check(`${page}: ბმული გადახდაზე`, html.includes('href="../#payment"'), true);
});

/*
  ჯავშნის ღილაკი ჰედერიდან მოხსნილია. ჯავშნა მთავარ გვერდზე ჰეროშია, საზღაურის
  გვერდზე კი ტექსტის ბოლოს. ამიტომ ჰედერში cal.com არ უნდა იყოს, გვერდზე კი უნდა დარჩეს:
  ასე შემთხვევითი დაბრუნებაც და სრული გაქრობაც ორივე დაფიქსირდება.
*/
["index.html", "en/index.html", "tarifi/index.html", "en/fees/index.html"].forEach((page) => {
  const html = read(page);
  const head = html.slice(html.indexOf('class="head-actions"'), html.indexOf("</header>"));

  check(`${page}: ჰედერში ჯავშნა აღარ არის`, head.includes("cal.com"), false);
  check(`${page}: ჯავშნა გვერდზე რჩება`, html.includes('class="btn btn-primary btn-cal"'), true);
});

console.log(`checks passed: ${passed}`);

if (failures.length) {
  console.log(`\nFAILURES: ${failures.length}\n`);
  failures.forEach((f) => console.log(`${f.label}\n  expected: ${f.expected}\n  actual:   ${f.actual}\n`));
  process.exit(1);
}

console.log("მარკაპი და კოდი ემთხვევა ორივე გვერდზე");
