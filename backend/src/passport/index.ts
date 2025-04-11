import passport from "passport";
import { 
    Strategy as GoogleStrategy, 
    Profile as GoogleProfile, 
    VerifyCallback as GoogleVerifyCallback 
} from "passport-google-oauth20";
import { 
    Strategy as GitHubStrategy, 
    Profile as GitHubProfile
} from "passport-github2";
import { VerifyCallback as OAuth2VerifyCallback } from "passport-oauth2";
import { User, IUser } from "../models/user.models";
import { UserLoginType, UserRolesEnum } from "../constants";
import { ApiError } from "../utils/ApiError";
import { CallbackError } from "mongoose";

interface GitHubProfileWithJson extends GitHubProfile {
    _json: {
        email: string;
        node_id: string;
        avatar_url: string;
    };
}

// Serialize user by _id
passport.serializeUser((user: Express.User, done: (err: any, id?: any) => void) => {
    const mongoUser = user as IUser;
    done(null, mongoUser._id);
});

// Deserialize user by _id
passport.deserializeUser(async (id: string, done: (err: CallbackError | null, user?: Express.User | false | null) => void) => {
    try {
        const user = await User.findById(id);
        if (!user) return done(new ApiError(404, "User does not exist"), null);
        return done(null, user as IUser);
    } catch (error) {
        return done(
            new ApiError(500, `Deserialization error: ${(error as Error).message}`),
            null
        );
    }
});

// ------------------- Google Strategy -------------------
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            callbackURL: process.env.GOOGLE_CALLBACK_URL!,
        },
        async (_accessToken: string, _refreshToken: string, profile: GoogleProfile, done: GoogleVerifyCallback) => {
            try {
                const googleJson = profile._json as {
                    email: string;
                    picture: string;
                    sub: string;
                };

                const email = googleJson.email;
                const existingUser = await User.findOne({ email });

                if (existingUser) {
                    if (existingUser.loginType !== UserLoginType.GOOGLE) {
                    return done(
                        new ApiError(
                        400,
                        `You have previously registered using ${existingUser.loginType.toLowerCase().replace(/_/g, " ")}. Please use the same login method.`
                        ),
                        false
                    );
                    }
                    return done(null, existingUser);
                }

                const newUser = await User.create({
                    email,
                    password: googleJson.sub,
                    username: email?.split("@")[0],
                    isEmailVerified: true,
                    role: UserRolesEnum.USER,
                    avatar: {
                    url: googleJson.picture,
                    localPath: "",
                    },
                    loginType: UserLoginType.GOOGLE,
                });

                return done(null, newUser);
            } catch (error) {
                return done(new ApiError(500, "Google strategy error: " + error), false);
            }
        }
    )
);

// ------------------- GitHub Strategy -------------------
passport.use(
    new GitHubStrategy(
        {
            clientID: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
            callbackURL: process.env.GITHUB_CALLBACK_URL!,
        },
        async (_accessToken: string, _refreshToken: string, profile: GitHubProfile, done: OAuth2VerifyCallback) => {
            try {
                const githubProfile = profile as GitHubProfileWithJson;
                const githubJson = githubProfile._json

                const email = githubJson.email;

                if (!email) {
                    return done(
                    new ApiError(
                        400,
                        "User does not have a public email associated with their GitHub account. Please try another login method."
                    ),
                    false
                    );
                }

                const existingUser = await User.findOne({ email });

                if (existingUser) {
                    if (existingUser.loginType !== UserLoginType.GITHUB) {
                    return done(
                        new ApiError(
                        400,
                        `You have previously registered using ${existingUser.loginType.toLowerCase().replace(/_/g, " ")}. Please use the same login method.`
                        ),
                        false
                    );
                    }
                    return done(null, existingUser);
                }

                const usernameTaken = await User.findOne({ username: profile.username });

                const newUser = await User.create({
                    email,
                    password: githubJson.node_id,
                    username: usernameTaken
                    ? email.split("@")[0]
                    : profile.username,
                    isEmailVerified: true,
                    role: UserRolesEnum.USER,
                    avatar: {
                    url: githubJson.avatar_url,
                    localPath: "",
                    },
                    loginType: UserLoginType.GITHUB,
                });

                return done(null, newUser);
            } catch (error) {
                return done(new ApiError(500, "GitHub strategy error: " + error), false);
            }
        }
    )
);
