"""Extração local e conservadora de campos de comprovantes fiscais."""

import csv
from datetime import datetime
from decimal import Decimal, InvalidOperation
from io import BytesIO, StringIO
import os
import re
import subprocess


MAX_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}


def _parse_date(text):
    match = re.search(r"\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b", text)
    if not match:
        return None
    day, month, year = map(int, match.groups())
    if year < 100:
        year += 2000 if year < 70 else 1900
    try:
        return datetime(year, month, day).strftime("%Y-%m-%d")
    except ValueError:
        return None


def _parse_amount(text):
    money = r"(?:R\$\s*)?(\d[\d.,]*)"
    total_labels = r"\b(?:VALOR\s+TOTAL|TOTAL\s+A\s+PAGAR|TOTAL\s+PAGO|TOTAL|VL\.?\s*TOTAL)\b"
    for line in text.splitlines():
        if re.search(total_labels, line, re.IGNORECASE):
            amounts = re.findall(money, line, re.IGNORECASE)
            if amounts:
                try:
                    normalized = amounts[-1]
                    if "." in normalized and "," in normalized:
                        if normalized.rfind(",") > normalized.rfind("."):
                            normalized = normalized.replace(".", "").replace(",", ".")
                        else:
                            normalized = normalized.replace(",", "")
                    elif "," in normalized:
                        normalized = normalized.replace(",", ".") \
                            if len(normalized.rsplit(",", 1)[1]) == 2 else normalized.replace(",", "")
                    elif "." in normalized and len(normalized.rsplit(".", 1)[1]) != 2:
                        normalized = normalized.replace(".", "")
                    value = Decimal(normalized)
                    if value > 0:
                        return f"{value:.2f}"
                except (InvalidOperation, ValueError):
                    pass
    return None


def parse_invoice_text(text, confidence=0):
    lines = [re.sub(r"\s+", " ", line).strip(" -|:") for line in text.splitlines()]
    lines = [line for line in lines if line]
    ignored = re.compile(
        r"(CNPJ|CPF|DANFE|NOTA FISCAL|CUPOM|DOCUMENTO AUXILIAR|\bCEP\b|\bIE\b|\d{2}[/.-]\d{2}[/.-]\d{2,4})",
        re.IGNORECASE,
    )
    supplier = next((line[:120] for line in lines if len(line) >= 3 and not ignored.search(line)), None)
    return {
        "fornecedor": supplier,
        "data": _parse_date(text),
        "valor": _parse_amount(text),
        "confianca_leitura": round(max(0, min(100, float(confidence))), 2),
        "campos_extraidos": {
            "fornecedor": supplier is not None,
            "data": _parse_date(text) is not None,
            "valor": _parse_amount(text) is not None,
        },
        "texto_detectado": text[:4000],
    }


def analyze_invoice(image_bytes, content_type):
    from PIL import Image, ImageOps

    if content_type not in ALLOWED_TYPES:
        raise ValueError("Envie uma imagem JPEG, PNG ou WebP.")
    if not image_bytes or len(image_bytes) > MAX_IMAGE_BYTES:
        raise ValueError("A imagem está vazia ou excede o limite de 5 MB.")

    try:
        image = Image.open(BytesIO(image_bytes))
        image.verify()
        image = Image.open(BytesIO(image_bytes))
        image = ImageOps.exif_transpose(image).convert("L")
    except Exception as error:
        raise ValueError("O arquivo enviado não é uma imagem válida.") from error

    if image.width * image.height > 25_000_000:
        raise ValueError("A resolução da imagem excede o limite permitido.")

    tesseract_command = os.getenv("TESSERACT_CMD", "tesseract")
    language = os.getenv("AI_OCR_LANGUAGE", "por")
    prepared = BytesIO()
    image.save(prepared, format="PNG")
    result = subprocess.run(
        [tesseract_command, "stdin", "stdout", "-l", language, "--psm", "6", "tsv"],
        input=prepared.getvalue(),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=30,
        check=False,
    )
    if result.returncode != 0:
        detail = result.stderr.decode("utf-8", errors="replace")[:300]
        raise RuntimeError(detail or "Falha ao executar Tesseract OCR.")

    tsv = csv.DictReader(StringIO(result.stdout.decode("utf-8", errors="replace")), delimiter="\t")
    words_by_line = {}
    confidences = []
    for row in tsv:
        if row.get("level") != "5" or not row.get("text", "").strip():
            continue
        key = (row.get("page_num"), row.get("block_num"), row.get("par_num"), row.get("line_num"))
        words_by_line.setdefault(key, []).append(row["text"].strip())
        try:
            confidence = float(row["conf"])
            if confidence >= 0:
                confidences.append(confidence)
        except (TypeError, ValueError):
            continue
    text = "\n".join(" ".join(words) for words in words_by_line.values())
    average = sum(confidences) / len(confidences) if confidences else 0
    return parse_invoice_text(text, average)
