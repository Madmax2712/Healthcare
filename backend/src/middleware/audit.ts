import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import logger from '../utils/logger';
import db from '../config/database';

interface AuditLogEntry {
  audit_id?: string;
  user_id: string | null;
  user_type: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  ip_address: string;
  user_agent: string;
  request_method: string;
  request_path: string;
  request_body_summary: string | null;
  response_status: number | null;
  timestamp: string;
}

/**
 * Maps HTTP methods and path patterns to human-readable action descriptions
 * for HIPAA audit logging.
 */
function deriveAction(method: string, path: string): string {
  const normalizedPath = path.replace(/\/[a-f0-9-]{36}/g, '/:id');

  const actionMap: Record<string, Record<string, string>> = {
    GET: {
      '/api/v1/health/metrics/:id': 'VIEW_HEALTH_METRICS',
      '/api/v1/health/alerts/:id': 'VIEW_HEALTH_ALERTS',
      '/api/v1/visits/history': 'VIEW_VISIT_HISTORY',
      '/api/v1/visits/:id': 'VIEW_VISIT_DETAILS',
      '/api/v1/ai/conversations': 'VIEW_AI_CONVERSATIONS',
      '/api/v1/emergency/alerts': 'VIEW_EMERGENCY_ALERTS',
      '/api/v1/hospitals/search': 'SEARCH_HOSPITALS',
      '/api/v1/hospitals/:id': 'VIEW_HOSPITAL',
      '/api/v1/hospitals/:id/specialists': 'VIEW_SPECIALISTS',
    },
    POST: {
      '/api/v1/health/metrics': 'SUBMIT_HEALTH_METRIC',
      '/api/v1/visits': 'CREATE_VISIT',
      '/api/v1/visits/:id/feedback': 'SUBMIT_FEEDBACK',
      '/api/v1/ai/conversation': 'START_AI_CONVERSATION',
      '/api/v1/ai/conversation/:id/message': 'SEND_AI_MESSAGE',
      '/api/v1/ai/emergency-guidance': 'REQUEST_EMERGENCY_GUIDANCE',
      '/api/v1/emergency/alert': 'CREATE_EMERGENCY_ALERT',
      '/api/v1/emergency/call-911': 'CALL_911_ATTEMPT',
      '/api/v1/auth/register': 'USER_REGISTRATION',
      '/api/v1/auth/login': 'USER_LOGIN',
      '/api/v1/auth/admin/login': 'ADMIN_LOGIN',
    },
    PUT: {
      '/api/v1/visits/:id': 'UPDATE_VISIT',
      '/api/v1/emergency/alert/:id/status': 'UPDATE_ALERT_STATUS',
      '/api/v1/hospitals/:id': 'UPDATE_HOSPITAL',
      '/api/v1/specialists/:id/status': 'UPDATE_SPECIALIST_STATUS',
    },
  };

  return actionMap[method]?.[normalizedPath] || `${method}_${normalizedPath}`;
}

/**
 * Derives the resource type from the request path.
 */
function deriveResourceType(path: string): string {
  const segments = path.split('/').filter(Boolean);
  // Look for the primary resource segment after 'api/v1'
  if (segments.length >= 3) {
    return segments[2].toUpperCase();
  }
  return 'UNKNOWN';
}

/**
 * Extracts a resource ID from the request params, if present.
 */
function extractResourceId(params: Record<string, string>): string | null {
  return params.id || params.userId || params.alertId || null;
}

/**
 * Redacts sensitive fields from the request body for audit storage.
 */
function sanitizeBody(body: Record<string, unknown>): string | null {
  if (!body || Object.keys(body).length === 0) {
    return null;
  }

  const sensitiveFields = [
    'password', 'otp', 'token', 'refresh_token',
    'secret', 'api_key', 'ssn', 'social_security',
  ];

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (sensitiveFields.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }

  const json = JSON.stringify(sanitized);
  // Truncate to prevent excessively large audit entries
  return json.length > 2000 ? json.substring(0, 2000) + '...[TRUNCATED]' : json;
}

/**
 * HIPAA-compliant audit logging middleware.
 * Logs all data access and modifications with user identity,
 * action performed, resource accessed, and timestamp.
 */
export function auditLog(req: AuthRequest, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Capture the original end method to intercept the response
  const originalEnd = res.end;

  res.end = function (this: Response, ...args: Parameters<typeof originalEnd>): ReturnType<typeof originalEnd> {
    const entry: AuditLogEntry = {
      user_id: req.user?.userId || null,
      user_type: req.user?.type || 'anonymous',
      action: deriveAction(req.method, req.path),
      resource_type: deriveResourceType(req.path),
      resource_id: extractResourceId(req.params),
      ip_address: (req.ip || req.socket.remoteAddress || 'unknown'),
      user_agent: req.headers['user-agent'] || 'unknown',
      request_method: req.method,
      request_path: req.path,
      request_body_summary: sanitizeBody(req.body as Record<string, unknown>),
      response_status: res.statusCode,
      timestamp: new Date().toISOString(),
    };

    // Persist the audit log asynchronously - do not block the response
    persistAuditLog(entry).catch((err) => {
      logger.error('Failed to persist audit log entry', { error: err, entry });
    });

    const duration = Date.now() - startTime;
    logger.info('Audit', {
      action: entry.action,
      userId: entry.user_id,
      resourceType: entry.resource_type,
      resourceId: entry.resource_id,
      status: res.statusCode,
      durationMs: duration,
    });

    return originalEnd.apply(this, args);
  };

  next();
}

/**
 * Persists an audit log entry to the database.
 */
async function persistAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await db('audit_logs').insert({
      user_id: entry.user_id,
      user_type: entry.user_type,
      action: entry.action,
      resource_type: entry.resource_type,
      resource_id: entry.resource_id,
      ip_address: entry.ip_address,
      user_agent: entry.user_agent,
      request_method: entry.request_method,
      request_path: entry.request_path,
      request_body_summary: entry.request_body_summary,
      response_status: entry.response_status,
      created_at: entry.timestamp,
    });
  } catch (error) {
    // Log to file as fallback if DB write fails
    logger.error('Audit DB write failed, logging to file', { entry, error });
  }
}

/**
 * Middleware for sensitive operations that require explicit audit notation.
 * Adds an audit reason header requirement.
 */
export function requireAuditReason(req: AuthRequest, res: Response, next: NextFunction): void {
  const reason = req.headers['x-audit-reason'] as string | undefined;

  if (!reason || reason.trim().length < 5) {
    res.status(400).json({
      success: false,
      error: 'An audit reason (X-Audit-Reason header, min 5 chars) is required for this operation.',
    });
    return;
  }

  next();
}
