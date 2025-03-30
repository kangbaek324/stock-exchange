import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { map, Observable } from "rxjs";

@Injectable()
export class jwtInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> | Promise<Observable<any>> {
        const ctx = context.switchToHttp();
        const res = ctx.getResponse();

        return next.handle().pipe(
            map((jwt) => {
                res.setHeader('Authorization', jwt.accessToken);
                res.json(jwt)
            })
        )
    }
}