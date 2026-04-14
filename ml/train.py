"""
Обучение модели roberta-base на датасете WELFake.

Запуск:
    python ml/train.py
"""

from pathlib import Path
import json
import shutil

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.metrics import accuracy_score, f1_score
from sklearn.utils.class_weight import compute_class_weight
from torch.utils.data import DataLoader
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    get_linear_schedule_with_warmup,
)

from dataset import FakeNewsDataset

# Пути
BASE_DIR   = Path(__file__).resolve().parent.parent
DATA_PATH  = BASE_DIR / "data" / "wellfake_preprocessed.csv"
MODELS_DIR = BASE_DIR / "models"

# Гиперпараметры
PRETRAINED_MODEL_NAME = "roberta-base"
MAX_LENGTH  = 512
NUM_LABELS  = 2        # 0 = fake, 1 = real

BATCH_SIZE  = 16       # если не хватает памяти GPU — уменьши до 8
LR          = 2e-5     # стандартный learning rate для fine-tuning roberta
EPOCHS      = 4        # для roberta хватает 3-4 эпох
WARMUP_RATIO = 0.1     # 10% шагов — разогрев learning rate

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Используем устройство: {DEVICE}")


# Загрузка данных

def load_splits() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    df = pd.read_csv(DATA_PATH)
    train_df = df[df["split"] == "train"].reset_index(drop=True)
    val_df   = df[df["split"] == "val"].reset_index(drop=True)
    test_df  = df[df["split"] == "test"].reset_index(drop=True)
    return train_df, val_df, test_df


def make_loaders(tokenizer) -> tuple[DataLoader, DataLoader, pd.DataFrame]:
    train_df, val_df, _ = load_splits()

    train_ds = FakeNewsDataset(
        texts=train_df["full_text"].tolist(),
        labels=train_df["label"].tolist(),
        tokenizer=tokenizer,
        max_length=MAX_LENGTH,
    )
    val_ds = FakeNewsDataset(
        texts=val_df["full_text"].tolist(),
        labels=val_df["label"].tolist(),
        tokenizer=tokenizer,
        max_length=MAX_LENGTH,
    )

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True)
    val_loader   = DataLoader(val_ds,   batch_size=BATCH_SIZE, shuffle=False)

    return train_loader, val_loader, train_df


# Веса классов (исправляем дисбаланс 54/46)

def compute_weights(train_df: pd.DataFrame) -> torch.Tensor:
    labels  = train_df["label"].values
    weights = compute_class_weight(
        class_weight="balanced",
        classes=np.array([0, 1]),
        y=labels,
    )
    print(f"Веса классов: fake={weights[0]:.3f}, real={weights[1]:.3f}")
    return torch.tensor(weights, dtype=torch.float).to(DEVICE)


# Валидация

def evaluate(
    model: nn.Module,
    loader: DataLoader,
    loss_fn: nn.CrossEntropyLoss,
) -> dict:
    model.eval()
    all_preds, all_labels = [], []
    total_loss = 0.0

    with torch.no_grad():
        for batch in loader:
            batch   = {k: v.to(DEVICE) for k, v in batch.items()}
            outputs = model(
                input_ids=batch["input_ids"],
                attention_mask=batch["attention_mask"],
            )
            loss = loss_fn(outputs.logits, batch["labels"])
            total_loss += loss.item()

            preds = torch.argmax(outputs.logits, dim=-1)
            all_preds.append(preds.cpu().numpy())
            all_labels.append(batch["labels"].cpu().numpy())

    all_preds  = np.concatenate(all_preds)
    all_labels = np.concatenate(all_labels)

    return {
        "loss":     total_loss / len(loader),
        "accuracy": accuracy_score(all_labels, all_preds),
        "f1":       f1_score(all_labels, all_preds, average="macro"),
    }


# Обучение

def train():
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    print(f"\nЗагружаем токенизатор и модель {PRETRAINED_MODEL_NAME}...")
    tokenizer = AutoTokenizer.from_pretrained(PRETRAINED_MODEL_NAME)
    model     = AutoModelForSequenceClassification.from_pretrained(
        PRETRAINED_MODEL_NAME,
        num_labels=NUM_LABELS,
    ).to(DEVICE)

    train_loader, val_loader, train_df = make_loaders(tokenizer)
    print(f"Батчей в train: {len(train_loader)} | в val: {len(val_loader)}")

    # Взвешенная функция потерь
    class_weights = compute_weights(train_df)
    loss_fn = nn.CrossEntropyLoss(weight=class_weights)

    # Оптимизатор и планировщик learning rate
    total_steps  = len(train_loader) * EPOCHS
    warmup_steps = int(total_steps * WARMUP_RATIO)

    optimizer = torch.optim.AdamW(model.parameters(), lr=LR)
    scheduler = get_linear_schedule_with_warmup(
        optimizer,
        num_warmup_steps=warmup_steps,
        num_training_steps=total_steps,
    )

    best_f1         = 0.0
    best_model_path = MODELS_DIR / "model_best.pt"

    print(f"\nНачинаем обучение на {EPOCHS} эпох...\n")

    for epoch in range(1, EPOCHS + 1):
        model.train()
        total_loss = 0.0

        for step, batch in enumerate(train_loader, 1):
            batch = {k: v.to(DEVICE) for k, v in batch.items()}

            optimizer.zero_grad()
            outputs = model(
                input_ids=batch["input_ids"],
                attention_mask=batch["attention_mask"],
            )
            loss = loss_fn(outputs.logits, batch["labels"])
            loss.backward()

            # Gradient clipping — защита от взрывного градиента
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)

            optimizer.step()
            scheduler.step()

            total_loss += loss.item()

            # Прогресс каждые 100 батчей
            if step % 100 == 0:
                print(f"  Epoch {epoch} | step {step}/{len(train_loader)} | loss={total_loss/step:.4f}")

        avg_train_loss = total_loss / len(train_loader)
        val_metrics    = evaluate(model, val_loader, loss_fn)

        print(
            f"\nEpoch {epoch}/{EPOCHS} | "
            f"train_loss={avg_train_loss:.4f} | "
            f"val_loss={val_metrics['loss']:.4f} | "
            f"val_acc={val_metrics['accuracy']:.4f} | "
            f"val_f1={val_metrics['f1']:.4f}"
        )

        # Сохраняем лучшую модель по val_f1
        if val_metrics["f1"] > best_f1:
            best_f1 = val_metrics["f1"]
            torch.save(model.state_dict(), best_model_path)
            print(f"  ✓ Новая лучшая модель сохранена (f1={best_f1:.4f})\n")

    # Копируем лучшую модель как основную
    shutil.copy(best_model_path, MODELS_DIR / "model.pt")

    # Сохраняем конфиг — inference.py будет читать его
    config = {
        "pretrained_model_name": PRETRAINED_MODEL_NAME,
        "num_labels":            NUM_LABELS,
        "max_length":            MAX_LENGTH,
        "id2label":              {"0": "fake", "1": "real"},
        "label2id":              {"fake": 0, "real": 1},
    }
    with open(MODELS_DIR / "config.json", "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)

    print(f"\nЛучший val f1: {best_f1:.4f}")
    print(f"Модель сохранена → {MODELS_DIR / 'model.pt'}")
    print(f"Конфиг сохранён  → {MODELS_DIR / 'config.json'}")


if __name__ == "__main__":
    train()