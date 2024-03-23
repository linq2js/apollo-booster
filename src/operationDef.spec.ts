import { gql } from "@apollo/client";
import { fragment } from ".";
import { print } from "graphql";

describe("fragment", () => {
  test("auto fill type name", () => {
    const f = fragment(gql`
      fragment TodoProps on Todo {
        id
        title
      }
    `);

    const configs: any = f.create({ id: 1 });
    expect(configs.from).toBe("Todo:1");
  });

  test("custom type name", () => {
    const f = fragment(gql`
      fragment TodoProps on Todo {
        id
        title
      }
    `);

    const configs: any = f.create({ id: 1 });
    expect(configs.from).toBe("Todo:1");
  });

  test("fragment.toString", () => {
    const todoPropsFragment = fragment(
      gql`
        fragment TodoProps on Todo {
          id
          title
        }
      `,
      (variables: { id1: string }) => ({ id: variables.id1 })
    );

    expect(print(todoPropsFragment.fragment)).toBe(String(todoPropsFragment));
  });
});
