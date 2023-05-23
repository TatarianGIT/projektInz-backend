// import cookieParser from "cookie-parser";
import express, { Express } from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import morgan from "morgan";
import { authRouter } from "./api/auth/auth.routes";
import { Server, Socket } from "socket.io";
import leaveRoom from "./utils/leaveRoom";

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

/**Socket.IO Server */
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

let chatRoom: any = "";
let allUsers: any = [];

io.on("connection", (socket) => {
  console.log("New client connected", socket.id);

  socket.on("joinRoom", (data) => {
    const { room, email } = data;
    allUsers = leaveRoom(socket.id, allUsers);
    const userExistsInRoom = allUsers.some(
      (user: any) => user.room === room && user.email === email
    );

    if (!userExistsInRoom) {
      socket.join(room);
      console.log(email, "połączono z", room);
      socket.emit("setRoom", room);
      chatRoom = room;
      allUsers.push({ id: socket.id, room, email });

      let creationTime = Date.now(); // Current timestamp
      // Send message to all users currently in the room, apart from the user that just joined
      socket.to(room).emit("receiveMessage", {
        creationTime,
        message: `Użytkownik ${email} dołączył do kanału`,
      });
      // Send welcome msg to user that just joined chat only
      socket.emit("receiveMessage", {
        creationTime,
        message: `Witaj ${email} na kanale ${room}`,
      });
    }

    const chatRoomUsers = allUsers.filter((user: any) => user.room === room);
    socket.to(room).emit("chatRoomUsers", chatRoomUsers);
    socket.emit("chatRoomUsers", chatRoomUsers);
  });

  socket.on("sendMessage", (data) => {
    const { message, email, room, creationTime } = data;
    io.in(room).emit("receiveMessage", data); // Send to all users in room, including sender
  });

  socket.on("leaveRoom", (data) => {
    const { email, room } = data;
    socket.leave(room);
    socket.emit("setRoom", "");
    socket.emit("setMessages", []);
    socket.emit("setRoomUsers", []);
    allUsers = leaveRoom(socket.id, allUsers);
    socket.to(room).emit("chatRoomUsers", allUsers);

    let creationTime = Date.now();
    socket.to(room).emit("receiveMessage", {
      message: `${email} opuścił kanał`,
      creationTime,
    });
    console.log(email, "opuszczono pokój", room);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected", socket.id);
    const user = allUsers.find((user: any) => user.id == socket.id);
    if (user?.username) {
      allUsers = leaveRoom(socket.id, allUsers);
      socket.to(chatRoom).emit("chatRoomUsers", allUsers);
      socket.to(chatRoom).emit("receiveMessage", {
        message: `${user.username} has disconnected from the chat.`,
      });
    }
  });
});

/**Server listen message */
httpServer.listen(PORT, () =>
  console.log(`The server is running on port ${PORT}`)
);
