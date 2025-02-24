import { IsString, Length } from "class-validator";

export class SigninDto {
    @IsString()
    @Length(5, 20)
    username: string;
    
    @IsString()
    password: string;
}

