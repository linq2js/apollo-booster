import { gql } from "@apollo/client";
import { MockedProviderProps } from "@apollo/client/testing";

export const COUNT_GQL = gql`
  query {
    count
  }
`;

export const DOUBLED_COUNT_GQL = gql`
  query {
    doubledCount
  }
`;

export const TODO_LIST_GQL = gql`
  query ($offset: Int) {
    todos(offset: $offset) @connection(key: "todoList") {
      id
    }
  }
`;

export const USER_WITH_FULL_NAME_GQL = gql`
  query UserQuery {
    user {
      id
      firstName
      lastName
      fullName @client
    }
  }
`;

export const USER_GQL = gql`
  query UserQuery {
    user {
      id
      firstName
      lastName
    }
  }
`;

export const GET_LAST_NAME_GQL = gql`
  query GetLastNameQuery {
    getLastName {
      id
      lastName
    }
  }
`;

const user = {
  id: 1,
  __typename: "User",
  firstName: "Ging",
  lastName: "Freecss",
};

const todos = [
  { __typename: "Todo", id: 1 },
  { __typename: "Todo", id: 2 },
  { __typename: "Todo", id: 3 },
  { __typename: "Todo", id: 4 },
  { __typename: "Todo", id: 5 },
  { __typename: "Todo", id: 6 },
];

export const mocks: MockedProviderProps["mocks"] = [
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
        todos: todos.slice(0, 3),
      },
    },
  },
  {
    request: { query: TODO_LIST_GQL, variables: { offset: 3 } },
    result: {
      data: {
        todos: todos.slice(3),
      },
    },
  },
  {
    request: { query: USER_WITH_FULL_NAME_GQL },
    result: {
      data: {
        user,
      },
    },
  },
  {
    request: { query: USER_GQL },
    result: {
      data: {
        user,
      },
    },
  },
  // normal fragment
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
        user,
      },
    },
  },
  {
    request: { query: GET_LAST_NAME_GQL, variables: { id: 1 } },
    result: {
      data: {
        getLastName: user,
      },
    },
  },
  {
    request: { query: GET_LAST_NAME_GQL, variables: { id: 1 } },
    result: {
      data: {
        getLastName: user,
      },
    },
  },
];
