import csv
import json
import random
from pathlib import Path

import tensorflow as tf

ROOT = Path(__file__).resolve().parent
DATASET = ROOT / "data" / "training.csv"
MODEL_DIR = ROOT / "model"


def load_dataset():
    with DATASET.open(encoding="utf-8", newline="") as stream:
        rows = list(csv.DictReader(stream))
    random.Random(42).shuffle(rows)
    labels = sorted({row["categoria_chave"] for row in rows})
    label_index = {label: index for index, label in enumerate(labels)}
    texts = [row["descricao"] for row in rows]
    targets = [label_index[row["categoria_chave"]] for row in rows]
    types = {row["categoria_chave"]: row["tipo"] for row in rows}
    return texts, targets, labels, types


def train():
    tf.keras.utils.set_random_seed(42)
    texts, targets, labels, types = load_dataset()
    vectorizer = tf.keras.layers.TextVectorization(
        max_tokens=2_000,
        output_mode="int",
        output_sequence_length=16,
        standardize="lower_and_strip_punctuation",
    )
    vectorizer.adapt(tf.constant(texts))
    model = tf.keras.Sequential([
        tf.keras.Input(shape=(), dtype=tf.string),
        vectorizer,
        tf.keras.layers.Embedding(2_000, 24, mask_zero=True),
        tf.keras.layers.GlobalAveragePooling1D(),
        tf.keras.layers.Dense(32, activation="relu"),
        tf.keras.layers.Dense(len(labels), activation="softmax"),
    ])
    model.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    model.fit(tf.constant(texts), tf.constant(targets), epochs=120, verbose=0)

    MODEL_DIR.mkdir(exist_ok=True)
    model.save(MODEL_DIR / "category_model.keras")
    (MODEL_DIR / "labels.json").write_text(
        json.dumps({"labels": labels, "types": types}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Modelo treinado com {len(texts)} exemplos e {len(labels)} categorias.")


if __name__ == "__main__":
    train()
