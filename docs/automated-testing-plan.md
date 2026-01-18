# Plano de Implementacao de Testes Automatizados

**Data**: 2026-01-18
**Branch**: `claude/plan-automated-testing-Z3xVK`
**Status**: Planejamento

---

## 1. Analise do Estado Atual

### 1.1 Infraestrutura Existente

| Aspecto | Shannon | GhostShell | Root |
|---------|---------|------------|------|
| Framework de Teste | Vitest v4.0.17 | Nenhum | Nenhum |
| Arquivos de Teste | 0 | 0 | 0 |
| Configuracao de Teste | Nenhuma | Nenhuma | Nenhuma |
| CI/CD | Nenhum | Nenhum | Nenhum |
| Cobertura de Codigo | Nenhuma | Nenhuma | Nenhuma |

### 1.2 Scripts de Teste Existentes (Shannon)

```json
{
  "test:service": "vitest run --dir src/service",
  "test:service:watch": "vitest --dir src/service"
}
```

**Nota**: Scripts definidos mas sem arquivos de teste para executar.

### 1.3 Estrutura de Diretorios

```
shannon/
├── src/
│   ├── temporal/          # Workflows, activities, worker
│   ├── ai/                # Claude executor
│   ├── audit/             # Logging e metricas
│   ├── service/           # Servicos HTTP
│   └── mcp-server/        # MCP server
├── configs/               # Arquivos YAML
└── prompts/               # Templates de prompt

ghostshell/
├── app/                   # Next.js app router
├── components/            # React components
├── lib/                   # Utilitarios e logica
└── prisma/                # Schema e migrations
```

---

## 2. Estrategia de Testes Proposta

### 2.1 Piramide de Testes

```
                    /\
                   /  \
                  / E2E \        <- Playwright (poucos, criticos)
                 /--------\
                /Integration\    <- Testes de integracao
               /--------------\
              /   Unit Tests    \ <- Vitest (maioria)
             /--------------------\
```

### 2.2 Tipos de Teste por Pacote

#### Shannon (Pentest Engine)

| Tipo | Framework | Alvo | Prioridade |
|------|-----------|------|------------|
| Unit | Vitest | Parsers, validadores, utilitarios | P1 |
| Unit | Vitest | Error handling, retry logic | P1 |
| Integration | Vitest | Temporal activities (mock) | P2 |
| Integration | Vitest | Claude executor (mock) | P2 |
| E2E | Vitest + Temporal | Workflow completo (test mode) | P3 |

#### GhostShell (Web Application)

| Tipo | Framework | Alvo | Prioridade |
|------|-----------|------|------------|
| Unit | Vitest | Utilitarios, helpers | P1 |
| Component | Testing Library | React components | P1 |
| Integration | Vitest | API routes, server actions | P2 |
| E2E | Playwright | Fluxos criticos de usuario | P3 |

### 2.3 Metas de Cobertura

| Fase | Meta | Timeline Sugerido |
|------|------|-------------------|
| MVP | 40% cobertura em modulos criticos | Fase 1 |
| Intermediario | 60% cobertura geral | Fase 2 |
| Completo | 80% cobertura, 100% em paths criticos | Fase 3 |

---

## 3. Roteiro de Uso do Spec-Kit

### 3.1 Visao Geral do Workflow Spec-Kit

```
/speckit.constitution  ->  Define principios do projeto
        |
        v
/speckit.specify       ->  Cria especificacao da feature
        |
        v
/speckit.clarify       ->  Esclarece requisitos (se necessario)
        |
        v
/speckit.plan          ->  Gera plano tecnico de implementacao
        |
        v
/speckit.tasks         ->  Quebra em tarefas executaveis
        |
        v
/speckit.analyze       ->  Valida consistencia dos artefatos
        |
        v
/speckit.implement     ->  Executa implementacao
```

### 3.2 Passo a Passo Detalhado

---

#### Passo 1: Configurar Constitution (Opcional)

**Comando**: `/speckit.constitution`

**Objetivo**: Definir principios que guiarao a implementacao de testes.

**Exemplo de Input**:
```
Adicionar principio de qualidade de codigo:
- Todo codigo novo deve ter testes unitarios
- Cobertura minima de 80% em modulos criticos
- Testes devem rodar em CI antes de merge
```

**Output Esperado**: `.specify/memory/constitution.md` atualizado

---

#### Passo 2: Criar Especificacao de Testes

**Comando**: `/speckit.specify Implementar infraestrutura de testes automatizados para monorepo Shannon`

**Objetivo**: Criar especificacao formal dos requisitos de teste.

**Conteudo Esperado da Spec**:
- User stories para configuracao de testes
- Requisitos funcionais (frameworks, cobertura, CI)
- Criterios de sucesso mensuraveis
- Cenarios de teste

**Output Esperado**:
- Branch: `XXX-automated-testing`
- Arquivo: `specs/XXX-automated-testing/spec.md`
- Checklist: `specs/XXX-automated-testing/checklists/requirements.md`

---

#### Passo 3: Esclarecer Requisitos

**Comando**: `/speckit.clarify`

**Objetivo**: Resolver ambiguidades na especificacao.

**Perguntas Tipicas**:
- Qual nivel de cobertura e aceitavel para MVP?
- Devemos incluir testes E2E na primeira fase?
- Qual ferramenta de CI preferida (GitHub Actions, etc)?

---

#### Passo 4: Criar Plano Tecnico

**Comando**: `/speckit.plan`

**Objetivo**: Definir arquitetura tecnica e decisoes.

**Artefatos Gerados**:
- `plan.md` - Stack tecnico, bibliotecas, estrutura
- `research.md` - Decisoes tecnicas documentadas
- `data-model.md` - Estrutura de dados (se aplicavel)
- `contracts/` - APIs e interfaces

**Decisoes Esperadas**:
```markdown
## Tech Stack para Testes

### Shannon Package
- Framework: Vitest (ja instalado)
- Mocking: vi.mock, vi.fn
- Coverage: @vitest/coverage-v8

### GhostShell Package
- Framework: Vitest
- Component Testing: @testing-library/react
- E2E: Playwright

### CI/CD
- GitHub Actions
- PR checks obrigatorios
```

---

#### Passo 5: Gerar Tarefas

**Comando**: `/speckit.tasks`

**Objetivo**: Criar lista de tarefas ordenadas por dependencia.

**Estrutura Esperada**:
```markdown
## Phase 1: Setup

- [ ] T001 Criar vitest.config.ts em shannon/
- [ ] T002 Criar vitest.config.ts em ghostshell/
- [ ] T003 [P] Instalar dependencias de teste em ghostshell
- [ ] T004 [P] Configurar coverage em ambos pacotes
- [ ] T005 Adicionar scripts de teste no root package.json

## Phase 2: Foundational

- [ ] T006 Criar diretorio de test fixtures em shannon/
- [ ] T007 Criar test utilities compartilhados
- [ ] T008 Configurar GitHub Actions workflow

## Phase 3: User Story 1 - Testes Unitarios Shannon

- [ ] T009 [US1] Criar testes para config-parser.ts
- [ ] T010 [US1] Criar testes para error-handling.ts
- [ ] T011 [US1] [P] Criar testes para tool-checker.ts
- [ ] T012 [US1] [P] Criar testes para session-manager.ts

## Phase 4: User Story 2 - Testes Unitarios GhostShell

- [ ] T013 [US2] Criar testes para lib/utils
- [ ] T014 [US2] [P] Criar testes para components basicos

## Phase 5: User Story 3 - CI/CD

- [ ] T015 [US3] Criar workflow de testes em PR
- [ ] T016 [US3] Configurar badges de cobertura

## Phase 6: Polish

- [ ] T017 Documentar guia de testes
- [ ] T018 Adicionar pre-commit hooks
```

---

#### Passo 6: Analisar Consistencia

**Comando**: `/speckit.analyze`

**Objetivo**: Validar que spec, plan e tasks estao alinhados.

**Checklist de Validacao**:
- Todas as user stories tem tarefas correspondentes
- Dependencias estao corretas
- Criterios de sucesso sao verificaveis

---

#### Passo 7: Implementar

**Comando**: `/speckit.implement`

**Objetivo**: Executar tarefas em ordem.

**Fluxo de Execucao**:
1. Verifica checklists
2. Carrega contexto (plan.md, tasks.md)
3. Executa fase por fase
4. Marca tarefas como concluidas
5. Valida ao final de cada fase

---

## 4. Detalhamento Tecnico

### 4.1 Configuracao Vitest - Shannon

```typescript
// shannon/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        'src/temporal/client.ts', // CLI entry
        'src/temporal/query.ts',  // CLI entry
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60,
      },
    },
    testTimeout: 30000,
  },
});
```

### 4.2 Configuracao Vitest - GhostShell

```typescript
// ghostshell/vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.next/',
        '**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

### 4.3 GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run Shannon tests
        run: npm run test:shannon

      - name: Run GhostShell tests
        run: npm run test:ghostshell

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./shannon/coverage/coverage-final.json,./ghostshell/coverage/coverage-final.json
```

### 4.4 Scripts do Root package.json

```json
{
  "scripts": {
    "test": "npm run test:shannon && npm run test:ghostshell",
    "test:shannon": "npm run test -w shannon",
    "test:ghostshell": "npm run test -w ghostshell",
    "test:coverage": "npm run test:coverage -w shannon && npm run test:coverage -w ghostshell",
    "test:watch": "npm run test:watch -w shannon"
  }
}
```

---

## 5. Modulos Prioritarios para Teste

### 5.1 Shannon - Alta Prioridade

| Modulo | Arquivo | Justificativa |
|--------|---------|---------------|
| Config Parser | `src/config-parser.ts` | Validacao YAML critica |
| Error Handling | `src/error-handling.ts` | Logica de retry complexa |
| Tool Checker | `src/tool-checker.ts` | Validacao de dependencias |
| Session Manager | `src/session-manager.ts` | Orquestracao de agentes |
| Queue Validation | `src/queue-validation.ts` | Validacao de deliverables |

### 5.2 Shannon - Media Prioridade

| Modulo | Arquivo | Justificativa |
|--------|---------|---------------|
| Prompt Manager | `src/prompt-manager.ts` | Template rendering |
| Audit Logger | `src/audit/*.ts` | Logging critico |
| Temporal Activities | `src/temporal/activities.ts` | Core business logic |

### 5.3 GhostShell - Alta Prioridade

| Modulo | Arquivo | Justificativa |
|--------|---------|---------------|
| Lib Utils | `lib/*.ts` | Utilitarios compartilhados |
| Server Actions | `lib/actions/*.ts` | Logica de backend |
| API Routes | `app/api/**/*.ts` | Endpoints criticos |

---

## 6. Exemplos de Testes

### 6.1 Teste Unitario - Config Parser

```typescript
// shannon/src/config-parser.test.ts
import { describe, it, expect, vi } from 'vitest';
import { parseConfig, validateConfig } from './config-parser';

describe('Config Parser', () => {
  describe('parseConfig', () => {
    it('should parse valid YAML config', async () => {
      const yaml = `
        target:
          url: https://example.com
        auth:
          type: form
      `;

      const config = await parseConfig(yaml);

      expect(config.target.url).toBe('https://example.com');
      expect(config.auth.type).toBe('form');
    });

    it('should throw on invalid YAML', async () => {
      const invalidYaml = 'invalid: yaml: content:';

      await expect(parseConfig(invalidYaml))
        .rejects.toThrow('Invalid YAML');
    });
  });

  describe('validateConfig', () => {
    it('should validate against JSON schema', () => {
      const config = {
        target: { url: 'https://example.com' },
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
    });

    it('should reject missing required fields', () => {
      const config = {};

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('target.url is required');
    });
  });
});
```

### 6.2 Teste de Componente React

```typescript
// ghostshell/components/Button.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>);

    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('calls onClick handler when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    fireEvent.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when loading', () => {
    render(<Button loading>Submit</Button>);

    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

---

## 7. Cronograma de Execucao com Spec-Kit

### Fase 1: Configuracao Base

```bash
# 1. Criar especificacao
/speckit.specify Implementar infraestrutura de testes automatizados para monorepo Shannon com Vitest, Testing Library e GitHub Actions CI

# 2. Revisar e ajustar spec gerada
# (verificar spec.md e requirements checklist)

# 3. Esclarecer duvidas se necessario
/speckit.clarify
```

### Fase 2: Planejamento Tecnico

```bash
# 4. Gerar plano tecnico
/speckit.plan

# 5. Revisar artefatos gerados:
# - plan.md (stack, estrutura)
# - research.md (decisoes)
```

### Fase 3: Geracao de Tarefas

```bash
# 6. Gerar tarefas
/speckit.tasks

# 7. Revisar tasks.md para ordem e completude

# 8. Validar consistencia
/speckit.analyze
```

### Fase 4: Implementacao

```bash
# 9. Executar implementacao
/speckit.implement

# 10. Acompanhar progresso
# (tasks marcadas como [X] conforme completadas)
```

---

## 8. Checklist de Validacao Final

### Infraestrutura

- [ ] vitest.config.ts criado em shannon/
- [ ] vitest.config.ts criado em ghostshell/
- [ ] Dependencias de teste instaladas
- [ ] Scripts de teste no root package.json
- [ ] GitHub Actions workflow configurado

### Testes Implementados

- [ ] Testes unitarios para config-parser
- [ ] Testes unitarios para error-handling
- [ ] Testes unitarios para tool-checker
- [ ] Testes de componentes GhostShell (minimo 3)
- [ ] Testes de API routes (minimo 2)

### Qualidade

- [ ] Cobertura >= 40% em modulos criticos
- [ ] Todos os testes passando
- [ ] CI rodando em PRs
- [ ] Documentacao de testes criada

---

## 9. Proximos Passos

1. **Executar** `/speckit.specify` com a descricao da feature de testes
2. **Revisar** especificacao gerada e ajustar se necessario
3. **Executar** `/speckit.plan` para criar plano tecnico
4. **Executar** `/speckit.tasks` para gerar lista de tarefas
5. **Executar** `/speckit.implement` para implementar

---

## Apendice: Comandos Spec-Kit

| Comando | Descricao | Quando Usar |
|---------|-----------|-------------|
| `/speckit.constitution` | Define principios do projeto | Inicio do projeto ou mudanca de diretrizes |
| `/speckit.specify` | Cria especificacao de feature | Nova feature ou mudanca significativa |
| `/speckit.clarify` | Esclarece requisitos | Ambiguidades na spec |
| `/speckit.plan` | Gera plano tecnico | Apos spec aprovada |
| `/speckit.tasks` | Gera tarefas executaveis | Apos plan aprovado |
| `/speckit.analyze` | Valida consistencia | Antes de implementar |
| `/speckit.implement` | Executa implementacao | Quando tasks prontas |
| `/speckit.checklist` | Gera checklist customizado | Validacao de requisitos especificos |
| `/speckit.taskstoissues` | Converte tasks em GitHub Issues | Integracao com project management |
