"""
Подготовка датасета WELFake для обучения модели.

Что делает скрипт:
1. Загружает WELFake_Dataset.csv
2. Чистит данные (удаляет пустые, дубликаты)
3. Объединяет заголовок + текст статьи в одно поле
4. Делит на train / val / test (80% / 10% / 10%)
5. Сохраняет в data/wellfake_preprocessed.csv

Запуск:
    python scripts/prepare_wellfake.py
"""

from pathlib import Path

import pandas as pd
from sklearn.model_selection import train_test_split

BASE_DIR = Path(__file__).resolve().parent.parent   # корень проекта
RAW_PATH = BASE_DIR / "data" / "WELFake_Dataset.csv"
OUT_PATH = BASE_DIR / "data" / "wellfake_preprocessed.csv"

# 0 = fake, 1 = real  (так в оригинальном WELFake)
LABEL_MAP = {0: 0, 1: 1}


def load_raw() -> pd.DataFrame:
    print(f"Загружаем {RAW_PATH}")
    df = pd.read_csv(RAW_PATH)
    print(f"  Загружено строк: {len(df)}")
    print(f"  Колонки: {df.columns.tolist()}")
    return df


def clean(df: pd.DataFrame) -> pd.DataFrame:
    """Чистка: убираем мусор, объединяем заголовок и текст."""

    # Приводим названия колонок к нижнему регистру на всякий случай
    df.columns = [c.strip().lower() for c in df.columns]

    # WELFake содержит: Unnamed: 0, title, text, label
    # Убираем служебную колонку индекса если есть
    if "unnamed: 0" in df.columns:
        df = df.drop(columns=["unnamed: 0"])

    # Заполняем пустые заголовки и тексты пустой строкой
    df["title"] = df["title"].fillna("")
    df["text"]  = df["text"].fillna("")

    # Объединяем заголовок и текст — модель видит всё сразу
    # Формат: "ЗАГОЛОВОК [SEP] текст статьи"
    df["full_text"] = df["title"] + " [SEP] " + df["text"]

    # Убираем строки где итоговый текст почти пустой (< 20 символов)
    before = len(df)
    df = df[df["full_text"].str.len() >= 20].reset_index(drop=True)
    print(f"  Удалено пустых строк: {before - len(df)}")

    # Убираем дубликаты по тексту
    before = len(df)
    df = df.drop_duplicates(subset=["full_text"]).reset_index(drop=True)
    print(f"  Удалено дубликатов: {before - len(df)}")

    # Оставляем только нужные колонки
    df = df[["full_text", "label"]].copy()

    return df


def split_data(df: pd.DataFrame):
    """Разбиваем на train / val / test."""

    # 80% train, 20% temp
    train, temp = train_test_split(
        df,
        test_size=0.2,
        random_state=42,
        stratify=df["label"],
    )

    # 10% val, 10% test (пополам от temp)
    val, test = train_test_split(
        temp,
        test_size=0.5,
        random_state=42,
        stratify=temp["label"],
    )

    train = train.copy()
    val   = val.copy()
    test  = test.copy()

    train["split"] = "train"
    val["split"]   = "val"
    test["split"]  = "test"

    return train, val, test


def print_stats(train, val, test):
    """Печатаем статистику по сплитам."""
    for name, df in [("train", train), ("val", val), ("test", test)]:
        total = len(df)
        fake  = (df["label"] == 0).sum()
        real  = (df["label"] == 1).sum()
        print(f"  {name:5s}: {total:6d} строк | fake={fake} ({fake/total*100:.1f}%) | real={real} ({real/total*100:.1f}%)")


def main():
    # 1. Загрузка
    df = load_raw()

    # 2. Чистка
    print("\nЧистим данные...")
    df = clean(df)
    print(f"  Итого после чистки: {len(df)} строк")

    # 3. Разбивка
    print("\nДелим на сплиты...")
    train, val, test = split_data(df)
    print_stats(train, val, test)

    # 4. Сохранение
    result = pd.concat([train, val, test], ignore_index=True)
    result.to_csv(OUT_PATH, index=False)
    print(f"\nСохранено в {OUT_PATH}")


if __name__ == "__main__":
    main()