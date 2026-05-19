import { Injectable, NestMiddleware } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { NextFunction, Request, Response } from "express";
import { TenantContextService } from "./tenant-context.service";

interface JwtPayload {
  sub: string;
  tenantId: string;
  schema: string;
}

/**
 * Resolves tenant + user from the Authorization header (Bearer JWT) and
 * binds them into AsyncLocalStorage so downstream services (Prisma, AI tools,
 * domain code) can pick them up without prop drilling.
 *
 * Unauthenticated routes (auth/signup, auth/login, health) simply continue
 * without a context.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly jwt: JwtService,
  ) {}

  use(req: Request, _res: Response, next: NextFunction) {
    const auth = req.headers["authorization"];
    if (!auth || !auth.startsWith("Bearer ")) return next();

    const token = auth.slice("Bearer ".length);
    try {
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });
      this.tenantContext.run(
        {
          userId: payload.sub,
          tenantId: payload.tenantId,
          schema: payload.schema,
        },
        () => next(),
      );
    } catch {
      return next();
    }
  }
}
