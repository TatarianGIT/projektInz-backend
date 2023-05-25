import bcrypt from "bcrypt";
import express from "express";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
// import { validate } from "../../middleware/validate";
import { hashToken } from "../../utils/hashToken";
import { generateTokens } from "../../utils/jwt";
import {
  createUser,
  findUserByEmail,
  findUserByUsername,
  findUserById,
} from "../users/users.services";
// import { registerSchema } from "./auth.schemas";
import {
  addRefreshTokenToWhitelist,
  deleteRefreshToken,
  findRefreshTokenById,
} from "./auth.services";
import { isAuthenticated } from "../../middleware/isAuthenticated";

export const authRouter = express.Router();

authRouter.get("/test", isAuthenticated, async (req, res, next) => {
  res.status(200).json({
    ok: "okok",
  });
});

authRouter.post(
  "/register",
  //   validate(registerSchema),
  async (req, res, next) => {
    try {
      const { username, email, password } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({
          message: "Nazwa użytkownika, adres e-mail oraz hasło są wymagane!",
        });
      }

      const isExistingEmail = await findUserByEmail(email);
      const isExistingUsername = await findUserByUsername(username);

      if (isExistingEmail) {
        return res.status(400).json({
          message: "Konto o takim adresie e-mail juz istnieje!",
        });
      }

      if (isExistingUsername) {
        return res.status(400).json({
          message: "Konto o takiej nazwie użytkownika juz istnieje",
        });
      }

      const newUser = await createUser(username, email, password);
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
        message: "Adres e-mail oraz hasło są wymagane.",
      });
    }

    const existingUser = await findUserByEmail(email);

    if (!existingUser) {
      return res.status(404).json({
        message: "Podany użytkownik nie istnieje!",
      });
    }

    const validPassword = await bcrypt.compare(password, existingUser.password);
    if (!validPassword) {
      return res.status(403).json({
        message: "Nieprawidłowe dane logowania.",
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
      username: existingUser.username,
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
        message: "Brak refresh token.",
      });
    }

    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!);

    const savedRefreshToken = await findRefreshTokenById(
      // @ts-ignore
      payload?.userId as string
    );

    if (!savedRefreshToken || savedRefreshToken.revoked === true) {
      return res.status(401).json({
        message: "Nieautoryzowany",
      });
    }

    const hashedToken = hashToken(refreshToken);
    if (hashedToken !== savedRefreshToken.hashedToken) {
      return res.status(401).json({
        message: "Nieautoryzowany",
      });
    }

    // @ts-ignore
    const user = await findUserById(payload?.userId as string);
    if (!user) {
      return res.status(401).json({
        message: "Nieautoryzowany",
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
