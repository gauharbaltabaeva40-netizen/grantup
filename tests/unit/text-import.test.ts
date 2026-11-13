import assert from "node:assert/strict";
import { test } from "node:test";
import { parseTestText } from "@/lib/admin/text-import";

// ҰБТ сынама тестінен (Қазақстан тарихы) — PDF-тен көшірілген күйі
const HISTORY = `
ҚАЗАҚСТАН ТАРИХЫ
Нұсқау: Сізге берілген төрт жауап нұсқасынан бір дұрыс жауапты
таңдауға арналған тапсырмалар беріледі.
1. Зарина патшайым басқарған мемлекет
A) Үйсін
B) Қаңлы
C) Қарлұқ
D) Сақ

 2. XIII ғасырда бүкіл Еуразияда саяси жағдайдың ӛзгеруіне себепкер болған
оқиға
A) Қарақытай жорығы
B) Әмір Темір жорығы
C) Араб шапқыншылығы
D) Моңғол шапқыншылығы

XVI-XVII ғғ. қазақ хандары

11. Дұрыс дәйектерді анықтаңыз
1. Хақназар хан ұлыстық жүйені жүздік жүйемен алмастырды
2. Тәуекел хан XVII ғасырдың аяғында бұхарлықтарды жеңіп, Ташкент,
Самарқанд қалаларын басып алды
3. Есім ханның астанасы Түркістан болды
4. 1579 жылы Мәуереннахр билеушісімен Тәуекел хан одақтық шарт жасады
A) 2,3
B) 1,2
C) 1,3
D) 1,4

15. Тарихи білімдерді пайдаланып, кестедегі хандардың билік құру кезеңдерін
сәйкестендіріңіз
I. Қасым хан; II. Хақназар хан; III. Тәуекел хан; IV. Есім хан
A. 1582-1598 жж.; В. 1511-1518 жж.; С. 1598-1628 жж.; D. 1538-1580 жж.
A) I-D, II-С, III-А, IV-В
B) I-А, II-В, III-D, IV-С
C) I-В, II-D, III-С, IV-А
D) I-В, II-D, III-А, IV-С
ҚАЗАҚСТАН ТАРИХЫНАН СЫНАҚ АЯҚТАЛДЫ

Жауаптар: 1-D 2-D 11-A
15 – D
`;

test("parseTestText: ҰБТ сынама тестін сұрақтарға бөледі", () => {
  const { questions } = parseTestText(HISTORY);
  assert.deepEqual(questions.map((q) => q.number), [1, 2, 11, 15]);
  assert.equal(questions[0].stem, "Зарина патшайым басқарған мемлекет");
  assert.deepEqual(questions[0].options, ["Үйсін", "Қаңлы", "Қарлұқ", "Сақ"]);
  // Екі жолға бөлінген сұрақ біріктіріледі
  assert.equal(questions[1].stem, "XIII ғасырда бүкіл Еуразияда саяси жағдайдың ӛзгеруіне себепкер болған\nоқиға");
});

test("parseTestText: сұрақ ішіндегі «1. 2. 3.» тізімі мен «A.» жолдары нұсқа емес", () => {
  const { questions } = parseTestText(HISTORY);
  const q11 = questions.find((q) => q.number === 11)!;
  assert.match(q11.stem, /^> XVI-XVII ғғ\. қазақ хандары\n\nДұрыс дәйектерді анықтаңыз\n1\. Хақназар/);
  assert.match(q11.stem, /Самарқанд қалаларын басып алды\n3\. Есім/);
  assert.deepEqual(q11.options, ["2,3", "1,2", "1,3", "1,4"]);
  const q15 = questions.find((q) => q.number === 15)!;
  assert.match(q15.stem, /A\. 1582-1598 жж\./);
  assert.equal(q15.options.length, 4);
});

test("parseTestText: «Нұсқау», тақырып, соңғы жол өткізіледі; кілт бойынша дұрыс жауап", () => {
  const { questions, skipped } = parseTestText(HISTORY);
  assert.ok(skipped.some((s) => s.startsWith("Нұсқау")));
  assert.ok(skipped.includes("ҚАЗАҚСТАН ТАРИХЫ"));
  assert.ok(!questions.some((q) => q.stem.includes("таңдауға арналған")));
  assert.deepEqual(questions.map((q) => q.correct), [[3], [3], [0], [3]]);
});

test("parseTestText: «*», «+» белгілері, «Жауабы:», кирилл әріптер, көп жауап", () => {
  const { questions } = parseTestText(`1) $2x+3=11$ теңдеуінің түбірі
А) 3
*В) 4
С) 5
2. Бағдарламалау тілдері
A) Python +
B) HTML
C) Java
D) CSS
Жауабы: A, C
3. Ответы учеников показали
A) да
B) нет`);
  assert.equal(questions.length, 3);
  assert.deepEqual(questions[0].options, ["3", "4", "5"]);
  assert.deepEqual(questions[0].correct, [1]);
  assert.deepEqual(questions[1].correct, [0, 2]);
  assert.equal(questions[1].options[0], "Python");
  assert.equal(questions[2].stem, "Ответы учеников показали");
});
