import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export const isAuthenticated = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { authorization } = req.headers;

  if (!authorization) {
    return res.status(401).json({
      message: "Un-Authorized",
    });
  }

  try {
    const token = authorization.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!);
    req.body = payload;
  } catch (err) {
    res.status(401).json({
      message: "Un-Authorized",
    });
  }

  return next();
};