/*
  გადახდის ბლოკი: ანგარიშის ნომრის კოპირება და თანხის გატანა ბანკის ბმულში.

  რატომ ასე:
  TBC-ის ბმული ანგარიშის ნომერს ბილიკში იღებს, ანუ /MB/TT/<IBAN>. თანხის პარამეტრი
  დოკუმენტირებული არ არის, ამიტომ `?amount=` ემატება მხოლოდ როგორც მინიშნება: თუ TBC
  მას იცნობს, ველი შეივსება, თუ არა, უბრალოდ იგნორირდება და ბმული მაინც მუშაობს.
  ამიტომ თანხა კოპირებულ ტექსტშიც წერია, რომ ხელით შევსება ყოველთვის შესაძლებელი იყოს.

  საქართველოს ბანკს IBAN-ის ბმული არ აქვს: ibank.bog.ge ბილიკს აგდებს და ფესვზე გადის.
  ამიტომ BOG-ს მხოლოდ ნომერი და კოპირების ღილაკი აქვს.
*/
(function () {
  const block = document.querySelector("[data-pay]");
  if (!block) return;

  const amountInput = block.querySelector("[data-pay-amount]");
  const lang = document.documentElement.lang === "en" ? "en" : "ka";

  const label = {
    copy: lang === "en" ? "Copy" : "კოპირება",
    copied: lang === "en" ? "Copied" : "დაკოპირდა",
    failed: lang === "en" ? "Copy failed" : "ვერ დაკოპირდა",
  };

  // თანხა მხოლოდ მაშინ ითვლება, თუ დადებითი რიცხვია
  const amount = () => {
    const n = Number(amountInput && amountInput.value);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
  };

  /*
    ბანკის ბმულის აწყობა. საბაზისო მისამართი data-pay-link-base-შია, თანხა კი
    ზედ ემატება. თუ თანხა არ არის, ბმული ხელუხლებელი რჩება.
  */
  const syncLinks = () => {
    block.querySelectorAll("[data-pay-link-base]").forEach((a) => {
      const base = a.dataset.payLinkBase;
      const sum = amount();
      a.href = sum ? base + (base.includes("?") ? "&" : "?") + "amount=" + sum : base;
    });
  };

  // კოპირებადი ტექსტი: ნომერი, მიმღები და თანხა, თუ შევსებულია
  const copyText = (card) => {
    const iban = card.dataset.payIban;
    const holder = card.dataset.payHolder || "";
    const sum = amount();
    return [iban, holder, sum ? sum + " GEL" : ""].filter(Boolean).join("\n");
  };

  const flash = (button, text) => {
    const original = button.dataset.originalLabel || button.textContent;
    button.dataset.originalLabel = original;
    button.textContent = text;
    clearTimeout(button.dataset.timer);
    button.dataset.timer = setTimeout(() => { button.textContent = original; }, 1800);
  };

  block.querySelectorAll("[data-pay-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const card = button.closest("[data-pay-iban]");
      const text = copyText(card);

      try {
        // navigator.clipboard მხოლოდ https-ზე და localhost-ზე მუშაობს
        if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
        else throw new Error("no clipboard api");
        flash(button, label.copied);
      } catch (e) {
        // ძველი გზა: დროებითი textarea და execCommand
        try {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.setAttribute("readonly", "");
          ta.style.cssText = "position:fixed;left:-9999px";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
          flash(button, label.copied);
        } catch (e2) {
          flash(button, label.failed);
        }
      }
    });
  });

  if (amountInput) amountInput.addEventListener("input", syncLinks);
  syncLinks();
})();
