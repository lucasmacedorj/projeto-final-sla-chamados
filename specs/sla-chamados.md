# Spec: SLA dos chamados

## Problema

No suporte, cada chamado tem um prazo de atendimento que depende da prioridade.
Hoje a API não diz se um chamado está dentro do prazo: quem acompanha precisa
calcular de cabeça, a partir da data de criação, descontando noites e fins de semana.

Queremos que a API calcule e devolva o **estado do SLA** de cada chamado,
contando apenas o horário comercial.

## Decisões

| # | Decisão | Valor adotado | Origem |
|---|---|---|---|
| A | Prazo por prioridade, em **horas úteis** | alta 4h, media 16h, baixa 40h | sua decisão |
| B | Como o tempo é contado | Horas úteis: segunda a sexta, 09:00 às 18:00, fuso UTC-3 (Brasília). Feriados fora do escopo | sua decisão (horário comercial e expediente); feriados fora: proposta |
| C | Quando passa a "vencendo" | Com 75% ou mais do prazo consumido | sua decisão |
| D | No limite exato do prazo | Ainda "vencendo" (ou "no prazo", se resolvido). Só passa se **ultrapassar** | sua decisão |
| E | Chamado resolvido | Informa se foi resolvido dentro do prazo ou fora | sua decisão |
| F | Status `em_andamento` | Existe, e **não pausa** o relógio do SLA | sua decisão |
| G | Quem pode ser resolvido | **Qualquer** chamado não resolvido, inclusive direto de `aberto` | sua decisão (discordou da proposta) |
| H | Resolvido sem `resolvidoEm` | A função lança um erro (dado inconsistente) | lacuna achada ao revisar o plano da IA; decisão sua |
| I | Arredondamento | 2 casas só no objeto devolvido; a classificação usa o valor exato | lacuna achada ao revisar o plano da IA; decisão sua |

> Se mudar uma decisão, atualize esta tabela **antes** de mexer no código.

Nota sobre A: com expediente de 9h por dia, 16h úteis são cerca de 1,8 dia útil e 40h úteis são cerca de 4,4 dias úteis.

## Modelo

Chamado:

- `titulo`: texto, obrigatório
- `prioridade`: `alta`, `media` ou `baixa`
- `status`: `aberto`, `em_andamento` ou `resolvido`
- `criadoEm`: data de criação (definida pelo servidor)
- `resolvidoEm`: data de resolução (só existe se resolvido)

Transições permitidas:

| De | Para | Rota |
|---|---|---|
| aberto | em_andamento | `POST /:id/iniciar` |
| aberto | resolvido | `POST /:id/resolver` |
| em_andamento | resolvido | `POST /:id/resolver` |

Qualquer outra transição é recusada com 409 `TRANSICAO_INVALIDA`.

## Cálculo do SLA

Duas funções puras, sem relógio e sem banco:

- `horasUteisEntre(inicio, fim)`: horas úteis entre duas datas.
- `calcularSla(chamado, agora)`: devolve `{ estado, prazoHoras, decorridoHoras, restanteHoras }`.

Regras:

- R1. Expediente: segunda a sexta, 09:00 às 18:00 (UTC-3). Fora dele o relógio **não corre**.
- R2. `decorrido` = tempo, dentro do expediente, entre `criadoEm` e o fim. O fim é `agora` para chamado não resolvido, e `resolvidoEm` para resolvido.
- R3. Chamado criado fora do expediente: a contagem começa na próxima abertura do expediente.
- R4. `em_andamento` não pausa o relógio.
- R5. Status `aberto` ou `em_andamento`:
  - `decorrido` menor que 75% do prazo: `no_prazo`
  - `decorrido` de 75% do prazo até o prazo, **inclusive**: `vencendo`
  - `decorrido` maior que o prazo: `vencido`
- R6. Status `resolvido`:
  - `decorrido` menor ou igual ao prazo: `resolvido_no_prazo`
  - `decorrido` maior que o prazo: `resolvido_fora_do_prazo`
- R6b. Chamado `resolvido` sem `resolvidoEm` é dado inconsistente: a função lança um erro, em vez de assumir uma data.
- R7. `criadoEm` no futuro: tratado como `decorrido` zero.
- R8. `restanteHoras = prazoHoras - decorridoHoras`. `decorridoHoras` e `restanteHoras` são arredondados em 2 casas **só no objeto devolvido**; a classificação (R5 e R6) usa o valor exato. Negativo significa atraso.

## Endpoints

Todas as rotas `/api/*` exigem o header `x-api-key` (401 `NAO_AUTORIZADO`).
`GET /` é público (health check).

- R9. `POST /api/chamados` com `{ titulo, prioridade }`: 201, chamado `aberto`, com o campo `sla`.
- R10. `GET /api/chamados`: lista, cada item com `sla`. Filtro opcional `?sla=no_prazo|vencendo|vencido|resolvido_no_prazo|resolvido_fora_do_prazo`.
- R11. `GET /api/chamados/:id`: 200 com `sla`. Se não existir: 404 `NAO_ENCONTRADO`.
- R12. `POST /api/chamados/:id/iniciar`: `aberto` vira `em_andamento`. Em outro status: 409.
- R13. `POST /api/chamados/:id/resolver`: `aberto` ou `em_andamento` vira `resolvido`, com `resolvidoEm`. Se já estava resolvido: 409.

## Erros

- R14. Id malformado em qualquer rota: 400 `ID_INVALIDO`.
- R15. `titulo` ausente ou vazio, `prioridade` fora da lista, ou valor inválido em `?sla=`: 422 `DADOS_INVALIDOS`.

## Proibido

- Nenhuma entrada inválida pode responder 500.
- As funções de SLA **não** leem o relógio (`new Date()`) nem acessam o banco.
- Nenhuma regra de negócio mora na rota. A rota só chama o service.

## Exemplos que viram testes

Expediente: segunda a sexta, 09:00 às 18:00 (9h por dia).

Prioridade alta (prazo 4h úteis, 75% = 3h):

| Criado | Agora | Decorrido | Estado | Regra |
|---|---|---|---|---|
| segunda 16:00 | segunda 17:00 | 1h | `no_prazo` | R5 |
| segunda 16:00 | segunda 18:00 | 2h | `no_prazo` | R5 |
| segunda 16:00 | terça 09:00 | 2h (a noite não conta) | `no_prazo` | R1 |
| segunda 16:00 | terça 10:00 | 3h | `vencendo` (75% exato) | R5 |
| segunda 16:00 | terça 11:00 | 4h | `vencendo` (limite exato) | R5 |
| segunda 16:00 | terça 11:01 | 4h01 | `vencido` | R5 |
| sábado 10:00 | segunda 09:00 | 0h | `no_prazo` | R3 |
| sábado 10:00 | segunda 13:00 | 4h | `vencendo` | R3 |
| sexta 17:00 | segunda 09:00 | 1h (o fim de semana não conta) | `no_prazo` | R1 |
| sexta 17:00 | segunda 11:00 | 3h | `vencendo` | R1 |

Prioridade media (prazo 16h úteis, 75% = 12h), criado segunda 09:00:

| Agora | Decorrido | Estado | Regra |
|---|---|---|---|
| segunda 18:00 | 9h | `no_prazo` | R5 |
| terça 11:59 | 11h59 | `no_prazo` | R5 |
| terça 12:00 | 12h | `vencendo` (75% exato) | R5 |
| terça 16:00 | 16h | `vencendo` (limite exato) | R5 |
| terça 16:01 | 16h01 | `vencido` | R5 |

Prioridade baixa (prazo 40h úteis, 75% = 30h), criado segunda 09:00:

| Agora | Decorrido | Estado | Regra |
|---|---|---|---|
| quinta 12:00 | 30h | `vencendo` (75% exato) | R5 |
| sexta 13:00 | 40h | `vencendo` (limite exato) | R5 |
| sexta 13:01 | 40h01 | `vencido` | R5 |

Prioridade baixa, criado **quinta 09:00** (a contagem atravessa o fim de semana):

| Agora | Decorrido | Estado | Regra |
|---|---|---|---|
| quarta seguinte 13:00 | 40h | `vencendo` (limite exato) | R1 |
| quarta seguinte 13:01 | 40h01 | `vencido` | R1 |

Chamado resolvido (alta, criado segunda 16:00):

| Resolvido em | Decorrido | Estado | Regra |
|---|---|---|---|
| terça 11:00 | 4h | `resolvido_no_prazo` (limite exato) | R6 |
| terça 11:01 | 4h01 | `resolvido_fora_do_prazo` | R6 |
| (sem `resolvidoEm`) | n/a | erro: a função lança | R6b |

Criado no futuro: `decorrido` 0 e `no_prazo` (R7).

## Estrutura do projeto

```
src/
  index.ts          liga tudo
  config/           env.ts, db.ts
  middleware/       logger.ts, auth.ts, errorHandler.ts
  routes/           chamados.ts
  services/         chamados.service.ts
  repositories/     chamados.repo.ts, objectId.ts
  domain/           types.ts, errors.ts, expediente.ts, sla.ts
scripts/seed.ts     chamados de idades e status variados, para a demonstração
tests/              expediente.test.ts, sla.test.ts
specs/              sla-chamados.md
NOTAS-IA.md         onde discordei da IA e por quê
```

## Limites conhecidos

- Feriados não são considerados.
- O fuso é fixo em UTC-3. Isso vale enquanto o Brasil não tiver horário de verão.
- Sem pausa do relógio, sem horário de almoço.

## Fora do escopo

- Feriados, pausar o SLA, horário de almoço.
- Notificações, página web, usuários e permissões.
- Editar ou apagar chamados.
