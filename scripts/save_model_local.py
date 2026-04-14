"""
Сохраняет токенизатор и архитектуру модели локально.
После этого inference.py будет работать полностью офлайн
и не будет обращаться к HuggingFace при каждом запуске.

Запустить ОДИН РАЗ:
    python scripts/save_model_local.py
"""

from pathlib import Path
from transformers import AutoTokenizer, AutoModelForSequenceClassification

PRETRAINED_MODEL_NAME = "roberta-base"
NUM_LABELS = 2

# Папка куда сохраняем
SAVE_DIR = Path("models/roberta-local")
SAVE_DIR.mkdir(parents=True, exist_ok=True)

print(f"Сохраняем токенизатор и архитектуру в {SAVE_DIR} ...")

tokenizer = AutoTokenizer.from_pretrained(PRETRAINED_MODEL_NAME)
tokenizer.save_pretrained(SAVE_DIR)
print("Токенизатор сохранён")

model = AutoModelForSequenceClassification.from_pretrained(
    PRETRAINED_MODEL_NAME,
    num_labels=NUM_LABELS,
)
model.save_pretrained(SAVE_DIR)
print("Архитектура модели сохранена")
