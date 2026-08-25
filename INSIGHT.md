# Esboço do Design da Lib (`morphz`)

Importações e primitivos da biblioteca:

```ts
import {
  Struct,
  Define,
  Uuid,
  Timestamp,
  DateTime,
  Nullable,
  Optional,
  List,
  Text,
  Number,
  Email,
  Password,
  Ip,
  Enum,
  Ref,
  FieldOf,
  Embed,
  Union,
  Literal,
  Version,
  FromZodType,
} from "morphz";
```

`Ref` e `FieldOf` têm papéis distintos e não são intercambiáveis:

- **`Ref(() => Struct)`** — relação entre entidades. Aponta pra outra `Struct` inteira (lazy via thunk, resolve referência circular). Usado sozinho ou dentro de `List`/`Optional` pra modelar 1:1, 1:N.
- **`FieldOf(Struct, 'campo')`** — reaproveita o **tipo de um campo específico** de outra `Struct` já declarada (ex: FK escalar que precisa ser o mesmo tipo de `User.id`, sem carregar a entidade inteira). Não é lazy — `Struct` já precisa existir no momento da chamada, já que só lê o shape do campo.

`Union` espelha o comportamento do Zod: se os membros são `Struct`s com uma chave discriminadora em comum, resolve como `discriminatedUnion` (mais rápido, erro melhor); se são `Literal`s ou tipos soltos sem chave comum, resolve como union simples. Não precisa de API separada — a lib inspeciona o shape dos membros.

**Fronteira do design:** a lib só se importa com o que é **declarado no `Struct`** (mapeado pra parse/serialize). Getters, métodos e campos calculados fora da declaração (`get fullAddress()`) não entram no ciclo de vida de validação — são comportamento de classe puro, sem relação com o schema.

**Sem herança múltipla / mixins de classe.** Reuso entre entidades acontece **por campo** (`Define`), não por classe base compartilhada: `id: PrimaryKey()`, `createdAt: CreatedAt()` etc. se repetem na declaração de cada `Struct` — cada `Define` já é um one-liner, então repetir não pesa. Não existe um `Timestamped`/`SoftDeletable` como classe pra estender ou compor; se existisse, teria que resolver colisão de campo/método entre mixins (problema real que o `compose()` do lib-meta tem hoje). Comportamento tipo "soft delete" (filtrar query por `deletedAt`, etc.) é responsabilidade de ORM/repositório, fora do escopo da lib — aqui `deletedAt` é só mais um campo `Nullable(DateTime)`.

---

## 1. Criação de Meta-Tipos Customizados (`Define`) com Templates

Meta-tipos permitem criar especializações reutilizáveis com _smart defaults_ e templates de texto interpolados a partir do contexto da entidade (`#entityName`, `#module`, etc.):

```ts
// Chave primária com gerador de UUID e template dinâmico
// immutable: true fica aqui — é característica da PK, não escolha de cada entidade
export const PrimaryKey = Define(Uuid, {
  description: "Identificador único de #entityName",
  default: () => crypto.randomUUID(),
  immutable: true,
});

// Timestamps padronizados
// createdAt também é sempre imutável — nasce com o registro, nunca muda depois
export const CreatedAt = Define(Timestamp, {
  description: "Data de criação do registro de #entityName",
  default: () => new Date(),
  immutable: true,
});

export const UpdatedAt = Define(Timestamp, {
  description: "Data da última atualização do registro de #entityName",
});

export const DeletedAt = Define(Nullable(DateTime), {
  description: "Data de exclusão lógica de #entityName",
  default: null,
});

// Tipos de Domínio com Regras e Metadados Semânticos
export const Cep = Define(Text, {
  description: "Código postal (CEP) formatado",
  regex: /^\d{5}-\d{3}$/,
  examples: ["01001-000"],
});

export const Slug = Define(Text, {
  description: "Identificador textual amigável (slug) de #entityName",
  regex: /^[a-z0-9-]+$/,
});

// Ip é primitivo core (mesma categoria de Text/Email/Uuid) — Define especializa em cima
export const PublicIp = Define(Ip({ version: "v4" }), {
  description: "Endereço IPv4 público de origem da requisição",
});

// Restrições temporais NÃO são primitivo core — são `Define(DateTime, { refine })`,
// igual Cep/Slug são Define(Text, ...). `refine` é o escape hatch pra validação
// custom de campo único (equivalente a .refine() do Zod num schema isolado).
// Comparação entre campos do MESMO Struct (startDate < endDate) nunca vai aqui —
// isso é sempre `post` nas options do Struct (ver seção 3), porque `refine` só
// enxerga o valor do próprio campo, não o objeto inteiro.

export const TimeAgo = Define(DateTime, {
  description: "Data no passado, opcionalmente dentro de uma janela",
  refine: (val: Date, opts?: { within?: string }) => {
    if (val > new Date()) return "Não pode ser no futuro";
    if (opts?.within && val < subtractDuration(new Date(), opts.within)) {
      return `Não pode ser mais antigo que ${opts.within}`;
    }
    return true;
  },
});

export const TimeBefore = Define(DateTime, {
  description: "Data anterior a uma referência (default: agora)",
  refine: (val: Date, opts?: { ref?: Date | (() => Date) }) => {
    const ref = typeof opts?.ref === "function" ? opts.ref() : (opts?.ref ?? new Date());
    return val < ref || `Precisa ser antes de ${ref.toISOString()}`;
  },
});

export const TimeAfter = Define(DateTime, {
  description: "Data posterior a uma referência (default: agora)",
  refine: (val: Date, opts?: { ref?: Date | (() => Date) }) => {
    const ref = typeof opts?.ref === "function" ? opts.ref() : (opts?.ref ?? new Date());
    return val > ref || `Precisa ser depois de ${ref.toISOString()}`;
  },
});

// Uso:
// tokenIssuedAt: TimeAgo({ within: '30d' })   -- OTP/sessão, não pode ter mais de 30 dias
// expiresAt: TimeAfter()                      -- ainda não expirou (data futura)
// scheduledFor: TimeAfter({ ref: () => addMinutes(new Date(), 5) })

// Versionamento otimista do registro (concorrência), não confundir com
// versionamento de schema/migração — isso fica fora do escopo da lib.
export const RowVersion = Define(Version({ type: "incr" }), {
  description: "Versão otimista do registro de #entityName",
});

// Mais receitas — todas iguais em espírito a Cep/Slug: pegam um primitivo core
// (Text, Number...) e travam regex/refine/description uma vez, reusam em todo lugar.

export const Mac = Define(Text, {
  description: "Endereço MAC de interface de rede",
  regex: /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/,
  examples: ["00:1B:44:11:3A:B7"],
});

export const Domain = Define(Text, {
  description: "Nome de domínio (sem protocolo)",
  regex: /^([a-z0-9-]+\.)+[a-z]{2,}$/,
  examples: ["metha.dev"],
});

export const Url = Define(Text, {
  description: "URL completa",
  refine: (val: string, opts?: { protocols?: string[] }) => {
    try {
      const url = new URL(val);
      const protocols = opts?.protocols ?? ["http:", "https:"];
      return (
        protocols.includes(url.protocol) || `Protocolo precisa ser um de: ${protocols.join(", ")}`
      );
    } catch {
      return "URL inválida";
    }
  },
});

export const Phone = Define(Text, {
  description: "Telefone em formato E.164",
  regex: /^\+[1-9]\d{7,14}$/,
  examples: ["+5511999999999"],
});

// Money guarda o valor como inteiro (menor unidade — centavos), evitando erro de
// ponto flutuante. `currency` fica fixo por Define especializado, não por campo.
export const Brl = Define(Number({ int: true, min: 0 }), {
  description: "Valor monetário em centavos (BRL)",
  examples: [15000], // R$ 150,00
});

// Formato de identificador alternativo a Uuid — mesma receita, base Text
// (não vira primitivo core novo, só mais um Define em cima de Text, como Cep/Slug)
export const ShortId = Define(Text, {
  description: "Identificador curto, não-sequencial, seguro pra URL",
  regex: /^[A-Za-z0-9_-]{21}$/,
  default: () => nanoid(),
});
```

---

## 2. Embedded / Value Objects

```ts
export class Address extends Struct(
  {
    street: Text({ description: "Logradouro", min: 3 }),
    number: Text({ description: "Número" }),
    city: Text({ description: "Cidade" }),
    zipCode: Cep(), // Reutiliza o meta-tipo Cep
  },
  {
    labels: { entityName: "Endereço" },
    description: "Objeto de valor representando endereço físico",
  },
) {
  get fullAddress(): string {
    return `${this.street}, ${this.number} - ${this.city} (${this.zipCode})`;
  }
}
```

---

## 3. Entidades com `Struct(fields, options)` e Propagação de Labels

Ao declarar `labels` no segundo argumento de `Struct`, os valores são propagados em cascata para todos os meta-tipos filhos:

```ts
export enum UserRole {
  ADMIN = "ADMIN",
  USER = "USER",
}

export class User extends Struct(
  {
    id: PrimaryKey(),
    // -> description gerada: "Identificador único de Usuário"
    // immutable já vem do Define — DTOs de update que incluírem esse campo
    // falham a validação, sem precisar de `.omit()` manual em cada entidade

    createdAt: CreatedAt(),
    // -> description gerada: "Data de criação do registro de Usuário"

    updatedAt: UpdatedAt(),
    // -> description gerada: "Data da última atualização do registro de Usuário"

    deletedAt: DeletedAt(),
    // -> description gerada: "Data de exclusão lógica de Usuário"

    name: Text({ min: 2, max: 50, description: "Nome completo" }),
    username: Slug(),
    // -> description gerada: "Identificador textual amigável (slug) de Usuário"

    email: Email({ description: "Email corporativo" }),
    password: Password({ description: "Hash da senha", writeOnly: true }),
    role: Enum(UserRole, { default: UserRole.USER }),

    // Value Object aninhado
    address: Optional(Embed(Address)),

    // Lista simples com default
    tags: List(Text(), { default: () => [] }),

    // Relacionamento 1:N com Lazy Evaluation
    posts: Optional(List(Ref(() => Post))),
  },
  {
    // Propaga contexto para os templates filhos (#entityName, #module, etc.)
    labels: {
      entityName: "Usuário",
      module: "Gestão de Contas",
    },
    description: "Entidade de representação de contas de usuários no sistema",

    // Hooks equivalentes a z.preprocess / z.superRefine — cross-field validation
    // e normalização entram aqui, não como campo declarado
    pre: (val) => ({ ...val, username: val.username?.toLowerCase() }),
    post: (val, ctx) => {
      if (val.role === UserRole.ADMIN && !val.email.endsWith("@empresa.com")) {
        ctx.addIssue({
          code: "custom",
          path: ["email"],
          message: "Admin precisa de e-mail corporativo",
        });
      }
    },
  },
) {
  // Métodos de domínio têm acesso tipado a `this.*`
  isAdmin(): boolean {
    return this.role === UserRole.ADMIN;
  }

  isDeleted(): boolean {
    return this.deletedAt !== null;
  }
}
```

---

## 4. Entidade Dependente com Referência de Campo (`FieldOf`)

```ts
export class Post extends Struct(
  {
    id: PrimaryKey(),
    // -> description gerada: "Identificador único de Publicação"

    createdAt: CreatedAt(),
    // -> description gerada: "Data de criação do registro de Publicação"

    updatedAt: UpdatedAt(),
    // -> description gerada: "Data da última atualização do registro de Publicação"

    deletedAt: DeletedAt(),
    // -> description gerada: "Data de exclusão lógica de Publicação"

    // FK escalar — reaproveita o tipo do campo `id` de User, sem carregar a entidade
    userId: FieldOf(User, "id", {
      description: "Chave estrangeira apontando para o autor da Publicação",
    }),

    title: Text({ min: 5, max: 120, description: "Título da publicação" }),
    body: Text({ description: "Conteúdo em markdown" }),

    status: Union([Literal("DRAFT"), Literal("PUBLISHED"), Literal("ARCHIVED")], {
      default: "DRAFT",
    }),
  },
  {
    labels: {
      entityName: "Publicação",
      module: "Conteúdo",
    },
    description: "Postagens criadas no blog",
  },
) {}
```

---

## 5. Mensagens de Erro Customizadas e i18n

A base é o error tree do Zod (`error.issues`: `path`, `code`, `message`). Em cima disso, `Define` aceita `message` pra sobrescrever o texto padrão por regra de validação — string fixa ou mapa i18n resolvido pelo locale ativo:

```ts
export const Email = Define(Text, {
  regex: /^[^@]+@[^@]+\.[^@]+$/,
  message: {
    invalid_type: { "pt-BR": "Precisa ser texto", "en-US": "Must be text" },
    regex: { "pt-BR": "E-mail inválido", "en-US": "Invalid email" },
  },
});

// Também dá pra sobrescrever pontualmente, na declaração do campo:
email: Email({ message: { regex: { "pt-BR": "Formato de e-mail incorreto" } } });
```

Locale ativo vem de `morphz.config.ts` (`defineConfig({ locale: { default: 'pt-BR', fallback: 'en-US' } })`) ou de um `AsyncLocalStorage`/contexto por request, pra não precisar passar locale em toda chamada de `.parse()`.

**Mecanismo de override é agnóstico ao schema — funciona por `(path, code)`, não por conhecimento interno do tipo.** Depois do parse, `morphz` percorre `error.issues` e, pra cada issue, olha `path` (aponta o campo) + `code` (`invalid_type`, `too_small`, `regex`, `custom`...) e procura um `message[code]` registrado no `Define` daquele campo. Achou, troca; não achou, deixa passar a mensagem crua do Zod (fallback, nunca quebra).

Isso significa que **`FromZodType` (wrapper de schema Zod arbitrário) funciona de graça com o mesmo mecanismo**, sem precisar entender a estrutura interna do schema embrulhado:

```ts
export const Coordinates = Define(FromZodType(z.tuple([z.number(), z.number()])), {
  description: "Par [latitude, longitude]",
  message: {
    invalid_type: "Precisa ser uma tupla de duas coordenadas",
  },
});
```

**Limite real:** o override só é confiável no `path` raiz do campo (`['coordinates']`). Se o schema embrulhado é composto — `z.object()`/`z.tuple()`/`z.array()` aninhado — os issues internos vêm com `path` mais fundo (`['coordinates', 0]`) e o `message` do `Define` (pensado pra campo escalar) não tem entrada pra esse nível. Cai no fallback automático: mensagem crua do Zod pro erro interno. Não é bug, é o comportamento esperado — `message` cobre o campo como unidade, não a árvore inteira de um `FromZodType` complexo. Quem precisa de mensagem custom nos níveis internos aplica `.meta()`/mensagens direto no schema Zod original, antes de embrulhar.

---

## 6. Datas Representáveis por Construção (`z.codec`, não `z.date()`)

`z.toJSONSchema()` (nativo do Zod v4) trata `z.date()` como **unrepresentable** — sem tratamento especial, ou lança erro ou vira `{}` (schema vazio, sem `type`/`format`). Isso quebra geração de Swagger/OpenAPI pra qualquer campo de data. O próprio `nestjs-zod` documenta isso como limitação conhecida e recomenda nunca usar `z.date()` cru — usar algo que valide **string** na borda.

O fix de raiz não é "converter depois" (override/tree-walk), é **`DateTime`/`Timestamp` nunca serem `z.date()` por dentro**. Zod v4 tem `z.codec(wireSchema, domainSchema, {decode, encode})` — schema bidirecional: um formato pra entrada/serialização (wire), outro pro valor real em memória (domínio):

```ts
// Implementação de referência do primitivo — não API pública, mostra a ideia:
const DateTime = z.codec(
  z.iso.datetime(), // wire: string ISO 8601 — 100% representável em JSON Schema
  z.date(), // domínio: Date real — TimeAgo/TimeBefore continuam comparando com `new Date()`
  {
    decode: (s) => new Date(s), // parse: string (JSON/HTTP) -> Date (instância em memória)
    encode: (d) => d.toISOString(), // serialize: Date -> string (resposta HTTP/JSON Schema)
  },
);
```

Consequência: `z.toJSONSchema()` nunca vê `z.date()` — só vê o lado `in` do codec (`z.iso.datetime()`, uma string), então gera `{type: 'string', format: 'date-time'}` sozinho, sem override nenhum, porque o schema já nasceu representável.

Isso também resolve a integração com `nestjs-zod` **de graça**, usando a própria API oficial dele (`createZodDto(schema, {codec: true})` já existe pra esse padrão — usa `encode` em vez de `parse` ao serializar resposta):

```ts
class UserDto extends createZodDto(getSchema(User), { codec: true }) {}
// -> nenhum transformDatesForOpenAPI manual, nenhum patch por consumidor
```

`examples[]` (JSON Schema 2020-12/OpenAPI 3.1) vs `example` singular (OpenAPI 3.0) é problema **separado**, não ligado a data — já resolvido pelo próprio `nestjs-zod` via `cleanupOpenApiDoc({ version: '3.0' })`, não precisa de patch próprio no `morphz` pra isso.

---

## 7. Ciclo de Vida: Parsing, Instanciação e Serialização

Diferente do Zod que gera apenas dicionários/objetos planos anônimos, cada operação de parsing aqui produz **instâncias reais da classe**, com identidade (`instanceof`) e métodos de domínio encapsulados:

```ts
// A. Parsing Direto / Instanciação (lança ValidationError se inválido):
const user = User.parse({
  name: "John Doe",
  username: "johndoe",
  email: "john@example.com",
  password: "secret_hash_value",
});
// Ou via construtor: const user = new User({ ... })

console.log(user instanceof User); // true
console.log(user.id); // string (preenchido pelo default)
console.log(user.isAdmin()); // método de domínio executado na instância!

// B. Safe Parsing (ideal para controllers e APIs HTTP):
const result = User.safeParse(req.body);

if (!result.success) {
  return res.status(400).json({ errors: result.errors });
}

// result.data é uma instância real e tipada de User
const validUser: User = result.data;

// C. Serialização Controlada (respeita writeOnly, transformações e mascaramento):
const json = user.toJSON(); // omite campos marcados como `writeOnly: true` (como password)
```

---

## 8. Extensibilidade Real de Classes

```ts
// A. Extensão de Schema + Comportamento (Novos campos + métodos):
export class AdminUser extends User.extend({
  department: Text({ description: "Departamento administrativo" }),
  permissions: List(Text(), { default: () => ["READ", "WRITE"] }),
}) {
  canExecute(action: string): boolean {
    return this.permissions.includes(action) || this.isAdmin();
  }
}

const admin = AdminUser.parse({
  name: "Admin Master",
  username: "admin",
  email: "admin@example.com",
  password: "admin_password",
  department: "Segurança",
});

console.log(admin instanceof AdminUser); // true
console.log(admin instanceof User); // true (polimorfismo preservado!)
console.log(admin.canExecute("DELETE")); // true

// B. Derivação de DTOs para APIs:
export class CreatePostDto extends Post.omit("id", "createdAt", "updatedAt", "deletedAt") {}
export class UpdateUserDto extends User.pick("name", "address").partial() {}

// C. Update real: `immutable` já barra campos como `id`/`createdAt` sem precisar
// listar tudo manualmente — só precisa tirar o que não faz parte da superfície pública
export class PatchUserDto extends User.omit("password").partial() {}
```

---

## 9. Configuração Global do Projeto (`morphz.config.ts`)

Configurações e convenções aplicadas em nível de monorepo/projeto:

```ts
// morphz.config.ts
import { defineConfig } from "morphz";

export default defineConfig({
  // Transformação automática de labels por padrão
  labels: {
    // Injeta `entityName` automaticamente a partir do nome da classe
    entityName: (ctx) => ctx.className.replace(/(Entity|Model)$/, ""),
  },

  // Delimitador de templates nas descrições ('#entityName', '{entityName}', etc.)
  template: {
    delimiter: "#",
  },

  // Injeção automática de JSDoc nos tipos gerados a partir dos metadados
  jsdoc: true,
});
```

---

## 10. Documentação e Autocomplete via JSDoc Automático (`jsdoc: true`)

Com a opção `jsdoc: true` ativada em `morphz.config.ts`, a biblioteca (via plugin/transformer de TypeScript ou geração de `.d.ts`) propaga automaticamente os metadados semânticos definidos em `Define` e `Struct` (`description`, `examples`, `default`, `immutable`, constraints de validação) para comentários JSDoc nos campos dos tipos gerados.

Dessa forma, o schema se torna a única fonte de verdade tanto para validação em runtime quanto para o Intellisense/hover no IDE.

### Mapeamento De $\rightarrow$ Para (Zod / JSON Schema $\rightarrow$ JSDoc)

| Campo Zod / JSON Schema        | Tag JSDoc Gerada             | Exemplo / Formato                    |
| :----------------------------- | :--------------------------- | :----------------------------------- |
| `description`                  | _(Corpo principal do bloco)_ | `Texto descritivo plano`             |
| `default`                      | `@default`                   | `@default "uuid-v4"` ou `@default 0` |
| `examples` / `example`         | `@example`                   | `@example "John Doe"` _(com escape)_ |
| `readOnly` / `immutable: true` | `@readonly`                  | `@readonly`                          |
| `writeOnly: true`              | `@writeOnly`                 | `@writeOnly`                         |
| `deprecated: true`             | `@deprecated`                | `@deprecated [motivo opcional]`      |
| `minLength` / `min` _(Text)_   | `@minLength`                 | `@minLength 2`                       |
| `maxLength` / `max` _(Text)_   | `@maxLength`                 | `@maxLength 50`                      |
| `minimum` / `min` _(Number)_   | `@minimum`                   | `@minimum 0`                         |
| `maximum` / `max` _(Number)_   | `@maximum`                   | `@maximum 100`                       |
| `pattern` / `regex`            | `@pattern`                   | `@pattern ^[a-z0-9-]+$`              |
| `format` _(Email, Uuid, etc.)_ | `@format`                    | `@format email`, `@format uuid`      |

---

### Tratamento Especial para `@example` e Decorators (Hover Truncation Fix)

Um problema clássico do parser JSDoc do TypeScript (`tsserver`) no VSCode ocorre quando um `@example` contém código com decorators ou propriedades iniciadas por `@` (ex: `@ApiProperty()`, `@Transform()`, ou chaves como `"@context"`):

- O compilador do TypeScript interpreta qualquer `@` interno como o **início de uma nova tag JSDoc**, quebrando o bloco de exemplo e corrompendo a visualização de hover.

**Solução implementada pelo `morphz`:**

1. **Encapsulamento em Fenced Markdown:** Exemplos de objetos ou snippets de código são envolvidos automaticamente em blocos ` ```ts ` ou ` ```json `.
2. **Escape Seguro de `@` Internos:** Caso o exemplo contenha decorators ou símbolos `@` no corpo, o gerador sanitiza utilizando o caractere de escape HTML `&#64;` ou literal seguro, impedindo que o `tsserver` interprete o caractere como uma anotação JSDoc de topo.

````ts
// Exemplo gerado no .d.ts / JSDoc para um campo com exemplo estruturado:
/**
 * User account metadata
 * @example
 * ```ts
 * // &#64;Transform decorator seguro sem quebrar o hover
 * { role: "ADMIN", active: true }
 * ```
 */
metadata: Record<string, any>;
````

---

### Exemplo de Declaração vs Hover no IDE

```ts
export class User extends Struct(
  {
    id: PrimaryKey(),
    name: Text({ min: 2, max: 50, description: "Full name", examples: ["John Doe"] }),
    email: Email({ description: "Work email" }),
  },
  {
    labels: { entityName: "User" },
  },
) {}
```

Ao inspecionar ou autocompletar propriedades de uma instância de `User` ou de um DTO derivado:

```ts
const user = User.parse(data);

// Hover em `user.id`:
/**
 * Unique identifier for User
 * @readonly
 * @default crypto.randomUUID()
 */
user.id;

// Hover em `user.name`:
/**
 * Full name
 * @minLength 2
 * @maxLength 50
 * @example "John Doe"
 */
user.name;

// Hover em `user.email`:
/**
 * Work email
 * @format email
 */
user.email;
```

---

## 11. TypeScript Language Service Plugin (Tooling & DX Ultra-Leve)

Para oferecer uma experiência de desenvolvimento completa (estilo _Tailwind CSS IntelliSense_), a melhor arquitetura técnica é um **TypeScript Language Service Plugin (`tsserver` plugin)**, integrado diretamente ao motor de tipos que o editor já executa.

### Vantagens Arquiteturais

1. **Ultra-leve (Zero Daemons Extras):** Não sobe novos processos Node.js ou servidores LSP em segundo plano. O plugin executa dentro do próprio processo do `tsserver` mantido pelo VSCode, Cursor, Neovim ou WebStorm.
2. **Reaproveitamento de Memória e AST:** Lê a Árvore Sintática Abstrata (AST) e a checagem de tipos que o TypeScript já calculou e mantém em cache na memória.
3. **Instalação via NPM:** Ativado diretamente pelo arquivo `tsconfig.json` do projeto, sem forçar o desenvolvedor a instalar extensões proprietárias na loja do editor.

```json
// tsconfig.json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "morphz/ts-plugin"
      }
    ]
  }
}
```

### Recursos Implementados pelo Plugin

#### A. Hover Dinâmico e Resolvido (`getQuickInfoAtPosition`)

Ao passar o mouse sobre a chamada de um `Define`, `Struct` ou propriedade declarada, o plugin intercepta a chamada e renderiza um popup em Markdown com as variáveis de template já interpoladas (`#entityName` $\rightarrow$ `"User"`) e as regras ativas:

```ts
// Código no editor:
export class User extends Struct({
  username: Slug(),
}) {}

// Popup exibido no Hover de `username`:
┌─────────────────────────────────────────────────────────────┐
│ (property) username: string                                 │
│                                                             │
│ 📝 Friendly textual identifier (slug) for User             │
│ ⚙️ Regex: /^[a-z0-9-]+$/                                    │
│ 🏷️ Origin: Define(Text) -> Slug                             │
│ 📌 Interpolated label: #entityName => "User"                │
└─────────────────────────────────────────────────────────────┘
```

#### B. Autocomplete Contextual de Templates e Campos (`getCompletionsAtPosition`)

- **Sugestão de Labels:** Ao digitar descrições ou strings dentro de um `Define({ description: "..." })`, digitar o delimitador (ex: `#`) aciona a lista de labels disponíveis no escopo (`#entityName`, `#module`, etc.).
- **Intellisense em `FieldOf`:** Ao usar `FieldOf(User, "...")`, o plugin sugere apenas as chaves reais de campos definidos em `User`, garantindo tipagem forte instantânea.

#### C. Diagnósticos e Linter Semântico em Tempo Real (`getSemanticDiagnostics`)

- **Aviso de Template Quebrado:** Destaca com _warning_ ou _error_ visual sublinhado caso um template faça referência a um label não definido nas opções do `Struct` ou `morphz.config.ts`.
- **Validação de Hooks:** Avisa caso o `path` configurado em `ctx.addIssue({ path: ['invalid'] })` dentro de um hook `post` aponte para um campo que não existe na entidade.

---

### D. Internacionalização (i18n) do Tooling e do Hover

O plugin e os geradores de JSDoc adotam **`en-US` como padrão universal de código e documentação técnica**, mas suportam resolução contextual de idiomas:

1. **Definições Multilíngues no Código:** Campos e `Define` podem fornecer descrições em múltiplos idiomas:

   ```ts
   export const Slug = Define(Text, {
     description: {
       "en-US": "Friendly textual identifier (slug) for #entityName",
       "pt-BR": "Identificador textual amigável (slug) de #entityName",
     },
     regex: /^[a-z0-9-]+$/,
   });
   ```

2. **Cascata de Resolução do Idioma no Editor:**
   - **1. Configuração do Projeto (`morphz.config.ts`):** `locale: { default: 'en-US' }`
   - **2. Detecção Automática da IDE/OS:** Caso não configurado explicitamente, o plugin lê o locale ativo da IDE (`vscode.env.language` ou locale do sistema via `Intl.DateTimeFormat().resolvedOptions().locale`).
   - **3. Fallback Seguro:** Se a chave no idioma local não existir, recorre ao `en-US`.

---

## 12. Geração Automática de Mocks e Fixtures para Testes (`User.mock()`)

Como cada campo declarado em um `Struct` já possui metadados semânticos completos (`format`, `regex`, `min`, `max`, `examples`, `default`), o `morphz` disponibiliza um gerador nativo de fixtures para testes unitários, testes E2E e seeding de banco de dados, eliminando a necessidade de factories manuais com bibliotecas externas.

### Funcionamento e Capacidades

- **Resolução Semântica de Valores:**
  - Campos com `examples` utilizam um dos exemplos declarados.
  - Campos com `default` utilizam o gerador padrão.
  - Campos com restrições (`min`, `max`, `regex`) têm seus valores sintetizados respeitando os limites da validação.
- **Overrides Tipados com Autocomplete:** Permite sobrescrever apenas as propriedades relevantes para o cenário do teste.
- **Instância Real Retornada:** O retorno de `.mock()` é uma instância autêntica da classe da entidade (passando na checagem `instanceof` e com todos os métodos de domínio disponíveis).

### Exemplo de Uso em Testes

```ts
import { User, UserRole } from "./user.entity";

describe("User Domain Services", () => {
  it("should calculate permissions for admin user", () => {
    // Gera uma instância válida com todos os campos preenchidos conforme o schema
    const admin = User.mock({
      role: UserRole.ADMIN,
      email: "admin@example.com",
    });

    expect(admin).toBeInstanceOf(User);
    expect(admin.isAdmin()).toBe(true);
    expect(typeof admin.id).toBe("string");
    expect(admin.createdAt).toBeInstanceOf(Date);
  });

  it("should support generating batch fixtures for seeding", () => {
    // Gera lista de 10 usuários válidos
    const batch = User.mockMany(10, (index) => ({
      email: `user-${index}@example.com`,
    }));

    expect(batch).toHaveLength(10);
  });
});
```

---

## 13. Mascaramento e Redação de Dados Sensíveis / LGPD (`mask` / `.toMaskedJSON()`)

Em sistemas corporativos, dados pessoais identificáveis (PII) precisam ser protegidos contra vazamentos em logs de observabilidade (Sentry, CloudWatch, Datadog) e respostas de endpoints públicos.

O `morphz` adiciona o modificador `mask` no nível de `Define` e `Struct`, além do método de serialização segura `.toMaskedJSON()`.

### Declaração de Máscaras Reutilizáveis

```ts
export const Email = Define(Text, {
  format: "email",
  mask: (email: string) => {
    const [user, domain] = email.split("@");
    return `${user.slice(0, 2)}***@${domain}`;
  },
});

export const DocumentCpf = Define(Text, {
  regex: /^\d{3}\.\d{3}\.\d{3}-\d{2}$/,
  mask: (cpf: string) => cpf.replace(/^(\d{3})\.\d{3}\.\d{3}-(\d{2})$/, "$1.***.***-$2"),
});
```

### Serialização Controlada em Logs e APIs

```ts
const user = User.parse({
  name: "John Doe",
  email: "john.doe@example.com",
  password: "super_secret_hash",
});

// A. Serialização padrão: oculta campos `writeOnly: true` (como password)
console.log(user.toJSON());
// -> { id: "...", name: "John Doe", email: "john.doe@example.com" }

// B. Serialização mascarada: aplica as funções de `mask` registradas
console.log(user.toMaskedJSON());
// -> { id: "...", name: "John Doe", email: "jo***@example.com" }

// C. Uso direto em logs de observabilidade:
logger.info("User session initialized", { user: user.toMaskedJSON() });
```

---

## 14. Arquitetura do Repositório (Monorepo) e Distribuição de Pacotes

Para garantir que a biblioteca (`morphz`), o plugin do compilador TypeScript (`ts-plugin`) e eventuais extensões de editor evoluam em perfeita sincronia, o projeto adota uma arquitetura de **Monorepo** gerenciada via **pnpm workspaces** e **Turborepo**.

### Vantagens do Monorepo Unificado

1. **Versionamento e Commits Atômicos:** Qualquer mudança na API da lib (novos modificadores, mudanças em `Define` ou templates) atualiza instantaneamente a lógica do plugin de IDE no mesmo Pull Request, eliminando defasagens de versão.
2. **Compartilhamento de Código Sem Overhead:** O `ts-plugin` importa tipos, AST helpers e analisadores de templates diretamente do `core` como workspace package (`workspace:*`), sem duplicação de lógica ou publicação de pacotes intermediários.
3. **Pipeline de Testes Integrada:** Executa testes de runtime de entidades e validações de hover/diagnósticos do TypeScript em um único comando (`pnpm test`).

### Estrutura de Pastas

```text
morphz/
├── packages/
│   ├── core/             # Lib principal publicada no npm como "morphz"
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── ts-plugin/        # Plugin para o tsserver ("@morphz/ts-plugin" / "morphz/ts-plugin")
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── vscode/           # (Opcional) Extensão VSCode marketplace para empacotamento
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
│
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

### Estratégia de Distribuição e Consumo

O plugin pode ser distribuído tanto como pacote separado (`@morphz/ts-plugin`) quanto empacotado via subpath export no pacote principal `morphz`:

```json
// package.json do morphz (core)
{
  "name": "morphz",
  "exports": {
    ".": "./dist/index.js",
    "./ts-plugin": "./dist/ts-plugin/index.js"
  }
}
```

Dessa forma, o consumidor do `morphz` tem setup **zero-friction**: ao instalar `morphz`, basta ativar o plugin no seu `tsconfig.json`:

```json
// tsconfig.json (Projeto do Consumidor)
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "morphz/ts-plugin"
      }
    ]
  }
}
```

---

## 15. Primitivos Adicionais para Desenvolvimento Moderno

Conforme o ecossistema e as necessidades de desenvolvimento evoluem, além dos primitivos iniciais da biblioteca (`Text`, `Number`, `Uuid`, `Email`, `DateTime`, `Password`, `Ip`, `Enum`, `Version`), novos tipos primitivos comuns em backends e APIs são adicionados ao design:

### A. Escalares Fundamentais

#### 1. `Boolean`

Valores lógicos com suporte a coerção automática de querystrings e payloads (`"true"` $\rightarrow$ `true`, `"0"` $\rightarrow$ `false`):

```ts
isActive: Boolean({ default: true, description: "Status de ativação da conta" }),
isEmailVerified: Boolean({ default: false }),
```

#### 2. `BigInt`

Inteiros de 64 bits para identificadores grandes (_Snowflakes_ do Discord/Twitter, IDs `BIGINT` do PostgreSQL, nano-timestamps):

```ts
snowflakeId: BigInt({ min: 0n, description: "Identificador Snowflake único" }),
balanceInAtomicUnits: BigInt({ min: 0n }),
```

#### 3. `Decimal`

Precisão numérica e financeira exata (evita erros de ponto flutuante do IEEE 754 e mapeia nativamente para colunas `DECIMAL` / `NUMERIC` de bancos de dados):

```ts
price: Decimal({ precision: 10, scale: 2, min: "0.00", description: "Preço unitário em reais" }), // "150.50"
interestRate: Decimal({ scale: 4, min: "0.0000", max: "1.0000" }), // "0.0525"
```

---

### B. Datas e Horários Especializados (Zero Timezone Drift)

Evita o bug clássico de off-by-one day onde o objeto `Date` tradicional altera o dia do calendário devido ao fuso horário:

#### 1. `DateOnly`

Data pura no formato ISO 8601 (`"YYYY-MM-DD"`):

```ts
birthDate: DateOnly({ description: "Data de nascimento do titular" }), // "1995-08-25"
dueDate: DateOnly({ description: "Data de vencimento da fatura" }),
```

#### 2. `TimeOnly`

Horário puro sem componente de data (`"HH:mm"` ou `"HH:mm:ss"`):

```ts
opensAt: TimeOnly({ description: "Horário de abertura do estabelecimento" }), // "08:30"
closesAt: TimeOnly({ description: "Horário de fechamento" }), // "18:00"
```

#### 3. `Duration`

Durações temporais no formato ISO 8601 (`"PT15M"`, `"P1D"`) ou notações amigáveis (`"15m"`, `"2h"`, `"30d"`):

```ts
sessionTtl: Duration({ default: "30d", description: "Tempo de expiração da sessão" }),
retryInterval: Duration({ default: "5m" }),
```

---

### C. Identificadores Modernos de Alta Performance

#### 1. `Ulid`

Identificadores únicos lexicograficamente ordenáveis por tempo (128-bit codificado em Crockford Base32), ideais para índices de bancos de dados:

```ts
id: Ulid({ default: () => ulid(), description: "Identificador ULID ordenável de #entityName" }),
```

#### 2. `Nanoid`

Identificadores curtos, seguros para URL e com alfabeto/tamanho configurável:

```ts
shareCode: Nanoid({ length: 10, description: "Código de compartilhamento rápido" }),
```

#### 3. `Cuid2`

Identificadores seguros, horizontais e não sequenciais de próxima geração:

```ts
publicToken: Cuid2({ description: "Token público seguro de #entityName" }),
```

---

### D. Web e Conectividade

#### 1. `Url`

Validação de URLs completas com filtros de protocolo e domínio:

```ts
website: Optional(Url({ protocols: ["http:", "https:"], description: "Website institucional" })),
webhookUrl: Url({ protocols: ["https:"], description: "URL de callback HTTPS" }),
```

---

### E. Estruturas Flexíveis e Binários

#### 1. `Json`

Payloads flexíveis ou semi-estruturados que aceitam objetos e arrays arbitrários com tipagem genérica:

```ts
metadata: Json<{ tags: string[]; priority?: number }>({
  default: () => ({ tags: [] }),
  description: "Metadados customizados do registro",
}),
```

#### 2. `Record(KeyType, ValueType)`

Dicionários chave-valor fortemente tipados tanto na chave quanto no valor:

```ts
featureFlags: Record(Text(), Boolean(), {
  default: () => ({}),
  description: "Flags de funcionalidades ativas por usuário",
}),
```

#### 3. `Binary`

Buffers de dados binários (`Uint8Array` ou `Buffer`) ou strings Base64 com validação de limite de tamanho em bytes:

```ts
avatarFile: Binary({ maxBytes: 5 * 1024 * 1024, description: "Imagem de perfil (máx 5MB)" }),
signatureHash: Binary({ exactBytes: 32 }),
```

#### 4. `Tuple`

Tuplas posicionais com tipos heterogêneos fixos (evita a necessidade de recorrer ao Zod cru):

```ts
coordinates: Tuple([Number({ min: -90, max: 90 }), Number({ min: -180, max: 180 })], {
  description: "Coordenadas geográficas [latitude, longitude]",
}),
```

#### 5. `SetOf`

Coleção com unicidade garantida (sem elementos duplicados, desserializada como `Set<T>`):

```ts
permissions: SetOf(Text(), {
  minSize: 1,
  description: "Conjunto único de permissões do usuário",
}),
```

---

## 16. Interceptores de Propriedade (`get`/`set`) em Meta-Tipos

O Zod possui `z.preprocess()`, mas com uma limitação fundamental: ele executa **apenas uma vez** durante o `.parse()` e gera um objeto plano estático. Se o desenvolvedor mutar a propriedade posteriormente (`user.id = "..."`), o Zod não intercepta mais nada e o objeto perde qualquer comportamento de encapsulamento.

Como o `morphz` instancia **classes reais**, os meta-tipos criados com `Define` suportam acessores `get` e `set` dinâmicos (aplicados via `Object.defineProperty` no construtor do `Struct`).

### Separação entre Wire-Format e Objeto de Domínio

- **Wire-Format (Schema de Validação):** A API e o OpenAPI enxergam tipos 100% serializáveis (ex: `Text` com regex de 24 hex chars).
- **Domain Object (Runtime em Memória):** O desenvolvedor manipula instâncias ricas da biblioteca de domínio (ex: `ObjectId` do MongoDB, `Decimal`, ou classes próprias).

### Exemplo de Implementação com MongoDB `ObjectId`

```ts
import { ObjectId } from "mongodb";
import { Define, Text, Struct } from "morphz";

// Meta-tipo com acessores encapsulados
export const MongoId = Define(Text({ regex: /^[0-9a-fA-F]{24}$/ }), {
  description: "MongoDB ObjectId identifier for #entityName",
  // get: Converte o valor bruto em instância rica de domínio
  get: (accessor) => new ObjectId(accessor.value),
  // set: Aceita tanto instâncias de ObjectId quanto strings e normaliza o valor interno
  set: (val: string | ObjectId, accessor) => {
    accessor.value = typeof val === "string" ? val : val.toHexString();
  },
});

export class User extends Struct({
  id: MongoId,
  name: Text({ min: 2 }),
}) {}
```

### Ciclo de Vida e Uso

```ts
// 1. Parsing com validação e instanciação:
const user = User.parse({
  id: "507f1f77bcf86cd799439011",
  name: "John Doe",
});

// 2. Leitura (get): Retorna a instância autêntica de ObjectId
console.log(user.id instanceof ObjectId); // true
console.log(user.id.getTimestamp()); // 2012-10-15T00:14:47.000Z

// 3. Mutação controlada (set): Aceita ObjectId ou string compatível
user.id = new ObjectId();
user.id = "507f191e810c19729de860ea";

// 4. Serialização (toJSON): Retorna a string pura compatível com JSON Schema
console.log(user.toJSON());
// -> { id: "507f191e810c19729de860ea", name: "John Doe" }
```

---

## 17. Diagnóstico e Observabilidade com Namespaces (`DEBUG=morphz:*`)

Por padrão, a biblioteca é **completamente silenciosa** em tempo de execução e não polui o `console.log` da aplicação.

Para depuração de fluxos internos, compilação de schemas e resolução de mensagens de validação, o `morphz` adota o padrão de depuração por namespaces via variável de ambiente `DEBUG` (comum no ecossistema Node.js / Express / Prisma).

### Namespaces Disponíveis

| Namespace          | Finalidade do Log                                                               |
| :----------------- | :------------------------------------------------------------------------------ |
| `morphz:struct`    | Registro e compilação de entidades, herança e resolução de labels/templates     |
| `morphz:parse`     | Ciclo de parsing, validação de inputs e transformações de entrada               |
| `morphz:codec`     | Codificação/decodificação bidirecional (ex: datas ISO $\leftrightarrow$ `Date`) |
| `morphz:i18n`      | Resolução de mensagens de erro, locales ativos e fallbacks acionados            |
| `morphz:lifecycle` | Criação de instâncias, execução de hooks `pre`/`post` e tempo de execução       |

### Ativação no Backend

#### 1. Via Terminal ao Iniciar o Servidor:

```bash
# Ativa todos os logs de todos os submódulos do morphz
DEBUG=morphz:* npm run dev

# Ativa apenas logs de parsing e i18n
DEBUG=morphz:parse,morphz:i18n npm run dev

# Ativa todos os logs exceto os de performance/cache
DEBUG=morphz:*,-morphz:cache npm run dev
```

#### 2. Via Arquivo `.env`:

```env
DEBUG=morphz:*
```

### Comportamento e Performance (Zero Overhead)

- **Em Produção:** Quando `DEBUG` não está definido ou não coincide com `morphz:*`, as funções de log retornam um _no-op_ (`() => {}`), permitindo que a engine V8 do Node.js/Bun elimine completamente o custo de formatação de strings e I/O de console.
- **Saída Formatada:** Quando ativo, emite logs com timestamps, identificador do namespace colorido e métricas de execução para diagnóstico em desenvolvimento.
