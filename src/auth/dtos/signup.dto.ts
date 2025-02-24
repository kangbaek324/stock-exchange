import { IsEmail, IsString, IsStrongPassword, Length } from "class-validator";

export class SignupDto {
    @IsString()
    @Length(5, 20)
    username: string;

    @IsString()
    @IsStrongPassword({
        minLength: 8,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1
    })
    password: string;

    @IsString()
    @IsEmail()
    email: string;
}