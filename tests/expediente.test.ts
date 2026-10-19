import { describe, expect, test } from "bun:test";
import { horasUteisEntre } from "../src/domain/expediente.ts";

// Datas fixas com offset -03:00: o resultado não depende do fuso da máquina.
// Semana de referência: segunda 2026-03-02 a sexta 2026-03-06 (sem feriados).
// Exemplos: specs/sla-chamados.md, seção "Exemplos que viram testes", coluna "Decorrido".

type Caso = { descricao: string; inicio: string; fim: string; horas: number };

const MIN = 1 / 60;

function verificar(casos: Caso[]) {
  for (const c of casos) {
    test(`${c.descricao} = ${c.horas.toFixed(4)}h`, () => {
      expect(horasUteisEntre(new Date(c.inicio), new Date(c.fim))).toBeCloseTo(c.horas, 2);
    });
  }
}

describe("horasUteisEntre: tabela da prioridade alta", () => {
  verificar([
    { descricao: "segunda 16:00 → segunda 17:00", inicio: "2026-03-02T16:00:00-03:00", fim: "2026-03-02T17:00:00-03:00", horas: 1 },
    { descricao: "segunda 16:00 → segunda 18:00", inicio: "2026-03-02T16:00:00-03:00", fim: "2026-03-02T18:00:00-03:00", horas: 2 },
    { descricao: "segunda 16:00 → terça 09:00 (a noite não conta)", inicio: "2026-03-02T16:00:00-03:00", fim: "2026-03-03T09:00:00-03:00", horas: 2 },
    { descricao: "segunda 16:00 → terça 10:00", inicio: "2026-03-02T16:00:00-03:00", fim: "2026-03-03T10:00:00-03:00", horas: 3 },
    { descricao: "segunda 16:00 → terça 11:00", inicio: "2026-03-02T16:00:00-03:00", fim: "2026-03-03T11:00:00-03:00", horas: 4 },
    { descricao: "segunda 16:00 → terça 11:01", inicio: "2026-03-02T16:00:00-03:00", fim: "2026-03-03T11:01:00-03:00", horas: 4 + MIN },
    { descricao: "sábado 10:00 → segunda 09:00 (R3)", inicio: "2026-03-07T10:00:00-03:00", fim: "2026-03-09T09:00:00-03:00", horas: 0 },
    { descricao: "sábado 10:00 → segunda 13:00 (R3)", inicio: "2026-03-07T10:00:00-03:00", fim: "2026-03-09T13:00:00-03:00", horas: 4 },
    { descricao: "sexta 17:00 → segunda 09:00 (o fim de semana não conta)", inicio: "2026-03-06T17:00:00-03:00", fim: "2026-03-09T09:00:00-03:00", horas: 1 },
    { descricao: "sexta 17:00 → segunda 11:00", inicio: "2026-03-06T17:00:00-03:00", fim: "2026-03-09T11:00:00-03:00", horas: 3 },
  ]);
});

describe("horasUteisEntre: tabela da prioridade media (criado segunda 09:00)", () => {
  verificar([
    { descricao: "segunda 09:00 → segunda 18:00", inicio: "2026-03-02T09:00:00-03:00", fim: "2026-03-02T18:00:00-03:00", horas: 9 },
    { descricao: "segunda 09:00 → terça 11:59", inicio: "2026-03-02T09:00:00-03:00", fim: "2026-03-03T11:59:00-03:00", horas: 11 + 59 * MIN },
    { descricao: "segunda 09:00 → terça 12:00", inicio: "2026-03-02T09:00:00-03:00", fim: "2026-03-03T12:00:00-03:00", horas: 12 },
    { descricao: "segunda 09:00 → terça 16:00", inicio: "2026-03-02T09:00:00-03:00", fim: "2026-03-03T16:00:00-03:00", horas: 16 },
    { descricao: "segunda 09:00 → terça 16:01", inicio: "2026-03-02T09:00:00-03:00", fim: "2026-03-03T16:01:00-03:00", horas: 16 + MIN },
  ]);
});

describe("horasUteisEntre: tabela da prioridade baixa (criado segunda 09:00)", () => {
  verificar([
    { descricao: "segunda 09:00 → quinta 12:00", inicio: "2026-03-02T09:00:00-03:00", fim: "2026-03-05T12:00:00-03:00", horas: 30 },
    { descricao: "segunda 09:00 → sexta 13:00", inicio: "2026-03-02T09:00:00-03:00", fim: "2026-03-06T13:00:00-03:00", horas: 40 },
    { descricao: "segunda 09:00 → sexta 13:01", inicio: "2026-03-02T09:00:00-03:00", fim: "2026-03-06T13:01:00-03:00", horas: 40 + MIN },
  ]);
});

describe("horasUteisEntre: tabela da prioridade baixa (criado quinta 09:00, atravessa o fim de semana)", () => {
  verificar([
    { descricao: "quinta 09:00 → quarta seguinte 13:00", inicio: "2026-03-05T09:00:00-03:00", fim: "2026-03-11T13:00:00-03:00", horas: 40 },
    { descricao: "quinta 09:00 → quarta seguinte 13:01", inicio: "2026-03-05T09:00:00-03:00", fim: "2026-03-11T13:01:00-03:00", horas: 40 + MIN },
  ]);
});

describe("horasUteisEntre: tabela de chamado resolvido (criado segunda 16:00)", () => {
  verificar([
    { descricao: "segunda 16:00 → terça 11:00", inicio: "2026-03-02T16:00:00-03:00", fim: "2026-03-03T11:00:00-03:00", horas: 4 },
    { descricao: "segunda 16:00 → terça 11:01", inicio: "2026-03-02T16:00:00-03:00", fim: "2026-03-03T11:01:00-03:00", horas: 4 + MIN },
  ]);
});
