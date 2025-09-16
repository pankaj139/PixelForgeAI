"""
Health monitoring utilities for service health checks and monitoring
"""

import os
import time
import psutil
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from pathlib import Path

from models import ServiceHealthStatus
from utils.logging_config import get_logger

logger = get_logger(__name__)

class HealthMonitor:
    """Health monitoring service for tracking service health and metrics"""
    
    def __init__(self, temp_dir: str = "/tmp", max_disk_usage_percent: float = 95.0):
        self.start_time = time.time()
        self.temp_dir = Path(temp_dir)
        self.max_disk_usage_percent = max_disk_usage_percent
        self.last_error: Optional[str] = None
        self.error_count = 0
        self.request_count = 0
        self.successful_requests = 0
        
    def get_uptime_seconds(self) -> float:
        """Get service uptime in seconds"""
        return time.time() - self.start_time
    
    def get_memory_usage_mb(self) -> float:
        """Get current memory usage in MB"""
        try:
            process = psutil.Process()
            memory_info = process.memory_info()
            return memory_info.rss / 1024 / 1024  # Convert bytes to MB
        except Exception as e:
            logger.warning(f"Failed to get memory usage: {e}")
            return 0.0
    
    def get_disk_usage_percent(self) -> float:
        """Get disk usage percentage for temp directory"""
        try:
            # Ensure temp directory exists
            self.temp_dir.mkdir(parents=True, exist_ok=True)
            
            # Get disk usage
            disk_usage = psutil.disk_usage(str(self.temp_dir))
            return (disk_usage.used / disk_usage.total) * 100
        except Exception as e:
            logger.warning(f"Failed to get disk usage: {e}")
            return 0.0
    
    def check_temp_directory(self) -> bool:
        """Check if temp directory is accessible and writable"""
        try:
            # Ensure directory exists
            self.temp_dir.mkdir(parents=True, exist_ok=True)
            
            # Test write access
            test_file = self.temp_dir / "health_check_test.tmp"
            test_file.write_text("health check")
            test_file.unlink()
            
            return True
        except Exception as e:
            logger.error(f"Temp directory check failed: {e}")
            return False
    
    def check_memory_usage(self) -> bool:
        """Check if memory usage is within acceptable limits"""
        try:
            memory_usage_mb = self.get_memory_usage_mb()
            # Consider unhealthy if using more than 1GB
            return memory_usage_mb < 1024
        except Exception as e:
            logger.error(f"Memory usage check failed: {e}")
            return False
    
    def check_disk_usage(self) -> bool:
        """Check if disk usage is within acceptable limits"""
        try:
            disk_usage_percent = self.get_disk_usage_percent()
            return disk_usage_percent < self.max_disk_usage_percent
        except Exception as e:
            logger.error(f"Disk usage check failed: {e}")
            return False
    
    def check_error_rate(self) -> bool:
        """Check if error rate is within acceptable limits"""
        if self.request_count == 0:
            return True
        
        error_rate = self.error_count / self.request_count
        # Consider unhealthy if error rate is above 50%
        return error_rate < 0.5
    
    def record_request(self, success: bool = True, error_message: Optional[str] = None):
        """Record a request for health monitoring"""
        self.request_count += 1
        
        if success:
            self.successful_requests += 1
        else:
            self.error_count += 1
            if error_message:
                self.last_error = error_message
    
    def get_health_status(self) -> ServiceHealthStatus:
        """Get comprehensive health status"""
        
        # Perform health checks
        checks = {
            "temp_directory": self.check_temp_directory(),
            "memory_usage": self.check_memory_usage(),
            "disk_usage": self.check_disk_usage(),
            "error_rate": self.check_error_rate()
        }
        
        # Determine overall status
        if all(checks.values()):
            status = "healthy"
        elif any(checks.values()):
            status = "degraded"
        else:
            status = "unhealthy"
        
        return ServiceHealthStatus(
            status=status,
            checks=checks,
            uptime_seconds=self.get_uptime_seconds(),
            memory_usage_mb=self.get_memory_usage_mb(),
            disk_usage_percent=self.get_disk_usage_percent(),
            last_error=self.last_error
        )
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get detailed service metrics"""
        
        uptime = self.get_uptime_seconds()
        
        return {
            "uptime_seconds": uptime,
            "uptime_human": self._format_uptime(uptime),
            "memory_usage_mb": self.get_memory_usage_mb(),
            "disk_usage_percent": self.get_disk_usage_percent(),
            "request_count": self.request_count,
            "successful_requests": self.successful_requests,
            "error_count": self.error_count,
            "success_rate": self.successful_requests / max(self.request_count, 1),
            "error_rate": self.error_count / max(self.request_count, 1),
            "last_error": self.last_error,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    def _format_uptime(self, uptime_seconds: float) -> str:
        """Format uptime in human-readable format"""
        
        days = int(uptime_seconds // 86400)
        hours = int((uptime_seconds % 86400) // 3600)
        minutes = int((uptime_seconds % 3600) // 60)
        seconds = int(uptime_seconds % 60)
        
        if days > 0:
            return f"{days}d {hours}h {minutes}m {seconds}s"
        elif hours > 0:
            return f"{hours}h {minutes}m {seconds}s"
        elif minutes > 0:
            return f"{minutes}m {seconds}s"
        else:
            return f"{seconds}s"
    
    async def cleanup_temp_files(self, max_age_hours: int = 24):
        """Clean up old temporary files"""
        
        try:
            if not self.temp_dir.exists():
                return
            
            current_time = time.time()
            max_age_seconds = max_age_hours * 3600
            cleaned_count = 0
            
            for file_path in self.temp_dir.iterdir():
                if file_path.is_file():
                    file_age = current_time - file_path.stat().st_mtime
                    if file_age > max_age_seconds:
                        try:
                            file_path.unlink()
                            cleaned_count += 1
                        except Exception as e:
                            logger.warning(f"Failed to delete temp file {file_path}: {e}")
            
            if cleaned_count > 0:
                logger.info(f"Cleaned up {cleaned_count} temporary files")
                
        except Exception as e:
            logger.error(f"Temp file cleanup failed: {e}")

# Global health monitor instance
health_monitor = HealthMonitor()

def get_health_monitor() -> HealthMonitor:
    """Get the global health monitor instance"""
    return health_monitor

async def periodic_cleanup_task():
    """Periodic task for cleanup operations"""
    
    while True:
        try:
            await health_monitor.cleanup_temp_files()
            await asyncio.sleep(3600)  # Run every hour
        except Exception as e:
            logger.error(f"Periodic cleanup task failed: {e}")
            await asyncio.sleep(300)  # Wait 5 minutes before retrying