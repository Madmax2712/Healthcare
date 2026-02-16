import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import { AdminRole } from '../../../shared/types';
import logger from '../utils/logger';

export interface AuthenticatedUser {
  userId: string;
  type: 'user' | 'admin';
  hospitalId?: string;
  role?: AdminRole;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * JWT authentication middleware.
 * Extracts and verifies the Bearer token from the Authorization header.
 */
export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Authentication required. Provide a valid Bearer token.',
    });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as {
      userId: string;
      type: 'user' | 'admin';
      hospitalId?: string;
      role?: AdminRole;
      iat: number;
      exp: number;
    };

    req.user = {
      userId: decoded.userId,
      type: decoded.type,
      hospitalId: decoded.hospitalId,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: 'Token has expired. Please refresh your token.',
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: 'Invalid token.',
      });
      return;
    }

    logger.error('Authentication error', { error });
    res.status(500).json({
      success: false,
      error: 'Internal authentication error.',
    });
  }
}

/**
 * Middleware that requires the authenticated user to be a hospital admin.
 * Must be used after authenticate().
 */
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required.',
    });
    return;
  }

  if (req.user.type !== 'admin') {
    res.status(403).json({
      success: false,
      error: 'Admin access required.',
    });
    return;
  }

  next();
}

/**
 * Middleware that requires a specific admin role or higher.
 * Role hierarchy: super_admin > admin > staff
 */
export function requireRole(...allowedRoles: AdminRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required.',
      });
      return;
    }

    if (req.user.type !== 'admin' || !req.user.role) {
      res.status(403).json({
        success: false,
        error: 'Admin access required.',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: `Insufficient permissions. Required role: ${allowedRoles.join(' or ')}.`,
      });
      return;
    }

    next();
  };
}

/**
 * Middleware that checks if the requesting user owns the resource
 * or is an admin. The userId param name can be configured.
 */
export function requireOwnerOrAdmin(userIdParam: string = 'userId') {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required.',
      });
      return;
    }

    const resourceUserId = req.params[userIdParam];

    if (req.user.type === 'admin') {
      next();
      return;
    }

    if (req.user.userId === resourceUserId) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      error: 'Access denied. You can only access your own resources.',
    });
  };
}

/**
 * Optional authentication - attaches user if token present but does not reject.
 */
export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as {
      userId: string;
      type: 'user' | 'admin';
      hospitalId?: string;
      role?: AdminRole;
    };

    req.user = {
      userId: decoded.userId,
      type: decoded.type,
      hospitalId: decoded.hospitalId,
      role: decoded.role,
    };
  } catch {
    // Token invalid - continue without auth
  }

  next();
}
