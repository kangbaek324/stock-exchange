import { IsAlpha, IsString } from "class-validator";

export class SigninDto {
    @IsString()
    @IsAlpha()
    username: string;
    
    @IsString()
    password: number;
}

