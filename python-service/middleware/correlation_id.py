"""
Correlation ID middleware for request tracking
"""

import time
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from utils.logging_config import (
    set_correlation_id, 
    extract_correlation_id_from_request,
    get_logger
)
from utils.error_handling import log_request_start, log_request_end
from utils.health_monitor import get_health_monitor

logger = get_logger(__name__)

class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """Middleware to handle correlation IDs and request logging"""
    
    async def dispatch(self, request: Request, call_next):
        # Extract or generate correlation ID
        correlation_id = extract_correlation_id_from_request(request)
        
        # Set correlation ID in context
        set_correlation_id(correlation_id)
        
        # Get health monitor
        health_monitor = get_health_monitor()
        
        # Log request start
        start_time = time.time()
        endpoint = f"{request.method} {request.url.path}"
        
        log_request_start(
            endpoint=endpoint,
            correlation_id=correlation_id,
            client_ip=request.client.host if request.client else "unknown",
            user_agent=request.headers.get("user-agent", "unknown")
        )
        
        try:
            # Process request
            response = await call_next(request)
            
            # Calculate duration
            duration_ms = (time.time() - start_time) * 1000
            
            # Add correlation ID to response headers
            response.headers["x-correlation-id"] = correlation_id
            
            # Log request completion
            log_request_end(
                endpoint=endpoint,
                correlation_id=correlation_id,
                duration_ms=duration_ms,
                status_code=response.status_code
            )
            
            # Record successful request
            health_monitor.record_request(success=True)
            
            return response
            
        except Exception as e:
            # Calculate duration
            duration_ms = (time.time() - start_time) * 1000
            
            # Log error
            logger.error(
                f"Request failed: {endpoint}",
                extra_fields={
                    "correlation_id": correlation_id,
                    "duration_ms": duration_ms,
                    "error": str(e)
                }
            )
            
            # Record failed request
            health_monitor.record_request(success=False, error_message=str(e))
            
            # Re-raise the exception to be handled by error handlers
            raise