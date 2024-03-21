import {
  ApolloClient,
  ApolloProvider,
  InMemoryCache,
  gql,
  useApolloClient,
} from "@apollo/client";
import { createAdapter } from "./createAdapter";
import { from, computed, query, reactive, mutation, resolver, typed } from ".";
import {
  ComponentClass,
  FunctionComponent,
  PropsWithChildren,
  ReactNode,
  Suspense,
  createElement,
} from "react";
import { screen, act, renderHook } from "@testing-library/react";
import { useAdapter } from "./useAdapter";
import { ErrorBoundary } from "react-error-boundary";
import { delay } from "./utils";
import { MockedProvider, MockedProviderProps } from "@apollo/client/testing";
import { Adapter } from "./types";

const COUNT_GQL = gql`
  query {
    count
  }
`;

const DOUBLED_COUNT_GQL = gql`
  query {
    doubledCount
  }
`;

const TODO_LIST_GQL = gql`
  query {
    todos {
      id
    }
  }
`;

const USER_GQL = gql`
  query {
    user {
      id
      firstName
      lastName
      fullName @client
    }
  }
`;

const fullNameComputedField = computed(
  "User.fullName",
  (user: { firstName: string; lastName: string }) => {
    return `${user.firstName} ${user.lastName}`;
  }
);

const defaultMocks: MockedProviderProps["mocks"] = [
  {
    request: { query: COUNT_GQL },
    result: { data: { count: 1 } },
  },
  {
    request: { query: DOUBLED_COUNT_GQL },
    result: { data: { doubledCount: 2 } },
  },
  {
    request: { query: TODO_LIST_GQL },
    result: {
      data: {
        todos: [
          { __typename: "Todo", id: 1 },
          { __typename: "Todo", id: 2 },
          { __typename: "Todo", id: 3 },
        ],
      },
    },
  },
  {
    request: { query: USER_GQL },
    result: {
      data: {
        user: {
          id: 1,
          __typename: "User",
          firstName: "Ging",
          lastName: "Freecss",
        },
      },
    },
  },
];

const createTestAdapter = () => {
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    uri: "",
  });
  const adapter = createAdapter(client);
  const wrapper = createWrapper(ApolloProvider, { client });
  return [adapter, wrapper, client] as const;
};

const createWrapper = <TProps extends object>(
  providerType: FunctionComponent<TProps> | ComponentClass<TProps>,
  providerProps: Omit<TProps, "children">,
  ...children: ReactNode[]
) => {
  const wrapper = (props: PropsWithChildren) =>
    createElement(providerType, {
      ...(providerProps as any),
      children: createElement(ErrorBoundary, {
        fallback: createElement("div", { children: "error" }),
        children: createElement(Suspense, {
          fallback: createElement("div", { children: "loading" }),
          children: [...children, props.children],
        }),
      }),
    });

  return wrapper;
};

const createMockProvider = (
  providerProps: MockedProviderProps = { mocks: defaultMocks }
) => {
  let lastAdapter: Adapter | undefined;
  const AccessLastAdapter = () => {
    lastAdapter = useAdapter();
    return null;
  };
  const wrapper = createWrapper(
    MockedProvider,
    providerProps,
    createElement(AccessLastAdapter, { key: "AccessLastAdapter" })
  );
  return [wrapper, () => lastAdapter] as const;
};

describe("reactiveVar", () => {
  test("read variable", () => {
    const [adapter] = createTestAdapter();
    const countVar1 = reactive(1);
    const countVar2 = reactive(2);
    expect(adapter.get(countVar1)).toBe(1);
    expect(adapter.get(countVar2)).toBe(2);
  });

  test("write variable", () => {
    const [adapter] = createTestAdapter();
    const countVar = reactive(1);
    expect(adapter.get(countVar)).toBe(1);
    adapter.set(countVar, (prev) => prev + 1);
    expect(adapter.get(countVar)).toBe(2);
  });

  test("The `reactive variable` should be accessible to an individual `client`", () => {
    const [adapter1] = createTestAdapter();
    const [adapter2] = createTestAdapter();
    const countVar = reactive(1);
    expect(adapter1.get(countVar)).toBe(1);
    expect(adapter2.get(countVar)).toBe(1);
    // update countVar
    adapter1.set(countVar, (prev) => prev + 1);
    expect(adapter1.get(countVar)).toBe(2);
    // The `countVar` of `adapter2` remains unchanged
    expect(adapter2.get(countVar)).toBe(1);
  });

  test("use reactive var", () => {
    const [adapter, wrapper] = createTestAdapter();
    const countVar = reactive(1);
    const { result } = renderHook(() => useAdapter().use(countVar)[0], {
      wrapper,
    });
    expect(result.current).toBe(1);
    act(() => {
      adapter.set(countVar, 2);
    });
    expect(result.current).toBe(2);
  });
});

describe("query", () => {
  test("simple value", async () => {
    const [wrapper] = createMockProvider();
    const countQuery = query<{ count: number }>(COUNT_GQL);
    const doubledCountQuery = query<{ doubledCount: number }>(
      DOUBLED_COUNT_GQL
    );
    const { result } = renderHook(
      () => {
        // execute multiple queries at once
        const [{ count }, { doubledCount }] = useAdapter().use(
          countQuery,
          doubledCountQuery
        );
        return [count, doubledCount];
      },
      { wrapper }
    );
    screen.getByText("loading");
    await act(delay);
    expect(result.current).toEqual([1, 2]);
  });
});

describe("resolver", () => {
  test("type resolver", async () => {
    const [wrapper] = createMockProvider();
    const userQuery = query<{
      user: { firstName: string; lastName: string; fullName: string };
    }>(() => ({
      document: USER_GQL,
      require: [fullNameComputedField],
    }));
    const { result } = renderHook(
      () => {
        // execute multiple queries at once
        const [{ user }] = useAdapter().use(userQuery);
        return user;
      },
      { wrapper }
    );
    await act(delay);
    await act(delay);
    expect(result.current).toEqual({
      id: 1,
      __typename: "User",
      firstName: "Ging",
      lastName: "Freecss",
      fullName: "Ging Freecss",
    });
  });

  test("typed json objects", async () => {
    const [wrapper, getLastAdapter] = createMockProvider();
    const userQuery = query<{
      user: { firstName: string; lastName: string };
    }>(() => ({ document: USER_GQL }));
    const updateUserResolver = resolver("Mutation.updateUser", () => () => {
      const result = typed(
        { id: 1, firstName: "updated firstName" },
        { name: "User" }
      );
      return result;
    });
    const updateUserMutation = mutation(() => ({
      document: gql`
        mutation {
          updateUser @client {
            id
            firstName
          }
        }
      `,
      require: [updateUserResolver],
    }));
    const { result } = renderHook(
      () => {
        // execute multiple queries at once
        const [{ user }] = useAdapter().use(
          userQuery.with({ fetchPolicy: "cache-first" })
        );
        return user;
      },
      { wrapper }
    );

    await act(delay);
    await act(delay);

    expect(result.current).toEqual({
      id: 1,
      __typename: "User",
      firstName: "Ging",
      lastName: "Freecss",
    });

    getLastAdapter()?.mutate(updateUserMutation);

    await act(delay);
    await act(delay);

    expect(result.current).toEqual({
      id: 1,
      __typename: "User",
      firstName: "Ging",
      lastName: "Freecss",
    });
  });
});

describe("entity", () => {
  test("modify", async () => {
    let renders = 0;
    const [wrapper, getLastAdapter] = createMockProvider();
    const userQuery = query<{
      user: { firstName: string; lastName: string; fullName: string };
    }>(() => ({ document: USER_GQL, require: [fullNameComputedField] }));
    const { result } = renderHook(
      () => {
        renders++;
        return useAdapter().use(userQuery)[0].user;
      },
      { wrapper }
    );

    // wait for resolved added
    await act(delay);

    // wait for querying
    await act(delay);

    // query data ready
    expect(result.current).toEqual({
      id: 1,
      __typename: "User",
      firstName: "Ging",
      lastName: "Freecss",
      fullName: "Ging Freecss",
    });
    getLastAdapter()?.set(result.current, {
      firstName: "new first name",
      lastName: (prev) => `${prev} (modified)`,
    });

    // wait for cache update
    await act(delay);

    expect(result.current).toEqual({
      id: 1,
      __typename: "User",
      firstName: "new first name",
      lastName: "Freecss (modified)",
      fullName: "Ging Freecss",
    });
    getLastAdapter()?.set(result.current, {
      lastName: "new last name",
      // re-compute
      fullName: fullNameComputedField,
    });
    // wait for cache update
    await act(delay);

    expect(result.current).toEqual({
      id: 1,
      __typename: "User",
      firstName: "new first name",
      lastName: "new last name",
      fullName: "new first name new last name",
    });
  });

  test("evict", async () => {
    const todoListQuery = query<{
      todos: { id: number; __typename: string }[];
    }>(TODO_LIST_GQL);
    const [wrapper, getLastAdapter] = createMockProvider();
    const { result } = renderHook(
      () => {
        return useAdapter().use(todoListQuery)[0].todos;
      },
      { wrapper }
    );
    await act(delay);
    expect(result.current).toEqual([
      { __typename: "Todo", id: 1 },
      { __typename: "Todo", id: 2 },
      { __typename: "Todo", id: 3 },
    ]);
    getLastAdapter()?.evict(result.current[0]);
    await act(delay);
    expect(result.current).toEqual([
      { __typename: "Todo", id: 2 },
      { __typename: "Todo", id: 3 },
    ]);
  });
});

describe("persist", () => {
  test("persisted variable", async () => {
    const [adapter1] = createTestAdapter();
    const countVar = reactive(1, { name: "count" });
    let cached: any;
    await adapter1.persist({
      write(getData) {
        cached = getData();
      },
    });

    expect(adapter1.get(countVar)).toBe(1);
    adapter1.set(countVar, 2);
    expect(adapter1.get(countVar)).toBe(2);

    const [adapter2] = createTestAdapter();
    await adapter2.persist({ read: () => cached });
    expect(adapter1.get(countVar)).toBe(2);
  });

  test("persisted query data", async () => {
    let installed = false;
    let cached: any;
    const userQuery = query<{
      user: {
        id: number;
        __typename: string;
        firstName: string;
        lastName: string;
      };
    }>(USER_GQL);
    const [wrapper, getLastAdapter] = createMockProvider();
    // write data
    renderHook(
      () => {
        const client = useApolloClient();
        if (!installed) {
          installed = true;
          from(client).persist({
            write(getData) {
              cached = getData();
            },
          });
        }
        useAdapter().use(userQuery);
      },
      { wrapper }
    );

    await act(delay);

    getLastAdapter()?.set(userQuery, {
      user: {
        id: 1,
        __typename: "User",
        firstName: "new first name",
        lastName: "new last name",
      },
    });
    expect(cached).not.toBeUndefined();

    // read data
    installed = false;

    const { result } = renderHook(
      () => {
        const client = useApolloClient();
        if (!installed) {
          installed = true;
          from(client).persist({
            async read() {
              return cached;
            },
          });
        }

        return useAdapter().use(
          userQuery.with({ fetchPolicy: "cache-only" })
        )[0];
      },
      { wrapper }
    );

    await act(delay);

    // the current user should be cached version
    expect(result.current).toEqual({
      user: {
        id: 1,
        __typename: "User",
        firstName: "new first name",
        lastName: "new last name",
      },
    });
  });
});

describe("useAdapter", () => {
  test("union type", async () => {
    let flag = false;
    const [wrapper] = createMockProvider();
    const userQuery = query<{
      user: {
        id: number;
        __typename: string;
        firstName: string;
        lastName: string;
      };
    }>(USER_GQL);

    const { result, rerender } = renderHook(
      () => {
        const [r1, r2, r3] = useAdapter().use(userQuery, 1, flag && userQuery);
        return { r1, r2, r3 };
      },
      { wrapper }
    );
    await act(delay);
    expect(result.current.r1.user).not.toBeUndefined();
    expect(result.current.r2).toBe(1);
    expect(result.current.r3).toBe(false);

    flag = true;
    rerender();

    expect(result.current.r1.user).not.toBeUndefined();
    expect(result.current.r2).toBe(1);
    expect(result.current.r3).toEqual({ user: expect.anything() });
  });
});
