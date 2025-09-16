/**
 * Comprehensive logging utility with correlation ID support
 */

import { AsyncLocalStorage } from 'async_hooks';

// Context storage for correlation IDs
const correlationIdStorage = new AsyncLocalStorage<string>();

export interface LogContext {
  correlationId?: string;
  service?: string;
  operation?: string;
  userId?: string;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  correlationId?: string;
  service: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private service: string;

  constructor(service: string = 'nodejs-backend') {
    this.service = service;
  }

  private formatLogEntry(
    level: string,
    message: string,
    context?: LogContext,
    error?: Error
  ): LogEntry {
    const correlationId = context?.correlationId || 
                         correlationIdStorage.getStore() || 
                         'no-correlation-id';

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      correlationId,
      service: this.service,
    };

    if (context) {
      logEntry.context = { ...context };
      delete logEntry.context.correlationId; // Avoid duplication
    }

    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }

    return logEntry;
  }

  private log(level: string, message: string, context?: LogContext, error?: Error): void {
    const logEntry = this.formatLogEntry(level, message, context, error);
    
    // In production, you might want to use a proper logging library like Winston
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(logEntry));
    } else {
      // Pretty print for development
      const timestamp = new Date().toISOString();
      const correlationId = logEntry.correlationId;
      console.log(`[${timestamp}] ${level.toUpperCase()} [${correlationId}] ${this.service}: ${message}`);
      
      if (error) {
        console.error('  Error:', error);
      }
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext, error?: Error): void {
    this.log('warn', message, context, error);
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.log('error', message, context, error);
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): Logger {
    const childLogger = new Logger(this.service);
    
    // Override log method to include additional context
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = (level: string, message: string, context?: LogContext, error?: Error) => {
      const mergedContext = { ...additionalContext, ...context };
      originalLog(level, message, mergedContext, error);
    };
    
    return childLogger;
  }
}

/**
 * Set correlation ID for current async context
 */
export function setCorrelationId(correlationId: string): void {
  correlationIdStorage.enterWith(correlationId);
}

/**
 * Get correlation ID from current async context
 */
export function getCorrelationId(): string | undefined {
  return correlationIdStorage.getStore();
}

/**
 * Generate a new correlation ID
 */
export function generateCorrelationId(): string {
  return `nodejs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Run function with correlation ID context
 */
export function runWithCorrelationId<T>(correlationId: string, fn: () => T): T {
  return correlationIdStorage.run(correlationId, fn);
}

/**
 * Express middleware for correlation ID handling
 */
export function correlationIdMiddleware() {
  return (req: any, res: any, next: any) => {
    // Extract correlation ID from headers or generate new one
    let correlationId = req.headers['x-correlation-id'] as string;
    
    if (!correlationId) {
      correlationId = generateCorrelationId();
    }
    
    // Set correlation ID in response headers
    res.setHeader('x-correlation-id', correlationId);
    
    // Store correlation ID in request for later use
    req.correlationId = correlationId;
    
    // Run the rest of the request in correlation ID context
    correlationIdStorage.run(correlationId, () => {
      next();
    });
  };
}



// Create default logger instance
export const logger = new Logger();

// Create service-specific loggers
export const createLogger = (service: string) => new Logger(service);

export default logger;