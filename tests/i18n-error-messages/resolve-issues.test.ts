import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Struct } from "../../src/core/struct.js";
import { Embed } from "../../src/core/embed.js";
import { Text } from "../../src/primitives/text.js";
import { Email } from "../../src/primitives/email.js";
import { List } from "../../src/primitives/list.js";
import { Define } from "../../src/core/define.js";
import { resolveIssueMessages } from "../../src/core/i18n/resolve-issues.js";
import { STRUCT_META } from "../../src/core/struct-meta.js";

// resolveIssueMessages() is tested standalone here, against a RAW ZodError
// pulled from the schema directly — since lifecycle-serialization, the
// constructor/.parse() wrap failures in ValidationError (whose .issues is
// already resolved), so bypassing it via STRUCT_META.schema keeps this
// suite testing resolveIssueMessages() in isolation, not the constructor.
function parseAndCatch(StructClass: any, input: unknown): z.ZodError {
  const result = StructClass[STRUCT_META].schema.safeParse(input);
  if (result.success) throw new Error("expected parse to fail");
  return result.error;
}

describe("resolveIssueMessages", () => {
  const CustomEmail = Define(Email, {
    message: { invalid_format: { "pt-BR": "Formato de e-mail incorreto" } },
  });

  it("substitutes the custom message for a field with a registered override", () => {
    class User extends Struct({ email: CustomEmail() }, { labels: { entityName: "Usuário" } }) {}

    const err = parseAndCatch(User, { email: "not-an-email" });
    const resolved = resolveIssueMessages(err, User as any, "pt-BR");

    expect(resolved).toHaveLength(1);
    expect(resolved[0].path).toEqual(["email"]);
    expect(resolved[0].message).toBe("Formato de e-mail incorreto");
  });

  it("leaves Zod's raw message untouched for a field with no registered override", () => {
    class User extends Struct({ email: Email() }, { labels: { entityName: "Usuário" } }) {}

    const err = parseAndCatch(User, { email: "not-an-email" });
    const resolved = resolveIssueMessages(err, User as any, "pt-BR");

    expect(resolved).toHaveLength(1);
    expect(resolved[0].message).toBe(err.issues[0]!.message);
    expect(resolved[0].message).not.toBe("Formato de e-mail incorreto");
  });

  it("recurses into Embed targets — a nested field's own message override applies", () => {
    class Child extends Struct({ email: CustomEmail() }, { labels: { entityName: "Filho" } }) {}

    class Parent extends Struct({ child: Embed(Child) }, { labels: { entityName: "Pai" } }) {}

    const err = parseAndCatch(Parent, { child: { email: "nope" } });
    const resolved = resolveIssueMessages(err, Parent as any, "pt-BR");

    expect(resolved).toHaveLength(1);
    expect(resolved[0].path).toEqual(["child", "email"]);
    expect(resolved[0].message).toBe("Formato de e-mail incorreto");
  });

  it("stops at List items — falls back to Zod's raw message, no override attempted", () => {
    class Post extends Struct(
      { tags: List(Text({ min: 3, message: { too_small: { "pt-BR": "custom (never used)" } } })) },
      { labels: { entityName: "Post" } },
    ) {}

    const err = parseAndCatch(Post, { tags: ["okay", "x"] });
    const resolved = resolveIssueMessages(err, Post as any, "pt-BR");

    expect(resolved).toHaveLength(1);
    expect(resolved[0].path).toEqual(["tags", 1]);
    expect(resolved[0].message).toBe(err.issues[0]!.message);
    expect(resolved[0].message).not.toBe("custom (never used)");
  });
});
