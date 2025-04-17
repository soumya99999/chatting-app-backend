import { Request } from 'express';
import { User } from '../models/User';

declare global {
  namespace Express {
    interface AuthRequest extends Request {
      user?: User;
      app: any;
      params: any;
      body: any;
      query: any;
      cookies: any;
    }
  }
} 