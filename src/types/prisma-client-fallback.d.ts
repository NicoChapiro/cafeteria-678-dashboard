declare module '@prisma/client' {
  export class PrismaClient {
    [key: string]: unknown;
    constructor(options?: Record<string, unknown>);
    $disconnect(): Promise<void>;
  }
}
