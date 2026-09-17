# CampoDigital IA

Serviço auxiliar em Python e TensorFlow para sugerir categorias financeiras a partir da descrição. O backend Node.js continua funcionando quando este serviço está desligado.

## Preparação no Windows

```powershell
py -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements.txt
python train.py
python server.py
```

O treinamento cria `model/category_model.keras` e `model/labels.json`. O serviço inicia em `http://127.0.0.1:8001`; `GET /health` confirma seu funcionamento.

O conjunto em `data/training.csv` é inicial e sintético. Antes da avaliação final, ele deve ser ampliado e documentado. Sugestões são apoio ao usuário e não assessoramento contábil.
