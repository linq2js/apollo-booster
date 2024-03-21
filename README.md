# `apollo-booster`

This NPM library enhances Apollo Client projects by offering conditional reactive variables, queries, and mutations, simplifying data persistence, and promoting clean code through separation of concerns. It also supports dynamic resolver registration, making it ideal for efficient and maintainable GraphQL applications.

## Installation

Using NPM

```bash
npm i apollo-booster
```

Using YARN

```bash
yarn add apollo-booster
```

## Features

- Enables conditional usage of reactive variables, queries, and mutations.
- Simplifies persistence of query data and values of reactive variables.
- Facilitates separation of concerns (resolvers, mutations, queries, reactive variables).
- Supports dynamic resolver registration.

## Recipes

### Consuming a Single Query

Using `@apollo/client`

```js
import { useQuery } from "@apollo/client";
import TODO_LIST_QUERY from "./todoListQuery.gql";

const TodoList = () => {
  const { data, loading, error } = useQuery(TODO_LIST_QUERY);
  // handle error
  if (error) return <div>Something went wrong</div>;
  // handle loading
  if (loading) return <div>Loading...</div>;
  // render data
  return data.map((todo) => <Todo key={todo.id} todo={todo} />);
};
```

Using `apollo-booster`

```js
import { useAdapter, query } from "apollo-booster";
import TODO_LIST_QUERY from "./todoListQuery.gql";

const TodoListQuery = query(TODO_LIST_QUERY);

const TodoList = () => {
  // no need to handle loading and error
  // closest Suspense and ErrorBoundary will handle those
  const [todos] = useAdapter().use(TodoListQuery);
  // render data
  return todos.map((todo) => <Todo key={todo.id} todo={todo} />);
};

const App = () => {
  return (
    <ErrorBoundary fallback={<div>Something went wrong</div>}>
      <Suspense fallback={<div>Loading...</div>}>
        <TodoList />
      </Suspense>
    </ErrorBoundary>
  );
};
```

Note: The usage of a single query between `@apollo/client` and `apollo-booster` remains largely similar.

### Consuming Multiple Queries Simultaneously

Using `@apollo/client`

```js
const useCurrentUser = () => {
  const profileResult = useQuery(ME_QUERY);
  const permissionsResult = useQuery(PERMISSIONS_QUERY, {
    skip: !profileResult.data || profileResult.error,
    variables: { userId: profileResult.data?.id },
  });
  const articlesResult = useQuery(GET_ARTICLE_LIST_BY_USER_QUERY, {
    skip: !profileResult.data || profileResult.error,
    variables: { userId: profileResult.data?.id },
  });
  const extraResult1 = useQuery(GET_EXTRA_1_INFO_QUERY, {
    skip:
      !profileResult.data ||
      profileResult.error ||
      // Based on the `profile.extra` property, load the appropriate additional information.
      profileResult.data.extra !== 1,
    variables: { userId: profileResult.data?.id },
  });
  const extraResult2 = useQuery(GET_EXTRA_2_INFO_QUERY, {
    skip:
      !profileResult.data ||
      profileResult.error ||
      // Based on the `profile.extra` property, load the appropriate additional information.
      profileResult.data.extra !== 2,
    variables: { userId: profileResult.data?.id },
  });

  const loading =
    profileResult.loading ||
    permissionsResult.loading ||
    articlesResult.loading ||
    extraResult1.loading ||
    extraResult2.loading;
  const error =
    profileResult.error ||
    permissionsResult.error ||
    articlesResult.error ||
    extraResult1.error ||
    extraResult2.error;

  const data = {
    profile: profileResult.data,
    permissions: permissionsResult.data,
    articles: articlesResult.data,
    extra: extraResult1.data || extraResult2.data,
  };

  return { loading, error, data };
};

const useMyPermissions = () => {
  const { loading, error, data } = useCurrentUser();
  // continue handle loading, error statuses
  return {
    loading,
    error,
    data: data?.permissions,
  };
};

const useMyArticles = () => {
  const { loading, error, data } = useCurrentUser();
  // continue handle loading, error statuses
  return {
    loading,
    error,
    data: data?.articles,
  };
};
```

Challenges with the above code include complexity, maintenance difficulty, and error-prone handling of loading states and errors.

Using `apollo-booster`

```js
const MeQuery = query(ME_QUERY);
const PermissionsQuery = query(PERMISSIONS_QUERY);
const ArticleListQuery = query(GET_ARTICLE_LIST_BY_USER_QUERY);
const ExtraInfo1Query = query(GET_EXTRA_1_INFO_QUERY);
const ExtraInfo2Query = query(GET_EXTRA_2_INFO_QUERY);

const useCurrentUser = () => {
  const { use } = useAdapter();
  const [profile] = use(MeQuery);
  // To handle multiple queries simultaneously without the need to manage loading and error states individually (as required in a sequential,
  // waterfall execution method), consider implementing a parallel or batch request strategy. This approach allows for the concurrent processing of multiple queries,
  // thereby optimizing efficiency and response time.
  // It's essential, however, to ensure proper error handling and response parsing for each query within the batch to maintain robustness and reliability in your application.
  const [permissions, articles, extra] = use(
    PermissionsQuery.with({ variables: { id: profile.id } }),
    ArticleListQuery.with({ variables: { id: profile.id } }),
    // Based on the `profile.extra` property, load the appropriate additional information.
    profile.extra === 1
      ? ExtraInfo1Query.with({ variables: { id: profile.id } })
      : ExtraInfo2Query.with({ variables: { id: profile.id } })
  );

  // combine results
  return {
    profile,
    permissions,
    articles,
    extra,
  };
};

const useMyPermissions = () => {
  return useCurrentUser().permissions;
};

const useMyArticles = () => {
  return useCurrentUser().articles;
};
```

Using apollo-booster streamlines the process, reducing complexity and the potential for errors when handling multiple queries.

### Using a Resolver to combine complex queries/mutations

In the previous example, we consumed multiple queries and then performed calculations within the React hook. This approach is not ideal for complex computational logic. Although we can use useMemo to memoize the results, this technique becomes ineffective if the logic is reused in multiple locations.

To make memoizing results more efficient and shareable across multiple locations, we can utilize the dynamic resolver feature. A dynamic resolver is registered to the `client` whenever it is used in a query or mutation.

```js
const CurrentUserResolver = resolver(
  // a query name
  "Query.currentUser",
  (adapter) => {
    // returns a resolver, the resolver signature is the same as GraphQL server resolver
    return async (parent, args, context, info) => {
      const profile = adapter.query(MeQuery);
      const [permissions, articles, extra] = await Promise.all([
        adapter.query(PermissionsQuery.with({ variables: { id: profile.id } })),
        adapter.query(ArticleListQuery.with({ variables: { id: profile.id } })),
        adapter.query(
          profile.extra === 1
            ? ExtraInfo1Query.with({ variables: { id: profile.id } })
            : ExtraInfo2Query.with({ variables: { id: profile.id } })
        ),
      ]);

      return {
        profile,
        permissions,
        articles,
        extra,
      };
    };
  }
);

const CurrentUserQuery = query((variables) => {
  return {
    // Should include the `@client` directive to inform Apollo that the result must be resolved by a local resolver.
    document: gql`
      query {
        currentUser @client {
          profile
          permissions
          articles
          extra
        }
      }
    `,
    // list of required resolvers
    require: [CurrentUserResolver],
    variables,
  };
});

const useCurrentUser = () => {
  const [currentUser] = useAdapter().use(CurrentUserQuery);
  return currentUser;
};
```

### Persistance query data and reactive variable values

`apollo-booster` offers an efficient method for managing persistent data, accommodating data from various sources, whether they return data synchronously or asynchronously.

```js
import { from } from "apollo-booster";

const adapter = from(client);

adapter.persist({
  // This method is triggered during the initiation of the cache restoration process,
  // specifically for reading persisted data from the data source.
  read() {
    return JSON.parse(localStorage.getItem("app"));
  },

  // The process of reading persisted data can be asynchronous,
  // allowing for the retrieval of persisted data from a server
  async read() {
    return fetch("api/to/return/app/data");
  },

  write(getData) {
    localStorage.setItem("app", JSON.stringify(getData()));
  },
});
```

During the data restoration process, any call to `useAdapter()` will result in a promise being thrown. To manage the pending state of the application effectively, the `Suspense` component can be utilized. `Suspense` provides a way to wrap asynchronous operations, allowing the application to display fallback content (such as loading indicators) while waiting for the asynchronous task to complete, thus enhancing the user experience during data restoration.

```js
// perform data restoring
from(client).persist({});

const App = () => {
  return (
    <Suspense fallback={<div>Application is loading</div>}>
      <MainContent />
    </Suspense>
  );
};
```

If the data writing process is executed frequently, implementing a debounce mechanism can enhance application performance. Debouncing consolidates multiple rapid calls to the data writing function into a single call, typically after a specified delay or when the activity ceases, thereby reducing the number of operations performed and minimizing resource consumption.

```js
import { from } from "apollo-booster";
import debounce from "lodash/debounce";

const debouncedWrite = (getData) => {
  const data = getData();
  // write to data source
};

from(client).persist({ write });
```

### Using `New Reactive Variable`

Although the Apollo Client provides reactive variables for storing simple values, reactive variables have the following limitations: values are not persistent, they operate globally and are not tied to individual Apollo Client instances, making it difficult to reset values during unit testing.

Apollo Booster enhances the efficiency of using reactive variables. Each reactive variable can be initialized lazily and associated with a specified Apollo Client. Within a React component, these reactive variables can be consumed on-demand, allowing for a more optimized and flexible approach to managing state in applications. This lazy initialization and association with specific Apollo Client instances improve modularity and facilitate easier unit testing.

```js
import { useAdapter, reactive } from "apollo-booster";

const countVar = reactive(1);
const themeVar = reactive("dark");

const App = (props) => {
  const { use, get, set } = useAdapter();

  useEffect(() => {
    // read the variable, no binding needed
    alert(`Current theme ${get(themeVar)}`);

    setInterval(() => {
      set(countVar, (prev) => prev + 1);
    }, 1000);
  }, []);

  return (
    <>
      {/* retrieve variable value and perform binding to the component */}
      <h1>{use(countVar)}</h1>
      {/* conditional rendering with reactive variable, perform binding lazily */}
      {props.showTheme && <div>{use(themeVar)}</div>}
    </>
  );
};
```

### Utilize a Resolver to integrate multiple external APIs

If you are dealing with multiple API endpoints, each utilizing different technologies and protocols, you can employ a "resolver" to encapsulate all the data fetching logic. This approach eliminates the need for creating a new Apollo Link for each endpoint.

```js
import { typed, resolver } from "apollo-booster";

// define a resolver to handle REST API
const TodoListResolver = resolver("Query.todos", () => async (parent, args) => {
  // call REST API
  const res = await fetch("https://jsonplaceholder.typicode.com/todos");
  return await res.json();
});

const TodoListQuery = query(() => {
  return {
    document: gql`
      query {
        todos @client {
          id
          title
          completed
        }
      }
    `,
    require: [TodoListResolver],
  };
});
```

The response from a REST API lacks the `__typename` field, indicating that the objects are untyped. To associate these objects with an existing type in the GraphQL schema, you can use the `typed` function to automatically assign a `__typename` field to each object.

```js
import { typed } from "apollo-booster";
const TodoListResolver = resolver("Query.todos", () => async (parent, args) => {
  // call REST API
  const res = await fetch("https://jsonplaceholder.typicode.com/todos");
  // now each item in todo list has __typename prop = 'Todo'
  return typed(res.json(), { name: "Todo" });
});
```

By adding the `__typename` field to JSON objects, you enable the use of `field` queries on those objects.

```js
const UserResolver = resolver(
  // define `user` field for Todo and Post types
  ["Todo.user", "Post.user"],
  (adapter) => async (parent, args) => {
    // read userId from Todo or Post object
    const userId = parent.userId;
    const res = await fetch(
      `https://jsonplaceholder.typicode.com/users/${userId}`
    );
    return typed(res.json(), { name: "User" });
  }
);

// refactor TodoListQuery
const TodoListQuery = query(() => {
  return {
    document: gql`
      query {
        todos @client {
          id
          title
          completed
          # select user field
          user @client {
            id
            name
            email
          }
        }
      }
    `,
    require: [TodoListResolver, UserResolver],
  };
});
```

## API References

### `from` function

Create `Adapter` interface from specified Apollo client

```js
import { from } from "apollo-booster";

const adapter = from(client);

adapter.ready(() => {
  // perform app initializing logic here
});
```

### `useAdapter` Hook

The `useAdapter` function is a React Hook that provides access to the adapter of the current Apollo client. This adapter facilitates interactions with the Apollo client's cache, allowing for operations such as queries, mutations.

#### Usage

```ts
const adapter = useAdapter();
```

Upon invocation, `useAdapter` retrieves the Apollo client's adapter using the `useApolloClient` hook internally. It returns a `ReactAdapter`, which is an extension of the `Adapter` interface, tailored for React-specific operations.

### `ReactAdapter` Interface

The `ReactAdapter` interface extends the Adapter interface to include the use method, which allows for retrieving values from queries or reactive variables and linking a React component to these data sources for automatic re-rendering upon data changes.

- **Methods**:

  - use<const TDefinitions extends readonly any[]>(...defs: TDefinitions): { [key in keyof TDefinitions]: MaybeObservable<TDefinitions[key]> }: Retrieves values from queries or reactive variables defined in TDefinitions. This method can be called within loops and conditional statements, unlike other React Hooks.

### `Adapter` Interface

The `Adapter` interface serves as a bridge between your application and the Apollo client, abstracting away direct interactions with the Apollo cache or network layer. It provides a set of methods to perform GraphQL operations such as queries and mutations, manipulate cache, and manage reactive variables.

- **Properties:**

  - `client`: A readonly property that gives access to the underlying ApolloClient instance.

- **Methods**:
  - `query<TData extends object>(query: QueryDef<TData, object>): Promise<TData>`: Executes a GraphQL query and returns a promise that resolves with the data.
  - `mutate<TData extends object>(mutation: MutationDef<TData, object>): Promise<TData>`: Performs a GraphQL mutation and returns a promise that resolves with the result.
  - `call<TResult, TArgs extends readonly any[]>(action: (adapter: Adapter, ...args: TArgs) => TResult, ...args: TArgs): TResult`: Invokes a specified action, passing the adapter as the first argument along with any other provided arguments.
  - `ref<T>(options: QueryRefOptions): QueryRef<T>`: Creates a `QueryRef` instance for managing a query's lifecycle, including re-fetching, subscription to result changes, and more.
  - `get<TData>(reactiveVar: ReactiveVarDef<TData>): TData`: Retrieves the current value of a specified reactive variable.
  - `get<TData extends object>(query: QueryDef<TData, object>): TData | undefined`: Retrieves cached data for a specified query, if available.
  - `set<TData extends object>(query: QueryDef<TData, object>, valueOrReducer: TData | ((prev: TData) => TData)): TData`: Updates the cache for a given query with either a new value or the result of a provided reducer function.
  - `set<TData>(reactiveVar: ReactiveVarDef<TData>, valueOrReducer: TData | ((prev: TData) => TData)): TData`: Sets a new value for a specified reactive variable, using either a direct value or a reducer function.
  - `set<T extends object>(entity: T, data: { [key in keyof T]?: ComputedDef<T, T[key]> | T[key] | Modifier<T[key]>; }): VoidFunction`: Updates properties of an object in the cache, affecting all related queries containing that object.
  - `evict(storedObject: StoreObject | Reference): boolean`: Removes an object from the cache, updating all related queries.
  - `persist(options: PersistOptions): Promise<void>`: Initiates the persistence of cache data based on specified options, such as custom read and write methods for storage.
  - `ready(): Promise<void> | undefined`: If the cache is being restored, returns a promise that resolves once the restoration is complete. Otherwise, returns `undefined`.
  - `ready(callback: (adapter: Adapter) => void): void`: Registers a callback to be invoked once cache restoration is complete. If there's nothing to restore, the callback is invoked immediately.

## License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/linq2js/apollo-booster/blob/main/LICENSE) file for details.

## Community Support

For questions, discussions, or contributions, please join our community:

- **GitHub Issues:** For reporting bugs or requesting new features, please use [GitHub Issues](https://github.com/linq2js/apollo-booster/issues).
- **Discussions:** Join the conversation and ask questions in [GitHub Discussions](https://github.com/linq2js/apollo-booster/discussions).
- **Contribute:** Contributions are welcome! If you're interested in contributing, please read our [CONTRIBUTING](https://github.com/linq2js/apollo-booster/blob/main/CONTRIBUTING.md) guide for more information on how to get started.

Stay connected and help improve `apollo-booster` by sharing your feedback and ideas with the community!
