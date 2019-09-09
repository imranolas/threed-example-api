const { ApolloServer } = require('apollo-server-express');
const express = require('express');

const database = require('./database');
const schema = require('./schema');
const crypt = require('./crypt');
const auth = require('./auth');

const DEV = process.env.NODE_ENV !== 'development';
const PORT = process.env.PORT || 3000;

const server = new ApolloServer({
  typeDefs: schema.typeDefs,
  resolvers: schema.resolvers,
  tracing: DEV,
  introspection: DEV,
  playground: DEV,
  context: ({ req }) => ({
    db: database,
    user: req.user || null,
    jwt: auth,
    crypt
  })
});

const app = express();

app.use('*', auth.middleware);

server.applyMiddleware({ app });

app.listen({ port: PORT }, () => {
  console.log(`🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`);
});
