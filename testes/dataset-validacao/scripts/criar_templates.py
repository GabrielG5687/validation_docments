#!/usr/bin/env python3
"""Cria e publica no ValiDoc os dois templates usados nos testes.

Lê templates/*.json, cria cada template com sua estrutura de campos, cadastra
as regras na ordem do arquivo e publica a versão 1.0. Os ids criados ficam em
resultados/templates_criados.json, que o executar_testes.py usa.

Uso:
    export VALIDOC_API=https://validoc.ivanpires.dev   # ou http://localhost:3333
    export VALIDOC_EMAIL=...  VALIDOC_SENHA=...
    python criar_templates.py
    python criar_templates.py --recriar   # cria de novo mesmo se já existir um com o mesmo nome
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import requests

RAIZ = Path(__file__).resolve().parent.parent
ARQUIVOS = [RAIZ / "templates" / "template_plano_de_curso.json", RAIZ / "templates" / "template_diario_de_turma.json"]
SAIDA = RAIZ / "resultados" / "templates_criados.json"


class Api:
    def __init__(self, base: str, email: str, senha: str, empresa: str | None):
        self.base = base.rstrip("/")
        self.s = requests.Session()
        r = self.s.post(f"{self.base}/api/auth/login", json={"email": email, "senha": senha}, timeout=30)
        if r.status_code != 200:
            sys.exit(f"Falha no login ({r.status_code}): {r.text[:300]}")
        self.s.headers["Authorization"] = f"Bearer {r.json()['token']}"
        if empresa:
            self.s.headers["X-Empresa-Id"] = empresa

    def req(self, metodo: str, caminho: str, **kw):
        r = self.s.request(metodo, f"{self.base}{caminho}", timeout=60, **kw)
        if r.status_code >= 400:
            sys.exit(f"{metodo} {caminho} -> {r.status_code}: {r.text[:500]}")
        return r.json() if r.content else {}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--api", default=os.getenv("VALIDOC_API", "http://localhost:3333"))
    ap.add_argument("--email", default=os.getenv("VALIDOC_EMAIL"))
    ap.add_argument("--senha", default=os.getenv("VALIDOC_SENHA"))
    ap.add_argument("--empresa", default=os.getenv("VALIDOC_EMPRESA"), help="X-Empresa-Id (opcional)")
    ap.add_argument("--recriar", action="store_true")
    args = ap.parse_args()
    if not args.email or not args.senha:
        sys.exit("Informe --email e --senha (ou VALIDOC_EMAIL e VALIDOC_SENHA).")

    api = Api(args.api, args.email, args.senha, args.empresa)
    existentes = {t["nome"]: t["id"] for t in api.req("GET", "/api/templates").get("data", [])}
    criados = {}
    for arq in ARQUIVOS:
        spec = json.loads(arq.read_text(encoding="utf-8"))
        nome = spec["nome"]
        if nome in existentes and not args.recriar:
            print(f"= {nome}: já existe ({existentes[nome]}), mantido. Use --recriar para criar outro.")
            criados[nome] = existentes[nome]
            continue
        tpl = api.req("POST", "/api/templates", json={k: spec[k] for k in ("nome", "descricao", "categoria", "estrutura")})
        for regra in spec["regras"]:
            api.req("POST", f"/api/templates/{tpl['id']}/regras",
                    json={k: regra[k] for k in ("nome", "tipo", "parametros", "obrigatoria")})
        api.req("POST", f"/api/templates/{tpl['id']}/publicar")
        criados[nome] = tpl["id"]
        print(f"+ {nome}: criado e publicado ({tpl['id']}), {len(spec['regras'])} regras")

    SAIDA.parent.mkdir(exist_ok=True)
    SAIDA.write_text(json.dumps({"api": args.api, "templates": criados}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Ids salvos em {SAIDA}")


if __name__ == "__main__":
    main()
