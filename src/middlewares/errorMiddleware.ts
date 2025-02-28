import { Request, Response, NextFunction } from 'express';
import AppError from '../utils/appError';

export const errorMiddleware = (
    err: AppError,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            status: 'error',
            message: err.message,
        });
    }

    return res.status(500).json({
        status: 'error',
        message: 'Something went wrong',
    });
};
