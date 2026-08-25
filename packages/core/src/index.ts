export { Define } from "./core/define.js";
export { FromZodType } from "./core/from-zod-type.js";
export type {
  FieldDescriptor,
  FieldDescriptorFactory,
  FieldDescriptorMeta,
  MessageMap,
} from "./core/field-descriptor.js";

export { Text } from "./primitives/text.js";
export { Number } from "./primitives/number.js";
export { Uuid } from "./primitives/uuid.js";
export { Email } from "./primitives/email.js";
export { Password } from "./primitives/password.js";
export { Ip } from "./primitives/ip.js";
export { Enum } from "./primitives/enum.js";
export { Version } from "./primitives/version.js";
export { Nullable } from "./primitives/nullable.js";
export { Optional } from "./primitives/optional.js";
export { List } from "./primitives/list.js";
export { DateTime } from "./primitives/date-time.js";
export { Timestamp } from "./primitives/timestamp.js";

export { Struct } from "./core/struct.js";
export { Embed } from "./core/embed.js";
export { STRUCT_META } from "./core/struct-meta.js";
export type { StructMeta, StructConstructorLike } from "./core/struct-meta.js";

export { Literal } from "./core/literal.js";
export { Ref } from "./core/ref.js";
export { FieldOf } from "./core/field-of.js";
export { Union } from "./core/union.js";

export { resolveIssueMessages } from "./core/i18n/resolve-issues.js";
export type { ResolvedIssue } from "./core/i18n/resolve-issues.js";
export { resolveLocale, localeStorage, setConfigLocaleReader } from "./core/i18n/resolve-locale.js";
export type { LocaleContext } from "./core/i18n/resolve-locale.js";
export { lookupMessage } from "./core/i18n/lookup-message.js";
export { descendPath } from "./core/i18n/descend-path.js";

export { ValidationError } from "./core/validation-error.js";
export { toJSON } from "./core/to-json.js";

export { defineConfig } from "./core/define-config.js";
export { getConfig, discoverConfig } from "./core/config.js";
export type {
  MorphzConfig,
  MorphzLabelsConfig,
  MorphzTemplateConfig,
  MorphzLocaleConfig,
} from "./core/config.js";
