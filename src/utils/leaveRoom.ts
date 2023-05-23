interface User {
  id?: number | string;
}

function leaveRoom(userID: string, chatRoomUsers: User[]): User[] {
  return chatRoomUsers.filter((user) => user.id !== userID);
}

export = leaveRoom;
