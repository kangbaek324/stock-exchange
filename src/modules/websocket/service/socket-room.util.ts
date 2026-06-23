import { Server } from 'socket.io';

export function hasRoomMembers(server: Server, room: string): boolean {
    const roomMembers = server.sockets.adapter.rooms.get(room);
    return (roomMembers?.size ?? 0) > 0;
}
