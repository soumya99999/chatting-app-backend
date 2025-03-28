// src/config/passport.ts
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User';

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: 'http://localhost:8081/api/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Extract email from the profile
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error('Email is required for sign-up'), false);
        }

        // Extract profile picture
        const profilePicture = profile.photos?.[0]?.value;

        // Check if the user already exists by email or googleId
        let user = await User.findOne({ 
          $or: [
            { email },
            { googleId: profile.id }
          ]
        });

        if (!user) {
          // Create a new user if they don't exist
          user = await User.create({
            name: profile.displayName || 'Unknown User',
            email,
            googleId: profile.id,
            profilePicture,
          });
        } else if (!user.googleId) {
          // If user exists but doesn't have googleId, update it
          user.googleId = profile.id;
          if (profilePicture && !user.profilePicture) {
            user.profilePicture = profilePicture;
          }
          await user.save();
        }

        return done(null, user);
      } catch (error) {
        console.error('Error during Google authentication:', error);
        return done(error as Error, false);
      }
    }
  )
);

// Since we're not using sessions (session: false in authRoutes), these are not strictly necessary
// but including them for completeness in case you enable sessions later
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

export default passport;