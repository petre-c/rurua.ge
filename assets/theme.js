/*
  თემის გადამრთველი.

  სამი მდგომარეობა ციკლურად: system → light → dark → system.
    system  data-theme ატრიბუტი არ არსებობს, ფერებს CSS ირჩევს
            prefers-color-scheme-ით, ანუ ოპერაციული სისტემის თემით.
    light   data-theme="light", ხელით არჩეული ნათელი.
    dark    data-theme="dark", ხელით არჩეული ბნელი.

  არჩევანი localStorage-ში ინახება. სისტემურ მდგომარეობაში ჩანაწერი იშლება,
  რომ შემდეგ ვიზიტზე გვერდი ისევ სისტემას მიჰყვეს.
  ატრიბუტს გვერდის თავშიც კითხულობს პატარა inline სკრიპტი, ციმციმის თავიდან ასარიდებლად.
*/
(function () {
  var root = document.documentElement;
  var btn = document.getElementById("theme-toggle");
  if (!btn) return;

  var order = ["system", "light", "dark"];

  // წარწერები გვერდის ენის მიხედვით, ორივე ვერსია ერთსა და იმავე სკრიპტს იყენებს
  var labels = document.documentElement.lang === "en"
    ? { system: "Theme: system", light: "Theme: light", dark: "Theme: dark" }
    : { system: "თემა: სისტემური", light: "თემა: ნათელი", dark: "თემა: ბნელი" };

  var current = function () {
    return root.dataset.theme === "light" || root.dataset.theme === "dark"
      ? root.dataset.theme
      : "system";
  };

  var apply = function (mode) {
    if (mode === "system") delete root.dataset.theme;
    else root.dataset.theme = mode;

    try {
      if (mode === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", mode);
    } catch (e) { /* localStorage დაბლოკილია, არჩევანი მხოლოდ ამ სესიაზე მოქმედებს */ }

    btn.setAttribute("title", labels[mode]);
    btn.setAttribute("aria-label", labels[mode]);
  };

  btn.addEventListener("click", function () {
    apply(order[(order.indexOf(current()) + 1) % order.length]);
  });

  // საწყისი წარწერა, ატრიბუტის ხელახლა დაწერის გარეშე
  apply(current());
})();
