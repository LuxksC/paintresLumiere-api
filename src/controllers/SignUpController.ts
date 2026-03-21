import { hash } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { usersTable } from '../db/schema';
import type { HttpRequest, HttpResponse } from '../types/Http';
import { signAccessToken } from '../libs/jwt';
import { badRequest, created } from '../utils/http';
import { isNonEmptyString } from '../utils/string';
import { conflictIfUserPropertyExists } from '../utils/userConflict';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  lastname: z.string().max(255).optional(),
  type: z.enum(['admin', 'client']).default('client'),
  phone: z.string().max(20).optional(),
  cpf: z.string().max(14).optional(),
  cnpj: z.string().max(14).optional(),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export class SignUpController {
  static async handle({ body }: HttpRequest): Promise<HttpResponse> {
    const { success, error, data } = schema.safeParse(body);

    if (!success) {
      return badRequest({ errors: error.flatten().fieldErrors });
    }

    const { name, lastname, type, phone, cpf, cnpj, email, password } = data;

    // Check if email is already registered
    const emailTakenError = await conflictIfUserPropertyExists(
      eq(usersTable.email, email),
      'Email already registered.'
    );
    if (emailTakenError) return emailTakenError;

    // Check if CPF is already registered
    if (isNonEmptyString(cpf)) {
      const cpfTakenError = await conflictIfUserPropertyExists(
        eq(usersTable.cpf, cpf),
        'CPF already registered.'
      );
      if (cpfTakenError) return cpfTakenError;
    }

    // Check if CNPJ is already registered
    if (isNonEmptyString(cnpj)) {
      const cnpjTakenError = await conflictIfUserPropertyExists(
        eq(usersTable.cnpj, cnpj),
        'CNPJ already registered.'
      );
      if (cnpjTakenError) return cnpjTakenError;
    }

    const hashedPassword = await hash(password, 10);

    const [user] = await db
      .insert(usersTable)
      .values({
        name,
        type,
        email,
        password: hashedPassword,
        ...(isNonEmptyString(lastname) ? { lastname } : {}),
        ...(isNonEmptyString(phone) ? { phone } : {}),
        ...(isNonEmptyString(cpf) ? { cpf } : {}),
        ...(isNonEmptyString(cnpj) ? { cnpj } : {}),
      })
      .returning({ id: usersTable.id });

    if (!user) {
      return badRequest({ error: 'Failed to create user.' });
    }

    const accessToken = signAccessToken(user.id);

    return created({ accessToken });
  }
}
