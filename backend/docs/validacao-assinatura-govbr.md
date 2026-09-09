# Validação de assinatura digital (gov.br / ICP-Brasil)

A verificação usa o **CMS/PKCS#7 embutido no PDF** (`/ByteRange` + `/Contents`). Texto “documento assinado”, imagem de rubrica, QR Code, carimbo visual ou a palavra “gov.br” **não** são prova de autenticidade.

Fluxo: `POST /api/documentos/:id/validar-assinatura` → `validarAssinaturasPdf` → parser PDF → verificação CMS → cadeia ICP-Brasil → CRL (se possível) → integridade do ByteRange.

O mesmo fluxo roda automaticamente em `processarDocumento` e o resultado fica em `dadosExtraidos._assinaturaGov`. Falha de assinatura **não** reprova o documento nas regras do template.

## O que a aplicação valida diretamente

| Verificação | Como |
| --- | --- |
| Presença de assinatura digital | Dicionário PDF com `/ByteRange` e `/Contents` (DER PKCS#7) |
| Integridade do conteúdo assinado | Hash dos bytes do ByteRange = atributo `messageDigest` |
| Assinatura criptográfica | RSA PKCS#1, RSA-PSS ou ECDSA sobre os atributos autenticados |
| Certificado do assinante | CN, DN, emissor, serial, `notBefore` / `notAfter` |
| Documento alterado após assinar | Bytes depois do último intervalo do ByteRange |
| Indício ICP-Brasil | OID de política `2.16.76.1` e/ou “ICP-Brasil” no DN |
| Cadeia embarcada | Assinatura emissor → certificado seguinte no CMS |

## O que depende de material ou serviço externo

| Verificação | Dependência |
| --- | --- |
| Âncora da AC Raiz ICP-Brasil | PEMs em `backend/certs/icp-brasil/` (baixe a AC Raiz no [repositório ITI](https://www.gov.br/iti/pt-br)) |
| Revogação | HTTP nas CRLs do certificado (`cRLDistributionPoints`). Timeout de 5 s. Se a rede falhar: `revogacaoVerificada: false` |
| OCSP | **Não** consultado nesta versão |

Sem a AC Raiz no disco, a cadeia ainda é conferida entre os certificados **dentro** do CMS. Isso detecta cadeia quebrada no arquivo, mas não substitui a âncora oficial da ICP-Brasil.

## Status agregados

`VALIDA` · `INVALIDA` · `DOCUMENTO_ALTERADO` · `CERTIFICADO_INVALIDO` · `CERTIFICADO_EXPIRADO` · `CERTIFICADO_REVOGADO` · `SEM_ASSINATURA` · `NAO_ICP_BRASIL` · `NAO_FOI_POSSIVEL_VALIDAR`

PDFs com várias assinaturas: cada uma é avaliada; o status geral só é `VALIDA` se **todas** forem ICP-Brasil, criptograficamente válidas e o arquivo estiver íntegro.
