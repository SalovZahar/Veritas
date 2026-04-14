"""
    from ml.inference import classify_text

    result = classify_text("текст статьи...")
"""

import json
from pathlib import Path

import torch
import torch.nn.functional as F
from transformers import AutoModelForSequenceClassification, AutoTokenizer

# Пути
BASE_DIR    = Path(__file__).resolve().parent.parent
MODELS_DIR  = BASE_DIR / "models"
CONFIG_PATH = MODELS_DIR / "config.json"
MODEL_PATH  = MODELS_DIR / "model.pt"

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Загружаем модель один раз при импорте модуля
# модель грузится при старте сервера, а не при каждом запросе.


with CONFIG_PATH.open("r", encoding="utf-8") as f:
    cfg = json.load(f)

PRETRAINED_MODEL_NAME: str = cfg["pretrained_model_name"]
LOCAL_MODEL_DIR = BASE_DIR / "models" / "roberta-local"
if LOCAL_MODEL_DIR.exists():
    PRETRAINED_MODEL_NAME = str(LOCAL_MODEL_DIR)
NUM_LABELS: int            = cfg["num_labels"]
MAX_LENGTH: int            = cfg.get("max_length", 256)
ID2LABEL: dict             = {int(k): v for k, v in cfg["id2label"].items()}
# ID2LABEL = {0: "fake", 1: "real"}

tokenizer = AutoTokenizer.from_pretrained(PRETRAINED_MODEL_NAME)
model     = AutoModelForSequenceClassification.from_pretrained(
    PRETRAINED_MODEL_NAME,
    num_labels=NUM_LABELS,
).to(DEVICE)

model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE, weights_only=True))
model.eval()


# Основная функция

def classify_text(text: str) -> dict:
    """
    Классифицирует текст новости как фейк или достоверный.

    Args:
        text: текст статьи, минимум 10 символов

    Returns:
        {
            "label":      "fake" | "real",
            "confidence": float (0.0 – 1.0),
            "score":      int   (0 – 100),  # 0=фейк, 100=достоверно
            "probs": {
                "fake": float,
                "real": float,
            }
        }
    ValueError: если текст слишком короткий
    """
    if not text or len(text.strip()) < 10:
        raise ValueError("Text is too short. Minimum length is 10 characters.")

    # Токенизируем текст
    inputs = tokenizer(
        text.strip(),
        truncation=True,
        padding="max_length",
        max_length=MAX_LENGTH,
        return_tensors="pt",
    )
    inputs = {k: v.to(DEVICE) for k, v in inputs.items()}

    # Предсказание
    with torch.no_grad():
        outputs = model(**inputs)
        probs_tensor = F.softmax(outputs.logits, dim=-1).squeeze(0)

    probs     = probs_tensor.cpu().tolist()          # [p_fake, p_real]
    class_idx = int(torch.argmax(probs_tensor).item())
    label     = ID2LABEL[class_idx]                  # "fake" или "real"

    p_fake = float(probs[0])
    p_real = float(probs[1])

    # score: 0 = точно фейк, 100 = точно достоверно
    score = round(probs[0] * 100)
    confidence = float(max(probs))

    return {
        "label":      label,
        "confidence": round(confidence, 4),
        "score":      score,
        "probs": {
            "fake": round(p_fake, 4),
            "real": round(p_real, 4),
        },
    }