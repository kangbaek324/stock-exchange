import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length } from "class-validator";

export class SigninDto {
    @ApiProperty({
        example: 'kangbaekho',
        description: "username"
    })
    @IsString()
    @Length(5, 20)
    username: string;
    
    @ApiProperty({
        example: 'kangbaekho@1234#!',
        description: "password"
    })
    @IsString()
    password: string;
}

