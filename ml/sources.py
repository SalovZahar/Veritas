"""
    from ml.sources import find_sources

    result = find_sources("acticle test...")
"""

import json
import re
from pathlib import Path
from urllib.parse import urlparse

from ddgs import DDGS

BASE_DIR = Path(__file__).resolve().parent.parent
TRUSTED_SOURCES_PATH = BASE_DIR / "data" / "trusted_sources.json"


def _load_trusted_sources() -> dict[str, str]:
    if not TRUSTED_SOURCES_PATH.exists():
        print(f"File {TRUSTED_SOURCES_PATH} not found.")
        return {}

    with TRUSTED_SOURCES_PATH.open("r", encoding="utf-8") as f:
        data = json.load(f)

    sources = {}
    for category, entries in data.items():
        if isinstance(entries, dict):
            sources.update(entries)

    return sources


# Загружается один раз при импорте модуля
TRUSTED_SOURCES: dict[str, str] = _load_trusted_sources()


def reload_trusted_sources():
    global TRUSTED_SOURCES
    TRUSTED_SOURCES = _load_trusted_sources()
    print(f"Load {len(TRUSTED_SOURCES)} trusted sourses.")


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
    Берём первые N значимых слов + news для фильтрации новостных источников.
    """
    cleaned = re.sub(r"[^\w\s]", " ", text)
    words = cleaned.split()
    return " ".join(words[:max_words]) + " news"


def find_sources(text: str, num_results: int = 3) -> dict:
    """
        {
            "query": "поисковый запрос который использовали",
            "sources": [
                {
                    "title":        "BBC News",
                    "url":          "https://bbc.com/news/...",
                    "domain":       "bbc.com",
                    "snippet":      "краткое описание страницы",
                    "trusted":      True,
                    "trusted_name": "BBC",
                },
                ...
            ],
            "trusted_count": 2,
            "error": None
        }
    """
    if not text or len(text.strip()) < 10:
        return _error_result("Text is too short.")

    query = _build_query(text)

    try:
        with DDGS() as ddgs:
            raw_results = list(ddgs.text(query, max_results=num_results))

    except Exception as e:
        return _error_result(f"Search error: {str(e)}")

    sources = []

    for item in raw_results[:num_results]:
        url = item.get("href", "")
        title = item.get("title", "")
        snippet = item.get("body", "")
        domain = _extract_domain(url)

        trusted_name = TRUSTED_SOURCES.get(domain)
        trusted = trusted_name is not None

        sources.append({
            "title": title,
            "url": url,
            "domain": domain,
            "snippet": snippet,
            "trusted": trusted,
            "trusted_name": trusted_name,
        })

    trusted_count = sum(1 for s in sources if s["trusted"])

    return {
        "query": query,
        "sources": sources,
        "trusted_count": trusted_count,
        "error": None,
    }


def _error_result(message: str) -> dict:
    """Возвращает пустой результат с текстом ошибки."""
    return {
        "query": "",
        "sources": [],
        "trusted_count": 0,
        "error": message,
    }
