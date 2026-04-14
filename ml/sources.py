"""
    from ml.sources import find_sources

    result = find_sources("текст статьи...")
"""

import re
from urllib.parse import urlparse

from ddgs import DDGS

# ── Список доверенных источников ───────────────────────────────────────────────
# Домен → название источника
TRUSTED_SOURCES: dict[str, str] = {
    # Мировые агентства
    "reuters.com":          "Reuters",
    "apnews.com":           "Associated Press",
    "bbc.com":              "BBC",
    "bbc.co.uk":            "BBC",
    "theguardian.com":      "The Guardian",
    "nytimes.com":          "The New York Times",
    "washingtonpost.com":   "The Washington Post",
    "bloomberg.com":        "Bloomberg",
    "ft.com":               "Financial Times",
    "economist.com":        "The Economist",
    "nature.com":           "Nature",
    "science.org":          "Science",
    "who.int":              "WHO",
    "un.org":               "United Nations",
    "nasa.gov":             "NASA",
    "cdc.gov":              "CDC",
    # Русскоязычные
    "tass.ru":              "ТАСС",
    "ria.ru":               "РИА Новости",
    "interfax.ru":          "Интерфакс",
    "rbc.ru":               "РБК",
    "kommersant.ru":        "Коммерсантъ",
    "vedomosti.ru":         "Ведомости",
    "meduza.io":            "Meduza",
}


def _extract_domain(url: str) -> str:
    """Извлекает домен из URL. Например: https://www.bbc.com/news → bbc.com"""
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        if domain.startswith("www."):
            domain = domain[4:]
        return domain
    except Exception:
        return ""


def _build_query(text: str, max_words: int = 12) -> str:
    """
    Строим поисковый запрос из текста статьи.
    Берём первые N значимых слов — этого достаточно для поиска.
    """
    cleaned = re.sub(r"[^\w\s]", " ", text)
    words   = cleaned.split()
    return " ".join(words[:max_words]) + " news"


def find_sources(text: str, num_results: int = 3) -> dict:
    """
    Ищет источники по тексту статьи через DuckDuckGo.

    Args:
        text:        текст статьи
        num_results: сколько источников вернуть (по умолчанию 3)

    Returns:
        {
            "query": "поисковый запрос который использовали",
            "sources": [
                {
                    "title":        "BBC News",
                    "url":          "https://bbc.com/news/...",
                    "domain":       "bbc.com",
                    "snippet":      "краткое описание страницы",
                    "trusted":      True,
                    "trusted_name": "BBC",   # None если не в списке
                },
                ...
            ],
            "trusted_count": 2,
            "error": None
        }
    """
    if not text or len(text.strip()) < 10:
        return _error_result("Текст слишком короткий для поиска источников.")

    query = _build_query(text)

    try:
        with DDGS() as ddgs:
            raw_results = list(ddgs.text(query, max_results=num_results))

    except Exception as e:
        return _error_result(f"Ошибка поиска: {str(e)}")

    # ── Парсим результаты ──────────────────────────────────────────────────────
    sources = []

    for item in raw_results[:num_results]:
        url     = item.get("href", "")
        title   = item.get("title", "")
        snippet = item.get("body", "")
        domain  = _extract_domain(url)

        trusted_name = TRUSTED_SOURCES.get(domain)
        trusted      = trusted_name is not None

        sources.append({
            "title":        title,
            "url":          url,
            "domain":       domain,
            "snippet":      snippet,
            "trusted":      trusted,
            "trusted_name": trusted_name,
        })

    trusted_count = sum(1 for s in sources if s["trusted"])

    return {
        "query":         query,
        "sources":       sources,
        "trusted_count": trusted_count,
        "error":         None,
    }


def _error_result(message: str) -> dict:
    """Возвращает пустой результат с текстом ошибки."""
    return {
        "query":         "",
        "sources":       [],
        "trusted_count": 0,
        "error":         message,
    }