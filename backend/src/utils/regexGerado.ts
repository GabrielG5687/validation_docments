const PERIGOSO = /(\([^)]*[+*][^)]*\))[+*{]|(\.\*){2,}|(\.\+){2,}/

export function validarRegexGerado(raw: string): string {
  let fonte = raw.trim()
  if (fonte.startsWith('/') && fonte.lastIndexOf('/') > 0) {
    fonte = fonte.slice(1, fonte.lastIndexOf('/'))
  }
  fonte = fonte.trim()
  if (!fonte || fonte.length > 180) throw new Error('A expressão gerada é inválida ou longa demais.')
  if (PERIGOSO.test(fonte)) throw new Error('A expressão gerada é insegura e foi recusada.')
  try {
    RegExp(fonte)
  } catch {
    throw new Error('A expressão gerada não é uma regex válida.')
  }
  return fonte
}
