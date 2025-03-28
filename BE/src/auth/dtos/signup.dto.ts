import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, IsStrongPassword, Length } from "class-validator";

export class SignupDto {
    @ApiProperty({
        example: "kangbaekho",
        description: "username"
    })
    @IsString()
    @Length(5, 20)
    username: string;

    @ApiProperty({
        example: "kangbaekho@1234#!",
        description: "password"
    })
    @IsString()
    @IsStrongPassword({
        minLength: 8,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1
    })
    password: string;

    @ApiProperty({
        example: "kangbaekho@gmail.com",
        description: "email"
    })
    @IsString()
    @IsEmail()
    email: string;
}