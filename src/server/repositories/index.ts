import type { DataBackend, RepositoryBundle } from './contracts';
import { prismaRepositories } from './db/prisma/prismaRepositories';
import { localRepositories } from './local/localRepositories';

const DEFAULT_BACKEND: DataBackend = 'local';

export function getDataBackend(): DataBackend {
  const backend = process.env.DATA_BACKEND;
  if (backend === 'db') {
    return 'db';
  }

  return DEFAULT_BACKEND;
}

export function getRepositories(): RepositoryBundle {
  const backend = getDataBackend();
  return backend === 'db' ? prismaRepositories : localRepositories;
}
