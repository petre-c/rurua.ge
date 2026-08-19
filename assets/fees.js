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

    const fee = money(pages * people * copies * factorFor(RATES.signaturePerPage, pages));
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
