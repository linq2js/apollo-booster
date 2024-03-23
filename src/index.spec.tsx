import {
  ApolloClient,
  ApolloProvider,
  InMemoryCache,
  gql,
  useApolloClient,
} from "@apollo/client";
import { createAdapter } from "./createAdapter";
import {
  from,
  query,
  reactive,
  mutation,
  resolver,
  typed,
  useAsync,
  fragment,
} from ".";
import {
  ComponentClass,
  FunctionComponent,
  PropsWithChildren,
  ReactNode,
  Suspense,
  createElement,
  useEffect,
} from "react";
import { screen, act, renderHook, render } from "@testing-library/react";
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
  query ($offset: Int) {
    todos(offset: $offset) @connection(key: "todoList") {
      id
    }
  }
`;

const USER_WITH_FULL_NAME_GQL = gql`
  query UserQuery {
    user {
      id
      firstName
      lastName
      fullName @client
    }
  }
`;

const USER_GQL = gql`
  query UserQuery {
    user {
      id
      firstName
      lastName
    }
  }
`;

const GET_LAST_NAME_GQL = gql`
  query GetLastNameQuery {
    getLastName {
      id
      lastName
    }
  }
`;

const fullNameComputedField = resolver.computed(
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
    request: { query: TODO_LIST_GQL, variables: { offset: 3 } },
    result: {
      data: {
        todos: [
          { __typename: "Todo", id: 4 },
          { __typename: "Todo", id: 5 },
          { __typename: "Todo", id: 6 },
        ],
      },
    },
  },
  {
    request: { query: USER_WITH_FULL_NAME_GQL },
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
  {
    request: {
      query: gql`
        query {
          user {
            id
            firstName
            ...LastNameFragment
          }
        }

        fragment LastNameFragment on User {
          lastName
        }
      `,
    },
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
  {
    request: { query: GET_LAST_NAME_GQL, variables: { id: 1 } },
    result: {
      data: {
        getLastName: {
          id: 1,
          __typename: "User",
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

  test("computed", () => {
    const [adapter] = createTestAdapter();
    const A = reactive(1);
    const B = reactive(2);
    const Sum = reactive((get) => get(A) + get(B), { computed: true });
    expect(adapter.get(Sum)).toBe(3);
    adapter.set(A, 2);
    expect(adapter.get(Sum)).toBe(4);
    adapter.set(B, 3);
    expect(adapter.get(Sum)).toBe(5);
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
      document: USER_WITH_FULL_NAME_GQL,
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
    }>(() => ({ document: USER_WITH_FULL_NAME_GQL }));
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
    }>(() => ({
      document: USER_WITH_FULL_NAME_GQL,
      require: [fullNameComputedField],
    }));
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
    }>(USER_WITH_FULL_NAME_GQL);
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
    }>(USER_WITH_FULL_NAME_GQL);

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

describe("watch", () => {
  test("variable", () => {
    const callback = jest.fn();
    const countVar = reactive(1);
    const [, wrapper] = createTestAdapter();
    const { result, unmount } = renderHook(
      () => {
        const { use, watch, set } = useAdapter();
        const [count] = use(countVar);
        useEffect(() => {
          return watch(countVar, callback);
        }, [watch, countVar]);

        return {
          count,
          increment() {
            set(countVar, (prev) => prev + 1);
          },
        };
      },
      { wrapper }
    );

    expect(result.current.count).toBe(1);
    act(() => result.current.increment());
    expect(result.current.count).toBe(2);
    act(() => result.current.increment());
    expect(result.current.count).toBe(3);
    expect(callback).toHaveBeenCalledTimes(2);

    unmount();

    act(() => result.current.increment());
    expect(callback).toHaveBeenCalledTimes(2);
  });

  test("query", async () => {
    const [wrapper] = createMockProvider();
    const callback = jest.fn();
    const userQuery = query<{
      user: { firstName: string; lastName: string };
    }>(USER_GQL);
    const { result, unmount } = renderHook(
      () => {
        const { use, watch, set } = useAdapter();
        const [data] = use(userQuery);
        useEffect(() => {
          return watch(userQuery, callback);
        }, [watch]);

        return {
          data,
          update() {
            set(userQuery, (prev) => ({
              ...prev,
              user: {
                ...prev.user,
                firstName: prev.user.firstName + ",updated",
              },
            }));
          },
        };
      },
      { wrapper }
    );
    expect(callback).toHaveBeenCalledTimes(0);
    await act(delay);
    expect(callback).toHaveBeenCalledTimes(0);
    act(() => result.current.update());
    await act(delay);
    act(() => result.current.update());
    await act(delay);
    expect(callback).toHaveBeenCalledTimes(2);

    unmount();

    act(() => result.current.update());
    expect(callback).toHaveBeenCalledTimes(2);
  });
});

describe("pagination", () => {
  test("fetchMore", async () => {
    const [wrapper, getLastAdapter] = createMockProvider();
    const todoListQuery = query<
      { todos: { id: number; __typename: string }[] },
      { offset: number }
    >(() => ({
      document: TODO_LIST_GQL,
      merge: (prev, incoming) => ({
        todos: [...prev.todos, ...incoming.todos],
      }),
    }));
    const { result } = renderHook(
      () => {
        const data = useAdapter().use(todoListQuery)[0];
        const loadable = useAsync();
        return { data, loadable };
      },
      { wrapper }
    );
    await act(delay);
    expect(result.current.data).toEqual({
      todos: [
        { __typename: "Todo", id: 1 },
        { __typename: "Todo", id: 2 },
        { __typename: "Todo", id: 3 },
      ],
    });
    act(() => {
      result.current.loadable.of(
        getLastAdapter()?.fetchMore(
          todoListQuery.with({ variables: { offset: 3 } })
        ) as any
      );
    });
    await act(delay);

    expect(result.current.data).toEqual({
      todos: [
        { __typename: "Todo", id: 1 },
        { __typename: "Todo", id: 2 },
        { __typename: "Todo", id: 3 },
        { __typename: "Todo", id: 4 },
        { __typename: "Todo", id: 5 },
        { __typename: "Todo", id: 6 },
      ],
    });
  });
});

describe("fragment", () => {
  test("normal fragment", async () => {
    const [wrapper] = createMockProvider();
    const lastNameFragment = fragment<{ lastName: string }>(gql`
      fragment LastNameFragment on User {
        lastName
      }
    `);
    const userQuery = query<{
      user: { id: number; firstName: string };
    }>(gql`
      query {
        user {
          id
          firstName
          ...LastNameFragment
        }
      }

      ${lastNameFragment}
    `);

    const Child = (props: { id: number }) => {
      const [{ lastName }] = useAdapter().use(
        lastNameFragment.with({ variables: props })
      );

      return <div>{lastName}</div>;
    };

    const Parent = () => {
      const [{ user }] = useAdapter().use(userQuery);
      return (
        <>
          <div>{user.firstName}</div>
          <Child id={user.id} />
        </>
      );
    };

    const { getByText } = render(<Parent />, { wrapper });
    getByText("loading");
    await act(delay);
    getByText("Ging");
    // last name already loaded
    getByText("Freecss");
  });

  test("fragment has fallback and data is not ready", async () => {
    // In this test scenario, the objective is to ensure that the fragment should utilize fallback query if the selected data is not ready.
    const [wrapper] = createMockProvider();
    const getLastNameQuery = query<
      { getLastName: { lastName: string } },
      { id: number }
    >(GET_LAST_NAME_GQL);
    const lastNameFragment = fragment<{ lastName: string }, { id: any }>(
      gql`
        fragment LastNameFragment on User {
          lastName
        }
      `,
      ({ id }) => ({
        id,
        fallback: ["getLastName", getLastNameQuery.with({ variables: { id } })],
      })
    );

    const Child = (props: { id: number }) => {
      const [{ lastName }] = useAdapter().use(
        lastNameFragment.with({ variables: props })
      );

      return <div>{lastName}</div>;
    };

    const { getByText } = render(<Child id={1} />, { wrapper });
    getByText("loading");
    await act(delay);
    getByText("Freecss");
  });

  test("fragment has fallback and data is ready", async () => {
    // In this test scenario, the objective is to ensure that the fragment utilizes cached data instead of resorting to a fallback query.
    const [wrapper] = createMockProvider();
    const getLastNameQuery = query<
      { getLastName: { lastName: string } },
      { id: number }
    >(GET_LAST_NAME_GQL);
    const lastNameFragment = fragment<{ lastName: string }, { id: any }>(
      gql`
        fragment LastNameFragment on User {
          lastName
        }
      `,
      ({ id }) => ({
        id,
        fallback: ["getLastName", getLastNameQuery.with({ variables: { id } })],
      })
    );

    const userQuery = query<{
      user: { id: number; firstName: string };
    }>(gql`
      query {
        user {
          id
          firstName
          ...LastNameFragment
        }
      }

      ${lastNameFragment}
    `);

    const Child = (props: { id: number }) => {
      const [{ lastName }] = useAdapter().use(
        lastNameFragment.with({ variables: props })
      );

      return <div>{lastName}</div>;
    };

    const Parent = () => {
      const [{ user }] = useAdapter().use(userQuery);
      return (
        <>
          <div>{user.firstName}</div>
          <Child id={user.id} />
        </>
      );
    };

    const { getByText } = render(<Parent />, { wrapper });
    getByText("loading");
    await act(delay);
    await act(delay);
    getByText("Ging");
    // last name already loaded
    getByText("Freecss");
  });
});
