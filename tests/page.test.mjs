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

  issue #20: საზღაურის ბლოკი ჰეროში აღარ უნდა იყოს. ახლა მთავარ გვერდზე ცალკე სექცია
  აღარ არსებობს: აღწერა კალკულატორის გვერდზეა, აქ ჰედერში პატარა ღილაკი რჩება.

  ისტორია: ეს შემოწმება თავიდან ვიზიტის სექციას ეყრდნობოდა, მერე კონტაქტს, ორივე
  მოიხსნა. არარსებულ ატრიბუტზე indexOf -1-ს აბრუნებს, ანუ პოზიციის შედარება ჩუმად
  გადის. ამიტომ აქ არსებობა ცალკე შემოწმდება და არა მხოლოდ რიგი.
*/
[["index.html", "tarifi/", "საბანკო რეკვიზიტები", "შეფასება Google-ზე"],
 ["en/index.html", "fees/", "Bank details", "Review on Google"]]
  .forEach(([page, href, payTitle, reviewTitle]) => {
  const html = read(page);

  const head = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
  const heroAt = html.indexOf('id="hero"');
  const hero = html.slice(heroAt, html.indexOf("</section>", heroAt));
  const foot = html.slice(html.indexOf("<footer"), html.indexOf("</footer>"));

  /*
    მოხსნილი სექციები. სამივე ერთ დროს არსებობდა, ახლა გვერდი ჰერო, გადახდა და
    შეფასებაა. ღუზასაც ვამოწმებთ, თორემ ბმული სექციის გარეშე დარჩება.
  */
  ["visit", "contact", "fees"].forEach((id) => {
    check(`${page}: ${id} სექცია აღარ არის`, html.includes(`id="${id}"`), false);
    check(`${page}: ${id}-ზე ბმული აღარ არის`, html.includes(`href="#${id}"`), false);
  });

  check(`${page}: საზღაურის ბლოკი აღარ არის`, html.includes("cta-calc"), false);
  check(`${page}: საბანკო რეკვიზიტების სექცია არსებობს`, html.includes('id="payment"'), true);
  check(`${page}: სექციის სათაური`, html.includes(`<h2 class="section-title">${payTitle}</h2>`), true);
  check(`${page}: შეფასების სექცია არსებობს`, html.includes('id="review"'), true);
  check(`${page}: შეფასების სათაური`, html.includes(`<h2 class="section-title">${reviewTitle}</h2>`), true);
  check(`${page}: შეფასების ღილაკი`, html.includes('class="btn-review"'), true);
  check(`${page}: შეფასების ბმული`, html.includes("!12e1"), true);

  // ხუთი ვარსკვლავი: ოთხი ან ექვსი შეცდომა იქნებოდა, ეს შეფასების ჩვეული ნიშანია
  check(`${page}: ხუთი ვარსკვლავი`, (html.match(/#icon-star/g) || []).length, 5);

  /*
    ჰედერი ნავიგაციაა და არა ღილაკების რიგი: მხოლოდ გადახდაზე გადასვლა რჩება,
    კონტაქტი ჰეროშია ხატულებით, ტექსტი კი ფუტერში.
  */
  check(`${page}: ჰედერში ნავიგაციაა`, head.includes('class="head-nav"'), true);
  check(`${page}: ჰედერში ბმული გადახდაზე აღარ არის`, head.includes('href="#payment"'), false);
  check(`${page}: ჰედერში ღილაკი არ არის`, head.includes('class="btn'), false);
  check(`${page}: ჰედერში ტელეფონის ხატულა`, head.includes("#icon-phone"), true);
  check(`${page}: ჰედერში ელფოსტის ხატულა`, head.includes("#icon-mail"), true);
  check(`${page}: ხატულებს სახელი აქვს`, (head.match(/nav-icon[^>]*aria-label=/g) || []).length, 2);
  check(`${page}: ჰედერში WhatsApp არ არის`, head.includes("wa.me"), false);
  check(`${page}: ჰედერში ჯავშნა აღარ არის`, head.includes("cal.com"), false);
  check(`${page}: ჰედერში საზღაური აღარ არის`, head.includes(`href="${href}"`), false);

  /*
    ჰეროში ჯავშანი მთავარია: ორი ღილაკი და მისამართი, სხვა ვერაფერი ეცილება
    ყურადღებას. კონტაქტი ჰედერშია, WhatsApp მცურავ ღილაკზე.
  */
  check(`${page}: ჯავშნა ჰეროშია`, hero.includes("cal.com/rurua/30"), true);
  check(`${page}: Teams ჰეროშია`, hero.includes("teams.live.com"), true);
  check(`${page}: მისამართი ჰეროშია`, hero.includes("maps/place/?cid=2737741856713212816"), true);
  check(`${page}: ჰეროში ორი ღილაკია`, (hero.match(/class="btn /g) || []).length, 2);

  /*
    WhatsApp მცურავი ღილაკია გვერდის ბოლოში და არა ნავიგაციაში. ფუტერში ნომერი და
    ელფოსტა ტექსტად წერია: ჰეროში მხოლოდ ხატულებია, ანუ ტექსტს სხვა ადგილი არ აქვს.
  */
  check(`${page}: WhatsApp მცურავი ღილაკია`, html.includes('class="wa-float"'), true);
  check(`${page}: მცურავი ღილაკი ფუტერის შემდეგაა`, html.indexOf("wa-float") > html.indexOf("</footer>"), true);
  check(`${page}: WhatsApp ბმული ერთია`, (html.match(/wa\.me\/995591709931/g) || []).length, 1);
  check(`${page}: ფუტერში ნომერი`, foot.includes("tel:+995591709931"), true);
  check(`${page}: ფუტერში ელფოსტა`, foot.includes("mailto:tikarurua@gmail.com"), true);
  check(`${page}: ფუტერში მისამართი რჩება`, /ყაზბეგის|Kazbegi/.test(foot), true);
  check(`${page}: ფუტერის მისამართი რუკის ბმულია`, foot.includes("maps/place/?cid=2737741856713212816"), true);
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
  ["visit", "services", "contact"].forEach((id) => {
    check(`${page}: მკვდარი ../#${id} ბმული`, html.includes(`href="../#${id}"`), false);
  });
  check(`${page}: ბმული საბანკო რეკვიზიტებზე`, html.includes('href="../#payment"'), true);
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

/*
  მცურავი WhatsApp ღილაკი გრაგნილს არ უნდა მიჰყვეს და მარჯვნივ ქვემოთ უნდა იდგეს.
  ეს მთლიანად CSS-ზეა, ამიტომ სტილსაც ვამოწმებთ და არა მხოლოდ მარკაპს.
*/
const css = read("assets/styles.css");
const waRule = css.slice(css.indexOf(".wa-float {"), css.indexOf("}", css.indexOf(".wa-float {")));

check("styles.css: მცურავი ღილაკი fixed-ია", /position:\s*fixed/.test(waRule), true);
check("styles.css: მარჯვნივ ქვემოთ", /right:\s*\d/.test(waRule) && /bottom:\s*\d/.test(waRule), true);
check("styles.css: ჰედერზე მაღლა", /z-index:\s*\d/.test(waRule), true);

/*
  მისამართის ჩაწერა ერთნაირი უნდა იყოს ყველგან: „თბილისი" და არა „ქალაქი თბილისი",
  ნომერი კი სიმბოლოს გარეშე. # ინგლისურენოვანი ჩვევაა, № კი დადგენილების ციტირებას
  რჩება. მისამართი ხუთ ადგილას წერია, ამიტომ ერთ გვერდზე შესწორება ცოტაა.
*/
["index.html", "tarifi/index.html", "README.md"].forEach((page) => {
  const text = read(page);

  check(`${page}: „ქალაქი" აღარ წერია`, text.includes("ქალაქი "), false);
  check(`${page}: ნომერი # სიმბოლოს გარეშეა`, text.includes("გამზირი #"), false);
  check(`${page}: მისამართი ადგილზეა`, text.includes("ალექსანდრე ყაზბეგის გამზირი 6"), true);
});

console.log(`checks passed: ${passed}`);

if (failures.length) {
  console.log(`\nFAILURES: ${failures.length}\n`);
  failures.forEach((f) => console.log(`${f.label}\n  expected: ${f.expected}\n  actual:   ${f.actual}\n`));
  process.exit(1);
}

console.log("მარკაპი და კოდი ემთხვევა ორივე გვერდზე");
