// Express request augmentation for correlationId
import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    correlationId?: string;
  }
}
