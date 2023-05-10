// import cookieParser from "cookie-parser";
import express, { Express } from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import morgan from "morgan";
import { authRouter } from "./api/auth/auth.routes";
import { Server, Socket } from "socket.io";

// import { authRouter } from "./api/auth/auth.routes";
// import { usersRouter } from "./api/users/users.routes";

const app: Express = express();

dotenv.config();

app.use(morgan("dev"));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
// app.use(cookieParser());
app.use(cors());

app.use("/auth", authRouter);

/** Error handling */
app.use((_req, res, _next) => {
  const error = new Error("Not found");
  return res.status(404).json({
    message: error.message,
  });
});

/** Server */
const httpServer = http.createServer(app);
const PORT: any = process.env.PORT ?? 6060;
httpServer.listen(PORT, () =>
  console.log(`The server is running on port ${PORT}`)
);

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:6060",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("New client connected!");

  socket.on("message", (message) => {
    console.log(`Client message: ${message}`);

    io.emit("message", `Server: Message recived "${message}"`);
  });

  socket.on("disconnect", () => {
    console.log("Klient rozłączony");
  });
});
