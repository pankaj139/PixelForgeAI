"""
Comprehensive logging configuration with correlation IDs and structured logging
"""

import logging
import logging.config
import json
import time
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from contextvars import ContextVar
from fastapi import Request

# Context variable for correlation ID
correlation_id_var: ContextVar[Optional[str]] = ContextVar('correlation_id', default=None)

class CorrelationIdFilter(logging.Filter):
    """Add correlation ID to log records"""
    
    def filter(self, record):
        record.correlation_id = correlation_id_var.get() or 'no-correlation-id'
        return True

class JSONFormatter(logging.Formatter):
    """JSON formatter for structured logging"""
    
    def format(self, record):
        log_entry = {
            'timestamp': datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'correlation_id': getattr(record, 'correlation_id', 'no-correlation-id'),
            'service': 'python-image-processing-service',
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno
        }
        
        # Add exception info if present
        if record.exc_info:
            log_entry['exception'] = self.formatException(record.exc_info)
        
        # Add extra fields
        if hasattr(record, 'extra_fields'):
            log_entry.update(record.extra_fields)
            
        return json.dumps(log_entry)

def setup_logging(debug: bool = False, log_file: Optional[str] = None):
    """Setup comprehensive logging configuration"""
    
    level = logging.DEBUG if debug else logging.INFO
    
    # Base configuration
    config = {
        'version': 1,
        'disable_existing_loggers': False,
        'formatters': {
            'json': {
                '()': JSONFormatter,
            },
            'console': {
                'format': '[%(asctime)s] %(levelname)s [%(correlation_id)s] %(name)s: %(message)s',
                'datefmt': '%Y-%m-%d %H:%M:%S'
            }
        },
        'filters': {
            'correlation_id': {
                '()': CorrelationIdFilter,
            }
        },
        'handlers': {
            'console': {
                'class': 'logging.StreamHandler',
                'level': level,
                'formatter': 'console',
                'filters': ['correlation_id'],
                'stream': 'ext://sys.stdout'
            }
        },
        'loggers': {
            '': {  # Root logger
                'level': level,
                'handlers': ['console'],
                'propagate': False
            },
            'uvicorn': {
                'level': logging.INFO,
                'handlers': ['console'],
                'propagate': False
            },
            'uvicorn.access': {
                'level': logging.INFO,
                'handlers': ['console'],
                'propagate': False
            }
        }
    }
    
    # Add file handler if log file specified
    if log_file:
        config['handlers']['file'] = {
            'class': 'logging.handlers.RotatingFileHandler',
            'level': level,
            'formatter': 'json',
            'filters': ['correlation_id'],
            'filename': log_file,
            'maxBytes': 10485760,  # 10MB
            'backupCount': 5
        }
        
        # Add file handler to all loggers
        for logger_config in config['loggers'].values():
            logger_config['handlers'].append('file')
    
    logging.config.dictConfig(config)

def set_correlation_id(correlation_id: str):
    """Set correlation ID for current context"""
    correlation_id_var.set(correlation_id)

def get_correlation_id() -> Optional[str]:
    """Get correlation ID from current context"""
    return correlation_id_var.get()

def generate_correlation_id() -> str:
    """Generate a new correlation ID"""
    return str(uuid.uuid4())

def extract_correlation_id_from_request(request: Request) -> str:
    """Extract or generate correlation ID from request"""
    # Try to get from headers first
    correlation_id = request.headers.get('x-correlation-id')
    
    if not correlation_id:
        # Try to get from query parameters
        correlation_id = request.query_params.get('correlation_id')
    
    if not correlation_id:
        # Generate new one
        correlation_id = generate_correlation_id()
    
    return correlation_id

class LoggerAdapter:
    """Logger adapter with correlation ID and extra fields support"""
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
    
    def _log(self, level: int, msg: str, extra_fields: Optional[Dict[str, Any]] = None, *args, **kwargs):
        """Internal log method with extra fields support"""
        if extra_fields:
            # Create a new record with extra fields
            record = self.logger.makeRecord(
                self.logger.name, level, '', 0, msg, args, None
            )
            record.extra_fields = extra_fields
            self.logger.handle(record)
        else:
            self.logger.log(level, msg, *args, **kwargs)
    
    def debug(self, msg: str, extra_fields: Optional[Dict[str, Any]] = None, *args, **kwargs):
        self._log(logging.DEBUG, msg, extra_fields, *args, **kwargs)
    
    def info(self, msg: str, extra_fields: Optional[Dict[str, Any]] = None, *args, **kwargs):
        self._log(logging.INFO, msg, extra_fields, *args, **kwargs)
    
    def warning(self, msg: str, extra_fields: Optional[Dict[str, Any]] = None, *args, **kwargs):
        self._log(logging.WARNING, msg, extra_fields, *args, **kwargs)
    
    def error(self, msg: str, extra_fields: Optional[Dict[str, Any]] = None, *args, **kwargs):
        self._log(logging.ERROR, msg, extra_fields, *args, **kwargs)
    
    def critical(self, msg: str, extra_fields: Optional[Dict[str, Any]] = None, *args, **kwargs):
        self._log(logging.CRITICAL, msg, extra_fields, *args, **kwargs)

def get_logger(name: str) -> LoggerAdapter:
    """Get logger adapter with correlation ID support"""
    return LoggerAdapter(logging.getLogger(name))