import { redis } from "../lib/redis.js";
import User from "../models/user.model.js";
import jwt from "jsonwebtoken";

/**
 * Generates an access token and a refresh token for a given user ID.
 *
 * @param {string} userId - The ID of the user to generate the tokens for.
 * @returns {{accessToken: string, refreshToken: string}} - An object containing the access token and the refresh token.
 */
const generateTokens = (userId) => {
	const accessToken = jwt.sign({ userId }, process.env.ACCESS_TOKEN_SECRET, {
		// The access token is valid for 15 minutes.
		expiresIn: "15m",
	});

	const refreshToken = jwt.sign({ userId }, process.env.REFRESH_TOKEN_SECRET, {
		// The refresh token is valid for 7 days.
		expiresIn: "7d",
	});

	return { accessToken, refreshToken };
};

const storeRefreshToken = async (userId, refreshToken) => {
	await redis.set(`refresh_token:${userId}`, refreshToken, "EX", 7 * 24 * 60 * 60); // 7days
};

const setCookies = (res, accessToken, refreshToken) => {
	res.cookie("accessToken", accessToken, {
		httpOnly: true, // prevent XSS attacks, cross site scripting attack
		secure: process.env.NODE_ENV === "production",
		sameSite: "strict", // prevents CSRF attack, cross-site request forgery attack
		maxAge: 15 * 60 * 1000, // 15 minutes
	});
	res.cookie("refreshToken", refreshToken, {
		httpOnly: true, // prevent XSS attacks, cross site scripting attack
		secure: process.env.NODE_ENV === "production",
		sameSite: "strict", // prevents CSRF attack, cross-site request forgery attack
		maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
	});
};

/**
 * Signup user
 * @param {Object} req - request object
 * @param {Object} res - response object
 * @returns {Promise<void>}
 */
export const signup = async (req, res) => {
	// Destructure request body
	const { email, password, name } = req.body;

	try {
		// Check if user with the same email already exists
		const userExists = await User.findOne({ email });

		if (userExists) {
			// If user exists, return 400 status code with error message
			return res.status(400).json({ message: "User already exists" });
		}

		// Create new user
		const user = await User.create({ name, email, password });

		// Generate access and refresh tokens
		const { accessToken, refreshToken } = generateTokens(user._id);

		// Store refresh token in Redis
		await storeRefreshToken(user._id, refreshToken);

		// Set cookies for access and refresh tokens
		setCookies(res, accessToken, refreshToken);

		// Return user data with 201 status code
		res.status(201).json({
			_id: user._id,
			name: user.name,
			email: user.email,
			role: user.role,
		});
	} catch (error) {
		// Log error and return 500 status code with error message
		console.log("Error in signup controller", error.message);
		res.status(500).json({ message: error.message });
	}
};

export const login = async (req, res) => {
	try {
		const { email, password } = req.body;
		const user = await User.findOne({ email });

		if (user && (await user.comparePassword(password))) {
			const { accessToken, refreshToken } = generateTokens(user._id);
			await storeRefreshToken(user._id, refreshToken);
			setCookies(res, accessToken, refreshToken);

			res.json({
				_id: user._id,
				name: user.name,
				email: user.email,
				role: user.role,
        message: "Login successful",
			});
		} else {
			res.status(400).json({ message: "Invalid email or password" });
		}
	} catch (error) {
		console.log("Error in login controller", error.message);
		res.status(500).json({ message: error.message });
	}
};

/**
 * Logs out the user by clearing the access token and the refresh token from the cookies
 * and deleting the refresh token from Redis.
 * 
 * @param {Object} req - request object
 * @param {Object} res - response object
 * @returns {Promise<void>}
 */
export const logout = async (req, res) => {
	try {
		// Clear the refresh token from the cookies if it exists
		const refreshToken = req.cookies.refreshToken;
		if (refreshToken) {
			// Verify the refresh token to get the user ID
      // Express app must have cookieParser in oder to use cookie
			const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
			// Delete the refresh token from Redis
			await redis.del(`refresh_token:${decoded.userId}`);
		}

		// Clear the access token and the refresh token from the cookies
		res.clearCookie("accessToken");
		res.clearCookie("refreshToken");

		// Return a success message
		res.json({ message: "Logged out successfully" });
	} catch (error) {
		// Log any errors and return 500 status code with error message
		console.log("Error in logout controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

/**
 * Refreshes the access token for a user
 * 
 * @param {Object} req - request object
 * @param {Object} res - response object
 * @returns {Promise<void>}
 */
export const refreshToken = async (req, res) => {
	try {
		// Get the refresh token from the cookies
		const refreshToken = req.cookies.refreshToken;

		if (!refreshToken) {
			// If no refresh token is provided, return 401 status code
			return res.status(401).json({ message: "No refresh token provided" });
		}

		// Verify the refresh token
		const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

		// Get the stored refresh token from Redis
		const storedToken = await redis.get(`refresh_token:${decoded.userId}`);

		if (storedToken !== refreshToken) {
			// If the stored refresh token does not match the provided refresh token, return 401 status code
			return res.status(401).json({ message: "Invalid refresh token" });
		}

		// Generate a new access token
		const accessToken = jwt.sign({ userId: decoded.userId }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "15m" });

		// Set the new access token in the cookies
		res.cookie("accessToken", accessToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict",
			maxAge: 15 * 60 * 1000,
		});

		// Return a success message
		res.json({ message: "Token refreshed successfully" });
	} catch (error) {
		// Log any errors and return 500 status code
		console.log("Error in refreshToken controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

/**
 * Get the profile of the current user
 * @param {Object} req - request object
 * @param {Object} res - response object
 * @returns {Promise<void>}
 */
export const getProfile = async (req, res) => {
	try {
		// If the user is not logged in, req.user will be null
		// and we should return 401 status code
		if (!req.user) {
			return res.status(401).json({ message: "Not logged in" });
		}

		// Return the user profile
		res.json(req.user);
	} catch (error) {
		// Log any errors and return 500 status code
		console.log("Error in getProfile controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};
