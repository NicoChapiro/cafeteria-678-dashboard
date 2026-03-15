/* eslint-disable @typescript-eslint/no-explicit-any */
declare module '@prisma/client' {
  export class PrismaClient {
    [key: string]: any;
    constructor(options?: Record<string, any>);
    $disconnect(): Promise<void>;
  }
}
