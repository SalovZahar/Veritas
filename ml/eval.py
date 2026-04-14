"""
Оценка качества обученной модели на тестовой выборке.

python ml/eval.py
"""

from pathlib import Path
import json

import numpy as np
import pandas as pd
import torch
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    confusion_matrix,
    classification_report,
)
from torch.utils.data import DataLoader
from transformers import AutoTokenizer, AutoModelForSequenceClassification

from dataset import FakeNewsDataset

# ── Пути ──────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = BASE_DIR / "data" / "wellfake_preprocessed.csv"
MODELS_DIR = BASE_DIR / "models"
CONFIG_PATH = MODELS_DIR / "config.json"
MODEL_PATH = MODELS_DIR / "model.pt"

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Используем устройство: {DEVICE}")


def load_test_df() -> pd.DataFrame:
    df = pd.read_csv(DATA_PATH)
    test_df = df[df["split"] == "test"].reset_index(drop=True)
    print(f"Тестовых примеров: {len(test_df)}")
    return test_df


def main():
    # ── Загружаем конфиг ───────────────────────────────────────────────────────
    with CONFIG_PATH.open("r", encoding="utf-8") as f:
        cfg = json.load(f)

    pretrained_model_name = cfg["pretrained_model_name"]
    num_labels = cfg["num_labels"]
    max_length = cfg.get("max_length", 256)
    id2label = {int(k): v for k, v in cfg["id2label"].items()}

    # ── Загружаем модель ───────────────────────────────────────────────────────
    print(f"\nЗагружаем модель {pretrained_model_name}...")
    tokenizer = AutoTokenizer.from_pretrained(pretrained_model_name)
    model = AutoModelForSequenceClassification.from_pretrained(
        pretrained_model_name,
        num_labels=num_labels,
    ).to(DEVICE)

    state_dict = torch.load(MODEL_PATH, map_location=DEVICE, weights_only=True)
    model.load_state_dict(state_dict, strict=False)
    model.eval()
    print("Модель загружена.")

    # ── Загружаем тестовые данные ──────────────────────────────────────────────
    test_df = load_test_df()
    test_ds = FakeNewsDataset(
        texts=test_df["full_text"].tolist(),
        labels=test_df["label"].tolist(),
        tokenizer=tokenizer,
        max_length=max_length,
    )
    test_loader = DataLoader(test_ds, batch_size=16, shuffle=False)

    # ── Предсказания ───────────────────────────────────────────────────────────
    all_preds, all_labels = [], []

    print("\nЗапускаем предсказания на тестовой выборке...")
    with torch.no_grad():
        for step, batch in enumerate(test_loader, 1):
            batch = {k: v.to(DEVICE) for k, v in batch.items()}
            outputs = model(
                input_ids=batch["input_ids"],
                attention_mask=batch["attention_mask"],
            )
            preds = torch.argmax(outputs.logits, dim=-1)

            all_preds.append(preds.cpu().numpy())
            all_labels.append(batch["labels"].cpu().numpy())

            if step % 50 == 0:
                print(f"  Обработано батчей: {step}/{len(test_loader)}")

    all_preds = np.concatenate(all_preds)
    all_labels = np.concatenate(all_labels)

    # ── Метрики ────────────────────────────────────────────────────────────────
    acc = accuracy_score(all_labels, all_preds)
    macro_f1 = f1_score(all_labels, all_preds, average="macro")
    cm = confusion_matrix(all_labels, all_preds, labels=[0, 1])

    label_names = [id2label[0], id2label[1]]  # ["fake", "real"]

    print("\n" + "=" * 50)
    print("РЕЗУЛЬТАТЫ НА ТЕСТОВОЙ ВЫБОРКЕ")
    print("=" * 50)
    print(f"Accuracy:  {acc:.4f}  ({acc * 100:.1f}%)")
    print(f"Macro F1:  {macro_f1:.4f}")

    print("\nConfusion matrix (строки=правда, столбцы=предсказание):")
    print(f"{'':>10} | {'pred_fake':>10} | {'pred_real':>10}")
    print("-" * 36)
    for i, row_label in enumerate(label_names):
        print(f"{row_label:>10} | {cm[i][0]:>10} | {cm[i][1]:>10}")

    print("\nДетальный отчёт по классам:")
    print(classification_report(all_labels, all_preds, target_names=label_names))
    print("=" * 50)


if __name__ == "__main__":
    main()
