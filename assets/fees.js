/*
  სანოტარო საზღაურის კალკულატორი.

  გაანგარიშება და ტექსტები anna94k.github.io/tarif/-ის ქცევაზეა გასწორებული:
  განაკვეთები, დამრგვალება, რეესტრის საფასური და დადგენილების მუხლების ჩამონათვალი.
  შედარება ავტომატური ტესტით ხდება, იხილეთ tests/.

  ორი დეტალი, რომელიც ადვილად გამოგრჩევა და შედეგს ცვლის:

  1. დღგ ითვლება როგორც Math.round(base * 18) / 100 და არა base * 0.18.
     მცურავი წილადის გამო 183.75-ზე პირველი იძლევა 33.08-ს, მეორე 33.07-ს.

  2. ჯამს ემატება რეესტრის საფასური, 5 ლარი, რომელსაც დღგ არ ერიცხება.
     ასლის დამოწმებას ეს საფასური არ აქვს.
*/

const RATES = {
  vatPercent: 18,

  // ელექტრონულ სანოტარო რეესტრში რეგისტრაციის საფასური, დადგენილების 39-ე მუხლი
  registryFee: 5,

  signaturePerPage: [
    { upToPages: 1, factor: 6 },
    { upToPages: 10, factor: 4 },
    { upToPages: 50, factor: 3 },
    { upToPages: Infinity, factor: 2 },
  ],

  copyPerPage: [
    { upToPages: 1, factor: 4 },
    { upToPages: 10, factor: 2 },
    { upToPages: 50, factor: 1 },
    { upToPages: Infinity, factor: 0.5 },
  ],

  // გარიგების პროგრესული შკალა, დადგენილების 23-ე მუხლი
  transactionScale: [
    { upTo: 500, from: 0, fixed: 0, rate: 0.03 },
    { upTo: 1000, from: 500, fixed: 15, rate: 0.025 },
    { upTo: 2000, from: 1000, fixed: 27.5, rate: 0.015 },
    { upTo: 3000, from: 2000, fixed: 42.5, rate: 0.01 },
    { upTo: 5000, from: 3000, fixed: 52.5, rate: 0.005 },
    { upTo: 20000, from: 5000, fixed: 62.5, rate: 0.004 },
    { upTo: 100000, from: 20000, fixed: 122.5, rate: 0.003 },
    { upTo: 500000, from: 100000, fixed: 362.5, rate: 0.002 },
    { upTo: 1000000, from: 500000, fixed: 1162.5, rate: 0.001 },
    { upTo: Infinity, from: 1000000, fixed: 1662.5, rate: 0.0005 },
  ],

  inheritanceDiscount: 0.5,
};

const money = (n) => Math.round(n * 100) / 100;

const count = (raw, min = 1) => {
  const n = Math.round(Number(raw));
  return Number.isFinite(n) && n >= min ? n : min;
};

const amount = (raw) => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? money(n) : 0;
};

const factorFor = (table, pages) => table.find((row) => pages <= row.upToPages).factor;

const scaleFee = (value) => {
  const step = RATES.transactionScale.find((row) => value <= row.upTo);
  return money(step.fixed + (value - step.from) * step.rate);
};

// დამრგვალება ზუსტად ისე, როგორც ორიგინალშია, იხილეთ ფაილის თავში მითითებული მიზეზი
const vatOn = (base, enabled) => (enabled ? Math.round(base * RATES.vatPercent) / 100 : 0);

const calculators = {
  signature(f) {
    const pages = count(f.pages);
    const people = count(f.people);
    const copies = count(f.copies);

    /*
      განზრახ განსხვავდება anna94k.github.io/tarif/-ისგან.

      ორიგინალი გვერდებზეც ამრავლებს: 12-გვერდიანი დოკუმენტი, 3 ხელმოწერა, 2 პირი
      მასთან 216 ლარია. დადგენილების 31-ე მუხლის მე-3 პუნქტი კი ამბობს
      „2-დან 10 გვერდის ჩათვლით დოკუმენტ(ებ)ზე − თითოეული ხელმოწერისთვის 4 ლარი",
      ანუ გვერდების რაოდენობა მხოლოდ განაკვეთს ირჩევს, თანხას არ ამრავლებს.
      იმავე მაგალითზე სწორი პასუხი 18 ლარია.

      ტარიფზე მეტის ახდევინება მძიმე დისციპლინური გადაცდომაა, ამიტომ აქ დადგენილებას
      მივყვებით და არა ორიგინალს. ტესტში ეს ცალკე აღნიშნულია.
    */
    const fee = money(people * copies * factorFor(RATES.signaturePerPage, pages));
    const extra = f.projectMode === "none" ? 0 : f.projectMode === "ten" ? 10 : amount(f.projectAmount);
    const vat = vatOn(fee + extra, f.vat);
    const registry = RATES.registryFee;

    return { fee, extra, vat, registry, total: money(fee + extra + vat + registry), mode: f.projectMode };
  },

  copy(f) {
    const pages = count(f.pages);
    const copies = count(f.copies);

    const fee = money(pages * copies * factorFor(RATES.copyPerPage, pages));
    // ასლის დამზადების ფასი თეთრებში შეიყვანება
    const extra = f.copyingMode === "none" ? 0 : money((amount(f.copyingTetri) * pages * copies) / 100);
    const vat = vatOn(fee + extra, f.vat);

    // ასლის დამოწმებას რეესტრის საფასური არ ერიცხება
    return { fee, extra, vat, registry: 0, total: money(fee + extra + vat) };
  },

  transaction(f) {
    const fee = scaleFee(amount(f.value));
    const vat = vatOn(fee, f.vat);
    const registry = RATES.registryFee;

    return { fee, extra: 0, vat, registry, total: money(fee + vat + registry) };
  },

  inheritance(f) {
    const heirs = count(f.heirs);
    const share = money(amount(f.value) / heirs);

    const perHeir = money(scaleFee(share) * RATES.inheritanceDiscount);
    const fee = money(perHeir * heirs);
    const vat = vatOn(fee, f.vat);
    const registry = RATES.registryFee;

    return { fee, extra: 0, vat, registry, total: money(fee + vat + registry), share, heirs };
  },
};

/* ---------- დადგენილების სრული კატალოგი ---------- */

/*
  ზემოთ ოთხი დეტალური კალკულატორია, იმ მოქმედებებისთვის, რომლებსაც აქტში ჩასასმელი
  ტექსტიც სჭირდება. აქ კი მთელი დადგენილება ერთ სიად არის: ყველა მუხლი, რომელიც
  საზღაურს ადგენს, პლუს ის ადგილები, სადაც საზღაური შეთანხმებით დგინდება.

  განაკვეთები ერთი წყაროდან მოდის: RATES და scaleFee იმავე ცხრილებია, რომლებსაც
  ზემოთა ოთხი კალკულატორი იყენებს, ამიტომ ორი სხვადასხვა ციფრი ერთსა და იმავე
  მოქმედებაზე ვერ გამოვა.
*/

const OUTSIDE_MAX = 35;   // მუხლი 34.2
const VALUE_CAP = 10000;  // მუხლი 23.3

const capped = (n) => Math.min(money(n), VALUE_CAP);

// ღირებულების სკალის წილი, ქვედა ზღვრით: ნახევარი, მეოთხედი და ასე შემდეგ
const share = (mult, floor) => (f) => {
  const fee = capped(scaleFee(amount(f.value)) * mult);
  const min = typeof floor === "function" ? floor(f) : floor;
  return { fee: min && fee < min ? money(min) : fee };
};

const flat = (gel) => () => ({ fee: gel });

// შეღავათი: შემცირებული განაკვეთი თავად დადგენილებით, არა ნოტარიუსის ფასდაკლება
const reduced = (full, low) => (f) => ({ fee: f.conc ? low : full });

const mortgage = (corporate) => (f) => {
  const v = amount(f.value);
  if (corporate && v > 1000000) return { fee: v > 20000000 ? 10000 : 1000 };
  if (v <= 5000) return { fee: 50 };
  if (v <= 20000) return { fee: 100 };
  if (v <= 50000) return { fee: 150 };
  if (v <= 100000) return { fee: 200 };
  return { fee: 500 };
};

const agreedUpTo = (cap) => (f) => ({ fee: Math.min(amount(f.agreedSum), cap) });

const CATALOGUE = [
  // --- მუხლი 31, მყარი განაკვეთები ---
  { id: "will", art: "31.1", group: "fixed", needs: ["conc"], calc: reduced(16, 10),
    ka: "ანდერძის დადასტურება", en: "Certifying a will" },
  { id: "will-open", art: "31.2", group: "fixed", needs: [], calc: flat(10),
    ka: "ანდერძის გახსნის ოქმი", en: "Record of opening a will" },
  { id: "sign", art: "31.3", group: "fixed", needs: ["pages", "signs"],
    calc: (f) => ({ fee: money(factorFor(RATES.signaturePerPage, count(f.pages)) * count(f.signs)) }),
    ka: "ხელმოწერის ნამდვილობის დამოწმება", en: "Certifying a signature" },
  { id: "translator", art: "31.4", group: "fixed", needs: ["pages", "signs"],
    calc: (f) => ({ fee: money(factorFor(RATES.signaturePerPage, count(f.pages)) * count(f.signs)) }),
    ka: "მთარგმნელის ხელმოწერის დამოწმება", en: "Certifying a translator's signature" },
  { id: "copy-accuracy", art: "31.5", group: "fixed", needs: ["pages", "conc"], noRegistry: true,
    calc: (f) => {
      const pages = count(f.pages);
      return { fee: money(f.conc ? 0.5 * pages : pages * factorFor(RATES.copyPerPage, pages)) };
    },
    ka: "ასლის ან ამონაწერის სისწორის დამოწმება", en: "Certifying a copy or extract" },
  { id: "copy-issue", art: "31.6", group: "fixed", needs: ["conc"], calc: reduced(5, 3),
    ka: "ბიუროში დაცული დოკუმენტის ასლის გაცემა", en: "Issuing a copy held by the bureau" },
  { id: "poa", art: "31.7", group: "fixed", needs: ["conc"], calc: reduced(18, 10),
    ka: "მინდობილობა, ფიზიკური პირი", en: "Power of attorney, natural person" },
  { id: "poa-legal", art: "31.8", group: "fixed", needs: [], calc: flat(30),
    ka: "მინდობილობა, იურიდიული პირი ან ინდივიდუალური მეწარმე", en: "Power of attorney, legal person or sole trader" },
  { id: "creditor", art: "31.9", group: "fixed", needs: [], calc: flat(10),
    ka: "მამკვიდრებლის კრედიტორის განცხადების მიღება", en: "Accepting a creditor's claim on an estate" },
  { id: "sea", art: "31.10", group: "fixed", needs: [], calc: flat(300),
    ka: "საზღვაო პროტესტი", en: "Maritime protest" },
  { id: "fact", art: "31.11", group: "fixed", needs: ["conc"], calc: reduced(4, 2),
    ka: "ფაქტის დადასტურება: ცოცხლად ყოფნა, ადგილი, დრო, ფოტოზე იგივეობა",
    en: "Certifying a fact: being alive, presence, time, identity in a photograph" },
  { id: "deliver", art: "31.12", group: "fixed", needs: [], calc: flat(10),
    ka: "განცხადების გადაცემა სხვა პირს", en: "Passing a statement to another person" },
  { id: "draft-app", art: "31.13", group: "fixed", needs: [], calc: flat(10),
    ka: "განცხადების პროექტის შედგენა", en: "Drafting a statement" },
  { id: "cert-deliver", art: "31.14", group: "fixed", needs: [], calc: flat(10),
    ka: "გადაცემის ან გადაცემის შეუძლებლობის მოწმობა", en: "Certificate of delivery or of impossibility" },
  { id: "writ", art: "31.15", group: "fixed", needs: [], calc: flat(140),
    ka: "სააღსრულებო ფურცლის გაცემა", en: "Issuing a writ of execution" },
  { id: "writ-change", art: "31.16", group: "fixed", needs: [], calc: flat(50),
    ka: "სააღსრულებო ფურცლის ცვლილება, გაუქმება, დუბლიკატი", en: "Changing, cancelling or duplicating a writ" },

  // --- ღირებულების სკალა, მუხლები 23, 24, 29, 30 ---
  { id: "deal", art: "23.1", group: "value", needs: ["value"], calc: share(1),
    ka: "ორმხრივი ან მრავალმხრივი გარიგება", en: "Bilateral or multilateral transaction" },
  { id: "deal-one", art: "23.2", group: "value", needs: ["value"], calc: share(0.5),
    ka: "ცალმხრივი გარიგება", en: "Unilateral transaction" },
  { id: "ownership", art: "29.1 ა", group: "value", needs: ["value"], calc: share(0.5),
    ka: "საკუთრების უფლების მოწმობა", en: "Certificate of ownership" },
  { id: "estate-inventory", art: "29.1 გ", group: "value", needs: ["value"], calc: share(0.5),
    ka: "სამკვიდრო ქონების აღწერა", en: "Inventory of an estate" },
  { id: "property-split", art: "24", group: "value", needs: ["value"], calc: share(0.5),
    ka: "ქონების გაყოფა ან სარგებლობის წესის დადგენა", en: "Dividing property or setting terms of use" },
  { id: "deal-draft", art: "30", group: "value", needs: ["value"], calc: share(0.5),
    ka: "გარიგების პროექტი, დამოწმების გარეშე", en: "Draft transaction, without certification" },
  { id: "deposit", art: "29.2 ა", group: "value", needs: ["value", "months"],
    calc: share(0.25, (f) => 4 * count(f.months)),
    ka: "ფულის ან ფასიანი ქაღალდების დეპოზიტზე მიღება", en: "Taking money or securities on deposit" },
  { id: "pledge-order", art: "29.2 ბ", group: "value", needs: ["value"], calc: share(0.25, 5),
    ka: "გირავნობის რიგითობის შეცვლა", en: "Changing the order of a pledge" },
  { id: "registry-app", art: "29.2 გ", group: "value", needs: ["value"], calc: share(0.25, 4),
    ka: "საჯარო რეესტრში ცვლილების განცხადების დამოწმება", en: "Certifying an application to the public registry" },
  { id: "privatisation", art: "26.1", group: "value", needs: ["value"],
    calc: (f) => ({ fee: Math.min(money(amount(f.value) * 0.002), 200) }),
    ka: "სახელმწიფო ქონების პრივატიზება", en: "Privatisation of state property" },

  // --- იპოთეკა, მუხლი 23¹ ---
  { id: "mortgage", art: "23¹.1", group: "value", needs: ["value"], calc: mortgage(false),
    ka: "იპოთეკა სესხზე", en: "Mortgage securing a loan" },
  { id: "mortgage-corp", art: "23¹.2", group: "value", needs: ["value"], calc: mortgage(true),
    ka: "იპოთეკა სამეწარმეო იურიდიული პირის სესხზე", en: "Mortgage securing a company loan" },

  // --- დანარჩენი ფიქსირებული ---
  { id: "deal-change", art: "8.4", group: "other", needs: [], calc: flat(25),
    ka: "გარიგებაში ცვლილება, ღირებულების შეცვლის გარეშე", en: "Amending a transaction without changing its value" },
  { id: "deal-cancel", art: "28.1", group: "other", needs: [], calc: flat(15),
    ka: "გარიგების გაუქმება", en: "Cancelling a transaction" },
  { id: "thing-right", art: "25", group: "other", needs: [], calc: flat(10),
    ka: "სანივთო უფლების შეძენა, წინასწარი დაპირება", en: "Acquiring a right in rem, advance promise" },
  { id: "estate-admin", art: "18.6", group: "other", needs: [], calc: flat(18),
    ka: "სამკვიდროს მმართველის მოწმობა, სამკვიდრო მოწმობის ცვლილება", en: "Estate administrator certificate, change to an inheritance certificate" },
  { id: "ngo", art: "20", group: "other", needs: [], calc: flat(50),
    ka: "არასამეწარმეო იურიდიული პირის ან პარტიის დოკუმენტები", en: "Documents of a non-commercial legal person or a party" },
  { id: "hoa", art: "22.1", group: "other", needs: [], calc: flat(100),
    ka: "ბინათმესაკუთრეთა ამხანაგობის კრების ოქმი", en: "Minutes of a homeowners association meeting" },
  { id: "hoa-failed", art: "22.2", group: "other", needs: [], calc: flat(50),
    ka: "ამხანაგობის კრების ჩაშლის მოწმობა", en: "Certificate that an association meeting failed" },
  { id: "e-statement", art: "32", group: "other", needs: [], calc: flat(60),
    ka: "ელექტრონული კომუნიკაციით განცხადება, ფიზიკური პირი", en: "Statement by electronic communication, natural person" },
  { id: "e-statement-legal", art: "32", group: "other", needs: [], calc: flat(90),
    ka: "ელექტრონული კომუნიკაციით განცხადება, იურიდიული პირი", en: "Statement by electronic communication, legal person" },
  { id: "e-statement-off", art: "28.3", group: "other", needs: [], calc: flat(30),
    ka: "იგივე, ელექტრონული კომუნიკაციის გარეშე, ფიზიკური პირი", en: "The same without electronic communication, natural person" },

  // --- შეთანხმებით, მუხლები 19, 21, 33, 35 ---
  { id: "company-docs", art: "19", group: "agreed", needs: ["agreedSum"], agreedCap: 1000, calc: agreedUpTo(1000),
    ka: "სამეწარმეო იურიდიული პირის სადამფუძნებლო დოკუმენტები, წილის გასხვისება",
    en: "Company founding documents, transfer of a share" },
  { id: "company-minutes", art: "21", group: "agreed", needs: ["agreedSum"], agreedCap: 500, calc: agreedUpTo(500),
    ka: "მართვის ორგანოს კრების ოქმი", en: "Minutes of a management body meeting" },
  { id: "consultation", art: "33", group: "agreed", needs: ["agreedSum"], agreedCap: Infinity, noRegistry: true,
    calc: (f) => ({ fee: amount(f.agreedSum) }),
    ka: "სამართლებრივი კონსულტაცია, სანოტარო მოქმედების გარეშე", en: "Legal consultation without a notarial act" },
  { id: "mediation", art: "—", group: "agreed", needs: ["agreedSum"], agreedCap: Infinity, noRegistry: true,
    calc: (f) => ({ fee: amount(f.agreedSum) }),
    ka: "სანოტარო მედიაცია", en: "Notarial mediation" },
  { id: "copy-making", art: "35", group: "agreed", needs: ["agreedSum"], agreedCap: Infinity, noRegistry: true,
    calc: (f) => ({ fee: amount(f.agreedSum) }),
    ka: "ასლის დამზადება, საბაზრო ფასით", en: "Producing a copy at market price" },
];

const byId = (id) => CATALOGUE.find((s) => s.id === id);

/*
  ერთი მოქმედების სრული ანგარიში: საზღაური, ბიუროს გარეთ გასვლის დანამატი, დღგ და
  რეესტრის საფასური. დღგ მხოლოდ საზღაურსა და დანამატს ერიცხება, რეესტრის 5 ლარში
  დღგ თავად დადგენილების 39-ე მუხლით შედის.
*/
const priceOne = (service, f) => {
  const base = service.calc(f);
  const fee = money(base.fee);
  const extra = f.outside ? Math.min(OUTSIDE_MAX, amount(f.outsideSum)) : 0;
  const vat = vatOn(fee + extra, f.vat);
  const registry = service.noRegistry || f.registry === false ? 0 : RATES.registryFee;

  return {
    fee, extra, vat, registry,
    total: money(fee + extra + vat + registry),
    article: service.art,
    agreedCap: service.agreedCap,
  };
};

/* ---------- დოკუმენტისთვის განკუთვნილი ტექსტი ---------- */

const phrase = (n) => window.gelWords.amountPhrase(n);

// დადგენილების სახელი ორ ბლოკში ოდნავ სხვადასხვაგვარად იწერება, ორივე ისეა დატოვებული, როგორც ორიგინალშია
const DECREE_INLINE =
  "საქართველოს მთავრობის 2011 წლის 29 დეკემბერის №507 დადგენილების (სანოტარო მოქმედებათა " +
  "შესრულებისათვის საზღაურისა და საქართველოს ნოტარიუსთა პალატისთვის დადგენილი საფასურის " +
  "ოდენობების, მათი გადახდევინების წესისა და მომსახურების ვადების დამტკიცების შესახებ)";

const DECREE_QUOTED =
  '"სანოტარო მოქმედებათა შესრულებისათვის საზღაურისა და საქართველოს ნოტარიუსთა პალატისთვის ' +
  'დადგენილი საფასურის ოდენობების, მათი გადახდევინების წესისა და მომსახურების ვადების ' +
  'დამტკიცების შესახებ" საქართველოს მთავრობის 2011 წლის 29 დეკემბრის #507 დადგენილების';

const REGISTRY_CLAUSE =
  " - ელექტრონულ სანოტარო რეესტრში სანოტარო მოქმედების რეგისტრაციის საფასური, " +
  "თანახმად ზემოხსენებული დადგენილების 39-ე მუხლისა";

const VAT_CLAUSE = ", თანახმად საქართველოს საგადასახადო კოდექსის 166-ე მუხლისა.";

/*
  ხელმოწერის, გარიგების და სამკვიდროს ტექსტი ერთ ყალიბზეა აგებული, მხოლოდ მუხლი და
  პროექტის პუნქტი განსხვავდება. სიის ბოლო რგოლს „და" წინ უდგება მხოლოდ მაშინ, როცა
  დღგ არ ერიცხება, სხვა შემთხვევაში „და" დღგ-ს წინ ჩნდება.
*/
const decreeText = (r, article, projectClause) => {
  let t = "გადახდილია სანოტარო მომსახურების საზღაური სულ: " + phrase(r.total) +
          ", მათ შორის: " + phrase(r.fee) + ", თანახმად " + DECREE_INLINE + " " + article;

  if (projectClause) t += ", " + phrase(r.extra) + " - " + projectClause;

  t += (r.vat ? ", " : " და ") + phrase(r.registry) + REGISTRY_CLAUSE;
  t += r.vat ? " და დღგ - " + phrase(r.vat) + VAT_CLAUSE : ".";

  return t;
};

const texts = {
  signature(r) {
    const project =
      r.mode === "ten" ? "განცხადების პროექტის შედგენისათვის, თანახმად ამავე დადგენილების 31.13 მუხლისა"
      : r.mode === "other" ? "გარიგების პროექტის შედგენისათვის, თანახმად ამავე დადგენილების 30-ე მუხლისა"
      : null;

    return decreeText(r, r.extra ? "31.3 მუხლისა" : "31-ე მუხლისა", r.extra ? project : null);
  },

  transaction(r) {
    return decreeText(r, "23-ე მუხლისა", null);
  },

  inheritance(r) {
    return decreeText(r, "მე-18, 23-ე და 29-ე მუხლებისა", null);
  },

  // ასლის ტექსტი სხვა ყალიბისაა და დღგ-ის გარეშე, ხარჯის გარეშე სულ მოკლედ იწერება
  copy(r) {
    if (!r.vat && !r.extra) {
      return "სანოტარო მოქმედების შესრულებისათვის გადახდილ იქნა საზღაური - " + phrase(r.fee) +
             ", თანახმად " + DECREE_QUOTED + " 31-ე მუხლისა.";
    }

    let t = "სანოტარო მოქმედების შესრულებისათვის გადახდილ იქნა საზღაური სულ: " + phrase(r.total) +
            ", მათ შორის: " + phrase(r.fee) + " – თანახმად " + DECREE_QUOTED + " 31-ე მუხლისა";

    if (r.extra) t += (r.vat ? ", " : " და ") + phrase(r.extra) + ", თანახმად ამავე დადგენილების 35-ე მუხლისა";
    t += r.vat ? " და დღგ " + phrase(r.vat) + VAT_CLAUSE : ".";

    return t;
  },
};

/* ---------- DOM ---------- */

const readFields = (block) => {
  const fields = {};

  block.querySelectorAll("[data-in]").forEach((el) => {
    fields[el.dataset.in] = el.type === "checkbox" ? el.checked : el.value;
  });

  block.querySelectorAll("[data-mode-group]").forEach((group) => {
    const picked = group.querySelector("input:checked");
    fields[group.dataset.modeGroup] = picked ? picked.dataset.mode : "none";
  });

  return fields;
};

const render = (block, result, text) => {
  // ნულოვან ხაზებს ცარიელი ვუტოვებ: „0 () ლარი" უაზრობა იქნებოდა, თუ ხაზი გამოჩნდა
  const optional = ["extra", "vat", "registry"];

  block.querySelectorAll("[data-out]").forEach((el) => {
    const key = el.dataset.out;
    if (key === "heirs") el.textContent = String(result.heirs);
    else if (typeof result[key] !== "number") return;
    else el.textContent = !result[key] && optional.includes(key) ? "" : phrase(result[key]);
  });

  // ნულოვანი ხაზები იმალება, რომ ცხრილი ზედმეტს არ აჩვენებდეს
  ["extra", "vat", "registry"].forEach((key) => {
    const row = block.querySelector("[data-row='" + key + "']");
    if (row) row.hidden = !result[key];
  });

  const note = block.querySelector("[data-note]");
  if (note) {
    note.hidden = !(result.heirs > 1);
    if (result.heirs > 1) {
      note.textContent = note.dataset.note
        .replace("{heirs}", String(result.heirs))
        .replace("{share}", phrase(result.share));
    }
  }

  const out = block.querySelector("[data-text]");
  if (out) out.textContent = text;
};

const recalc = (block) => {
  const kind = block.dataset.calc;
  const calc = calculators[kind];
  if (!calc) return;

  const result = calc(readFields(block));
  render(block, result, texts[kind](result));
};

/*
  სრული სიის ბლოკი. ერთი ჩამოსაშლელი სია, რომელშიც დადგენილების ყველა მოქმედებაა,
  და მხოლოდ იმ ველების ჩვენება, რომლებიც არჩეულ მოქმედებას სჭირდება.
  აქტში ჩასასმელი ტექსტი ამ ბლოკს არ აქვს: ის ოთხ დეტალურ კალკულატორშია.
*/
const isEnglish = () => document.documentElement.lang === "en";
const label = (s) => (isEnglish() ? s.en : s.ka);
const moneyText = (n) => n.toFixed(2) + (isEnglish() ? " GEL" : " ლარი");

const GROUPS = [
  ["fixed", { ka: "მყარი განაკვეთი, მუხლი 31", en: "Fixed rates, article 31" }],
  ["value", { ka: "გარიგების ღირებულებით", en: "Based on transaction value" }],
  ["other", { ka: "სხვა ფიქსირებული საზღაური", en: "Other fixed fees" }],
  ["agreed", { ka: "შეთანხმებით დგინდება", en: "Set by agreement" }],
];

const NOTES = {
  fixedPrice: {
    ka: "ფასი ფიქსირებულია. მუხლი 3.5: ამ მოქმედებაზე ნოტარიუსი ვალდებულია გადაახდევინოს ზუსტად დადგენილი ოდენობა, არც მეტი, არც ნაკლები.",
    en: "This fee is fixed. Article 3(5): the notary must charge exactly the set amount, no more and no less.",
  },
  agreedCapped: {
    ka: "საზღაური დაინტერესებულ პირთან შეთანხმებით დგინდება და {cap} ლარს არ უნდა აღემატებოდეს.",
    en: "The fee is agreed with the client and must not exceed {cap} GEL.",
  },
  agreedFree: {
    ka: "ამ მომსახურებაზე ტარიფი დადგენილი არ არის, საზღაური შეთანხმებით დგინდება.",
    en: "No tariff is set for this service, the fee is agreed between the parties.",
  },
};

document.querySelectorAll("[data-picker]").forEach((block) => {
  const select = block.querySelector("[data-picker-select]");
  const note = block.querySelector("[data-picker-note]");

  GROUPS.forEach(([key, name]) => {
    const services = CATALOGUE.filter((s) => s.group === key);
    if (!services.length) return;

    const group = document.createElement("optgroup");
    group.label = label(name);

    services.forEach((s) => {
      const option = document.createElement("option");
      option.value = s.id;
      option.textContent = label(s) + " · " + s.art;
      group.appendChild(option);
    });

    select.appendChild(group);
  });

  const update = () => {
    const service = byId(select.value) || CATALOGUE[0];
    const fields = readFields(block);

    // მხოლოდ საჭირო ველები ჩანს
    block.querySelectorAll("[data-needs]").forEach((el) => {
      const needed = service.needs.includes(el.dataset.needs);
      el.hidden = el.dataset.needs === "outsideSum" ? !fields.outside : !needed;
    });

    // ასლის დამოწმებას და არასანოტარო მომსახურებას რეესტრის საფასური არ ერიცხება
    const registryBox = block.querySelector("[data-in='registry']");
    if (registryBox) {
      registryBox.disabled = !!service.noRegistry;
      if (service.noRegistry) registryBox.checked = false;
    }

    const r = priceOne(service, fields);

    block.querySelectorAll("[data-out]").forEach((el) => {
      const key = el.dataset.out;
      if (key === "article") { el.textContent = service.art; return; }
      if (typeof r[key] !== "number") return;
      el.textContent = moneyText(r[key]);
    });

    ["extra", "vat", "registry"].forEach((key) => {
      const row = block.querySelector("[data-row='" + key + "']");
      if (row) row.hidden = !r[key];
    });

    if (note) {
      const text = r.agreedCap === undefined ? NOTES.fixedPrice
        : r.agreedCap === Infinity ? NOTES.agreedFree
        : NOTES.agreedCapped;

      note.textContent = label(text).replace("{cap}", String(r.agreedCap));
      note.dataset.kind = r.agreedCap === undefined ? "fixed" : "agreed";
    }
  };

  block.addEventListener("input", update);
  block.addEventListener("change", update);
  update();
});

document.querySelectorAll("[data-calc]").forEach((block) => {
  const syncDisabled = () => {
    block.querySelectorAll("[data-enabled-by]").forEach((el) => {
      const trigger = block.querySelector("#" + el.dataset.enabledBy);
      el.disabled = !(trigger && trigger.checked);
    });
  };

  const update = () => {
    syncDisabled();
    recalc(block);
  };

  block.addEventListener("input", update);
  block.addEventListener("change", update);

  // ტექსტის კოპირება, იმავე ლოგიკით რაც გადახდის ბლოკშია
  const copyButton = block.querySelector("[data-text-copy]");
  if (copyButton) {
    copyButton.addEventListener("click", async () => {
      const text = block.querySelector("[data-text]").textContent;
      const original = copyButton.dataset.label || copyButton.textContent;
      copyButton.dataset.label = original;

      try {
        if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
        else throw new Error("no clipboard api");
      } catch (e) {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;left:-9999px";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); } catch (e2) { /* ვერ დაკოპირდა, წარწერა არ იცვლება */ }
        ta.remove();
      }

      copyButton.textContent = copyButton.dataset.copied || original;
      setTimeout(() => { copyButton.textContent = original; }, 1800);
    });
  }

  update();
});
