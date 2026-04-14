# Veritas Fake News Detector

Описывает все ML-функции, их входные/выходные данные и порядок установки.

---

## Установка

### 1. PyTorch с поддержкой GPU

```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

### 2. Остальные зависимости

```bash
pip install transformers scikit-learn pandas numpy ddgs httpx python-dotenv
```

### 3. Веса модели

Получить у ML-разработчика :
```
директорию models

ссылка: 
https://drive.google.com/file/d/1u8ZEnB5sV25YFhsfgMhN7fZdFVbF8YW8/view?usp=sharing
```

### 4. Переменные окружения

Создать файл `.env` в корне проекта:
```
LLM_API_KEY=sk-or-xxxxxxxxxxxxxxxx
```

---

## Три функции ML-модуля

```python
from ml.inference     import classify_text   # быстрая классификация
from ml.sources       import find_sources    # поиск источников
from ml.deep_analysis import deep_analyse    # глубокий анализ через LLM
```

> **Важно:** импортировать модули один раз при старте сервера.  
> `classify_text` загружает модель при импорте — это занимает ~3 секунды.  

---

## Функция 1 — classify_text()

Быстрая классификация текста. Вызывается при нажатии кнопки **"Проверить"**.

```python
result = classify_text("текст статьи...")
```

### Входные данные

| Параметр | Тип | Описание |
|---|---|---|
| `text` | `str` | Текст статьи, минимум 10 символов |

### Возвращает

```python
{
    "label":      "fake",   # "fake" или "real"
    "confidence": 0.94,     # уверенность модели, 0.0 – 1.0
    "score":      6,        # 0 = фейк, 100 = достоверно
    "probs": {
        "fake": 0.94,
        "real": 0.06,
    }
}
```

### Логика цвета плашки для фронтенда

```
score  0 – 35   → 🔴 красный  → "Вероятно фейк"
score 36 – 64   → 🟡 жёлтый   → "Спорно"
score 65 – 100  → 🟢 зелёный  → "Вероятно достоверно"
```

### Ошибки

```python
# Если текст слишком короткий
ValueError("Text is too short. Minimum length is 10 characters.")
# → вернуть клиенту 400 Bad Request
```

---

## Функция 2 — find_sources()

Поиск источников по тексту через DuckDuckGo. Вызывается вместе с `classify_text`.

```python
result = find_sources("текст статьи...")
```

### Входные данные

| Параметр | Тип | Описание |
|---|---|---|
| `text` | `str` | Текст статьи |
| `num_results` | `int` | Кол-во источников (по умолчанию 3) |

### Возвращает

```python
{
    "query": "Federal Reserve raised interest rates news",
    "sources": [
        {
            "title":        "Fed Holds Rates Steady — Reuters",
            "url":          "https://reuters.com/...",
            "domain":       "reuters.com",
            "snippet":      "краткое описание страницы...",
            "trusted":      True,
            "trusted_name": "Reuters",   # None если не в списке доверенных
        },
        ...
    ],
    "trusted_count": 1,   # сколько источников из доверенного списка
    "error": None         # строка с ошибкой если что-то пошло не так
}
```

### Обработка ошибок

```python
result = find_sources(text)
if result["error"]:
    # не падаем — просто возвращаем пустой список источников
    # функция всегда возвращает dict, никогда не кидает исключение
    pass
```

---

## Функция 3 — deep_analyse()

Глубокий анализ через LLM (OpenRouter). Вызывается при нажатии кнопки **"Глубокий анализ"**

```python
result = deep_analyse(
    news_text=text,
    model_result=classify_text(text),      # результат из функции 1
    sources_result=find_sources(text),     # результат из функции 2
)
```

### Входные данные

| Параметр | Тип | Описание |
|---|---|---|
| `news_text` | `str` | Текст статьи |
| `model_result` | `dict` | Результат `classify_text()` |
| `sources_result` | `dict` | Результат `find_sources()` |

### Возвращает

```python
{
    "verdict":    "fake",          # fake / likely_fake / mixed / likely_real / real
    "confidence": 95,              # уверенность LLM, 0–100
    "explanation": "The article uses sensationalist language...",
    "signals": {
        "factual_issues":     ["No scientific evidence for claim X"],
        "manipulation_signs": ["Use of SHOCKING", "Fear-mongering"],
        "source_analysis":    ["Reuters confirms the event", "Unknown site sott.net"],
        "contradictions":     ["Claim X contradicts statement Y"]
    },
    "final_reasoning": "Detailed analysis in 5-10 sentences...",
    "error": None
}
```

### Обработка ошибок

```python
result = deep_analyse(text, model_result, sources_result)
if result["error"]:
    # вернуть клиенту 503 Service Unavailable
    # LLM может быть недоступна
    pass
```

---


## Переменные окружения

| Переменная | Описание |
|---|---|
| `LLM_API_KEY` | Ключ OpenRouter (`sk-or-...`) |