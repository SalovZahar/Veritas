"""
Проверка модели на реальных примерах новостей.

Запуск:
    python test_real_news.py
"""

from ml.inference import classify_text

# ── Тестовые примеры ───────────────────────────────────────────────────────────
# Формат: (текст, ожидаемый класс, описание)

EXAMPLES = [
    # ── Реальные новости ───────────────────────────────────────────────────────
    (
        "The Federal Reserve held interest rates steady on Wednesday, "
        "as policymakers said they needed more evidence that inflation "
        "was cooling before cutting borrowing costs. Fed Chair Jerome Powell "
        "said the central bank was in no hurry to adjust rates.",
        "real",
        "Reuters: ФРС оставила ставки без изменений"
    ),
    (
        "NASA's James Webb Space Telescope has captured the most detailed "
        "images of the Carina Nebula, revealing thousands of never-before-seen "
        "young stars in a stellar nursery 7,600 light-years away. "
        "The images were released by the space agency on Tuesday.",
        "real",
        "NASA: телескоп Джеймс Уэбб"
    ),
    (
        "Apple reported quarterly earnings that beat Wall Street expectations, "
        "with revenue rising 5% to $94.9 billion. iPhone sales remained strong "
        "despite concerns about slowing consumer spending in key markets.",
        "real",
        "Bloomberg: квартальная отчётность Apple"
    ),
    (
        "Ukrainian forces repelled Russian attacks near Bakhmut on Saturday, "
        "the Ukrainian military said, as fighting continued along the eastern "
        "front. Russia's defense ministry claimed its forces had advanced "
        "in several directions.",
        "real",
        "AP News: боевые действия на Украине"
    ),

    # ── Фейковые новости ───────────────────────────────────────────────────────
    (
        "SHOCKING: Scientists CONFIRM that 5G towers are secretly being used "
        "to control human behavior! Government whistleblower reveals the truth "
        "they don't want you to know. Share before this gets deleted!!!",
        "fake",
        "Фейк: 5G-теория заговора"
    ),
    (
        "BREAKING: Barack Obama arrested for treason after secret documents "
        "prove he funded terrorist organizations. White House sources confirm "
        "military tribunals will begin next week. The mainstream media is "
        "hiding this from you!",
        "fake",
        "Фейк: Обама арестован"
    ),
    (
        "EXPOSED: Big Pharma has been suppressing the cure for cancer for "
        "decades to keep profits high. A brave doctor reveals the natural "
        "remedy that ACTUALLY works — but they're trying to silence him. "
        "Click here to learn the truth!",
        "fake",
        "Фейк: заговор фармкомпаний"
    ),
    (
        "You won't BELIEVE what they found in the voting machines! "
        "Millions of ballots were switched automatically by a secret algorithm. "
        "This is the biggest election fraud in American history and the "
        "deep state is covering it up!",
        "fake",
        "Фейк: фальсификация выборов"
    ),
]


def emoji_score(score: int) -> str:
    if score <= 35:
        return "🔴"
    elif score <= 64:
        return "🟡"
    else:
        return "🟢"


def main():
    print("=" * 65)
    print("ПРОВЕРКА МОДЕЛИ НА РЕАЛЬНЫХ ПРИМЕРАХ")
    print("=" * 65)

    correct = 0

    for text, expected, description in EXAMPLES:
        result = classify_text(text)

        label      = result["label"]
        score      = result["score"]
        confidence = result["confidence"]
        is_correct = label == expected
        correct   += int(is_correct)

        status = "✅ верно" if is_correct else "❌ ошибка"
        icon   = emoji_score(score)

        print(f"\n{icon} {description}")
        print(f"   Результат:  {label:4s} | score={score:3d} | confidence={confidence:.2f}")
        print(f"   Ожидалось:  {expected}")
        print(f"   {status}")

    print("\n" + "=" * 65)
    print(f"Итого: {correct}/{len(EXAMPLES)} правильных ответов")
    print("=" * 65)


if __name__ == "__main__":
    main()