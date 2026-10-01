# CampoDigital IA

Serviço auxiliar em Python e TensorFlow para sugerir categorias financeiras e analisar fotos de comprovantes. O backend Node.js continua funcionando quando este serviço está desligado.

## Preparação no Windows

```powershell
py -3.12 -m venv .venv312
.venv312\Scripts\python -m pip install --upgrade pip
.venv312\Scripts\python -m pip install -r requirements.txt
.venv312\Scripts\python train.py
.venv312\Scripts\python server.py
```

Use Python 3.12 para manter compatibilidade com os pacotes do TensorFlow utilizados no projeto.

## Leitura de comprovantes

A análise de imagem também precisa do programa Tesseract OCR instalado no Windows e do pacote de idioma português (`por`). Durante a instalação do Tesseract, inclua o idioma português e habilite o executável no `PATH`. Se ele não estiver no `PATH`, configure `TESSERACT_CMD` com o caminho completo, por exemplo:

```powershell
$env:TESSERACT_CMD = 'C:\Program Files\Tesseract-OCR\tesseract.exe'
```

O executável Tesseract precisa ser instalado à parte. A integração envia os bytes pela entrada padrão do processo, sem criar arquivos temporários com a imagem. `AI_OCR_LANGUAGE` pode trocar o idioma, mas o padrão é `por`.

O backend envia a imagem em memória ao serviço local. A IA tenta extrair fornecedor, data e total e sugere uma categoria. A leitura retorna um rascunho para revisão: não cria lançamento automaticamente e a imagem não é gravada em disco nem no banco. O limite é 5 MB, com JPEG, PNG e WebP. Erros/baixa confiança exigem conferência manual.

Os testes unitários do parser, que não exigem TensorFlow nem o executável Tesseract, podem ser executados com:

```powershell
.venv312\Scripts\python -m unittest test_invoice.py
```

O treinamento cria `model/category_model.keras` e `model/labels.json`. O serviço inicia em `http://127.0.0.1:8001`; `GET /health` confirma seu funcionamento.

O conjunto em `data/training.csv` é inicial e sintético. Antes da avaliação final, ele deve ser ampliado e documentado. Sugestões são apoio ao usuário e não assessoramento contábil.
