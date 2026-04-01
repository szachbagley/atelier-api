import { config } from './index.js';

export const authConfig = {
  accessToken: {
    secret: config.auth.accessTokenSecret,
    expiresIn: config.auth.accessTokenExpiry,
    algorithm: 'HS256' as const,
  },

  refreshToken: {
    secret: config.auth.refreshTokenSecret,
    expiresIn: config.auth.refreshTokenExpiry,
    algorithm: 'HS256' as const,
    cookie: {
      name: 'refresh_token',
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'strict' as const,
      path: '/api/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    },
  },

  password: {
    saltRounds: config.auth.bcryptRounds,
    minLength: 8,
    maxLength: 128,
  },
};
