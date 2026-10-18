#!/usr/bin/env python3
"""Oráculo: aplica as regras dos templates aos valores verdadeiros do gabarito.

Reproduz em Python o motor de regras do ValiDoc (backend/src/services/
validationService.ts) e a normalização de datas do upload
(services/extracao/normalizadores.ts). Supõe extração perfeita: cada campo
recebe exatamente o valor impresso no PDF.

O resultado é o "status esperado" de cada regra em cada documento. A
diferença entre o oráculo e o sistema real mede os erros de extração; a
diferença entre o oráculo e o gabarito de erros mede a cobertura das regras.

Uso:
    python oraculo.py                   # imprime a matriz documento x regra
    python oraculo.py --modo studio     # sem normalização de datas (aba Teste do Studio)
"""
from __future__ import annotations

import argparse
import json
import re
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
TEMPLATES = {
    "Plano de Curso - SIGAA (testes)": RAIZ / "templates" / "template_plano_de_curso.json",
    "Diário de Turma - SIGAA (testes)": RAIZ / "templates" / "template_diario_de_turma.json",
}
PENDENCIAS = ("nao_encontrado", "extracao_conflitante", "nao_verificavel")


def carregar_templates() -> dict:
    return {nome: json.loads(p.read_text(encoding="utf-8")) for nome, p in TEMPLATES.items()}


def data_valida(valor: str) -> bool:
    m = re.fullmatch(r"(\d{1,2})[./-](\d{1,2})[./-](\d{4})", valor.strip())
    if not m:
        return False
    try:
        date(int(m[3]), int(m[2]), int(m[1]))
        return True
    except ValueError:
        return False


def eh_campo_data(chave: str) -> bool:
    c = chave.lower()
    return any(t in c for t in ("data", "emissao", "validade", "vencimento"))


def campos_da_regra(regra: dict) -> list[str]:
    p = regra["parametros"]
    if regra["tipo"] == "calculo":
        ids = re.findall(r"[A-Za-z_][A-Za-z0-9_]*", p.get("expressao", ""))
        return list(dict.fromkeys([p["campo_resultado"], *ids]))
    return [p["campo"]]


def avaliar(expr: str, dados: dict) -> float:
    def troca(m):
        return str(float(dados[m.group(0)]))
    numerica = re.sub(r"[A-Za-z_][A-Za-z0-9_]*", troca, expr)
    # Depois da troca a expressão só pode ter números e + - * / ( ); qualquer outra coisa é recusada.
    if not re.fullmatch(r"[\d.+\-*/() ]+", numerica):
        raise ValueError("expressão inválida")
    return float(eval(numerica, {"__builtins__": {}}))


def aplicar_regra(regra: dict, valores: dict, modo: str = "upload") -> str:
    """Devolve o status da regra: aprovado, nao_conforme, nao_encontrado ou nao_verificavel."""
    dados, invalidos = {}, set()
    for chave, valor in valores.items():
        if not valor:
            continue
        if modo == "upload" and eh_campo_data(chave) and not data_valida(valor):
            invalidos.add(chave)  # status sem_evidencia com valor -> nao_verificavel
            continue
        dados[chave] = valor
    campos = campos_da_regra(regra)
    faltando = [c for c in campos if not dados.get(c, "").strip()]
    if faltando:
        return "nao_verificavel" if any(c in invalidos for c in faltando) else "nao_encontrado"
    p, tipo = regra["parametros"], regra["tipo"]
    if tipo == "campo_obrigatorio":
        return "aprovado"
    if tipo == "formato":
        valor = dados[p["campo"]].strip()
        if re.search(p["regex"], valor):
            return "aprovado"
        if "/" in p["regex"] and data_valida(valor):
            return "aprovado"
        return "nao_conforme"
    if tipo == "intervalo":
        try:
            n = float(dados[p["campo"]])
        except ValueError:
            return "nao_verificavel"
        return "aprovado" if float(p["min"]) <= n <= float(p["max"]) else "nao_conforme"
    try:
        calc = avaliar(p["expressao"], dados)
        esperado = float(dados[p["campo_resultado"]])
    except (ValueError, KeyError, ZeroDivisionError, SyntaxError):
        return "nao_verificavel"
    return "aprovado" if abs(calc - esperado) <= float(p.get("tolerancia", 0)) else "nao_conforme"


def decisao(statuses: dict) -> str:
    if any(s == "nao_conforme" for s in statuses.values()):
        return "reprovado"
    if any(s in PENDENCIAS for s in statuses.values()):
        return "inconclusivo"
    return "aprovado"


def oraculo(gabarito: dict, modo: str = "upload") -> dict:
    """{arquivo: {"regras": {codigo: status}, "decisao": ...}} para documentos com template."""
    templates = carregar_templates()
    saida = {}
    for doc in gabarito["documentos"]:
        if doc["categoria"] == "robustez":
            continue
        tpl = templates[doc["template"]]
        regras = {r["codigo"]: aplicar_regra(r, doc["esperado"], modo) for r in tpl["regras"]}
        saida[doc["arquivo"]] = {"regras": regras, "decisao": decisao(regras)}
    return saida


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--modo", choices=["upload", "studio"], default="upload")
    args = ap.parse_args()
    gab = json.loads((RAIZ / "gabarito" / "gabarito.json").read_text(encoding="utf-8"))
    res = oraculo(gab, args.modo)
    cat = gab["catalogo_erros"]
    abrev = {"aprovado": ".", "nao_conforme": "X", "nao_encontrado": "?", "nao_verificavel": "~"}
    print("Legenda: . aprovado | X nao_conforme | ? nao_encontrado | ~ nao_verificavel\n")
    divergencias = 0
    for doc in gab["documentos"]:
        if doc["arquivo"] not in res:
            continue
        r = res[doc["arquivo"]]
        linha = "".join(abrev[s] for s in r["regras"].values())
        alertas = []
        for e in doc["erros"]:
            c = cat[e]
            if c["regra"] == "-":
                continue
            obtido = r["regras"][c["regra"]]
            if obtido != c["status"]:
                alertas.append(f"{e}: {c['regra']} deu {obtido}, gabarito diz {c['status']}")
        if doc["categoria"] == "controle" and r["decisao"] != "aprovado":
            alertas.append("controle não aprovado")
        divergencias += len(alertas)
        nome = Path(doc["arquivo"]).name[:3]
        print(f"{nome}  {linha}  {r['decisao']:<12} {','.join(doc['erros']) or 'controle':<10} {'; '.join(alertas)}")
    print(f"\nDivergências entre oráculo e gabarito: {divergencias}")


if __name__ == "__main__":
    main()
