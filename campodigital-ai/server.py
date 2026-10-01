import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from invoice import MAX_IMAGE_BYTES, analyze_invoice

ROOT = Path(__file__).resolve().parent
MODEL_DIR = Path(os.getenv("AI_MODEL_DIR", ROOT / "model"))


class ModelUnavailableError(Exception):
    """The category model could not be loaded; invoice OCR can still run."""


tf = None
MODEL = None
METADATA = None
MODEL_ERROR = None
try:
    import tensorflow as tf

    MODEL = tf.keras.models.load_model(MODEL_DIR / "category_model.keras")
    METADATA = json.loads((MODEL_DIR / "labels.json").read_text(encoding="utf-8"))
except Exception as error:
    # TensorFlow uses native Windows DLLs. A managed Windows policy can block
    # them; keep the HTTP service alive so the independent OCR route still works.
    MODEL_ERROR = error


def predict(payload):
    if MODEL is None or tf is None or METADATA is None:
        raise ModelUnavailableError("Sugestões por modelo estão indisponíveis neste ambiente.")

    description = str(payload.get("descripcion", "")).strip()
    movement_type = str(payload.get("tipo", "")).strip().upper()
    available = set(payload.get("categorias_disponiveis") or [])
    if not 2 <= len(description) <= 255 or movement_type not in {"INGRESO", "GASTO"}:
        raise ValueError("Descrição ou tipo inválido.")

    probabilities = MODEL.predict(tf.constant([description]), verbose=0)[0].tolist()
    ranked = sorted(zip(METADATA["labels"], probabilities), key=lambda item: item[1], reverse=True)
    for key, probability in ranked:
        if METADATA["types"].get(key) == movement_type and key in available:
            return {
                "categoria_chave": key,
                "confianca": round(float(probability) * 100, 2),
                "gerada_por_ia": True,
            }
    raise LookupError("Nenhuma categoria compatível disponível.")


class Handler(BaseHTTPRequestHandler):
    def send_json(self, status, body):
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/health":
            self.send_json(200, {
                "status": "ok",
                "service": "campodigital-ai",
                "model_loaded": MODEL is not None,
                "invoice_endpoint": True,
            })
        else:
            self.send_json(404, {"message": "Rota não encontrada."})

    def do_POST(self):
        if self.path == "/read-invoice":
            self.read_invoice()
            return
        if self.path != "/suggest":
            self.send_json(404, {"message": "Rota não encontrada."})
            return
        try:
            length = int(self.headers.get("content-length", "0"))
            if length <= 0 or length > 16_384:
                raise ValueError("Corpo inválido.")
            payload = json.loads(self.rfile.read(length))
            self.send_json(200, predict(payload))
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json(400, {"message": str(error)})
        except LookupError as error:
            self.send_json(422, {"message": str(error)})
        except ModelUnavailableError as error:
            self.send_json(503, {"message": str(error)})

    def read_invoice(self):
        content_type = self.headers.get("content-type", "").split(";")[0].strip().lower()
        try:
            length = int(self.headers.get("content-length", "0"))
            if length <= 0 or length > MAX_IMAGE_BYTES:
                raise ValueError("A imagem está vazia ou excede o limite de 5 MB.")
            result = analyze_invoice(self.rfile.read(length), content_type)
            self.send_json(200, result)
        except ValueError as error:
            self.send_json(400, {"message": str(error)})
        except Exception as error:
            print(f"[campodigital-ai] Falha na leitura do comprovante: {error}")
            self.send_json(503, {"message": "Não foi possível ler a imagem. Confira se o Tesseract e o idioma português estão instalados."})

    def log_message(self, fmt, *args):
        print(f"[campodigital-ai] {self.address_string()} - {fmt % args}")


if __name__ == "__main__":
    host = os.getenv("AI_HOST", "127.0.0.1")
    port = int(os.getenv("AI_PORT", "8001"))
    print(f"CampoDigital IA disponível em http://{host}:{port}")
    if MODEL is None:
        print(
            "[campodigital-ai] Aviso: TensorFlow/modelo indisponível; "
            "sugestões de categoria desativadas. A rota de OCR continua ativa. "
            f"Detalhe: {MODEL_ERROR}"
        )
    ThreadingHTTPServer((host, port), Handler).serve_forever()
