import { IsAlpha, IsEmail, IsPhoneNumber, IsString, IsStrongPassword } from "class-validator";

export class SignupDto {
    @IsString()
    @IsAlpha()
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
    @IsPhoneNumber("KR")
    phone: number;

    @IsString()
    @IsEmail()
    email: string;
}