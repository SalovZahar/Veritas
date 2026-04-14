"""
Dataset класс для обучения модели на WELFake.

Принимает тексты и метки, токенизирует их и отдаёт батчи в train.py.
"""

from typing import Sequence

import torch
from torch.utils.data import Dataset
from transformers import PreTrainedTokenizerBase


class FakeNewsDataset(Dataset):
    def __init__(
        self,
        texts: Sequence[str],
        labels: Sequence[int],
        tokenizer: PreTrainedTokenizerBase,
        max_length: int = 512,
    ):
        """
        Args:
            texts:      список текстов статей
            labels:     список меток (0 = fake, 1 = real)
            tokenizer:  токенизатор от HuggingFace (roberta-base)
            max_length: максимальная длина токенов (512 — лимит roberta)
        """
        self.texts      = list(texts)
        self.labels     = list(labels)
        self.tokenizer  = tokenizer
        self.max_length = max_length

    def __len__(self) -> int:
        return len(self.texts)

    def __getitem__(self, idx: int) -> dict:
        text  = str(self.texts[idx])
        label = int(self.labels[idx])

        # Токенизируем текст:
        # - truncation=True   — обрезаем если длиннее max_length
        # - padding="max_length" — добиваем до max_length если короче
        # - return_tensors="pt" — возвращаем PyTorch тензоры
        encoding = self.tokenizer(
            text,
            truncation=True,
            padding="max_length",
            max_length=self.max_length,
            return_tensors="pt",
        )

        # squeeze(0) убирает лишнее измерение батча которое добавляет токенизатор
        # было: [1, 512] → стало: [512]
        item = {k: v.squeeze(0) for k, v in encoding.items()}
        item["labels"] = torch.tensor(label, dtype=torch.long)

        return item