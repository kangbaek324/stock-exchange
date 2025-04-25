import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/common/prisma/prisma.service";

@Injectable()
export class AuthRepository { 
    constructor(
        private prisma: PrismaService
    ) {}

    async createUser(signupData, password) {
        await this.prisma.users.create({ 
            data : {
                username : signupData.username,
                password : password,
                email : signupData.email
            }
        });
    }
}