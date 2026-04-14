"""
Тест глубокого анализа через LLM (Groq).

Запуск:
    python test_deep_analysis.py
"""

from ml.inference import classify_text
from ml.sources import find_sources
from ml.deep_analysis import deep_analyse

# Тестовые примеры — один фейк, одна реальная новость
EXAMPLES = [
    (
        "SHOCKING: Scientists CONFIRM that 5G towers are secretly being used "
        "to control human behavior! Government whistleblower reveals the truth "
        "they don't want you to know. Share before this gets deleted!!!",
        "Фейк: 5G-теория заговора"
    ),
    (
        "Lord George Robertson, the former Labour defence secretary who wrote the government's Strategic Defence Review (SDR), has accused \"non-military experts in the Treasury\" of \"vandalism\", in a speech to be delivered on Tuesday."
        "The government has promised to publish a 10-year defence investment plan to fund the SDR's vision but it has been repeatedly delayed.",
        "Реальная новость: ФРС"
    ),
]

VERDICT_EMOJI = {
    "fake":        "🔴",
    "likely_fake": "🟠",
    "mixed":       "🟡",
    "likely_real": "🟢",
    "real":        "🟢",
    "unknown":     "⚪",
}


def main():
    for text, description in EXAMPLES:
        print("\n" + "=" * 65)
        print(f"📰 {description}")
        print("=" * 65)

        model_result = classify_text(text)

        sources_result = find_sources(text)

        analysis = deep_analyse(text, model_result, sources_result)

        print(sources_result["sources"])

        print(analysis)



if __name__ == "__main__":
    main()