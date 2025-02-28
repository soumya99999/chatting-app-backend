export interface User {
    _id: string;
    email: string;
    name: string;
}

export interface AuthRequest extends Request {
    user?: User['_id'];
} 