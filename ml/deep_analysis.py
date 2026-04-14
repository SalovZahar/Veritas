"""
Глубокий анализ новости через LLM (OpenRouter).

Использование:
    from ml.deep_analysis import deep_analyse

    result = deep_analyse(
        news_text="текст статьи",
        model_result=classify_text(news_text),
        sources_result=find_sources(news_text),
    )
"""

import json
import os
import re

import httpx
from dotenv import load_dotenv

load_dotenv()

# ── Настройки ──────────────────────────────────────────────────────────────────
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_API_URL = "https://openrouter.ai/api/v1/chat/completions"
LLM_MODEL = "openrouter/auto"


def _format_sources(sources_result: dict) -> str:
    """Форматируем источники в читаемый текст для промта."""
    if sources_result.get("error") or not sources_result.get("sources"):
        return "Источники не найдены."

    lines = []
    for i, s in enumerate(sources_result["sources"], 1):
        trust = "ДОВЕРЕННЫЙ" if s["trusted"] else "неизвестный"
        lines.append(f"{i}. [{trust}] {s['domain']} — {s['title']}")
        if s.get("snippet"):
            lines.append(f"   Описание: {s['snippet'][:150]}...")

    return "\n".join(lines)


def _build_prompt(news_text: str, model_result: dict, sources_result: dict) -> str:
    """Собираем финальный промт."""
    sources_text = _format_sources(sources_result)
    label        = model_result.get("label", "unknown")
    confidence   = round(model_result.get("confidence", 0) * 100)
    score        = model_result.get("score", 0)

    return f"""Ты — эксперт по фактчекингу, журналистике и анализу дезинформации.
Твоя задача — провести глубокий анализ достоверности новости.

=== ДАННЫЕ ===

НОВОСТЬ:
\"\"\"{news_text}\"\"\"

РЕЗУЛЬТАТ МОДЕЛИ КЛАССИФИКАЦИИ:
- label: {label}
- confidence: {confidence}%
- score: {score}/100 (0=фейк, 100=достоверно)

НАЙДЕННЫЕ ИСТОЧНИКИ:
{sources_text}

=== ИНСТРУКЦИИ ===

Проанализируй новость по следующим критериям:

1. ФАКТЫ И ЛОГИКА
   - Есть ли проверяемые утверждения?
   - Есть ли логические ошибки, противоречия или натяжки?

2. СТИЛЬ И МАНИПУЛЯЦИИ
   - Используется ли кликбейт, эмоциональное давление, сенсационность?
   - Есть ли признаки пропаганды или манипуляции?

3. СООТВЕТСТВИЕ ИСТОЧНИКАМ
   - Подтверждают ли найденные источники новость?
   - Есть ли расхождения?

4. ДОСТОВЕРНОСТЬ ИСТОЧНИКОВ
   - Насколько источники авторитетны?
   - Есть ли подозрительные или неизвестные сайты?

5. ОБЩАЯ ОЦЕНКА

=== ФОРМАТ ОТВЕТА ===

Верни ТОЛЬКО валидный JSON без какого-либо текста до или после него:

{{
  "verdict": "fake | likely_fake | mixed | likely_real | real",
  "confidence": 0-100,
  "explanation": "краткое объяснение (2-3 предложения)",
  "signals": {{
    "factual_issues": ["issue1", "issue2"],
    "manipulation_signs": ["sign1", "sign2"],
    "source_analysis": ["analysis1", "analysis2"],
    "contradictions": ["contradiction1"]
  }},
  "final_reasoning": "подробный анализ (5-10 предложений)"
}}

=== ВАЖНО ===
- НЕ доверяй модели классификации слепо — она может ошибаться
- Если данных недостаточно — укажи это в explanation
- НЕ придумывай факты которых нет в тексте
- Если не уверен — снижай confidence
- Используй только предоставленные данные
- Верни ТОЛЬКО JSON, никакого другого текста
- Пиши ТОЛЬКО на английском языке
- НЕ используй эмодзи нигде в ответе
- В source_analysis укажи конкретные источники которые нашёл и оцени их авторитетность
"""


def _parse_llm_response(raw: str) -> dict:
    """Парсим JSON из ответа LLM."""
    cleaned = re.sub(r"```json\s*", "", raw)
    cleaned = re.sub(r"```\s*", "", cleaned)
    cleaned = cleaned.strip()

    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if match:
        cleaned = match.group(0)

    return json.loads(cleaned)


def deep_analyse(
    news_text: str,
    model_result: dict,
    sources_result: dict,
) -> dict:
    """
    Проводит глубокий анализ новости через LLM.

    Args:
        news_text:      текст статьи
        model_result:   результат classify_text()
        sources_result: результат find_sources()

    Returns:
        {
            "verdict":    "fake | likely_fake | mixed | likely_real | real",
            "confidence": 0-100,
            "explanation": "краткое объяснение",
            "signals": {
                "factual_issues":     [...],
                "manipulation_signs": [...],
                "source_analysis":    [...],
                "contradictions":     [...]
            },
            "final_reasoning": "подробный анализ",
            "error": None
        }
    """
    if not LLM_API_KEY:
        return _error_result("LLM_API_KEY не задан в .env файле.")

    if not news_text or len(news_text.strip()) < 10:
        return _error_result("Текст слишком короткий для анализа.")

    prompt = _build_prompt(news_text, model_result, sources_result)

    try:
        response = httpx.post(
            LLM_API_URL,
            headers={
                "Authorization":  f"Bearer {LLM_API_KEY}",
                "Content-Type":   "application/json",
                "HTTP-Referer":   "https://veritas-extension.local",
                "X-Title":        "Veritas Fake News Detector",
            },
            json={
                "model":    LLM_MODEL,
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.2,
                "max_tokens":  1500,
            },
            timeout=30.0,
        )
        response.raise_for_status()
        data = response.json()

    except httpx.TimeoutException:
        return _error_result("LLM не ответил вовремя (timeout 30s).")
    except httpx.HTTPStatusError as e:
        return _error_result(f"Ошибка API: {e.response.status_code} — {e.response.text[:200]}")
    except Exception as e:
        return _error_result(f"Неизвестная ошибка: {str(e)}")

    try:
        raw_text = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError):
        return _error_result(f"Неожиданный формат ответа: {str(data)[:200]}")

    try:
        result = _parse_llm_response(raw_text)
    except json.JSONDecodeError:
        return _error_result(f"LLM вернул невалидный JSON: {raw_text[:200]}")

    result["error"] = None
    return result


def _error_result(message: str) -> dict:
    return {
        "verdict":        "unknown",
        "confidence":     0,
        "explanation":    message,
        "signals": {
            "factual_issues":     [],
            "manipulation_signs": [],
            "source_analysis":    [],
            "contradictions":     [],
        },
        "final_reasoning": "",
        "error":           message,
    }