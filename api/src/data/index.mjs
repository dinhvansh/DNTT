import { getConfig } from '../config.mjs';
import { createFixtureRepository } from './fixtureRepository.mjs';
import { createPostgresRepository } from './postgresRepository.mjs';

export function createRepository(config = getConfig()) {
  if (config.apiDataSource === 'postgres') {
    return createPostgresRepository({ databaseUrl: config.databaseUrl });
  }

  return createFixtureRepository();
}
