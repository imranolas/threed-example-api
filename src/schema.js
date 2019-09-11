const cuid = require('cuid');
const { GraphQLError } = require('graphql');
const { gql } = require('apollo-server-express');
const { GraphQLDateTime } = require('graphql-iso-date');

const typeDefs = gql`
  scalar DateTime

  enum SortBy {
    LATEST
    OLDEST
  }

  type User {
    id: ID!
    username: String!
    avatar: String
    createdAt: DateTime
  }

  type Reply {
    id: ID!
    text: String!
    thread: Thread!
    createdBy: User!
    createdAt: DateTime!
    likesNumber: Int!
    likes(skip: Int, limit: Int): [Like!]!
  }

  type Thread {
    id: ID!
    title: String!
    text: String
    createdBy: User!
    createdAt: DateTime!
    likesNumber: Int!
    likes(skip: Int, limit: Int): [Like!]!
    repliesNumber: Int!
    replies(skip: Int, limit: Int): [Reply!]!
  }

  type Like {
    id: ID!
    createdBy: User!
    createdAt: DateTime!
  }

  type Query {
    threads(sortBy: SortBy!, skip: Int, limit: Int): [Thread!]!
    thread(id: ID!): Thread
    me: User
  }

  input ThreadInput {
    title: String!
    text: String
  }

  input ReplyInput {
    threadId: ID!
    text: String!
  }

  type SigninResult {
    user: User!
    token: String!
  }

  type Mutation {
    createThread(input: ThreadInput!): Thread!
    reply(input: ReplyInput!): Thread!
    likeThread(threadId: ID!): Thread!
    likeReply(replyId: ID!): Reply!
    signup(username: String!, password: String!): SigninResult!
    signin(username: String!, password: String!): SigninResult!
  }
`;

const resolvers = {
  DateTime: GraphQLDateTime,

  Query: {
    threads: async (_, { sortBy, skip = 0, limit = 10 }, ctx) => {
      const threads = ctx.db
        .select()
        .from("threads")
        .limit(limit)
        .offset(skip)
        .orderBy(sortBy);

      switch (sortBy) {
        case 'LATEST':
          return await threads.orderBy('created_at', 'desc');
        case 'OLDEST':
          return await threads.orderBy('created_at', 'asc');
        default:
          return await threads;
      }
    },
    thread: async (_, { id }, ctx) => {
      return await ctx.db
        .first()
        .from("threads")
        .where({ id });
    },
    me: async (_, __, ctx) => {
      if (!ctx.user) {
        return null;
      }

      return await ctx.db
        .first()
        .from('users')
        .where({ id: ctx.user.id });
    }
  },

  User: {
    createdAt: parent => parent.created_at
  },

  Thread: {
    createdAt: parent => parent.created_at,
    createdBy: async (parent, _, ctx) => {
      return await ctx.db
        .first()
        .from('users')
        .where({ id: parent.created_by });
    },
    likesNumber: async (parent, _, ctx) => {
      return await ctx.db
        .count('id')
        .from('likes')
        .where({ thread_id: parent.id });
    },
    likes: async (parent, { skip = 0, limit = 10 }, ctx) => {
      return await ctx.db
        .select()
        .from('likes')
        .orderBy('created_at', 'desc')
        .where({ thread_id: parent.id })
        .limit(limit)
        .offset(skip);
    },
    repliesNumber: async (parent, _, ctx) => {
      return await ctx.db
        .count('id')
        .from('replies')
        .where({ thread_id: parent.id });
    },
    replies: async (parent, { skip = 0, limit = 10 }, ctx) => {
      return await ctx.db
        .select()
        .from('replies')
        .orderBy('created_at', 'desc')
        .where({ thread_id: parent.id })
        .limit(limit)
        .offset(skip);
    }
  },

  Like: {
    createdAt: parent => parent.created_at,
    createdBy: async (parent, _, ctx) => {
      return await ctx.db
        .first()
        .from('users')
        .where({ id: parent.created_by });
    }
  },

  Reply: {
    createdAt: parent => parent.created_at,
    createdBy: async (parent, _, ctx) => {
      return await ctx.db
        .first()
        .from('users')
        .where({ id: parent.created_by });
    },
    likesNumber: async (parent, _, ctx) => {
      return await ctx.db
        .count('id')
        .from('likes')
        .where({ reply_id: parent.id });
    },
    likes: async (parent, { skip = 0, limit = 10 }, ctx) => {
      return await ctx.db
        .select()
        .from("likes")
        .orderBy('created_at', 'desc')
        .where({ reply_id: parent.id })
        .limit(limit)
        .offset(skip);
    }
  },

  Mutation: {
    createThread: async (_, { input }, ctx) => {
      if (!ctx.user) {
        throw new GraphQLError("Not Authenticated");
      }

      const thread = {
        id: cuid(),
        title: input.title,
        text: input.text || null,
        created_by: ctx.user.id
      };

      const [res] = await ctx.db
        .insert(thread)
        .into('threads')
        .returning(['id', 'title', 'text', 'created_by', 'created_at']);

      return res;
    },
    reply: async (_, { input }, ctx) => {
      if (!ctx.user) {
        throw new GraphQLError("Not Authenticated");
      }

      const reply = {
        id: cuid(),
        thread_id: input.threadId,
        text: input.text || null,
        created_by: ctx.user.id
      };

      const [res] = await ctx.db
        .insert(reply)
        .into('replies')
        .returning(['id', 'thread_id', 'text', 'created_by', 'created_at']);

      return res;
    },
    likeThread: async (_, { threadId }, ctx) => {
      if (!ctx.user) {
        throw new GraphQLError("Not Authenticated");
      }

      const like = {
        id: cuid(),
        thread_id: threadId,
        reply_id: null,
        created_by: ctx.user.id
      };

      await ctx.db.insert(like).into('likes');
      return await ctx.db.first().from('threads').where({ id: threadId });
    },
    likeReply: async (_, { replyId }, ctx) => {
      if (!ctx.user) {
        throw new GraphQLError("Not Authenticated");
      }

      const reply = {
        id: cuid(),
        reply_id: replyId,
        thread_id: null,
        created_by: ctx.user.id
      };

      await ctx.db.insert(like).into('likes');
      return await ctx.db.first().from('replies').where({ id: replyId });
    },
    signup: async (_, { username, password }, ctx) => {
      const userEntry = await ctx.db
        .first()
        .from('users')
        .where({ username })
        .first();

      if (userEntry) {
        throw new GraphQLError("A user with this username already exists!");
      }

      const userInput = {
        id: cuid(),
        username,
        hash: ctx.crypt.hash(password)
      };

      const [user] = await ctx.db
        .insert(userInput)
        .into("users")
        .returning(["id", "username", "hash", "avatar", "created_at"]);

      if (user) {
        return { user, token: ctx.jwt.create(user) };
      } else {
        throw new GraphQLError("Unable to sign up!");
      }
    },
    signin: async (_, { username, password }, ctx) => {
      const user = await ctx.db
        .select()
        .from("users")
        .where({ username })
        .first();

      if (user) {
        return { user, token: ctx.jwt.create(user) };
      } else {
        throw new GraphQLError("A user with this username already exists!");
      }
    }
  }
};

module.exports = { typeDefs, resolvers };
