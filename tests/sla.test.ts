import { describe, expect, test } from "bun:test";
import { calcularSla } from "../src/domain/sla.ts";

// Datas fixas com offset -03:00: o resultado não depende do fuso da máquina.
// Semana de referência: segunda 2026-03-02 a sexta 2026-03-06 (sem feriados).
// Exemplos: specs/sla-chamados.md, seção "Exemplos que viram testes".

type Prioridade = "alta" | "media" | "baixa";
type Estado = "no_prazo" | "vencendo" | "vencido" | "resolvido_no_prazo" | "resolvido_fora_do_prazo";

type Caso = {
  descricao: string;
  criadoEm: string;
  agora: string;
  decorrido: number;
  restante: number;
  estado: Estado;
};

const MIN = 1 / 60;
const PRAZO: Record<Prioridade, number> = { alta: 4, media: 16, baixa: 40 };

function verificarAbertos(prioridade: Prioridade, casos: Caso[]) {
  for (const c of casos) {
    test(`${c.descricao} → ${c.estado}`, () => {
      const sla = calcularSla(
        { prioridade, status: "aberto", criadoEm: new Date(c.criadoEm) },
        new Date(c.agora),
      );
      expect(sla.estado).toBe(c.estado);
      expect(sla.prazoHoras).toBe(PRAZO[prioridade]);
      expect(sla.decorridoHoras).toBeCloseTo(c.decorrido, 2);
      expect(sla.restanteHoras).toBeCloseTo(c.restante, 2);
    });
  }
}

describe("calcularSla: prioridade alta (prazo 4h, 75% = 3h)", () => {
  verificarAbertos("alta", [
    { descricao: "segunda 16:00 → segunda 17:00", criadoEm: "2026-03-02T16:00:00-03:00", agora: "2026-03-02T17:00:00-03:00", decorrido: 1, restante: 3, estado: "no_prazo" },
    { descricao: "segunda 16:00 → segunda 18:00", criadoEm: "2026-03-02T16:00:00-03:00", agora: "2026-03-02T18:00:00-03:00", decorrido: 2, restante: 2, estado: "no_prazo" },
    { descricao: "segunda 16:00 → terça 09:00 (a noite não conta)", criadoEm: "2026-03-02T16:00:00-03:00", agora: "2026-03-03T09:00:00-03:00", decorrido: 2, restante: 2, estado: "no_prazo" },
    { descricao: "segunda 16:00 → terça 10:00 (75% exato)", criadoEm: "2026-03-02T16:00:00-03:00", agora: "2026-03-03T10:00:00-03:00", decorrido: 3, restante: 1, estado: "vencendo" },
    { descricao: "segunda 16:00 → terça 11:00 (limite exato)", criadoEm: "2026-03-02T16:00:00-03:00", agora: "2026-03-03T11:00:00-03:00", decorrido: 4, restante: 0, estado: "vencendo" },
    { descricao: "segunda 16:00 → terça 11:01", criadoEm: "2026-03-02T16:00:00-03:00", agora: "2026-03-03T11:01:00-03:00", decorrido: 4 + MIN, restante: -0.02, estado: "vencido" },
    { descricao: "sábado 10:00 → segunda 09:00 (R3)", criadoEm: "2026-03-07T10:00:00-03:00", agora: "2026-03-09T09:00:00-03:00", decorrido: 0, restante: 4, estado: "no_prazo" },
    { descricao: "sábado 10:00 → segunda 13:00 (R3)", criadoEm: "2026-03-07T10:00:00-03:00", agora: "2026-03-09T13:00:00-03:00", decorrido: 4, restante: 0, estado: "vencendo" },
    { descricao: "sexta 17:00 → segunda 09:00 (o fim de semana não conta)", criadoEm: "2026-03-06T17:00:00-03:00", agora: "2026-03-09T09:00:00-03:00", decorrido: 1, restante: 3, estado: "no_prazo" },
    { descricao: "sexta 17:00 → segunda 11:00", criadoEm: "2026-03-06T17:00:00-03:00", agora: "2026-03-09T11:00:00-03:00", decorrido: 3, restante: 1, estado: "vencendo" },
  ]);
});

describe("calcularSla: prioridade media (prazo 16h, 75% = 12h), criado segunda 09:00", () => {
  verificarAbertos("media", [
    { descricao: "agora segunda 18:00", criadoEm: "2026-03-02T09:00:00-03:00", agora: "2026-03-02T18:00:00-03:00", decorrido: 9, restante: 7, estado: "no_prazo" },
    { descricao: "agora terça 11:59", criadoEm: "2026-03-02T09:00:00-03:00", agora: "2026-03-03T11:59:00-03:00", decorrido: 11 + 59 * MIN, restante: 4.02, estado: "no_prazo" },
    { descricao: "agora terça 12:00 (75% exato)", criadoEm: "2026-03-02T09:00:00-03:00", agora: "2026-03-03T12:00:00-03:00", decorrido: 12, restante: 4, estado: "vencendo" },
    { descricao: "agora terça 16:00 (limite exato)", criadoEm: "2026-03-02T09:00:00-03:00", agora: "2026-03-03T16:00:00-03:00", decorrido: 16, restante: 0, estado: "vencendo" },
    { descricao: "agora terça 16:01", criadoEm: "2026-03-02T09:00:00-03:00", agora: "2026-03-03T16:01:00-03:00", decorrido: 16 + MIN, restante: -0.02, estado: "vencido" },
  ]);
});

describe("calcularSla: prioridade baixa (prazo 40h, 75% = 30h), criado segunda 09:00", () => {
  verificarAbertos("baixa", [
    { descricao: "agora quinta 12:00 (75% exato)", criadoEm: "2026-03-02T09:00:00-03:00", agora: "2026-03-05T12:00:00-03:00", decorrido: 30, restante: 10, estado: "vencendo" },
    { descricao: "agora sexta 13:00 (limite exato)", criadoEm: "2026-03-02T09:00:00-03:00", agora: "2026-03-06T13:00:00-03:00", decorrido: 40, restante: 0, estado: "vencendo" },
    { descricao: "agora sexta 13:01", criadoEm: "2026-03-02T09:00:00-03:00", agora: "2026-03-06T13:01:00-03:00", decorrido: 40 + MIN, restante: -0.02, estado: "vencido" },
  ]);
});

describe("calcularSla: prioridade baixa, criado quinta 09:00 (atravessa o fim de semana)", () => {
  verificarAbertos("baixa", [
    { descricao: "agora quarta seguinte 13:00 (limite exato)", criadoEm: "2026-03-05T09:00:00-03:00", agora: "2026-03-11T13:00:00-03:00", decorrido: 40, restante: 0, estado: "vencendo" },
    { descricao: "agora quarta seguinte 13:01", criadoEm: "2026-03-05T09:00:00-03:00", agora: "2026-03-11T13:01:00-03:00", decorrido: 40 + MIN, restante: -0.02, estado: "vencido" },
  ]);
});

describe("calcularSla: chamado resolvido (alta, criado segunda 16:00)", () => {
  // `agora` bem depois da resolução: o fim da contagem tem que ser `resolvidoEm` (R2).
  const agora = new Date("2026-03-11T17:00:00-03:00");

  const casos: Array<{ descricao: string; resolvidoEm: string; decorrido: number; restante: number; estado: Estado }> = [
    { descricao: "resolvido terça 11:00 (limite exato)", resolvidoEm: "2026-03-03T11:00:00-03:00", decorrido: 4, restante: 0, estado: "resolvido_no_prazo" },
    { descricao: "resolvido terça 11:01", resolvidoEm: "2026-03-03T11:01:00-03:00", decorrido: 4 + MIN, restante: -0.02, estado: "resolvido_fora_do_prazo" },
  ];

  for (const c of casos) {
    test(`${c.descricao} → ${c.estado}`, () => {
      const sla = calcularSla(
        {
          prioridade: "alta",
          status: "resolvido",
          criadoEm: new Date("2026-03-02T16:00:00-03:00"),
          resolvidoEm: new Date(c.resolvidoEm),
        },
        agora,
      );
      expect(sla.estado).toBe(c.estado);
      expect(sla.prazoHoras).toBe(4);
      expect(sla.decorridoHoras).toBeCloseTo(c.decorrido, 2);
      expect(sla.restanteHoras).toBeCloseTo(c.restante, 2);
    });
  }
});

describe("calcularSla: casos adicionais", () => {
  test("criado no futuro → decorrido 0 e no_prazo (R7)", () => {
    const sla = calcularSla(
      { prioridade: "alta", status: "aberto", criadoEm: new Date("2026-03-03T10:00:00-03:00") },
      new Date("2026-03-02T10:00:00-03:00"),
    );
    expect(sla.estado).toBe("no_prazo");
    expect(sla.decorridoHoras).toBe(0);
    expect(sla.restanteHoras).toBeCloseTo(4, 2);
  });

  test("em_andamento não pausa o relógio: mesmo estado que aberto (R4)", () => {
    const criadoEm = new Date("2026-03-02T16:00:00-03:00");
    const agora = new Date("2026-03-03T10:00:00-03:00");

    const emAndamento = calcularSla({ prioridade: "alta", status: "em_andamento", criadoEm }, agora);
    const aberto = calcularSla({ prioridade: "alta", status: "aberto", criadoEm }, agora);

    expect(emAndamento.estado).toBe("vencendo");
    expect(emAndamento).toEqual(aberto);
  });

  test("4h00min10s em alta → vencido: a classificação usa o valor sem arredondar (R5 com R8)", () => {
    // restanteHoras arredondado dá 0, mas o decorrido real (≈4,0028h) passou do prazo.
    const sla = calcularSla(
      { prioridade: "alta", status: "aberto", criadoEm: new Date("2026-03-02T16:00:00-03:00") },
      new Date("2026-03-03T11:00:10-03:00"),
    );
    expect(sla.estado).toBe("vencido");
  });
});
