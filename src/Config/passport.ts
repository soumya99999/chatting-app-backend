import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User';

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            callbackURL: 'http://localhost:8081/api/users/google/callback',
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                // Check if the user already exists in the database
                const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;

                if (!email) {
                    return done(new Error("Email is required for sign-up"), false);
                }

                let user = await User.findOne({ email });

                if (!user) {
                    // Ensure googleId is available before creating a new user
                    if (!profile.id) {
                        return done(new Error("Google ID is required for sign-up"), false);
                    }

                    // Create a new user if they don't exist
                    user = await User.create({
                        name: profile.displayName,
                        email: email, // Use the extracted email
                        googleId: profile.id, // Store Google ID
                    });
                }

                return done(null, user); // Pass the user object if found or created
            } catch (error) {
                console.error('Error during Google authentication:', error);
                return done(error as Error, false); // Pass false for the user
            }
        }
    )
);

export default passport;