/*
  სანოტარო საზღაურის კალკულატორი.

  ტარიფები „ნოტარიუსის მოქმედებათა საზღაურის" წესებიდან მოდის. ლოგიკა აქ ხელახლა
  დაწერილია და არა გადმოწერილი, ამიტომ თუ კანონში განაკვეთი შეიცვლება, ერთადერთი
  შესაცვლელი ადგილი ამ ფაილის თავშია, RATES ობიექტში.

  გვერდი JS-ის გარეშე კითხვადი რჩება: ველები და შედეგების ცხრილი HTML-შია,
  ეს ფაილი მხოლოდ რიცხვებს ავსებს.

  სტრუქტურა:
    RATES              განაკვეთები ერთ ადგილას
    scaleFee()         გარიგების პროგრესული შკალა
    calculators        ოთხი ბლოკის ლოგიკა, თითო წმინდა ფუნქციაა
    ხოლო ბოლოს         DOM-ის მიბმა: ყოველ input-ზე გადათვლა
*/

const RATES = {
  vat: 0.18,

  // ხელმოწერის დამოწმება: კოეფიციენტი დოკუმენტის გვერდების მიხედვით
  signaturePerPage: [
    { upToPages: 1, factor: 6 },
    { upToPages: 10, factor: 4 },
    { upToPages: 50, factor: 3 },
    { upToPages: Infinity, factor: 2 },
  ],

  // ასლის დამოწმება: იმავე პრინციპით, სხვა კოეფიციენტებით
  copyPerPage: [
    { upToPages: 1, factor: 4 },
    { upToPages: 10, factor: 2 },
    { upToPages: 50, factor: 1 },
    { upToPages: Infinity, factor: 0.5 },
  ],

  /*
    გარიგების დამოწმების პროგრესული შკალა, 23-ე მუხლი.
    ყოველ საფეხურზე: fixed + (თანხა - from) * rate
    fixed არის წინა საფეხურების ჯამი, ანუ საზღაური იმ ზღვარზე.
  */
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

  // სამკვიდრო მოწმობა: იმავე შკალის ნახევარი, თითოეული მემკვიდრის წილზე
  inheritanceDiscount: 0.5,
};

// ლარამდე დამრგვალება ორი ათწილადით
const money = (n) => Math.round(n * 100) / 100;

// მთელ რიცხვად, არანაკლებ მინიმუმის: ველში ხელით შეყვანილ ნაგავს ასწორებს
const count = (raw, min = 1) => {
  const n = Math.round(Number(raw));
  return Number.isFinite(n) && n >= min ? n : min;
};

// უარყოფითი და არარიცხვი თანხა ნულად ითვლება
const amount = (raw) => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? money(n) : 0;
};

const factorFor = (table, pages) => table.find((row) => pages <= row.upToPages).factor;

// შკალაზე საზღაურის დათვლა
const scaleFee = (value) => {
  const step = RATES.transactionScale.find((row) => value <= row.upTo);
  return money(step.fixed + (value - step.from) * step.rate);
};

// დღგ ცალკე ითვლება, რომ შედეგებში დაშლილად ჩანდეს
const vatOn = (base, enabled) => (enabled ? money(base * RATES.vat) : 0);

/*
  ოთხი კალკულატორი. თითოეული იღებს ველების ობიექტს და აბრუნებს
  დაშლილ შედეგს: საზღაური, დამატებითი ხარჯი, დღგ და ჯამი.
*/
const calculators = {
  // ხელმოწერის ნამდვილობის დამოწმება
  signature(f) {
    const pages = count(f.pages);
    const people = count(f.people);
    const copies = count(f.copies);

    const fee = money(pages * people * copies * factorFor(RATES.signaturePerPage, pages));
    const extra = f.projectMode === "none" ? 0 : f.projectMode === "ten" ? 10 : amount(f.projectAmount);
    const vat = vatOn(fee + extra, f.vat);

    return { fee, extra, vat, total: money(fee + extra + vat) };
  },

  // ასლის ნამდვილობის დამოწმება
  copy(f) {
    const pages = count(f.pages);
    const copies = count(f.copies);

    const fee = money(pages * copies * factorFor(RATES.copyPerPage, pages));
    // ასლის დამზადების ფასი თეთრებშია, ამიტომ ლარში გადაყვანა სჭირდება
    const extra = f.copyingMode === "none" ? 0 : money((amount(f.copyingTetri) * pages * copies) / 100);
    const vat = vatOn(fee + extra, f.vat);

    return { fee, extra, vat, total: money(fee + extra + vat) };
  },

  // გარიგების დამოწმება, 23-ე მუხლი
  transaction(f) {
    const value = amount(f.value);
    const fee = scaleFee(value);
    const vat = vatOn(fee, f.vat);

    return { fee, extra: 0, vat, total: money(fee + vat) };
  },

  /*
    სამკვიდრო მოწმობის გაცემა.
    შკალა თითოეული მემკვიდრის წილზე მუშაობს, შედეგი ნახევრდება და
    მემკვიდრეების რაოდენობაზე მრავლდება. ანუ სამი თანაბარი წილი
    ერთ დიდ წილზე ნაკლები გამოდის, რადგან შკალა პროგრესულია.
  */
  inheritance(f) {
    const heirs = count(f.heirs);
    const share = money(amount(f.value) / heirs);

    const perHeir = money(scaleFee(share) * RATES.inheritanceDiscount);
    const fee = money(perHeir * heirs);
    const vat = vatOn(fee, f.vat);

    return { fee, extra: 0, vat, total: money(fee + vat), share, heirs };
  },
};

/* ---------- DOM ---------- */

const lang = document.documentElement.lang === "en" ? "en" : "ka";

const fmt = new Intl.NumberFormat(lang === "en" ? "en-GB" : "ka-GE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const lari = (n) => fmt.format(n) + " ₾";

const readFields = (block) => {
  const fields = {};

  block.querySelectorAll("[data-in]").forEach((el) => {
    fields[el.dataset.in] = el.type === "checkbox" ? el.checked : el.value;
  });

  // რადიო ჯგუფები mode-ს სახით: მონიშნულის data-mode მნიშვნელობა
  block.querySelectorAll("[data-mode-group]").forEach((group) => {
    const picked = group.querySelector("input:checked");
    fields[group.dataset.modeGroup] = picked ? picked.dataset.mode : "none";
  });

  return fields;
};

const render = (block, result) => {
  block.querySelectorAll("[data-out]").forEach((el) => {
    const value = result[el.dataset.out];
    if (typeof value === "number") el.textContent = el.dataset.out === "heirs" ? String(value) : lari(value);
  });

  // ხარჯის ხაზი მხოლოდ მაშინ ჩანს, როცა ხარჯი არსებობს
  const extraRow = block.querySelector("[data-row='extra']");
  if (extraRow) extraRow.hidden = !result.extra;

  const vatRow = block.querySelector("[data-row='vat']");
  if (vatRow) vatRow.hidden = !result.vat;

  // წილის შენიშვნა მხოლოდ ორი და მეტი მემკვიდრის შემთხვევაში
  const note = block.querySelector("[data-note]");
  if (note) {
    note.hidden = !(result.heirs > 1);
    if (result.heirs > 1) note.textContent = note.dataset.note.replace("{share}", lari(result.share)).replace("{heirs}", String(result.heirs));
  }
};

const recalc = (block) => {
  const calc = calculators[block.dataset.calc];
  if (calc) render(block, calc(readFields(block)));
};

document.querySelectorAll("[data-calc]").forEach((block) => {
  // ველი, რომელიც მხოლოდ „სხვა" რეჟიმში მუშაობს
  const syncDisabled = () => {
    block.querySelectorAll("[data-enabled-by]").forEach((el) => {
      const trigger = block.querySelector("#" + el.dataset.enabledBy);
      el.disabled = !(trigger && trigger.checked);
    });
  };

  block.addEventListener("input", () => {
    syncDisabled();
    recalc(block);
  });

  block.addEventListener("change", () => {
    syncDisabled();
    recalc(block);
  });

  // ბლოკის დასაწყისში ჩვენება, რომ ცხრილი ცარიელი არ დარჩეს
  syncDisabled();
  recalc(block);
});
