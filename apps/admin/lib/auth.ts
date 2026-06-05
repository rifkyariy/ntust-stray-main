'use server';
import { cookies } from 'next/headers';

const COOKIE = 'stray_admin_token';
const MAX_AGE = 60 * 60 * 24; // 24 h

export async function setAuthCookie(token: string) {
  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  });
}

export async function clearAuthCookie() {
  cookies().delete(COOKIE);
}

export async function getAuthToken(): Promise<string | undefined> {
  return cookies().get(COOKIE)?.value;
}
