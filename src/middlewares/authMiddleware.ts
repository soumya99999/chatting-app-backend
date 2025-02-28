import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
    user?: any; // Change from string to any, or create a proper User type
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
    // Get the token from cookies
    const token = req.cookies.token;

    if (!token) {
        res.status(401).json({ message: "No token, authorization denied" });
        console.log("No token Found");
        return;
    }

    try {
        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY!) as { id: string };
        req.user = { _id: decoded.id }; // Attach user ID as an object

        // console.log("Decoded");
        next();
    } catch (err) {
        res.status(401).json({ message: "Invalid token" });
    }
};
