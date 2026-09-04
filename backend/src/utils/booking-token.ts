import jwt from 'jsonwebtoken';
import { env } from '../config/env';

const BOOKING_TOKEN_TTL_SECONDS = 48 * 60 * 60; // 48 hours

export interface BookingTokenPayload {
  leadId: string;
  contractorId: string;
}

/**
 * Generate a signed JWT booking token for the public booking page.
 * Token is valid for 48 hours.
 */
export function generateBookingToken(leadId: string, contractorId: string): string {
  return jwt.sign(
    { leadId, contractorId },
    env.bookingTokenSecret,
    { expiresIn: BOOKING_TOKEN_TTL_SECONDS }
  );
}

/**
 * Verify and decode a booking token.
 * Throws if the token is invalid or expired.
 */
export function verifyBookingToken(token: string): BookingTokenPayload {
  const payload = jwt.verify(token, env.bookingTokenSecret) as BookingTokenPayload & jwt.JwtPayload;
  if (!payload.leadId || !payload.contractorId) {
    throw new Error('Invalid booking token payload');
  }
  return { leadId: payload.leadId, contractorId: payload.contractorId };
}
