import { Socket as IOSocket } from 'socket.io';

export interface CustomSocket extends IOSocket {
    user?: any;
}
