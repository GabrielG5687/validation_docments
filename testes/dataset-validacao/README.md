# Dataset de testes do ValiDoc

Dataset sintético para medir se o ValiDoc encontra erros em Diários de Turma e Planos de Curso do SIGAA. Todos os nomes, matrículas, códigos e datas são fictícios. O passo a passo completo (criação dos templates, execução, métricas e texto-base para o TCC) está em [ROTEIRO.md](ROTEIRO.md).

## Conteúdo

| Pasta | O que tem |
|---|---|
| `pdfs/planos/` | 25 Planos de Curso: 7 corretos (controles) e 18 com erros |
| `pdfs/diarios/` | 25 Diários de Turma: 7 corretos e 18 com erros |
| `pdfs/robustez/` | 4 arquivos problemáticos: PDF escaneado, PDF corrompido, arquivo que não é PDF e cópia duplicada |
| `gabarito/gabarito.csv` | Um erro por linha: arquivo, descrição, onde está, regra que deve acusar e resultado esperado |
| `gabarito/gabarito.json` | O mesmo gabarito e os valores verdadeiros de cada campo de cada PDF |
| `templates/` | Especificação dos dois templates: campos, rótulos e 15 regras cada |
| `scripts/` | Criação dos templates, execução em lote, oráculo e cálculo das métricas |
| `gerador/` | Script que gera os PDFs e o gabarito (semente fixa 20261017) |
| `resultados/` | Saídas dos scripts (ids dos templates, execuções e métricas) |

Os nomes dos arquivos não revelam os erros. Consulte o gabarito só depois de rodar os testes.

## Uso rápido

```bash
cd testes/dataset-validacao
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

export VALIDOC_API=https://validoc.ivanpires.dev    # ou http://localhost:3333
export VALIDOC_EMAIL=seu-email  VALIDOC_SENHA=sua-senha

python scripts/oraculo.py               # 0. confere o gabarito (deve dar 0 divergências)
python scripts/criar_templates.py       # 1. cria e publica os 2 templates (ou crie à mão no Studio)
python scripts/executar_testes.py       # 2. envia os 54 arquivos pelo upload real
python scripts/calcular_metricas.py     # 3. gera resultados/metricas_*.md e os CSVs
```

Para regenerar o dataset: `python gerador/gerar_dataset.py` (exige `pdftoppm`, do pacote poppler-utils). Com a mesma semente o conteúdo se repete; com `--seed` outro número sai um novo sorteio.
