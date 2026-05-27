import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt, { type SignOptions, type JwtPayload } from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { authConfig } from '../../config/auth.js';
import { db } from '../../db/index.js';
import { ConflictError, UnauthorizedError } from '../../errors/index.js';
import { ErrorCodes } from '../../errors/codes.js';
import type { RefreshToken, User } from '../../types/models.js';

// Precomputed dummy hash so login() runs bcrypt.compare even when the user
// does not exist, keeping response timing constant against email enumeration.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  'enumeration-guard',
  authConfig.password.saltRounds
);

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface TokenPair {
  user: { id: string; email: string };
  accessToken: string;
  refreshToken: string;
  refreshTokenId: string;
}

interface AccessTokenPayload extends JwtPayload {
  sub: string;
  email: string;
  type: 'access';
}

interface RefreshTokenPayload extends JwtPayload {
  sub: string;
  jti: string;
  type: 'refresh';
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function generateTokenPair(
  userId: string,
  email: string
): Promise<TokenPair> {
  const accessToken = jwt.sign(
    { sub: userId, email, type: 'access' },
    authConfig.accessToken.secret,
    {
      expiresIn: authConfig.accessToken
        .expiresIn as SignOptions['expiresIn'],
      algorithm: authConfig.accessToken.algorithm,
    }
  );

  const refreshTokenId = uuid();
  const refreshToken = jwt.sign(
    { sub: userId, jti: refreshTokenId, type: 'refresh' },
    authConfig.refreshToken.secret,
    {
      expiresIn: authConfig.refreshToken
        .expiresIn as SignOptions['expiresIn'],
      algorithm: authConfig.refreshToken.algorithm,
    }
  );

  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await db('refresh_tokens').insert({
    id: refreshTokenId,
    user_id: userId,
    token_hash: hashToken(refreshToken),
    expires_at: expiresAt,
  });

  return {
    user: { id: userId, email },
    accessToken,
    refreshToken,
    refreshTokenId,
  };
}

async function register(email: string, password: string): Promise<TokenPair> {
  const existing = await db<User>('users')
    .where({ email })
    .whereNull('deleted_at')
    .first();

  if (existing) {
    throw new ConflictError(
      ErrorCodes.AUTH_EMAIL_IN_USE,
      'Email already registered'
    );
  }

  const passwordHash = await bcrypt.hash(
    password,
    authConfig.password.saltRounds
  );

  const userId = uuid();
  await db('users').insert({
    id: userId,
    email,
    password_hash: passwordHash,
  });

  return generateTokenPair(userId, email);
}

async function login(email: string, password: string): Promise<TokenPair> {
  const user = await db<User>('users')
    .where({ email })
    .whereNull('deleted_at')
    .first();

  // Always run bcrypt.compare to keep timing constant whether the email
  // is known or not (prevents user enumeration via response time).
  const hash = user ? user.password_hash : DUMMY_PASSWORD_HASH;
  const validPassword = await bcrypt.compare(password, hash);

  if (!user || !validPassword) {
    throw new UnauthorizedError(
      ErrorCodes.AUTH_INVALID_CREDENTIALS,
      'Invalid email or password'
    );
  }

  return generateTokenPair(user.id, user.email);
}

async function revokeTokenFamily(tokenId: string): Promise<void> {
  let currentId: string | null = tokenId;
  while (currentId) {
    const token: RefreshToken | undefined = await db<RefreshToken>(
      'refresh_tokens'
    )
      .where({ id: currentId })
      .first();
    if (!token) break;

    await db('refresh_tokens')
      .where({ id: currentId })
      .update({ revoked_at: db.fn.now() });

    currentId = token.replaced_by_id;
  }
}

async function refresh(refreshToken: string): Promise<TokenPair> {
  let payload: RefreshTokenPayload;
  try {
    payload = jwt.verify(
      refreshToken,
      authConfig.refreshToken.secret
    ) as RefreshTokenPayload;
  } catch {
    throw new UnauthorizedError(ErrorCodes.AUTH_TOKEN_INVALID, 'Invalid refresh token');
  }

  const tokenHash = hashToken(refreshToken);
  const storedToken = await db<RefreshToken>('refresh_tokens')
    .where({ token_hash: tokenHash })
    .first();

  if (!storedToken) {
    throw new UnauthorizedError(ErrorCodes.AUTH_TOKEN_INVALID, 'Invalid refresh token');
  }

  if (storedToken.revoked_at) {
    throw new UnauthorizedError(ErrorCodes.AUTH_TOKEN_INVALID, 'Refresh token revoked');
  }

  // Token was already rotated — treat as replay attack and revoke the family.
  if (storedToken.replaced_by_id) {
    await revokeTokenFamily(storedToken.id);
    throw new UnauthorizedError(ErrorCodes.AUTH_TOKEN_INVALID, 'Refresh token reuse detected');
  }

  const user = await db<User>('users')
    .where({ id: payload.sub })
    .whereNull('deleted_at')
    .first();

  if (!user) {
    throw new UnauthorizedError(ErrorCodes.AUTH_TOKEN_INVALID, 'User no longer exists');
  }

  const newTokens = await generateTokenPair(user.id, user.email);

  await db('refresh_tokens')
    .where({ id: storedToken.id })
    .update({ replaced_by_id: newTokens.refreshTokenId });

  return newTokens;
}

async function logout(refreshToken: string): Promise<void> {
  const tokenHash = hashToken(refreshToken);
  await db('refresh_tokens')
    .where({ token_hash: tokenHash })
    .whereNull('revoked_at')
    .update({ revoked_at: db.fn.now() });
}

function verifyAccessToken(token: string): { id: string; email: string } {
  try {
    const payload = jwt.verify(
      token,
      authConfig.accessToken.secret
    ) as AccessTokenPayload;
    return { id: payload.sub, email: payload.email };
  } catch (err) {
    if (err instanceof Error && err.name === 'TokenExpiredError') {
      throw new UnauthorizedError(ErrorCodes.AUTH_TOKEN_EXPIRED, 'Access token expired');
    }
    throw new UnauthorizedError(ErrorCodes.AUTH_TOKEN_INVALID, 'Invalid access token');
  }
}

export const authService = {
  register,
  login,
  refresh,
  logout,
  verifyAccessToken,
  generateTokenPair,
  revokeTokenFamily,
  hashToken,
};
