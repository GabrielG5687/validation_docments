#!/usr/bin/env python3
"""Gera o dataset sintético de testes do ValiDoc.

Reproduz o layout dos Diários de Turma e Planos de Curso emitidos pelo SIGAA,
com dados fictícios e aleatórios. Parte dos documentos recebe erros
propositais; o gabarito registra cada erro, a regra que deve detectá-lo e o
resultado esperado.

Uso:
    python gerar_dataset.py                 # semente padrão, saída em ../
    python gerar_dataset.py --seed 123      # outro sorteio
    python gerar_dataset.py --saida /tmp/x  # outra pasta
"""
from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import json
import random
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

SEED_PADRAO = 20261017
RODAPE = "Documento sintético - dados fictícios gerados para testes do ValiDoc"

# ─── Pools de dados fictícios ────────────────────────────────────────────────

NOMES = [
    "ANA", "BRUNO", "CAMILA", "DANIEL", "EDUARDA", "FELIPE", "GABRIELA", "HEITOR",
    "ISABELA", "JOÃO", "KAUAN", "LARISSA", "MATEUS", "NATÁLIA", "OTÁVIO", "PAULA",
    "RAFAEL", "SABRINA", "TIAGO", "VALENTINA", "WESLEY", "YASMIN", "ARTHUR", "BEATRIZ",
    "CAIO", "DÉBORA", "ENZO", "FERNANDA", "GUSTAVO", "HELENA", "IGOR", "JÚLIA",
    "LEONARDO", "MARIANA", "NICOLAS", "PEDRO", "RENATA", "SAMUEL", "TALITA", "VINÍCIUS",
]
NOMES_MEIO = ["", "", "", "", "DA SILVA", "DOS SANTOS", "DE SOUZA", "DE OLIVEIRA"]
SOBRENOMES = [
    "ALMEIDA", "BARBOSA", "CARDOSO", "DIAS", "FERREIRA", "GOMES", "LIMA", "MARTINS",
    "NASCIMENTO", "OLIVEIRA", "PEREIRA", "RIBEIRO", "SANTOS", "SOUZA", "TEIXEIRA", "VIEIRA",
    "ARAÚJO", "CAMPOS", "DUARTE", "FREITAS", "MACHADO", "MOREIRA", "NUNES", "PINTO",
    "ROCHA", "SALES", "TAVARES", "XAVIER", "BORGES", "COSTA", "FONSECA", "MENDES",
]
EDITORAS = ["Editora Horizonte", "Editora Cerrado", "Editora Pantanal Acadêmica",
            "Editora Araguaia", "Editora Chapada", "Editora Guaporé"]

DISCIPLINAS = [
    {
        "nome": "ESTRUTURA DE DADOS II",
        "ementa": "Árvores binárias de busca; árvores balanceadas AVL e rubro-negras; tabelas hash; "
                  "heaps e filas de prioridade; grafos: representação e percursos; análise de complexidade.",
        "unidades": [
            ["Revisão de listas e recursão", "Árvores binárias de busca", "Percursos em árvores", "Árvores AVL"],
            ["Árvores rubro-negras", "Tabelas hash e colisões", "Heaps binários", "Filas de prioridade"],
            ["Grafos: representação", "Busca em largura e profundidade", "Caminhos mínimos", "Revisão geral"],
        ],
        "titulos": ["Estruturas de Dados em C", "Algoritmos e Estruturas de Dados", "Projeto de Algoritmos"],
    },
    {
        "nome": "BANCO DE DADOS I",
        "ementa": "Conceitos de sistemas de banco de dados; modelo entidade-relacionamento; modelo relacional; "
                  "álgebra relacional; linguagem SQL; normalização.",
        "unidades": [
            ["Introdução a SGBDs", "Modelo entidade-relacionamento", "Cardinalidade e entidades fracas", "Modelo relacional"],
            ["Álgebra relacional", "SQL: DDL", "SQL: consultas simples", "SQL: junções e agregações"],
            ["Normalização: 1FN a 3FN", "Forma normal de Boyce-Codd", "Visões e índices", "Projeto prático"],
        ],
        "titulos": ["Sistemas de Banco de Dados", "Projeto de Banco de Dados", "SQL na Prática"],
    },
    {
        "nome": "ENGENHARIA DE SOFTWARE I",
        "ementa": "Processos de software; modelos de ciclo de vida; engenharia de requisitos; "
                  "modelagem com UML; métodos ágeis; gestão de configuração.",
        "unidades": [
            ["Introdução à engenharia de software", "Modelos de processo", "Métodos ágeis: Scrum", "Kanban e XP"],
            ["Engenharia de requisitos", "Casos de uso", "Diagramas de classe", "Diagramas de sequência"],
            ["Arquitetura de software", "Controle de versão", "Integração contínua", "Apresentação de projetos"],
        ],
        "titulos": ["Engenharia de Software Moderna", "Requisitos de Software", "UML Essencial"],
    },
    {
        "nome": "REDES DE COMPUTADORES",
        "ementa": "Arquiteturas de redes; modelo OSI e TCP/IP; camada de aplicação; camada de transporte; "
                  "camada de rede e roteamento; redes locais e enlace.",
        "unidades": [
            ["Introdução às redes", "Modelos OSI e TCP/IP", "Camada de aplicação: HTTP e DNS", "Sockets"],
            ["Camada de transporte: UDP", "TCP e controle de congestionamento", "Camada de rede: IPv4", "Sub-redes"],
            ["Roteamento", "IPv6", "Camada de enlace e Ethernet", "Redes sem fio"],
        ],
        "titulos": ["Redes de Computadores", "Protocolos da Internet", "Redes e Roteamento"],
    },
    {
        "nome": "SISTEMAS OPERACIONAIS",
        "ementa": "Estrutura de sistemas operacionais; processos e threads; escalonamento; sincronização; "
                  "impasses; gerência de memória; sistemas de arquivos.",
        "unidades": [
            ["Introdução aos sistemas operacionais", "Processos", "Threads", "Escalonamento de CPU"],
            ["Sincronização", "Semáforos e monitores", "Impasses", "Gerência de memória"],
            ["Memória virtual", "Sistemas de arquivos", "Entrada e saída", "Estudo de caso: Linux"],
        ],
        "titulos": ["Sistemas Operacionais Modernos", "Fundamentos de Sistemas Operacionais", "Linux para Desenvolvedores"],
    },
    {
        "nome": "PROGRAMAÇÃO ORIENTADA A OBJETOS",
        "ementa": "Classes e objetos; encapsulamento; herança; polimorfismo; interfaces; tratamento de exceções; "
                  "coleções; padrões de projeto introdutórios.",
        "unidades": [
            ["Paradigma orientado a objetos", "Classes e objetos", "Encapsulamento", "Construtores"],
            ["Herança", "Polimorfismo", "Classes abstratas e interfaces", "Tratamento de exceções"],
            ["Coleções", "Padrões de projeto: Strategy", "Padrões de projeto: Observer", "Projeto final"],
        ],
        "titulos": ["Programação Orientada a Objetos", "Java Essencial", "Padrões de Projeto Aplicados"],
    },
    {
        "nome": "INTELIGÊNCIA ARTIFICIAL",
        "ementa": "Agentes inteligentes; busca em espaço de estados; busca heurística; representação do conhecimento; "
                  "aprendizado de máquina supervisionado; redes neurais.",
        "unidades": [
            ["Introdução à IA", "Agentes inteligentes", "Busca não informada", "Busca heurística A*"],
            ["Lógica proposicional", "Representação do conhecimento", "Incerteza e probabilidade", "Classificadores bayesianos"],
            ["Árvores de decisão", "Redes neurais", "Avaliação de modelos", "Seminários"],
        ],
        "titulos": ["Inteligência Artificial", "Aprendizado de Máquina", "Redes Neurais Artificiais"],
    },
    {
        "nome": "DESENVOLVIMENTO WEB",
        "ementa": "Arquitetura cliente-servidor; HTML, CSS e JavaScript; frameworks de front-end; "
                  "APIs REST; persistência; implantação de aplicações web.",
        "unidades": [
            ["HTML semântico", "CSS e layout responsivo", "JavaScript moderno", "Manipulação do DOM"],
            ["Framework de front-end", "Componentes e estado", "Roteamento no cliente", "Consumo de APIs"],
            ["APIs REST no servidor", "Autenticação", "Persistência de dados", "Implantação em nuvem"],
        ],
        "titulos": ["Desenvolvimento Web Moderno", "JavaScript Completo", "APIs REST na Prática"],
    },
    {
        "nome": "TEORIA DA COMPUTAÇÃO",
        "ementa": "Linguagens formais; autômatos finitos; expressões regulares; gramáticas livres de contexto; "
                  "autômatos de pilha; máquinas de Turing; decidibilidade.",
        "unidades": [
            ["Alfabetos e linguagens", "Autômatos finitos determinísticos", "Autômatos não determinísticos", "Expressões regulares"],
            ["Lema do bombeamento", "Gramáticas livres de contexto", "Autômatos de pilha", "Formas normais"],
            ["Máquinas de Turing", "Tese de Church-Turing", "Decidibilidade", "Revisão geral"],
        ],
        "titulos": ["Introdução à Teoria da Computação", "Linguagens Formais e Autômatos", "Computabilidade"],
    },
    {
        "nome": "SEGURANÇA DA INFORMAÇÃO",
        "ementa": "Princípios de segurança; criptografia simétrica e assimétrica; assinaturas digitais; "
                  "autenticação; vulnerabilidades em aplicações; políticas de segurança e LGPD.",
        "unidades": [
            ["Princípios de segurança", "Criptografia clássica", "Criptografia simétrica", "Funções hash"],
            ["Criptografia assimétrica", "Assinaturas digitais", "Certificados e ICP", "Autenticação"],
            ["Vulnerabilidades web", "Testes de intrusão", "Políticas de segurança", "LGPD"],
        ],
        "titulos": ["Segurança da Informação", "Criptografia Aplicada", "Segurança em Aplicações Web"],
    },
    {
        "nome": "COMPUTAÇÃO GRÁFICA",
        "ementa": "Dispositivos gráficos; primitivas de desenho; transformações geométricas 2D e 3D; "
                  "projeções; modelos de iluminação; texturas; pipeline gráfico.",
        "unidades": [
            ["Introdução à computação gráfica", "Primitivas de desenho", "Rasterização", "Transformações 2D"],
            ["Transformações 3D", "Projeções", "Câmera virtual", "Recorte e visibilidade"],
            ["Iluminação", "Texturas", "Pipeline gráfico", "Projeto final"],
        ],
        "titulos": ["Computação Gráfica", "Fundamentos de Gráficos 3D", "OpenGL Essencial"],
    },
    {
        "nome": "COMPILADORES",
        "ementa": "Estrutura de um compilador; análise léxica; análise sintática descendente e ascendente; "
                  "análise semântica; geração de código intermediário; otimização.",
        "unidades": [
            ["Estrutura de um compilador", "Análise léxica", "Expressões regulares e autômatos", "Geradores léxicos"],
            ["Gramáticas", "Análise sintática descendente", "Análise sintática ascendente", "Geradores sintáticos"],
            ["Análise semântica", "Tabela de símbolos", "Código intermediário", "Otimização"],
        ],
        "titulos": ["Compiladores: Princípios e Práticas", "Construção de Compiladores", "Linguagens de Programação"],
    },
]

SEMESTRES = {
    "2024.1": date(2024, 3, 4),
    "2024.2": date(2024, 8, 5),
    "2025.1": date(2025, 3, 10),
    "2025.2": date(2025, 8, 4),
}
MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho",
         "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]

# ─── Catálogo de erros ───────────────────────────────────────────────────────
# classe: "regra" = regra determinística do motor; "ia" = regra cujo valor é uma
# contagem feita pela IA na extração; "limitacao" = nenhuma regra cobre o erro.
# status_esperado: status da regra-alvo quando o erro é detectado.

ERROS = {
    # Plano de Curso
    "EP01": dict(doc="plano", regra="RP01", classe="regra", status="nao_encontrado",
                 desc="Ementa em branco", onde="Página 1, campo Ementa"),
    "EP02": dict(doc="plano", regra="RP02", classe="regra", status="nao_encontrado",
                 desc="Docente e matrícula do docente em branco", onde="Página 1, bloco Matrícula / Docente(s)"),
    "EP03": dict(doc="plano", regra="RP03", classe="regra", status="nao_encontrado",
                 desc="Horário de atendimento em branco", onde="Página 2, campo Horário de Atendimento"),
    "EP04": dict(doc="plano", regra="RP04", classe="regra", status="nao_encontrado",
                 desc="Pré-requisitos em branco (deveria constar 'Não possui' ou a lista)", onde="Página 1, campo Pré-Requisitos"),
    "EP05": dict(doc="plano", regra="RP05", classe="regra", status="nao_encontrado",
                 desc="Metodologia em branco", onde="Página 2, campo Metodologia"),
    "EP06": dict(doc="plano", regra="RP06", classe="regra", status="nao_encontrado",
                 desc="Procedimentos de avaliação em branco", onde="Página 2, campo Procedimentos de Avaliação"),
    "EP07": dict(doc="plano", regra="RP07", classe="regra", status="nao_encontrado",
                 desc="Referências básicas sem nenhum item", onde="Seção Referências Básicas"),
    "EP08": dict(doc="plano", regra="RP08", classe="regra", status="nao_conforme",
                 desc="Código da disciplina fora do padrão FACET-SNP-000", onde="Página 1, campo Turma"),
    "EP09": dict(doc="plano", regra="RP09", classe="regra", status="nao_conforme",
                 desc="Ano/semestre inexistente (semestre 3)", onde="Página 1, campo Turma"),
    "EP10": dict(doc="plano", regra="RP10", classe="regra", status="nao_conforme",
                 desc="Código de horário inválido", onde="Página 1, campo Horário"),
    "EP11": dict(doc="plano", regra="RP11", classe="regra", status="nao_conforme",
                 desc="Matrícula do docente com quantidade errada de dígitos", onde="Página 1, coluna Matrícula"),
    "EP12": dict(doc="plano", regra="RP12", classe="regra", status="nao_encontrado",
                 desc="Nenhuma avaliação cadastrada", onde="Seção Avaliações"),
    "EP13": dict(doc="plano", regra="RP13", classe="regra", status="nao_conforme",
                 desc="Carga horária do docente diferente da carga horária da disciplina", onde="Página 1, Turma x Docente(s)"),
    "EP14": dict(doc="plano", regra="RP14", classe="ia", status="nao_conforme",
                 desc="Cronograma de aulas incompleto (apenas 4 aulas)", onde="Seção Cronograma de Aulas"),
    "EP15": dict(doc="plano", regra="RP12", classe="regra", status="nao_verificavel",
                 desc="Data de avaliação impossível (dia 31 em mês de 30 dias)", onde="Seção Avaliações, 1ª linha",
                 obs="O upload normaliza campos com 'data' no identificador e marca a data como inválida. "
                     "No teste do Studio não há normalização: a regex aceita 31/09 e o erro passa."),
    # Diário de Turma
    "ED01": dict(doc="diario", regra="RD11", classe="regra", status="nao_encontrado",
                 desc="Código de verificação ausente", onde="Página 2, Código de Verificação"),
    "ED02": dict(doc="diario", regra="RD11", classe="regra", status="nao_conforme",
                 desc="Código de verificação fora do formato (maiúsculas e hífen)", onde="Página 2, Código de Verificação"),
    "ED03": dict(doc="diario", regra="RD02", classe="regra", status="nao_conforme",
                 desc="Turma com status ABERTA (diário não consolidado)", onde="Cabeçalho de todas as páginas"),
    "ED04": dict(doc="diario", regra="RD01", classe="regra", status="nao_verificavel",
                 desc="Data de emissão inexistente", onde="Cabeçalho de todas as páginas",
                 obs="A normalização de datas do upload rejeita a data; a regra fica sem valor verificável."),
    "ED05": dict(doc="diario", regra="RD06", classe="regra", status="nao_conforme",
                 desc="Carga horária incompatível com os créditos (créditos x 15)", onde="Página 1, Créditos e Carga Horária"),
    "ED06": dict(doc="diario", regra="RD05", classe="regra", status="nao_conforme",
                 desc="Quantidade de créditos fora do intervalo permitido (1 a 8)", onde="Página 1, Créditos"),
    "ED07": dict(doc="diario", regra="RD03", classe="regra", status="nao_encontrado",
                 desc="Nome da disciplina em branco", onde="Página 1 e cabeçalhos das listas"),
    "ED08": dict(doc="diario", regra="RD09", classe="regra", status="nao_encontrado",
                 desc="Docente em branco (o nome ainda aparece como usuário na tabela Versões)", onde="Página 2, Docente(s)"),
    "ED09": dict(doc="diario", regra="RD13", classe="ia", status="nao_conforme",
                 desc="Faltas não lançadas: alunos sem marcação na frequência e sem total de faltas", onde="Páginas 4 e 5"),
    "ED10": dict(doc="diario", regra="RD14", classe="ia", status="nao_conforme",
                 desc="Nota de avaliação não lançada para alunos", onde="Página 4, Lista de Notas e Faltas"),
    "ED11": dict(doc="diario", regra="RD15", classe="ia", status="nao_conforme",
                 desc="Aulas do conteúdo programado sem descrição", onde="Página 6, Conteúdo Programado"),
    "ED12": dict(doc="diario", regra="RD12", classe="regra", status="nao_encontrado",
                 desc="Tabela Versões do documento sem nenhum registro", onde="Página 3, Versões do documento"),
    "ED13": dict(doc="diario", regra="-", classe="limitacao", status="aprovado",
                 desc="Total de faltas diverge da soma da lista de frequência", onde="Páginas 4 e 5"),
    "ED14": dict(doc="diario", regra="-", classe="limitacao", status="aprovado",
                 desc="Resultado incoerente: aluno com média acima de 7 e faltas dentro do limite marcado como REP", onde="Página 4, coluna Resultado"),
    "ED15": dict(doc="diario", regra="-", classe="limitacao", status="aprovado",
                 desc="Média final calculada errada para um aluno", onde="Página 4, coluna Média Final"),
}

# Composição do dataset: lista de conjuntos de erros por documento ([] = controle).
COMPOSICAO = {
    "plano": [[]] * 7 + [[f"EP{i:02d}"] for i in range(1, 16)]
             + [["EP03", "EP09"], ["EP01", "EP13"], ["EP08", "EP11"]],
    "diario": [[]] * 7 + [[f"ED{i:02d}"] for i in range(1, 16)]
              + [["ED09", "ED10"], ["ED03", "ED05"], ["ED07", "ED11"]],
}

# ─── Modelo de dados ─────────────────────────────────────────────────────────


@dataclass
class Aluno:
    matricula: str
    nome: str
    notas: list  # 3 floats ou None
    faltas_por_data: dict  # data -> horas de falta (0 = presente, None = não lançado)
    total_faltas: int | None = None
    media_parcial: float | None = None
    prova: float | None = None
    media_final: float | None = None
    resultado: str = ""


@dataclass
class Turma:
    codigo: str
    disciplina: dict
    nome_disciplina: str
    creditos: int
    carga_horaria: int
    turma: str
    semestre: str
    horario: str
    horas_por_aula: int
    docente: str
    matricula_docente: str
    ch_docente: int
    pre_requisitos: str
    ementa: str
    metodologia: str
    procedimentos: str
    atendimento: str
    aulas: list  # (data, descricao, sem_aula: bool)
    avaliacoes: list  # (data_str, hora, descricao)
    referencias_basicas: list
    referencias_complementares: list
    alunos: list = field(default_factory=list)
    emissao: datetime | None = None
    emissao_txt: str = ""
    status_turma: str = "CONSOLIDADA"
    codigo_verificacao: str = ""
    versoes: list = field(default_factory=list)  # (data, usuario, codigo)


def nome_pessoa(rng: random.Random) -> str:
    partes = [rng.choice(NOMES), rng.choice(SOBRENOMES), rng.choice(NOMES_MEIO) or rng.choice(SOBRENOMES)]
    nome = " ".join(p for p in partes if p)
    return nome


def hexcode(rng: random.Random) -> str:
    return "".join(rng.choice("0123456789abcdef") for _ in range(10))


def fmt_nota(v):
    return "" if v is None else f"{v:.1f}".replace(".", ",")


def fmt_media(v):
    return "" if v is None else f"{v:.1f}"


def sortear_turma(rng: random.Random, codigos_usados: set) -> Turma:
    disc = rng.choice(DISCIPLINAS)
    while True:
        codigo = f"FACET-SNP-{rng.randint(201, 340):03d}"
        if codigo not in codigos_usados:
            codigos_usados.add(codigo)
            break
    creditos = rng.choice([2, 4, 4, 4, 6])
    ch = creditos * 15
    semestre = rng.choice(list(SEMESTRES))
    dia_semana = rng.randint(2, 6)  # 2 = segunda ... 6 = sexta
    turno = rng.choice(["M", "T", "N", "N"])
    horas_aula = {2: 2, 4: rng.choice([3, 4]), 6: 4}[creditos]
    horario = f"{dia_semana}{turno}{''.join(str(i) for i in range(1, horas_aula + 1))}"

    inicio = SEMESTRES[semestre]
    primeira = inicio + timedelta(days=(dia_semana - 2 - inicio.weekday()) % 7)
    n_aulas = rng.randint(16, 18)
    datas = [primeira + timedelta(weeks=i) for i in range(n_aulas)]

    topicos = [t for unidade in disc["unidades"] for t in unidade]
    sem_aula = set(rng.sample(range(2, n_aulas - 2), k=rng.choice([1, 2])))
    aulas, idx = [], 0
    for i, d in enumerate(datas):
        if i in sem_aula:
            aulas.append((d, rng.choice(["Não Haverá Aula", "Não Haverá Aula - Feriado",
                                         "Não Haverá Aula - Semana Acadêmica"]), True))
            continue
        if idx < len(topicos):
            un = idx // 4 + 1
            desc = f"Unidade {un} - {topicos[idx]}"
            idx += 1
        else:
            desc = rng.choice(["Revisão de conteúdo", "Atividade prática em laboratório",
                               "Exame final", "Reposição de aula - Aula Extra [Reposição]"])
        aulas.append((d, desc, False))
    validas = [a for a in aulas if not a[2]]
    marcos = [validas[len(validas) // 3][0], validas[2 * len(validas) // 3][0], validas[-2][0]]
    avaliacoes = [(m.strftime("%d/%m/%Y"), "Até às 23h59", f"{i + 1}ª Unidade") for i, m in enumerate(marcos)]

    docente = nome_pessoa(rng)
    email = docente.split()[0].lower() + "." + docente.split()[-1].lower() + "@exemplo.edu.br"
    email = email.translate(str.maketrans("áéíóúâêôãõç", "aeiouaeoaoc"))
    atendimento = (f"{rng.choice(['Segundas', 'Terças', 'Quartas', 'Quintas', 'Sextas'])}-feiras, "
                   f"das {rng.choice(['08:00 às 10:00', '14:00 às 16:00', '16:00 às 18:00'])} horas. "
                   f"Agendamento pelo fórum da disciplina ou pelo e-mail {email}.")
    sincronas = int(ch * 0.75)
    metodologia = (
        f"A disciplina está organizada em 03 unidades.\n"
        f"Unidade 01: {', '.join(disc['unidades'][0][:3])};\n"
        f"Unidade 02: {', '.join(disc['unidades'][1][:3])};\n"
        f"Unidade 03: {', '.join(disc['unidades'][2][:3])}.\n"
        f"As aulas serão teórico-práticas, com exposição dialogada, exercícios e atividades em laboratório. "
        f"Os estudantes terão {sincronas} horas de atividades síncronas presenciais e {ch - sincronas} horas "
        f"de atividades assíncronas no ambiente virtual da disciplina."
    )
    procedimentos = (
        "A nota final será a média aritmética simples de três avaliações individuais, uma por unidade, "
        "enviadas pelo ambiente virtual. O exame final consistirá em prova teórica individual sobre o "
        "conteúdo das três unidades, aplicada ao final do semestre conforme a normativa acadêmica."
    )
    pre = rng.choice(["Não possui", "Não possui", f"( FACET-SNP-{rng.randint(201, 340):03d} )",
                      f"( FACET-SNP-{rng.randint(201, 340):03d} OU FACET-SNP-{rng.randint(201, 340):03d} )"])

    def referencia(titulo):
        autor = f"{rng.choice(SOBRENOMES).title()}, {rng.choice(NOMES).title()}"
        return ("Livro", f"{autor}. {titulo}. {rng.choice(EDITORAS)}. {rng.randint(2012, 2023)}")

    basicas = [referencia(t) for t in disc["titulos"]]
    complementares = [("Site", f"Documentação oficial: {t}") for t in rng.sample(topicos, 3)]

    t = Turma(
        codigo=codigo, disciplina=disc, nome_disciplina=disc["nome"], creditos=creditos,
        carga_horaria=ch, turma=f"{rng.choice([1, 1, 1, 2]):02d}", semestre=semestre, horario=horario,
        horas_por_aula=horas_aula, docente=docente, matricula_docente=str(rng.randint(100000000, 399999999)),
        ch_docente=ch, pre_requisitos=pre, ementa=disc["ementa"], metodologia=metodologia,
        procedimentos=procedimentos, atendimento=atendimento, aulas=aulas, avaliacoes=avaliacoes,
        referencias_basicas=basicas, referencias_complementares=complementares,
    )

    # Alunos, notas e frequência coerentes entre si
    ano = int(semestre[:4])
    datas_validas = [a[0] for a in aulas if not a[2]]
    limite_faltas = ch * 0.25
    for _ in range(rng.randint(8, 14)):
        perfil = rng.random()
        if perfil < 0.12:  # abandonou
            notas = [round(rng.uniform(0, 4) * 2) / 2, 0.0, 0.0]
            p_falta = 0.75
        elif perfil < 0.3:  # dificuldade
            notas = [round(rng.uniform(3, 7.5) * 2) / 2 for _ in range(3)]
            p_falta = 0.15
        else:
            notas = [round(rng.uniform(6.5, 10) * 2) / 2 for _ in range(3)]
            p_falta = 0.07
        faltas = {d: (horas_aula if rng.random() < p_falta else 0) for d in datas_validas}
        aluno = Aluno(matricula=f"{rng.randint(ano - 5, ano - 1)}{rng.randint(100000, 299999)}",
                      nome=nome_pessoa(rng), notas=notas, faltas_por_data=faltas)
        recalcular_aluno(aluno, limite_faltas, rng)
        t.alunos.append(aluno)
    t.alunos.sort(key=lambda a: a.nome)

    fim = aulas[-1][0] + timedelta(days=rng.randint(5, 15))
    t.emissao = datetime(fim.year, fim.month, fim.day, rng.randint(8, 18), rng.randint(0, 59))
    t.emissao_txt = t.emissao.strftime("%d/%m/%Y")
    t.codigo_verificacao = hexcode(rng)
    t.versoes = [((fim - timedelta(days=rng.randint(1, 4))).strftime("%d/%m/%Y"), docente, hexcode(rng))]
    return t


def recalcular_aluno(a: Aluno, limite_faltas: float, rng: random.Random):
    a.total_faltas = sum(v for v in a.faltas_por_data.values() if v)
    parcial = round(sum(a.notas) / 3, 1)
    reprova_falta = a.total_faltas > limite_faltas
    a.media_parcial = a.prova = None
    if parcial >= 7 or reprova_falta:
        a.media_final = parcial
        nota_ok = parcial >= 7
    else:
        a.media_parcial = parcial
        a.prova = round(rng.uniform(3, 9) * 2) / 2
        a.media_final = round((parcial + a.prova) / 2, 1)
        nota_ok = a.media_final >= 5
    if reprova_falta:
        a.resultado = "REPF" if nota_ok else "REMF"
    else:
        a.resultado = "APR" if nota_ok else "REP"


# ─── Injeção de erros ────────────────────────────────────────────────────────


def aplicar_erros(t: Turma, erros: list, rng: random.Random) -> dict:
    """Altera a turma conforme os erros e devolve detalhes para o gabarito."""
    detalhes = {}
    for e in erros:
        if e == "EP01":
            t.ementa = ""
        elif e == "EP02":
            t.docente, t.matricula_docente = "", ""
        elif e == "EP03":
            t.atendimento = ""
        elif e == "EP04":
            t.pre_requisitos = ""
        elif e == "EP05":
            t.metodologia = ""
        elif e == "EP06":
            t.procedimentos = ""
        elif e == "EP07":
            t.referencias_basicas = []
        elif e == "EP08":
            t.codigo = rng.choice([t.codigo.replace("-SNP-", " SNP "), t.codigo[:-1] + "X",
                                   t.codigo.replace("FACET-", "FACE-")])
            detalhes[e] = f"código impresso: {t.codigo}"
        elif e == "EP09":
            t.semestre = t.semestre[:4] + ".3"
            detalhes[e] = f"semestre impresso: {t.semestre}"
        elif e == "EP10":
            t.horario = rng.choice(["9N123", "3X12", "N3123", "3N"])
            detalhes[e] = f"horário impresso: {t.horario}"
        elif e == "EP11":
            t.matricula_docente = t.matricula_docente[:rng.choice([6, 7])]
            detalhes[e] = f"matrícula impressa: {t.matricula_docente}"
        elif e == "EP12":
            t.avaliacoes = []
        elif e == "EP13":
            t.ch_docente = t.carga_horaria - 15 if t.carga_horaria > 30 else t.carga_horaria + 30
            detalhes[e] = f"disciplina {t.carga_horaria}h, docente {t.ch_docente}h"
        elif e == "EP14":
            t.aulas = t.aulas[:4]
        elif e == "EP15":
            d, h, desc = t.avaliacoes[0]
            mes = int(d[3:5])
            mes = mes if mes in (4, 6, 9, 11) else rng.choice([4, 6]) if t.semestre.endswith(".1") else rng.choice([9, 11])
            t.avaliacoes[0] = (f"31/{mes:02d}/{d[6:]}", h, desc)
            detalhes[e] = f"data impressa: {t.avaliacoes[0][0]}"
        elif e == "ED01":
            t.codigo_verificacao = ""
        elif e == "ED02":
            c = t.codigo_verificacao.upper()
            t.codigo_verificacao = f"{c[:4]}-{c[4:8]}"
            detalhes[e] = f"código impresso: {t.codigo_verificacao}"
        elif e == "ED03":
            t.status_turma = "ABERTA"
        elif e == "ED04":
            t.emissao_txt = rng.choice(["32/12/2025", "15/13/2025", "00/07/2025"])
            detalhes[e] = f"data impressa: {t.emissao_txt}"
        elif e == "ED05":
            t.carga_horaria = t.creditos * 15 + 15
            detalhes[e] = f"{t.creditos} créditos e {t.carga_horaria}h (esperado {t.creditos * 15}h)"
        elif e == "ED06":
            t.creditos = 12
            t.carga_horaria = 180
            detalhes[e] = "12 créditos / 180h"
        elif e == "ED07":
            t.nome_disciplina = ""
        elif e == "ED08":
            t.docente, t.matricula_docente = "", ""
        elif e == "ED09":
            alvo = rng.sample(t.alunos, k=2)
            for a in alvo:
                a.faltas_por_data = {d: None for d in a.faltas_por_data}
                a.total_faltas = None
            detalhes[e] = "alunos: " + "; ".join(a.nome for a in alvo)
            detalhes["_qtd_sem_faltas"] = 2
        elif e == "ED10":
            alvo = rng.sample(t.alunos, k=rng.choice([1, 2]))
            for a in alvo:
                a.notas[rng.choice([1, 2])] = None
            detalhes[e] = "alunos: " + "; ".join(a.nome for a in alvo)
            detalhes["_qtd_sem_nota"] = len(alvo)
        elif e == "ED11":
            idx = rng.sample([i for i, a in enumerate(t.aulas) if not a[2]], k=2)
            for i in idx:
                t.aulas[i] = (t.aulas[i][0], "", False)
            detalhes[e] = "datas: " + "; ".join(t.aulas[i][0].strftime("%d/%m/%Y") for i in sorted(idx))
            detalhes["_qtd_sem_conteudo"] = 2
        elif e == "ED12":
            t.versoes = []
        elif e == "ED13":
            a = rng.choice([x for x in t.alunos if (x.total_faltas or 0) >= t.horas_por_aula])
            real = a.total_faltas
            a.total_faltas = max(0, real - 2 * t.horas_por_aula)
            detalhes[e] = f"{a.nome}: frequência soma {real}h, total impresso {a.total_faltas}h"
        elif e == "ED14":
            a = rng.choice([x for x in t.alunos if x.resultado == "APR" and x.media_parcial is None])
            a.resultado = "REP"
            detalhes[e] = f"{a.nome}: média {fmt_media(a.media_final)}, {a.total_faltas} faltas, resultado REP"
        elif e == "ED15":
            a = rng.choice([x for x in t.alunos if x.resultado == "APR" and x.media_parcial is None])
            certo = a.media_final
            a.media_final = round(max(0.0, certo - 3.0), 1)
            detalhes[e] = f"{a.nome}: notas {', '.join(fmt_nota(n) for n in a.notas)}, média correta {certo}, impressa {a.media_final}"
    return detalhes


# ─── Renderização ────────────────────────────────────────────────────────────

ST = {
    "titulo": ParagraphStyle("titulo", fontName="Helvetica-Bold", fontSize=18, alignment=1, leading=22),
    "secao": ParagraphStyle("secao", fontName="Helvetica-Bold", fontSize=8.5, leading=11),
    "rot": ParagraphStyle("rot", fontName="Helvetica", fontSize=8.5, leading=10),
    "rotb": ParagraphStyle("rotb", fontName="Helvetica-Bold", fontSize=8.5, leading=10),
    "val": ParagraphStyle("val", fontName="Helvetica-Bold", fontSize=8.5, leading=9.5),
    "valn": ParagraphStyle("valn", fontName="Helvetica", fontSize=8.5, leading=10),
    "cel": ParagraphStyle("cel", fontName="Helvetica", fontSize=6.5, leading=7.6),
    "celc": ParagraphStyle("celc", fontName="Helvetica", fontSize=6.5, leading=7.6, alignment=1),
    "sub": ParagraphStyle("sub", fontName="Helvetica", fontSize=6.5, leading=8),
    "just": ParagraphStyle("just", fontName="Helvetica", fontSize=6.8, leading=8.2),
}


def P(texto, estilo="cel"):
    texto = (texto or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br/>")
    return Paragraph(texto, ST[estilo])


def brasao(c, x, y, s):
    """Emblema genérico (sem texto) no lugar dos brasões oficiais."""
    c.saveState()
    c.setStrokeColor(colors.HexColor("#7a7a7a"))
    c.setFillColor(colors.HexColor("#e9eef5"))
    c.circle(x + s / 2, y + s / 2, s / 2, stroke=1, fill=1)
    c.setFillColor(colors.HexColor("#b9c8dc"))
    p = c.beginPath()
    p.moveTo(x + s * 0.3, y + s * 0.72)
    p.lineTo(x + s * 0.7, y + s * 0.72)
    p.lineTo(x + s * 0.7, y + s * 0.42)
    p.lineTo(x + s * 0.5, y + s * 0.22)
    p.lineTo(x + s * 0.3, y + s * 0.42)
    p.close()
    c.drawPath(p, stroke=1, fill=1)
    c.restoreState()


def cabecalho_diario(t: Turma):
    def desenhar(c, doc):
        w, h = c._pagesize
        c.saveState()
        brasao(c, 30, h - 92, 56)
        brasao(c, w - 86, h - 92, 56)
        c.setFont("Helvetica-Bold", 7.5)
        for i, linha in enumerate(["GOVERNO DO ESTADO DE MATO GROSSO",
                                   "SECRETARIA DE ESTADO DE CIÊNCIA, TECNOLOGIA E INOVAÇÃO",
                                   "UNIVERSIDADE DO ESTADO DE MATO GROSSO",
                                   "PRÓ-REITORIA DE ENSINO DE GRADUAÇÃO"]):
            c.drawCentredString(w / 2, h - 42 - i * 11, linha)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(28, h - 120, "Diário - Emitido em")
        c.drawString(130, h - 120, f"{t.emissao_txt} às {t.emissao.strftime('%H:%M')}  -  Status da Turma:   {t.status_turma}")
        c.setLineWidth(0.8)
        c.line(22, h - 106, w - 22, h - 106)
        c.line(22, h - 125, w - 22, h - 125)
        c.setFont("Helvetica", 5.5)
        c.setFillColor(colors.HexColor("#8a8a8a"))
        c.drawString(28, 18, RODAPE)
        c.restoreState()
    return desenhar


def cabecalho_plano(c, doc):
    w, h = c._pagesize
    c.saveState()
    brasao(c, 48, h - 92, 56)
    brasao(c, w - 104, h - 92, 56)
    c.setFont("Helvetica-Bold", 6.5)
    for i, linha in enumerate(["SIGAA - Sistema Integrado de Gestão de Atividades Acadêmicas",
                               "UNEMAT - Universidade do Estado de Mato Grosso",
                               "PROEG",
                               "SAA - Supervisão de Apoio Acadêmico",
                               "Av. Tancredo Neves, 1095 - Cavalhada III 78217-900 - Cáceres - Mato Grosso"]):
        c.drawCentredString(w / 2, h - 40 - i * 10, linha)
    c.setFont("Helvetica", 6.5)
    c.drawRightString(w - 40, 30, f"Página {doc.page}")
    c.setFont("Helvetica", 5.5)
    c.setFillColor(colors.HexColor("#8a8a8a"))
    c.drawString(40, 18, RODAPE)
    c.restoreState()


GRADE = TableStyle([
    ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("TOPPADDING", (0, 0), (-1, -1), 1.5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
    ("LEFTPADDING", (0, 0), (-1, -1), 2),
    ("RIGHTPADDING", (0, 0), (-1, -1), 2),
])


def subcabecalho(t: Turma, titulo):
    disc = f"{t.codigo} - {t.nome_disciplina}" if t.nome_disciplina else f"{t.codigo} - "
    return [
        P(titulo, "secao"),
        Table([[""]], colWidths=[551], rowHeights=[2], style=[("LINEABOVE", (0, 0), (-1, -1), 0.8, colors.black)]),
        P(f"Turma: {t.turma} - {t.semestre}    Status: {t.status_turma}    Horário: {t.horario}\nDisciplina: {disc}", "sub"),
        Spacer(1, 4),
    ]


def render_diario(t: Turma, destino: Path):
    retrato = Frame(22, 30, A4[0] - 44, A4[1] - 165, id="r")
    pais = landscape(A4)
    paisagem = Frame(22, 30, pais[0] - 44, pais[1] - 165, id="p")
    doc = BaseDocTemplate(str(destino), pagesize=A4, title="Diário de Turma", author="SIGAA (sintético)")
    cab = cabecalho_diario(t)
    doc.addPageTemplates([PageTemplate("retrato", [retrato], onPage=cab, pagesize=A4),
                          PageTemplate("paisagem", [paisagem], onPage=cab, pagesize=pais)])
    s = []
    # Página 1 - capa
    s += [Spacer(1, 60), P("Diário de Turma", "titulo"), Spacer(1, 90)]
    ident = [
        ("Centro:", 'UNIVERSIDADE DO ESTADO DE MATO GROSSO "CARLOS ALBERTO REYES MALDONADO"'),
        ("Departamento:", "FACULDADE DE CIÊNCIAS EXATAS E TECNOLÓGICAS - SNP"),
        ("Código:", t.codigo),
        ("Disciplina:", t.nome_disciplina),
        ("Créditos:", str(t.creditos)),
        ("Carga Horária:", str(t.carga_horaria)),
    ]
    s.append(Table([[P(a, "rot"), P(b, "val")] for a, b in ident], colWidths=[105, 310],
                   style=[("VALIGN", (0, 0), (-1, -1), "TOP"), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]))
    s += [Spacer(1, 100)]
    s.append(Table([[P("Turma:", "rot"), P("Ano/Semestre:", "rot"), P("Horário:", "rot")],
                    [P(t.turma, "val"), P(t.semestre, "val"), P(t.horario, "val")]],
                   colWidths=[150, 150, 150],
                   style=[("ALIGN", (0, 0), (-1, -1), "CENTER")]))
    s.append(PageBreak())
    # Página 2 - docente e código de verificação
    s.append(Table([[P("Matrícula", "rot"), P("Docente(s)", "rot")],
                    [P(t.matricula_docente, "val"),
                     P(f"{t.docente} - {t.ch_docente}h" if t.docente else "", "val")]],
                   colWidths=[110, 330], style=[("LEFTPADDING", (0, 0), (-1, -1), 0)]))
    s.append(Spacer(1, 6))
    s.append(Table([[P("Código de Verificação:", "rot"), P(t.codigo_verificacao, "val")]],
                   colWidths=[120, 300], style=[("BOX", (0, 0), (-1, -1), 0.6, colors.black)]))
    s.append(PageBreak())
    # Página 3 - versões
    s += subcabecalho(t, "Versões do documento")
    linhas = [[P("Data", "celc"), P("Usuário"), P("Código", "celc")]]
    linhas += [[P(d, "celc"), P(u), P(c, "celc")] for d, u, c in t.versoes]
    s.append(Table(linhas, colWidths=[55, 310, 60], style=GRADE))
    s.append(PageBreak())
    # Página 4 - notas e faltas
    s += subcabecalho(t, "Lista de Notas e Faltas")
    cab = ["", "Matrícula", "Nome", "1a Aval.", "2a Aval.", "3a Aval.", "Média Parcial", "Recup.",
           "Prova", "Média Final", "Total Faltas", "Resultado"]
    linhas = [[P(x, "celc") for x in cab]]
    for i, a in enumerate(t.alunos, 1):
        linhas.append([P(str(i), "celc"), P(a.matricula, "celc"), P(a.nome)] +
                      [P(fmt_nota(n), "celc") for n in a.notas] +
                      [P(fmt_nota(a.media_parcial), "celc"), P(""), P(fmt_nota(a.prova), "celc"),
                       P(fmt_media(a.media_final), "celc"),
                       P("" if a.total_faltas is None else str(a.total_faltas), "celc"),
                       P(a.resultado, "celc")])
    s.append(Table(linhas, colWidths=[16, 50, 170, 26, 26, 26, 30, 28, 28, 28, 28, 40], style=GRADE))
    s.append(NextPageTemplate("paisagem"))
    s.append(PageBreak())
    # Página 5 - frequência
    s += subcabecalho(t, "Lista de Freqüência")
    datas = [a[0] for a in t.aulas]
    meses, spans = [], []
    for j, d in enumerate(datas):
        if not meses or meses[-1][0] != d.month:
            meses.append([d.month, j, j])
        else:
            meses[-1][2] = j
    linha_mes = ["", ""] + [""] * len(datas) + [""]
    for mes, ini, fim in meses:
        linha_mes[2 + ini] = P(MESES[mes - 1], "celc")
        spans.append(("SPAN", (2 + ini, 0), (2 + fim, 0)))
    linha_dia = [P("Matrícula", "celc"), P("Nome")] + [P(str(d.day), "celc") for d in datas] + [P("Total de Faltas", "celc")]
    linhas = [linha_mes, linha_dia]
    sem_aula_cols = [2 + j for j, a in enumerate(t.aulas) if a[2]]
    for a in t.alunos:
        cel = []
        for aula in t.aulas:
            if aula[2]:
                cel.append("")
                continue
            v = a.faltas_por_data.get(aula[0])
            cel.append("" if v is None else ("*" if v == 0 else str(v)))
        total = "" if a.total_faltas is None else str(a.total_faltas)
        linhas.append([P(a.matricula, "celc"), P(a.nome)] + [P(x, "celc") for x in cel] + [P(total, "celc")])
    larg_data = min(22, (pais[0] - 44 - 60 - 170 - 50) / max(1, len(datas)))
    estilo = TableStyle(GRADE.getCommands() + spans +
                        [("BACKGROUND", (c, 2), (c, -1), colors.HexColor("#c8c8c8")) for c in sem_aula_cols])
    s.append(Table(linhas, colWidths=[60, 170] + [larg_data] * len(datas) + [50], style=estilo))
    s.append(NextPageTemplate("retrato"))
    s.append(PageBreak())
    # Página 6 - conteúdo programado
    s += subcabecalho(t, "Conteúdo Programado")
    linhas = [[P("Data", "celc"), P("Descrição")]]
    linhas += [[P(d.strftime("%d/%m/%Y"), "celc"), P(desc)] for d, desc, _ in t.aulas]
    s.append(Table(linhas, colWidths=[55, 210], style=GRADE, hAlign="LEFT"))
    doc.build(s)


def render_plano(t: Turma, destino: Path):
    doc = BaseDocTemplate(str(destino), pagesize=A4, title="Plano de Curso", author="SIGAA (sintético)")
    doc.addPageTemplates([PageTemplate("p", [Frame(46, 45, A4[0] - 92, A4[1] - 150)], onPage=cabecalho_plano)])
    s = [Spacer(1, 18), P("Plano de Curso", "titulo"), Spacer(1, 40)]
    turma_txt = f"{t.codigo} - {t.nome_disciplina} ({t.carga_horaria}h) - Turma: {t.turma} ({t.semestre})"
    ident = [("Turma:", turma_txt), ("Horário:", t.horario), ("Pré-Requisitos:", t.pre_requisitos), ("Ementa:", t.ementa)]
    s.append(Table([[P(a, "rotb"), P(b, "valn")] for a, b in ident], colWidths=[95, 310],
                   style=[("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                          ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
    s.append(Spacer(1, 6))
    s.append(Table([[P("Matrícula", "rotb"), P("Docente(s)", "rotb")],
                    [P(t.matricula_docente, "valn"), P(f"{t.docente} - {t.ch_docente}h" if t.docente else "", "valn")]],
                   colWidths=[95, 310], style=[("LEFTPADDING", (0, 0), (-1, -1), 0)]))
    s.append(PageBreak())

    s.append(P("Metodologia de Ensino e Avaliação", "secao"))
    s.append(Table([[P(a, "just"), P(b, "just")] for a, b in [
        ("Metodologia:", t.metodologia),
        ("Procedimentos de Avaliação da Aprendizagem:", t.procedimentos),
        ("Horário de Atendimento:", t.atendimento),
    ]], colWidths=[110, 393], style=TableStyle(GRADE.getCommands() + [("TOPPADDING", (0, 0), (-1, -1), 4),
                                                                         ("BOTTOMPADDING", (0, 0), (-1, -1), 4)])))
    s += [Spacer(1, 10), P("Cronograma de Aulas", "secao")]
    linhas = [[P("Início", "celc"), P("Fim", "celc"), P("Descrição")]]
    linhas += [[P(d.strftime("%d/%m/%Y"), "celc"), P(d.strftime("%d/%m/%Y"), "celc"), P(desc)] for d, desc, _ in t.aulas]
    s.append(Table(linhas, colWidths=[70, 70, 363], style=GRADE, repeatRows=1))
    s += [Spacer(1, 10), P("Avaliações", "secao")]
    linhas = [[P("Data", "celc"), P("Hora", "celc"), P("Descrição")]]
    linhas += [[P(d, "celc"), P(h, "celc"), P(desc)] for d, h, desc in t.avaliacoes]
    s.append(Table(linhas, colWidths=[70, 70, 160], style=GRADE, hAlign="LEFT"))
    s += [Spacer(1, 10), P("Referências Básicas", "secao")]
    linhas = [[P("Tipo de Material", "celc"), P("Descrição")]]
    linhas += [[P(tp, "celc"), P(desc)] for tp, desc in t.referencias_basicas]
    s.append(Table(linhas, colWidths=[70, 433], style=GRADE))
    s += [Spacer(1, 10), P("Referências Complementares", "secao")]
    linhas = [[P("Tipo de Material", "celc"), P("Descrição")]]
    linhas += [[P(tp, "celc"), P(desc)] for tp, desc in t.referencias_complementares]
    s.append(Table(linhas, colWidths=[70, 433], style=GRADE))
    doc.build(s)


# ─── Valores esperados (verdade de campo) ────────────────────────────────────


def esperado_plano(t: Turma) -> dict:
    return {
        "codigo_disciplina": t.codigo,
        "nome_disciplina": t.nome_disciplina,
        "carga_horaria": str(t.carga_horaria),
        "turma": t.turma,
        "ano_semestre": t.semestre,
        "horario": t.horario,
        "pre_requisitos": t.pre_requisitos,
        "ementa": t.ementa,
        "matricula_docente": t.matricula_docente,
        "docente": t.docente,
        "carga_horaria_docente": str(t.ch_docente) if t.docente else "",
        "metodologia": t.metodologia,
        "procedimentos_avaliacao": t.procedimentos,
        "horario_atendimento": t.atendimento,
        "data_primeira_aula": t.aulas[0][0].strftime("%d/%m/%Y") if t.aulas else "",
        "data_primeira_avaliacao": t.avaliacoes[0][0] if t.avaliacoes else "",
        "referencia_basica": t.referencias_basicas[0][1] if t.referencias_basicas else "",
        "qtd_aulas_cronograma": str(len(t.aulas)),
    }


def esperado_diario(t: Turma, det: dict) -> dict:
    return {
        "data_emissao": t.emissao_txt,
        "status_turma": t.status_turma,
        "codigo_disciplina": t.codigo,
        "nome_disciplina": t.nome_disciplina,
        "creditos": str(t.creditos),
        "carga_horaria": str(t.carga_horaria),
        "turma": t.turma,
        "ano_semestre": t.semestre,
        "horario": t.horario,
        "matricula_docente": t.matricula_docente,
        "docente": t.docente,
        "codigo_verificacao": t.codigo_verificacao,
        "codigo_versao": t.versoes[0][2] if t.versoes else "",
        "qtd_alunos_sem_total_faltas": str(det.get("_qtd_sem_faltas", 0)),
        "qtd_alunos_sem_nota": str(det.get("_qtd_sem_nota", 0)),
        "qtd_aulas_sem_conteudo": str(det.get("_qtd_sem_conteudo", 0)),
    }


# ─── Robustez ────────────────────────────────────────────────────────────────


def rasterizar(origem: Path, destino: Path):
    """Converte o PDF em imagens e remonta um PDF sem texto selecionável."""
    from reportlab.pdfgen import canvas as rl_canvas
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["pdftoppm", "-r", "110", "-png", str(origem), f"{tmp}/p"], check=True)
        paginas = sorted(Path(tmp).glob("p-*.png"))
        c = rl_canvas.Canvas(str(destino))
        for png in paginas:
            from reportlab.lib.utils import ImageReader
            img = ImageReader(str(png))
            w, h = img.getSize()
            tam = (w * 72 / 110, h * 72 / 110)
            c.setPageSize(tam)
            c.drawImage(img, 0, 0, *tam)
            c.showPage()
        c.save()


# ─── Principal ───────────────────────────────────────────────────────────────


def sha256(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--seed", type=int, default=SEED_PADRAO)
    ap.add_argument("--saida", type=Path, default=Path(__file__).resolve().parent.parent)
    args = ap.parse_args()

    rng = random.Random(args.seed)
    raiz: Path = args.saida
    pdfs = raiz / "pdfs"
    for sub in ("planos", "diarios", "robustez"):
        shutil.rmtree(pdfs / sub, ignore_errors=True)
        (pdfs / sub).mkdir(parents=True, exist_ok=True)
    (raiz / "gabarito").mkdir(exist_ok=True)

    registros = []
    codigos = set()
    controles = {"plano": [], "diario": []}
    for tipo in ("plano", "diario"):
        composicao = list(COMPOSICAO[tipo])
        rng.shuffle(composicao)
        prefixo = "P" if tipo == "plano" else "D"
        for n, erros in enumerate(composicao, 1):
            t = sortear_turma(rng, codigos)
            codigo_original = t.codigo
            semestre_original = t.semestre
            det = aplicar_erros(t, erros, rng)
            if tipo == "plano":
                nome = f"{prefixo}{n:02d}_Plano_de_Curso_{codigo_original}_{semestre_original}_{t.turma}_.pdf"
                destino = pdfs / "planos" / nome
                render_plano(t, destino)
                esperado = esperado_plano(t)
                template = "Plano de Curso - SIGAA (testes)"
            else:
                nome = f"{prefixo}{n:02d}_diario_{codigo_original}_{semestre_original}_{t.turma}_.pdf"
                destino = pdfs / "diarios" / nome
                render_diario(t, destino)
                esperado = esperado_diario(t, det)
                template = "Diário de Turma - SIGAA (testes)"
            if not erros:
                controles[tipo].append(destino)
            registros.append({
                "arquivo": f"pdfs/{destino.parent.name}/{nome}",
                "tipo_documento": "Plano de Curso" if tipo == "plano" else "Diário de Turma",
                "template": template,
                "categoria": "erro" if erros else "controle",
                "erros": erros,
                "detalhes": {k: v for k, v in det.items() if not k.startswith("_")},
                "esperado": esperado,
                "sha256": sha256(destino),
            })

    # Arquivos de robustez
    rb = pdfs / "robustez"
    base_d, base_p = controles["diario"][0], controles["plano"][0]
    rasterizar(base_d, rb / "R01_diario_escaneado_sem_texto.pdf")
    dados = base_p.read_bytes()
    (rb / "R02_plano_corrompido.pdf").write_bytes(dados[: int(len(dados) * 0.55)])
    (rb / "R03_nao_e_pdf.pdf").write_text("Este arquivo tem extensão .pdf, mas é texto puro.\n", encoding="utf-8")
    shutil.copyfile(base_d, rb / ("R04_copia_identica_de_" + base_d.name))
    robustez = [
        ("R01_diario_escaneado_sem_texto.pdf", "RB01", "PDF só com imagem (sem texto selecionável)",
         "status erro_extracao com a mensagem 'PDF sem texto selecionável'"),
        ("R02_plano_corrompido.pdf", "RB02", "PDF truncado (corrompido), cabeçalho %PDF- preservado",
         "falha tratada: status erro_extracao ou erro HTTP, sem travar a fila"),
        ("R03_nao_e_pdf.pdf", "RB03", "Arquivo de texto com extensão .pdf",
         "HTTP 415 'O arquivo enviado não é um PDF válido'"),
        ("R04_copia_identica_de_" + base_d.name, "RB04", f"Cópia byte a byte de {base_d.name}",
         "HTTP 200 com reenviado=true e o mesmo id do documento original (sem registro duplicado)"),
    ]
    for arq, cod, desc, esp in robustez:
        p = rb / arq
        registros.append({
            "arquivo": f"pdfs/robustez/{arq}", "tipo_documento": "Robustez",
            "template": "Diário de Turma - SIGAA (testes)" if "diario" in arq else "Plano de Curso - SIGAA (testes)",
            "categoria": "robustez", "erros": [cod], "detalhes": {cod: desc}, "esperado": {},
            "resultado_esperado_robustez": esp, "sha256": sha256(p),
        })

    gab = {
        "gerado_em": datetime.now().isoformat(timespec="seconds"),
        "seed": args.seed,
        "catalogo_erros": ERROS | {
            "RB01": dict(doc="robustez", regra="-", classe="robustez", status="erro_extracao",
                         desc=robustez[0][2], onde="arquivo inteiro"),
            "RB02": dict(doc="robustez", regra="-", classe="robustez", status="erro_extracao",
                         desc=robustez[1][2], onde="arquivo inteiro"),
            "RB03": dict(doc="robustez", regra="-", classe="robustez", status="http_415",
                         desc=robustez[2][2], onde="arquivo inteiro"),
            "RB04": dict(doc="robustez", regra="-", classe="robustez", status="reenviado",
                         desc=robustez[3][2], onde="arquivo inteiro"),
        },
        "documentos": registros,
    }
    (raiz / "gabarito" / "gabarito.json").write_text(json.dumps(gab, ensure_ascii=False, indent=2), encoding="utf-8")

    with open(raiz / "gabarito" / "gabarito.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["arquivo", "tipo_documento", "categoria", "erro", "descricao_erro", "onde",
                    "regra_alvo", "classe", "status_regra_esperado", "decisao_esperada", "detalhe", "observacao"])
        for r in registros:
            if r["categoria"] == "controle":
                w.writerow([r["arquivo"], r["tipo_documento"], "controle", "-", "Documento sem erro", "-",
                            "todas", "-", "aprovado", "aprovado (aguardando_revisao, sem pendências)", "", ""])
                continue
            for e in r["erros"]:
                cat = gab["catalogo_erros"][e]
                if cat["classe"] == "robustez":
                    decisao = r["resultado_esperado_robustez"]
                elif cat["classe"] == "limitacao":
                    decisao = "aprovado (o erro passa: limitação conhecida)"
                elif cat["status"] == "nao_conforme":
                    decisao = "reprovado_automatico"
                else:
                    decisao = "aguardando_revisao (inconclusivo)"
                w.writerow([r["arquivo"], r["tipo_documento"], r["categoria"], e, cat["desc"], cat["onde"],
                            cat["regra"], cat["classe"], cat["status"], decisao, r["detalhes"].get(e, ""),
                            cat.get("obs", "")])

    n_err = sum(1 for r in registros if r["categoria"] == "erro")
    n_ctl = sum(1 for r in registros if r["categoria"] == "controle")
    print(f"Gerados {len(registros)} arquivos: {n_ctl} controles, {n_err} com erro, 4 de robustez.")
    print(f"Gabarito: {raiz / 'gabarito'}")


if __name__ == "__main__":
    main()
