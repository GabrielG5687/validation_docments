import { recalcularValidades } from './validadeService'

const INTERVALO_MS = 60 * 60 * 1000

function chaveDia(data: Date): string {
  return `${data.getFullYear()}-${data.getMonth() + 1}-${data.getDate()}`
}

export function iniciarJobVencimento(): () => void {
  let diaExecutado: string | null = null
  let emExecucao = false

  async function executarSeNecessario(): Promise<void> {
    if (emExecucao) return
    const hoje = chaveDia(new Date())
    if (hoje === diaExecutado) return
    emExecucao = true
    try {
      const notificadas = await recalcularValidades()
      console.info(`[JobVencimento] validades recalculadas · ${notificadas} notificação(ões) de vencimento`)
      diaExecutado = hoje
    } catch (error) {
      console.error('[JobVencimento] falha no recálculo de validades', error)
      // não marca o dia — permite retry no próximo intervalo
    } finally {
      emExecucao = false
    }
  }

  const timer = setInterval(executarSeNecessario, INTERVALO_MS)
  void executarSeNecessario()
  return () => clearInterval(timer)
}

export default { iniciarJobVencimento }
