#!/usr/bin/env python3
"""Envia todos os PDFs do dataset ao ValiDoc e guarda as respostas brutas.

Modos:
  upload  (padrão) pipeline real: POST /api/documentos/upload e consulta o
          documento até sair de 'processando'. Extração por páginas, evidência
          no texto, normalização de datas e decisão automática. É o modo que
          vale para o TCC.
  studio  aba Teste do Studio: POST /api/templates/:id/testar. Resposta
          imediata, sem normalização nem verificação de evidência. Serve
          como teste rápido e para comparar com o upload.

Uso:
    python executar_testes.py                      # modo upload, todos os arquivos
    python executar_testes.py --modo studio
    python executar_testes.py --filtro D0          # só arquivos cujo nome contém D0
    python executar_testes.py --repeticao 2        # rótulo para rodadas repetidas

Saída: resultados/execucao_<modo>_<data-hora>.json
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import requests

RAIZ = Path(__file__).resolve().parent.parent
FINAIS = {"aguardando_revisao", "em_revisao", "aprovado", "reprovado", "reprovado_automatico", "erro_extracao"}


class Api:
    def __init__(self, base, email, senha, empresa):
        self.base = base.rstrip("/")
        self.s = requests.Session()
        r = self.s.post(f"{self.base}/api/auth/login", json={"email": email, "senha": senha}, timeout=30)
        if r.status_code != 200:
            sys.exit(f"Falha no login ({r.status_code}): {r.text[:300]}")
        self.s.headers["Authorization"] = f"Bearer {r.json()['token']}"
        if empresa:
            self.s.headers["X-Empresa-Id"] = empresa

    def req(self, metodo, caminho, **kw):
        """Faz a requisição respeitando o limite de 100 req/min da API."""
        for tentativa in range(5):
            r = self.s.request(metodo, f"{self.base}{caminho}", timeout=180, **kw)
            if r.status_code != 429:
                time.sleep(0.7)
                return r
            espera = 20 * (tentativa + 1)
            print(f"   limite de requisições atingido, aguardando {espera}s")
            time.sleep(espera)
        return r


def codigo_regra(nome: str) -> str:
    return nome.split(" ")[0]


def enviar_upload(api: Api, caminho: Path, template_id: str, poll: float, limite: float) -> dict:
    inicio = time.monotonic()
    with open(caminho, "rb") as f:
        r = api.req("POST", "/api/documentos/upload",
                    files={"arquivo": (caminho.name, f, "application/pdf")}, data={"templateId": template_id})
    reg = {"http_upload": r.status_code}
    try:
        corpo = r.json()
    except ValueError:
        corpo = {"texto": r.text[:500]}
    if r.status_code >= 400:
        reg.update(erro_http=corpo.get("error") or corpo, segundos=round(time.monotonic() - inicio, 1))
        return reg
    doc_id = corpo["id"]
    reg.update(documento_id=doc_id, reenviado=bool(corpo.get("reenviado")))
    detalhe = {}
    while time.monotonic() - inicio < limite:
        time.sleep(poll)
        d = api.req("GET", f"/api/documentos/{doc_id}")
        if d.status_code == 200:
            detalhe = d.json()
            if detalhe.get("status") in FINAIS:
                break
    reg["segundos"] = round(time.monotonic() - inicio, 1)
    reg["status_documento"] = detalhe.get("status", "timeout")
    validacao = (detalhe.get("validacoes") or [{}])[0]
    reg["resultado_validacao"] = validacao.get("resultado")
    reg["parecer_ia"] = validacao.get("parecerIa")
    reg["observacoes"] = validacao.get("observacoes")
    reg["regras"] = {
        codigo_regra(rr["regra"]["nome"]): {
            "status": rr["status"], "valor": rr.get("valorEncontrado"), "criterio": rr.get("criterio"),
            "explicacao_ia": rr.get("explicacaoIa"),
        }
        for rr in validacao.get("resultadosRegra") or []
    }
    dados = detalhe.get("dadosExtraidos") or {}
    reg["valores"] = {k: v for k, v in dados.items() if not k.startswith("_") and isinstance(v, str)}
    extracao = dados.get("_extracao") or {}
    reg["extracao"] = {
        c["chave"]: {"status": c.get("status"), "origem": c.get("origem"), "bruto": c.get("valorBruto")}
        for c in extracao.get("campos", [])
    }
    reg["ia_status"] = extracao.get("iaStatus") or extracao.get("ia")
    reg["erro_extracao"] = dados.get("erroExtracao")
    return reg


def enviar_studio(api: Api, caminho: Path, template_id: str) -> dict:
    inicio = time.monotonic()
    with open(caminho, "rb") as f:
        r = api.req("POST", f"/api/templates/{template_id}/testar",
                    files={"arquivo": (caminho.name, f, "application/pdf")})
    reg = {"http_upload": r.status_code, "segundos": round(time.monotonic() - inicio, 1)}
    try:
        corpo = r.json()
    except ValueError:
        corpo = {"texto": r.text[:500]}
    if r.status_code >= 400:
        reg["erro_http"] = corpo.get("error") or corpo
        return reg
    reg["resultado_validacao"] = corpo.get("resultado")
    reg["status_documento"] = {"reprovado": "reprovado_automatico"}.get(corpo.get("resultado"), "aguardando_revisao")
    reg["regras"] = {codigo_regra(x["nome"]): {"status": x["status"], "valor": x.get("valorEncontrado"),
                                               "criterio": x.get("criterio")} for x in corpo.get("resultados", [])}
    reg["valores"] = corpo.get("valores") or {}
    reg["resumo_ia"] = corpo.get("resumo")
    return reg


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--api", default=os.getenv("VALIDOC_API"))
    ap.add_argument("--email", default=os.getenv("VALIDOC_EMAIL"))
    ap.add_argument("--senha", default=os.getenv("VALIDOC_SENHA"))
    ap.add_argument("--empresa", default=os.getenv("VALIDOC_EMPRESA"))
    ap.add_argument("--modo", choices=["upload", "studio"], default="upload")
    ap.add_argument("--filtro", default="", help="processa só arquivos cujo nome contém este texto")
    ap.add_argument("--repeticao", default="1", help="rótulo da rodada (para repetir o teste e medir variação)")
    ap.add_argument("--poll", type=float, default=3.0, help="segundos entre consultas de status")
    ap.add_argument("--limite", type=float, default=240.0, help="tempo máximo por documento, em segundos")
    args = ap.parse_args()

    criados = json.loads((RAIZ / "resultados" / "templates_criados.json").read_text(encoding="utf-8"))
    api_url = args.api or criados.get("api") or "http://localhost:3333"
    if not args.email or not args.senha:
        sys.exit("Informe --email e --senha (ou VALIDOC_EMAIL e VALIDOC_SENHA).")
    api = Api(api_url, args.email, args.senha, args.empresa)
    gabarito = json.loads((RAIZ / "gabarito" / "gabarito.json").read_text(encoding="utf-8"))

    docs = [d for d in gabarito["documentos"] if args.filtro in Path(d["arquivo"]).name]
    docs.sort(key=lambda d: d["categoria"] == "robustez")  # robustez por último: R04 depende do original
    if args.modo == "studio":
        docs = [d for d in docs if d["categoria"] != "robustez"]

    execucao = {"modo": args.modo, "api": api_url, "repeticao": args.repeticao,
                "inicio": datetime.now().isoformat(timespec="seconds"), "templates": criados["templates"],
                "documentos": {}}
    for i, d in enumerate(docs, 1):
        caminho = RAIZ / d["arquivo"]
        template_id = criados["templates"][d["template"]]
        print(f"[{i:02d}/{len(docs)}] {caminho.name}", flush=True)
        if args.modo == "upload":
            reg = enviar_upload(api, caminho, template_id, args.poll, args.limite)
        else:
            reg = enviar_studio(api, caminho, template_id)
        execucao["documentos"][d["arquivo"]] = reg
        falhas = [c for c, r in (reg.get("regras") or {}).items() if r["status"] != "aprovado"]
        print(f"         {reg.get('status_documento') or reg.get('http_upload')}"
              f" {reg.get('resultado_validacao') or ''} {reg.get('segundos')}s"
              f"{'  regras: ' + ', '.join(falhas) if falhas else ''}", flush=True)

    execucao["fim"] = datetime.now().isoformat(timespec="seconds")
    carimbo = datetime.now().strftime("%Y%m%d-%H%M%S")
    destino = RAIZ / "resultados" / f"execucao_{args.modo}_{carimbo}.json"
    destino.write_text(json.dumps(execucao, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nRespostas salvas em {destino}")
    print("Próximo passo: python calcular_metricas.py " + str(destino.relative_to(RAIZ)))


if __name__ == "__main__":
    main()
