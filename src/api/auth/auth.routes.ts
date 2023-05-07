import bcrypt from "bcrypt";
import express from "express";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
// import { validate } from "../../middleware/validate";
import { hashToken } from "../../utils/hashToken";
import { generateTokens } from "../../utils/jwt";
import {
  createUserByEmailAndPassword,
  findUserByEmail,
  findUserById,
} from "../users/users.services";
// import { registerSchema } from "./auth.schemas";
import {
  addRefreshTokenToWhitelist,
  deleteRefreshToken,
  findRefreshTokenById,
} from "./auth.services";

export const authRouter = express.Router();

authRouter.post(
  "/register",
  //   validate(registerSchema),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          message: "You must provide an email and password",
        });
      }

      const isExistingUser = await findUserByEmail(email);

      if (isExistingUser) {
        return res.status(400).json({
          message: "Email already in use",
        });
      }

      const newUser = await createUserByEmailAndPassword(email, password);
      const jti = uuidv4();
      const { accessToken, refreshToken } = generateTokens(newUser.id, jti);
      await addRefreshTokenToWhitelist({
        jti,
        refreshToken,
        userId: newUser.id,
      });

      return (
        res
          .status(200)
          // .cookie("accessToken", accessToken, {
          //   httpOnly: true,
          //   secure: process.env.NODE_ENV === "production",
          // })
          // .cookie("refreshToken", refreshToken, {
          //   httpOnly: true,
          //   secure: process.env.NODE_ENV === "production",
          // })
          .json({
            accessToken,
            refreshToken,
          })
      );
    } catch (err) {
      next(err);
    }
  }
);

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "You must provide an email and a password.",
      });
    }

    const existingUser = await findUserByEmail(email);

    if (!existingUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const validPassword = await bcrypt.compare(password, existingUser.password);
    if (!validPassword) {
      return res.status(403).json({
        message: "Invalid login credentials.",
      });
    }

    const jti = uuidv4();
    const { accessToken, refreshToken } = generateTokens(existingUser.id, jti);
    await addRefreshTokenToWhitelist({
      jti,
      refreshToken,
      userId: existingUser.id,
    });

    res.status(200).json({
      accessToken,
      refreshToken,
      email: existingUser.email,
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/refresh-token", async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        message: "Missing refresh token.",
      });
    }

    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!);

    const savedRefreshToken = await findRefreshTokenById(
      // @ts-ignore
      payload?.userId as string
    );

    if (!savedRefreshToken || savedRefreshToken.revoked === true) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const hashedToken = hashToken(refreshToken);
    if (hashedToken !== savedRefreshToken.hashedToken) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    // @ts-ignore
    const user = await findUserById(payload?.userId as string);
    if (!user) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    await deleteRefreshToken(savedRefreshToken.id);
    const jti = uuidv4();
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      user?.id,
      jti
    );
    await addRefreshTokenToWhitelist({
      jti,
      refreshToken: newRefreshToken,
      userId: user.id,
    });

    res.json({
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    next(err);
  }
});
