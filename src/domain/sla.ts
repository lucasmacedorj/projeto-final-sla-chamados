import { horasUteisEntre } from "./expediente.ts";

export type Prioridade = "alta" | "media" | "baixa";
export type Status = "aberto" | "em_andamento" | "resolvido";
export type EstadoSla = "no_prazo" | "vencendo" | "vencido" | "resolvido_no_prazo" | "resolvido_fora_do_prazo";

export type ChamadoSla = {
  prioridade: Prioridade;
  status: Status;
  criadoEm: Date;
  resolvidoEm?: Date;
};

export type Sla = {
  estado: EstadoSla;
  prazoHoras: number;
  decorridoHoras: number;
  restanteHoras: number;
};

// Prazo em horas úteis por prioridade (decisão A).
export const PRAZO_HORAS: Record<Prioridade, number> = { alta: 4, media: 16, baixa: 40 };

// A partir de 75% do prazo consumido o chamado está "vencendo" (decisão C).
const LIMIAR_VENCENDO = 0.75;

// Estado do SLA. Função pura: o `agora` vem de fora.
export function calcularSla(chamado: ChamadoSla, agora: Date): Sla {
  const resolvido = chamado.status === "resolvido";
  if (resolvido && !chamado.resolvidoEm) {
    throw new Error("Chamado resolvido sem resolvidoEm: dado inconsistente (R6b)");
  }

  // R2: o fim é `resolvidoEm` se resolvido; senão `agora`. em_andamento não pausa (R4).
  const fim = resolvido ? chamado.resolvidoEm! : agora;
  const prazo = PRAZO_HORAS[chamado.prioridade];
  const decorrido = horasUteisEntre(chamado.criadoEm, fim);

  // R8: a classificação usa o valor exato; só o objeto devolvido é arredondado.
  return {
    estado: classificar(decorrido, prazo, resolvido),
    prazoHoras: prazo,
    decorridoHoras: arredondar2(decorrido),
    restanteHoras: arredondar2(prazo - decorrido),
  };
}

function classificar(decorrido: number, prazo: number, resolvido: boolean): EstadoSla {
  if (resolvido) return decorrido <= prazo ? "resolvido_no_prazo" : "resolvido_fora_do_prazo"; // R6
  if (decorrido > prazo) return "vencido"; // R5
  if (decorrido >= LIMIAR_VENCENDO * prazo) return "vencendo";
  return "no_prazo";
}

// 2 casas; converte -0 em 0 (ex.: restante de -0,0028h).
function arredondar2(valor: number): number {
  const r = Math.round(valor * 100) / 100;
  return r === 0 ? 0 : r;
}
