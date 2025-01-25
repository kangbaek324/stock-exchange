import { IsAlpha, IsString, Max, Min } from "class-validator";

export class SigninDto {
    @IsString()
    @Min(5)
    @Max(20)
    username: string;
    
    @IsString()
    password: number;
}

