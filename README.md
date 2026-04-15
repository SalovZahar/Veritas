# Veritas — Fake News Detection System (ML + Source Verification + LLM Analysis)

**Veritas** is an open-source project designed to detect fake news using Machine Learning models combined with source verification and optional deep analysis powered by Large Language Models (LLMs).

The goal of this project is not only to classify text as **fake** or **real**, but also to provide supporting evidence by searching trusted sources and generating an explainable final verdict.

---

## 🚀 Features

- 🧠 **Machine Learning Fake News Classification**  
  Predicts whether a news article is `fake` or `real` with confidence score.

- 🔍 **Source Searching & Verification**  
  Finds relevant sources online and checks whether they belong to trusted domains.

- 🤖 **LLM-powered Deep Analysis (optional)**  
  Generates a structured explanation and reasoning behind the verdict.

- 📊 **Explainable Output**  
  Produces results with probabilities, confidence, and supporting links.

---

## 📦 Installation

### 1. Clone the repository
```bash
git clone https://github.com/SalovZahar/Veritas.git
cd Veritas
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Set up environment variables
Create a `.env` file in the root directory:

```env
LLM_API_KEY=your_api_key_here
```

*(If your LLM provider uses a different key name, adjust it in your code.)*


### 4. Download model

Download model, create `models/` directory at the project root and place it inside.

https://drive.google.com/file/d/1u8ZEnB5sV25YFhsfgMhN7fZdFVbF8YW8/view?usp=sharing

Should be like this:
```bash
models/
├── roberta-local
    ├── config.json
    ├── model.safetensors
    ├── tokenizer.json
    ├── config_config.json
├── config.json
├── medel.pt
└── medel_best.pt

```

---

## Functional

### ✅ Quick Fake News Classification
```python
from ml.inference import classify_text

text = "Breaking news: something happened..."
result = classify_text(text)

print(result)
```

### 🔎 Search for Sources
```python
from ml.sources import find_sources

sources = find_sources("Some news statement to verify")
print(sources)
```

### 🤖 Deep Analysis with LLM
```python
from ml.deep_analysis import deep_analyse

analysis = deep_analyse(news_text, model_result, sources_result)
print(analysis)
```

---

## 📊 Usage

to start the server, enter the terminal:

```bash
    uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```
or
```bash
    python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```
---

## 🔥 Future Improvements

Planned enhancements:

- GitHub Actions CI pipeline
- Docker support
- Web UI / frontend
- OpenAPI (Swagger) documentation
- Benchmarking against public fake-news datasets
- Improved trusted-source ranking system

---

## 🤝 Contributing

Contributions are welcome!

If you want to improve Veritas:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Open a Pull Request

If you find a bug or want a feature, feel free to open an issue.

---

### Contact us
 <a href="mailto:sosikoni@gmail.com">gmail.com</a>


