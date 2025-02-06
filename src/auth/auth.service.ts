import { Injectable, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        profile: { select: { id: true, role: true, username: true } },
      },
    });

    if (!user) {
      throw new BadRequestException('Email ou senha inválidos');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new BadRequestException('Email ou senha inválidos');
    }

    // Update lastSignInAt in profile
    await this.prisma.profiles.update({
      where: { id: user.profile.id },
      data: { lastSignInAt: new Date() },
    });

    const payload = {
      email: user.email,
      sub: user.id,
      role: user.profile.role,
    };

    const token = this.jwtService.sign(payload);

    return {
      id: user.id,
      email: user.email,
      token,
      profileId: user.profile.id,
      role: user.profile.role || 'user',
      userName: user.profile.username || 'user',
    };
  }
}
