const { JWT_SECRET = 'threed-secret-123' } = process.env;
const POSTGRES_CONNECTION = process.env.DATABASE_URL || 'postgres://threed:Formidable@127.0.0.1/threed';

module.exports = {
  POSTGRES_CONNECTION,
  JWT_SECRET
};
