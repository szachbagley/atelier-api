import { Router } from 'express';
import { authConfig } from '../config/auth.js';
import { db } from '../db/index.js';
import { ErrorCodes } from '../errors/codes.js';
import { NotFoundError, UnauthorizedError } from '../errors/index.js';
import { authenticate } from '../middleware/authenticate.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, registerSchema } from '../schemas/auth.js';
import { authService } from '../services/auth/authService.js';
import type { User } from '../types/models.js';

export const authRouter = Router();

const refreshCookieName = authConfig.refreshToken.cookie.name;
const refreshCookieOptions = authConfig.refreshToken.cookie;

authRouter.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  async (req, res) => {
    const { email, password } = req.body as { email: string; password: string };
    const result = await authService.register(email, password);

    res.cookie(refreshCookieName, result.refreshToken, refreshCookieOptions);
    res.status(201).json({
      user: result.user,
      accessToken: result.accessToken,
    });
  }
);

authRouter.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  async (req, res) => {
    const { email, password } = req.body as { email: string; password: string };
    const result = await authService.login(email, password);

    res.cookie(refreshCookieName, result.refreshToken, refreshCookieOptions);
    res.json({
      user: result.user,
      accessToken: result.accessToken,
    });
  }
);

authRouter.post('/refresh', async (req, res) => {
  const cookies = (req.cookies ?? {}) as Record<string, string | undefined>;
  const refreshToken = cookies[refreshCookieName];

  if (!refreshToken) {
    throw new UnauthorizedError(
      ErrorCodes.AUTH_TOKEN_MISSING,
      'Refresh token missing'
    );
  }

  const tokens = await authService.refresh(refreshToken);

  res.cookie(refreshCookieName, tokens.refreshToken, refreshCookieOptions);
  res.json({ accessToken: tokens.accessToken });
});

authRouter.post('/logout', authenticate, async (req, res) => {
  const cookies = (req.cookies ?? {}) as Record<string, string | undefined>;
  const refreshToken = cookies[refreshCookieName];

  if (refreshToken) {
    await authService.logout(refreshToken);
  }

  res.clearCookie(refreshCookieName, { path: refreshCookieOptions.path });
  res.status(204).send();
});

authRouter.get('/me', authenticate, async (req, res) => {
  // authenticate guarantees req.user is set.
  const authUser = req.user as { id: string; email: string };
  const user: User | undefined = await db<User>('users')
    .where({ id: authUser.id })
    .whereNull('deleted_at')
    .first();

  if (!user) {
    throw new NotFoundError('User', authUser.id);
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.created_at,
    },
  });
});
