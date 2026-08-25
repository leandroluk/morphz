/**
 * `morphz/recipes` — an OPTIONAL, opinionated starter set of `Define`-based
 * field types, built exactly per INSIGHT.md §1's reference code. NOT part
 * of `morphz`'s main entry point: INSIGHT.md's own §1 recipes are shown as
 * userland code (a consumer's own `Define(...)` calls, never imported from
 * `morphz` itself in its top-of-file import block) — this subpath exists
 * purely as a convenience so consumers don't have to hand-write the
 * well-known ones. `import { PrimaryKey } from 'morphz/recipes'`.
 */
import { nanoid } from "nanoid";
import { Define } from "./core/define.js";
import { Uuid } from "./primitives/uuid.js";
import { Timestamp } from "./primitives/timestamp.js";
import { DateTime } from "./primitives/date-time.js";
import { Nullable } from "./primitives/nullable.js";
import { Text } from "./primitives/text.js";
import { Number as NumberField } from "./primitives/number.js";
import { Ip } from "./primitives/ip.js";
import { Version } from "./primitives/version.js";

export const PrimaryKey = Define(Uuid, {
  description: "Identificador único de #entityName",
  default: () => crypto.randomUUID(),
  immutable: true,
});

export const CreatedAt = Define(Timestamp, {
  description: "Data de criação do registro de #entityName",
  default: () => new Date(),
  immutable: true,
});

export const UpdatedAt = Define(Timestamp, {
  description: "Data da última atualização do registro de #entityName",
});

export const DeletedAt = Define(Nullable(DateTime()), {
  description: "Data de exclusão lógica de #entityName",
  default: null,
});

export const Cep = Define(Text, {
  description: "Código postal (CEP) formatado",
  regex: /^\d{5}-\d{3}$/,
  examples: ["01001-000"],
});

export const Slug = Define(Text, {
  description: "Identificador textual amigável (slug) de #entityName",
  regex: /^[a-z0-9-]+$/,
});

export const PublicIp = Define(Ip({ version: "v4" }), {
  description: "Endereço IPv4 público de origem da requisição",
});

function subtractFriendlyDuration(from: Date, friendly: string): Date {
  const match = /^(\d+)(ms|s|m|h|d|w|y)$/.exec(friendly.trim());
  if (!match) return from;
  const amount = Number(match[1]);
  const unitMs: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
    y: 31_536_000_000,
  };
  const unit = match[2] as string;
  return new Date(from.getTime() - amount * (unitMs[unit] ?? 0));
}

export const TimeAgo = Define(DateTime, {
  description: "Data no passado, opcionalmente dentro de uma janela",
  refine: (val: Date, opts?: { within?: string }) => {
    if (val > new Date()) return "Não pode ser no futuro";
    if (opts?.within && val < subtractFriendlyDuration(new Date(), opts.within)) {
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

export const RowVersion = Define(Version({ type: "incr" }), {
  description: "Versão otimista do registro de #entityName",
});

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

export const Phone = Define(Text, {
  description: "Telefone em formato E.164",
  regex: /^\+[1-9]\d{7,14}$/,
  examples: ["+5511999999999"],
});

export const Brl = Define(NumberField({ int: true, min: 0 }), {
  description: "Valor monetário em centavos (BRL)",
  examples: [15000],
});

export const ShortId = Define(Text, {
  description: "Identificador curto, não-sequencial, seguro pra URL",
  regex: /^[A-Za-z0-9_-]{21}$/,
  default: () => nanoid(),
});
