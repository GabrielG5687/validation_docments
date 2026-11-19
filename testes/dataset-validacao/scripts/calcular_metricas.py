#!/usr/bin/env python3
"""Compara uma execução do ValiDoc com o gabarito e calcula as métricas do TCC.

Três referências:
  1. Gabarito de erros: cada erro injetado e a regra que deve acusá-lo.
  2. Oráculo (oraculo.py): status de cada regra com extração perfeita.
  3. Valores verdadeiros de cada campo: medem a extração.

Uso:
    python calcular_metricas.py                                   # usa a execução mais recente
    python calcular_metricas.py resultados/execucao_upload_X.json
    python calcular_metricas.py parte1.json parte2.json         # une execuções parciais

Saídas em resultados/:
    metricas_<execucao>.md         tabelas prontas para o TCC
    regras_<execucao>.csv          uma linha por documento x regra
    erros_<execucao>.csv           uma linha por erro injetado
    extracao_<execucao>.csv        uma linha por documento x campo
"""
from __future__ import annotations

import csv
import difflib
import json
import re
import statistics
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from oraculo import oraculo  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent


def pct(a, b):
    return f"{100 * a / b:.1f}%" if b else "-"


def razao(a, b):
    return a / b if b else 0.0


def norm(v) -> str:
    v = unicodedata.normalize("NFC", str(v or "")).strip().lower()
    return re.sub(r"\s+", " ", v).strip(" .;:")


def norm_data(v: str) -> str:
    m = re.fullmatch(r"(\d{1,2})[./-](\d{1,2})[./-](\d{4})", v)
    return f"{int(m[1]):02d}/{int(m[2]):02d}/{m[3]}" if m else v


def comparar(esperado: str, obtido: str) -> str:
    e, o = norm(esperado), norm(obtido)
    if not e:
        return "ausente_ok" if not o else "inventado"
    if not o:
        return "nao_extraido"
    if norm_data(e) == norm_data(o):
        return "correto"
    try:
        if float(e.replace(",", ".")) == float(o.replace(",", ".")):
            return "correto"
    except ValueError:
        pass
    if len(e) >= 12 and len(o) >= 8 and (o in e or e in o):
        return "correto"
    if difflib.SequenceMatcher(None, e, o).ratio() >= 0.9:
        return "correto"
    return "divergente"


def decisao_sistema(reg: dict) -> str:
    if reg.get("http_upload", 200) >= 400:
        return f"http_{reg['http_upload']}"
    st = reg.get("status_documento")
    if st == "erro_extracao":
        return "erro_extracao"
    if st == "timeout":
        return "timeout"
    if st == "reprovado_automatico" or reg.get("resultado_validacao") == "reprovado":
        return "reprovado"
    return reg.get("resultado_validacao") or "inconclusivo"


def tabela(cab, linhas):
    out = ["| " + " | ".join(cab) + " |", "|" + "|".join("---" for _ in cab) + "|"]
    out += ["| " + " | ".join(str(c) for c in l) + " |" for l in linhas]
    return "\n".join(out)


def main():
    if len(sys.argv) > 1:
        arquivos = [Path(a) if Path(a).is_absolute() or Path(a).exists() else RAIZ / a for a in sys.argv[1:]]
    else:
        execucoes = sorted((RAIZ / "resultados").glob("execucao_*.json"), key=lambda p: p.stat().st_mtime)
        if not execucoes:
            sys.exit("Nenhuma execução em resultados/. Rode executar_testes.py antes.")
        arquivos = [execucoes[-1]]
    # Várias execuções parciais (ex.: rodadas com --filtro) são unidas; a última vence em caso de repetição.
    arq = arquivos[0]
    exe = json.loads(arq.read_text(encoding="utf-8"))
    for extra in arquivos[1:]:
        outra = json.loads(extra.read_text(encoding="utf-8"))
        exe["documentos"].update(outra["documentos"])
        exe["fim"] = outra.get("fim", exe.get("fim"))
    gab = json.loads((RAIZ / "gabarito" / "gabarito.json").read_text(encoding="utf-8"))
    cat = gab["catalogo_erros"]
    orc = oraculo(gab, "studio" if exe["modo"] == "studio" else "upload")
    tag = arq.stem.replace("execucao_", "")
    docs = [d for d in gab["documentos"] if d["arquivo"] in exe["documentos"]]
    md = [f"# Resultados do teste do ValiDoc ({exe['modo']}, rodada {exe.get('repeticao', '1')})", "",
          f"Execução de {exe['inicio']} a {exe.get('fim', '?')} contra {exe['api']}. "
          f"Arquivo bruto: `{arq.name}`.", ""]

    # 1. Avaliação regra a regra contra o oráculo
    linhas_regras, conf = [], defaultdict(Counter)
    for d in docs:
        if d["categoria"] == "robustez":
            continue
        reg = exe["documentos"][d["arquivo"]]
        esperado = orc[d["arquivo"]]["regras"]
        for codigo, st_esp in esperado.items():
            st_obt = (reg.get("regras") or {}).get(codigo, {}).get("status", "sem_resultado")
            pos_esp, pos_obt = st_esp != "aprovado", st_obt != "aprovado"
            celula = {(True, True): "VP", (False, True): "FP", (True, False): "FN", (False, False): "VN"}[(pos_esp, pos_obt)]
            for chave in ("geral", d["tipo_documento"]):
                conf[chave][celula] += 1
            linhas_regras.append([d["arquivo"], d["categoria"], codigo, st_esp, st_obt, celula,
                                  (reg.get("regras") or {}).get(codigo, {}).get("valor", ""),
                                  (reg.get("regras") or {}).get(codigo, {}).get("criterio", "")])
    with open(RAIZ / "resultados" / f"regras_{tag}.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["arquivo", "categoria", "regra", "status_esperado", "status_obtido", "classificacao", "valor", "criterio"])
        w.writerows(linhas_regras)

    def metr(c):
        vp, fp, fn, vn = c["VP"], c["FP"], c["FN"], c["VN"]
        p, r = razao(vp, vp + fp), razao(vp, vp + fn)
        f1 = 2 * p * r / (p + r) if p + r else 0.0
        return [vp, fp, fn, vn, f"{p:.3f}", f"{r:.3f}", f"{f1:.3f}", f"{razao(vp + vn, vp + fp + fn + vn):.3f}"]

    md += ["## 1. Regras: sistema x oráculo", "",
           "Cada par documento x regra conta uma vez. Positivo = regra não aprovada. "
           "O oráculo aplica as mesmas regras aos valores verdadeiros do PDF.", "",
           tabela(["Recorte", "VP", "FP", "FN", "VN", "Precisão", "Revocação", "F1", "Acurácia"],
                  [[k] + metr(conf[k]) for k in ["geral", "Plano de Curso", "Diário de Turma"] if conf[k]]), ""]

    # 2. Detecção de cada erro injetado
    linhas_erros, por_erro = [], defaultdict(list)
    for d in docs:
        if d["categoria"] != "erro":
            continue
        reg = exe["documentos"][d["arquivo"]]
        for e in d["erros"]:
            c = cat[e]
            if c["regra"] == "-":
                obtido = decisao_sistema(reg)
                detectado = "sinalizado" if obtido != "aprovado" else "não"
                status = f"decisão {obtido}"
            else:
                status = (reg.get("regras") or {}).get(c["regra"], {}).get("status", "sem_resultado")
                detectado = "sim" if status == c["status"] else ("parcial" if status != "aprovado" else "não")
            por_erro[e].append((detectado, status))
            linhas_erros.append([d["arquivo"], e, c["desc"], c["classe"], c["regra"], c["status"], status, detectado])
    with open(RAIZ / "resultados" / f"erros_{tag}.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["arquivo", "erro", "descricao", "classe", "regra_alvo", "status_esperado", "status_obtido", "detectado"])
        w.writerows(linhas_erros)

    linhas = []
    tot = Counter()
    for e in sorted(por_erro):
        res = por_erro[e]
        sim = sum(1 for x, _ in res if x in ("sim", "sinalizado"))
        parcial = sum(1 for x, _ in res if x == "parcial")
        tot[cat[e]["classe"] + "_n"] += len(res)
        tot[cat[e]["classe"] + "_det"] += sim + parcial
        linhas.append([e, cat[e]["desc"], cat[e]["classe"], cat[e]["regra"], cat[e]["status"], len(res), sim, parcial,
                       ", ".join(sorted({s for _, s in res}))])
    md += ["## 2. Detecção por erro injetado", "",
           "Sim = regra-alvo com o status esperado; Parcial = regra-alvo não aprovada, com outro status. "
           "Na classe limitacao nenhuma regra cobre o erro: Sim conta documentos sinalizados por outra regra, "
           "o que não é detecção do erro.", "",
           tabela(["Erro", "Descrição", "Classe", "Regra", "Esperado", "Casos", "Sim", "Parcial", "Status obtidos"], linhas), "",
           tabela(["Classe", "Casos", "Detectados (sim + parcial)", "Taxa"],
                  [[k, tot[k + "_n"], tot[k + "_det"], pct(tot[k + "_det"], tot[k + "_n"])]
                   for k in ("regra", "ia", "limitacao") if tot[k + "_n"]]), ""]

    # 3. Decisão por documento
    rotulos = ["aprovado", "inconclusivo", "reprovado"]
    matriz, outros = Counter(), Counter()
    ctl_ok = ctl_n = err_sin = err_n = 0
    for d in docs:
        if d["categoria"] == "robustez":
            continue
        esp = orc[d["arquivo"]]["decisao"]
        obt = decisao_sistema(exe["documentos"][d["arquivo"]])
        if obt in rotulos:
            matriz[(esp, obt)] += 1
        else:
            outros[obt] += 1
        if d["categoria"] == "controle":
            ctl_n += 1
            ctl_ok += obt == "aprovado"
        else:
            err_n += 1
            err_sin += obt != "aprovado"
    md += ["## 3. Decisão por documento", "",
           f"Controles aprovados sem pendência: {ctl_ok} de {ctl_n} ({pct(ctl_ok, ctl_n)}). "
           f"Documentos com erro sinalizados (reprovados ou inconclusivos): {err_sin} de {err_n} ({pct(err_sin, err_n)}).", "",
           "Linhas = decisão esperada pelo oráculo; colunas = decisão do sistema.", "",
           tabela(["Esperado \\ Obtido"] + rotulos, [[e] + [matriz[(e, o)] for o in rotulos] for e in rotulos]), ""]
    if outros:
        md += ["Outros desfechos: " + ", ".join(f"{k}: {v}" for k, v in outros.items()), ""]

    # 4. Extração campo a campo
    linhas_ext, por_campo = [], defaultdict(Counter)
    for d in docs:
        if d["categoria"] == "robustez":
            continue
        valores = exe["documentos"][d["arquivo"]].get("valores") or {}
        for campo, esperado in d["esperado"].items():
            obtido = valores.get(campo, "")
            r = comparar(esperado, obtido)
            por_campo[(d["tipo_documento"], campo)][r] += 1
            linhas_ext.append([d["arquivo"], campo, esperado, obtido, r])
    with open(RAIZ / "resultados" / f"extracao_{tag}.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["arquivo", "campo", "valor_esperado", "valor_extraido", "resultado"])
        w.writerows(linhas_ext)
    linhas = []
    for (tipo, campo), c in sorted(por_campo.items()):
        n = sum(c.values())
        certos = c["correto"] + c["ausente_ok"]
        linhas.append([tipo, campo, n, c["correto"], c["ausente_ok"], c["nao_extraido"], c["divergente"], c["inventado"], pct(certos, n)])
    total = Counter()
    for c in por_campo.values():
        total.update(c)
    n = sum(total.values())
    md += ["## 4. Extração de campos", "",
           f"Acurácia geral: {pct(total['correto'] + total['ausente_ok'], n)} de {n} campos. "
           f"Valores inventados para campos em branco: {total['inventado']}.", "",
           tabela(["Documento", "Campo", "N", "Correto", "Branco ok", "Não extraído", "Divergente", "Inventado", "Acurácia"], linhas), ""]

    # 5. Robustez
    linhas = []
    for d in docs:
        if d["categoria"] != "robustez":
            continue
        reg = exe["documentos"][d["arquivo"]]
        obtido = decisao_sistema(reg)
        if reg.get("reenviado"):
            original = next((r for a, r in exe["documentos"].items()
                             if a.endswith(d["arquivo"].split("_copia_identica_de_")[-1]) and a != d["arquivo"]), {})
            obtido += f", reenviado=true, mesmo id do original: {'sim' if original.get('documento_id') == reg.get('documento_id') else 'não'}"
        if reg.get("erro_http"):
            obtido += f" ({reg['erro_http']})"
        if reg.get("erro_extracao"):
            obtido += f" ({reg['erro_extracao']})"
        linhas.append([d["erros"][0], cat[d["erros"][0]]["desc"], d["resultado_esperado_robustez"], obtido])
    if linhas:
        md += ["## 5. Robustez", "", tabela(["Caso", "Arquivo", "Esperado", "Obtido"], linhas), ""]

    # 6. Tempo
    tempos = [r["segundos"] for a, r in exe["documentos"].items() if r.get("segundos") is not None
              and decisao_sistema(r) in rotulos]
    if tempos:
        md += ["## 6. Tempo de processamento", "",
               tabela(["Documentos", "Média (s)", "Mediana (s)", "Mínimo (s)", "Máximo (s)"],
                      [[len(tempos), f"{statistics.mean(tempos):.1f}", f"{statistics.median(tempos):.1f}",
                        f"{min(tempos):.1f}", f"{max(tempos):.1f}"]]), "",
               "O tempo inclui a espera entre consultas de status (parâmetro --poll do executar_testes.py).", ""]

    destino = RAIZ / "resultados" / f"metricas_{tag}.md"
    destino.write_text("\n".join(md), encoding="utf-8")
    print("\n".join(md))
    print(f"\nRelatório: {destino}")


if __name__ == "__main__":
    main()
