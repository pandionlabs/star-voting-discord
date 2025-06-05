import { sequelize, Poll, Option, Vote } from '../src/models';

beforeAll(async () => {
  // Use in-memory SQLite for testing
  process.env.NODE_ENV = 'test';
  
  // Logging is already disabled in models for test environment
  
  // Sync database before tests
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  // Close database connection after tests
  await sequelize.close();
});

beforeEach(async () => {
  // Clear all tables before each test by deleting all records
  await Vote.destroy({ where: {}, force: true });
  await Option.destroy({ where: {}, force: true });
  await Poll.destroy({ where: {}, force: true });
});