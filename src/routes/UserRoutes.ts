import express from 'express';
import passport from 'passport';
import { fetchUsers, searchUsers, getCurrentUser } from '../controllers/user.controller';
import jwt from 'jsonwebtoken';
import {authenticate} from "../middlewares/authMiddleware";
import upload from '../middlewares/multer';

const router = express.Router();


// User registration and login routes
router.get('/fetch-users', authenticate, fetchUsers); 

// Add this with your other routes
router.get('/search', authenticate, searchUsers);

// Add this new route with your other routes
router.get('/current-user', authenticate, getCurrentUser);

export default router;
