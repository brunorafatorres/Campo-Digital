import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import tensorflow as tf

ROOT = Path(__file__).resolve().parent
MODEL_DIR = Path(os.getenv("AI_MODEL_DIR", ROOT / "model"))
MODEL = tf.keras.models.load_model(MODEL_DIR / "category_model.keras")
METADATA = json.loads((MODEL_DIR / "labels.json").read_text(encoding="utf-8"))


def predict(payload):
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
            self.send_json(200, {"status": "ok", "service": "campodigital-ai", "model_loaded": True})
        else:
            self.send_json(404, {"message": "Rota não encontrada."})

    def do_POST(self):
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

    def log_message(self, fmt, *args):
        print(f"[campodigital-ai] {self.address_string()} - {fmt % args}")


if __name__ == "__main__":
    host = os.getenv("AI_HOST", "127.0.0.1")
    port = int(os.getenv("AI_PORT", "8001"))
    print(f"CampoDigital IA disponível em http://{host}:{port}")
    ThreadingHTTPServer((host, port), Handler).serve_forever()
