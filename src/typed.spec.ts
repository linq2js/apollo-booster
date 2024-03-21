import { typed } from "./typed";

const FooType = { name: "foo" };
const BarType = { name: "bar" };

describe("typed", () => {
  test("non-object type", () => {
    const result = typed(1, FooType);
    expect(result).toBe(1);
  });

  test("array", () => {
    const result = typed([{ name: "Ging" }, { name: "Ging" }], FooType);
    expect(result).toEqual([
      { name: "Ging", __typename: "foo" },
      { name: "Ging", __typename: "foo" },
    ]);
  });

  test("promise", async () => {
    const result = typed(Promise.resolve({ name: "Ging" }), FooType);
    await expect(result).resolves.toEqual({ name: "Ging", __typename: "foo" });
  });

  test("respect existing __typename", () => {
    const result = typed(
      [{ name: "Ging", __typename: "person" }, { name: "Ging" }],
      FooType
    );
    expect(result).toEqual([
      { name: "Ging", __typename: "person" },
      { name: "Ging", __typename: "foo" },
    ]);
  });

  test("dynamic type", () => {
    const result = typed([{ type: "foo" }, { type: "bar" }], (value) =>
      value.type === "foo" ? FooType : BarType
    );
    expect(result).toEqual([
      { type: "foo", __typename: "foo" },
      { type: "bar", __typename: "bar" },
    ]);
  });

  test("nested type", () => {
    const result = typed(
      { children: [{ value: 1 }, { value: 2, nested: { value: 3 } }] },
      {
        name: "parent",
        props: {
          children: { name: "child" },
          "children.nested": { name: "nested" },
        },
      }
    );
    expect(result).toEqual({
      __typename: "parent",
      children: [
        { __typename: "child", value: 1 },
        {
          __typename: "child",
          value: 2,
          nested: { __typename: "nested", value: 3 },
        },
      ],
    });
  });
});
