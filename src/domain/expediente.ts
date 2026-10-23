// Expediente: segunda a sexta, 09:00 às 18:00, fuso fixo UTC-3 (spec R1).
// Função pura: não lê o relógio nem depende do fuso da máquina.

const HORA_MS = 60 * 60 * 1000;
const DIA_MS = 24 * HORA_MS;
const OFFSET_MS = -3 * HORA_MS;
const ABERTURA = 9;
const FECHAMENTO = 18;

// Horas úteis entre duas datas. Se `fim` não for depois de `inicio`, devolve 0 (R7).
export function horasUteisEntre(inicio: Date, fim: Date): number {
  // Desloca para o horário de Brasília e lê com getUTC*: o "UTC" passa a ser a hora local de lá.
  const ini = inicio.getTime() + OFFSET_MS;
  const fi = fim.getTime() + OFFSET_MS;
  if (fi <= ini) return 0;

  let totalMs = 0;
  for (let dia = Math.floor(ini / DIA_MS) * DIA_MS; dia < fi; dia += DIA_MS) {
    const diaDaSemana = new Date(dia).getUTCDay();
    if (diaDaSemana === 0 || diaDaSemana === 6) continue;

    const de = Math.max(ini, dia + ABERTURA * HORA_MS);
    const ate = Math.min(fi, dia + FECHAMENTO * HORA_MS);
    if (ate > de) totalMs += ate - de;
  }

  return totalMs / HORA_MS;
}
