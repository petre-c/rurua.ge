/*
  რიცხვის სიტყვიერად ჩაწერა ქართულად, ლარებში და თეთრებში.

  სანოტარო ტექსტში თანხა ორჯერ იწერება, ციფრებით და სიტყვებით:
    12.08 (თორმეტი ლარი და რვა თეთრი) ლარი

  ქართული ათვლა ოცობითია: 20, 40, 60 და 80 ცალკეული სიტყვებია, შუალედი კი
  „ოცდა", „ორმოცდა" და ასე შემდეგ, პლუს ნაშთი 1-დან 19-მდე.
  ასეულებში ბოლო „ი" ცვივდება, როცა შემდეგ სიტყვა მოჰყვება: ასი, მაგრამ ას ერთი.

  window.gelWords-ს კალკულატორი იყენებს, ცალკე ფაილშია, რომ ტესტმა იმავე კოდი შეამოწმოს.
*/
(function () {
  const UNITS = ["", "ერთი", "ორი", "სამი", "ოთხი", "ხუთი", "ექვსი", "შვიდი", "რვა", "ცხრა"];

  const TEENS = ["ათი", "თერთმეტი", "თორმეტი", "ცამეტი", "თოთხმეტი", "თხუთმეტი",
                 "თექვსმეტი", "ჩვიდმეტი", "თვრამეტი", "ცხრამეტი"];

  // ოცობითი საფეხურები: სრული ფორმა და პრეფიქსი, რომელსაც „და" ერთვის
  const SCORES = [
    { value: 20, full: "ოცი", prefix: "ოც" },
    { value: 40, full: "ორმოცი", prefix: "ორმოც" },
    { value: 60, full: "სამოცი", prefix: "სამოც" },
    { value: 80, full: "ოთხმოცი", prefix: "ოთხმოც" },
  ];

  // ასეულის ფუძეები: 100 უბრალოდ „ასი"-ა და არა „ერთასი"
  const HUNDRED_STEMS = ["", "ას", "ორას", "სამას", "ოთხას", "ხუთას", "ექვსას", "შვიდას", "რვაას", "ცხრაას"];

  // 1-დან 99-მდე
  const under100 = (n) => {
    if (n === 0) return "";
    if (n < 10) return UNITS[n];
    if (n < 20) return TEENS[n - 10];

    const score = SCORES.filter((s) => s.value <= n).pop();
    const rest = n - score.value;
    return rest === 0 ? score.full : score.prefix + "და" + under100(rest);
  };

  // 1-დან 999-მდე
  const under1000 = (n) => {
    if (n < 100) return under100(n);

    const stem = HUNDRED_STEMS[Math.floor(n / 100)];
    const rest = n % 100;
    return rest === 0 ? stem + "ი" : stem + " " + under100(rest);
  };

  /*
    დიდი რიგები. ათასი და მილიონი იმავე წესს მიჰყვება: როცა ნაშთი არ არის,
    სიტყვა სრული ფორმითაა („ათასი"), თუ ნაშთია, ბოლო ხმოვანი ცვივდება („ათას ორასი").
    ერთი ათასი უბრალოდ „ათასი"-ა, ერთი მილიონი კი „ერთი მილიონი".
  */
  const SCALES = [
    { value: 1e9, full: "მილიარდი", short: "მილიარდ", dropOne: false },
    { value: 1e6, full: "მილიონი", short: "მილიონ", dropOne: false },
    { value: 1e3, full: "ათასი", short: "ათას", dropOne: true },
  ];

  const integerToWords = (n) => {
    n = Math.floor(Math.abs(n));
    if (n === 0) return "";
    if (n < 1000) return under1000(n);

    for (const scale of SCALES) {
      if (n < scale.value) continue;

      const count = Math.floor(n / scale.value);
      const rest = n % scale.value;
      /*
        ერთეული სად ცვივდება: „ათასი" ყოველთვის უერთეულოდ იწერება, მილიონი კი
        მხოლოდ მაშინ, როცა ნაშთი არ არის. ანუ 1000000 არის „მილიონი", ხოლო
        1000001 არის „ერთი მილიონ ერთი". ეს ორიგინალის ქცევაა და მასზეა გასწორებული.
      */
      const head = count === 1 && (scale.dropOne || rest === 0) ? "" : integerToWords(count) + " ";
      const word = rest === 0 ? scale.full : scale.short;
      return (head + word + (rest ? " " + integerToWords(rest) : "")).trim();
    }

    return under1000(n);
  };

  // თეთრები: 0-99, ცალკე სიტყვა „თეთრი"
  const tetriToWords = (t) => (t === 0 ? "" : under100(t) + " თეთრი");

  /*
    სრული თანხა სიტყვებით. სამი შემთხვევა:
      მთელი და თეთრი   ოთხი ლარი და ორმოცი თეთრი
      მხოლოდ მთელი     ოთხი
      მხოლოდ თეთრი     ორმოცი თეთრი
  */
  const amountToWords = (amount) => {
    const value = Math.round(Math.abs(Number(amount)) * 100) / 100;
    const lari = Math.floor(value);
    const tetri = Math.round((value - lari) * 100);

    if (lari && tetri) return integerToWords(lari) + " ლარი და " + tetriToWords(tetri);
    if (lari) return integerToWords(lari);
    return tetriToWords(tetri);
  };

  // ციფრები და სიტყვები ერთად, ისე როგორც ტექსტში იწერება
  const amountPhrase = (amount) => {
    const value = Math.round(Number(amount) * 100) / 100;
    return value + " (" + amountToWords(value) + ") ლარი";
  };

  window.gelWords = { integerToWords, tetriToWords, amountToWords, amountPhrase };
})();
