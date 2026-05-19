import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../../core/database/prisma.service";
import { TenantProvisionerService } from "../../tenancy/tenant-provisioner.service";
import { SignupDto } from "./dto/signup.dto";
import { LoginDto } from "./dto/login.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly provisioner: TenantProvisionerService,
  ) {}

  async signup(dto: SignupDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) throw new ConflictException("Email already registered");

    const slug = await this.uniqueSlug(dto.companyName);
    const schema = this.provisioner.schemaNameFor(slug);
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // 1) Create tenant + user + membership in public schema.
    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: dto.companyName, slug, schema },
      });
      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          name: dto.name,
          passwordHash,
        },
      });
      await tx.tenantMember.create({
        data: { tenantId: tenant.id, userId: user.id, role: "owner" },
      });
      return { tenant, user };
    });

    // 2) Provision the dedicated Postgres schema for this tenant.
    await this.provisioner.provision(schema);

    return this.buildAuthResponse(result.user, result.tenant);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { memberships: { include: { tenant: true } } },
    });
    if (!user) throw new UnauthorizedException("Invalid credentials");

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Invalid credentials");

    const membership = user.memberships[0];
    if (!membership) throw new UnauthorizedException("No tenant for user");

    return this.buildAuthResponse(user, membership.tenant);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: { include: { tenant: true } } },
    });
    if (!user) throw new UnauthorizedException();
    const tenant = user.memberships[0]?.tenant;
    return {
      user: { id: user.id, email: user.email, name: user.name },
      tenant: tenant
        ? { id: tenant.id, name: tenant.name, slug: tenant.slug, schema: tenant.schema }
        : null,
    };
  }

  private buildAuthResponse(
    user: { id: string; email: string; name: string },
    tenant: { id: string; name: string; slug: string; schema: string },
  ) {
    const token = this.jwt.sign({
      sub: user.id,
      tenantId: tenant.id,
      schema: tenant.schema,
      email: user.email,
    });
    return {
      token,
      user: { id: user.id, email: user.email, name: user.name },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        schema: tenant.schema,
      },
    };
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "tenant";
    let candidate = base;
    let i = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const hit = await this.prisma.tenant.findUnique({ where: { slug: candidate } });
      if (!hit) return candidate;
      i += 1;
      candidate = `${base}-${i}`;
    }
  }
}
