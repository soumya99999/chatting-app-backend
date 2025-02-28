import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
    name: string;
    email: string;
    password?: string; // Optional for Google sign-ups
    googleId?: string; // Required for Google sign-ups
    profilePicture?: string;
    otp?: string; // Field to store OTP
    otpExpiration?: Date; // Field to store OTP expiration time
}

export const DEFAULT_PROFILE_PICTURE = "https://www.gravatar.com/avatar/default?d=mp";

const UserSchema: Schema = new Schema(
    {
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        profilePicture: {
            type: String,
            default: DEFAULT_PROFILE_PICTURE
        },
        password: { type: String, required: false }, // Optional for Google sign-ups
        googleId: { type: String, required: false, default: "" }, // Optional: Store Google ID
        otp: { type: String }, // Add OTP field
        otpExpiration: { type: Date }, // Add OTP expiration field
    },
    { timestamps: true }
);

UserSchema.pre('save', function(next) {
    if (!this.profilePicture) {
        this.profilePicture = DEFAULT_PROFILE_PICTURE;
    }
    next();
});

export default mongoose.model<IUser>('user', UserSchema);
