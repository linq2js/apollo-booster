import { NestedMap } from "./NestedMap";

describe("SerializableKeyMap", () => {
  test("not serialize key", () => {
    const map = new NestedMap(() => ({ value: {} }));
    const v1 = map.get({});
    const v2 = map.get({});
    const v3 = map.get(1);
    const v4 = map.get(1);

    expect(v1).not.toBe(v2);
    expect(v3).toBe(v4);
  });

  test("serialize key", () => {
    const map = new NestedMap(() => ({ value: {} }), JSON.stringify);
    const v1 = map.get({});
    const v2 = map.get({});

    expect(v1).toBe(v2);
  });

  test("dispose", () => {
    const dispose = jest.fn();
    const map = new NestedMap((_: string) => {
      const nested = new NestedMap((key: string) => ({
        value: key,
        onDispose: dispose,
      }));
      return { value: nested, onDispose: nested.clear };
    });
    const v1 = map.get("1").get("1.1");
    const v2 = map.get("2").get("2.1");
    map.get("1").get("1.2");
    map.get("2").get("2.2");
    expect(v1).toBe("1.1");
    expect(v2).toBe("2.1");
    map.delete("1");
    expect(dispose).toHaveBeenCalledTimes(2);
    map.delete("2");
    expect(dispose).toHaveBeenCalledTimes(4);
  });
});
