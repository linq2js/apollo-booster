# `apollo-booster`

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
  // To handle multiple queries simultaneously without the need to manage loading and error states individually (as required in a sequential, waterfall execution method), consider implementing a parallel or batch request strategy. This approach allows for the concurrent processing of multiple queries, thereby optimizing efficiency and response time. It's essential, however, to ensure proper error handling and response parsing for each query within the batch to maintain robustness and reliability in your application.
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
const currentUserResolver = resolver(
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
    require: [CurrentUserQuery],
    variables,
  };
});

const useCurrentUser = () => {
  const [currentUser] = useAdapter().use(CurrentUserQuery);
  return currentUser;
};
```
