import {
    Controller,
    Get,
    UseGuards,
    Query,
    Put,
    Delete,
    Body,
    Param,
} from '@nestjs/common';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { GetOrderDto } from '../dto/get-order.dto';
import { User } from '@prisma/client';
import { CancelDto } from '../dto/cancel.dto';
import { EditDto } from '../dto/edit.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { OrderService } from '../services/order.service';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
    constructor(private readonly orderService: OrderService) {}

    // 주문 조회
    @Get('/')
    async getOrder(@Query() query: GetOrderDto, @GetUser() user: User) {
        return this.orderService.getOrder(query, user);
    }

    // 주문 정정
    @Put('/:id')
    async edit(
        @Body() dto: EditDto,
        @GetUser() user: User,
        @Param('id') id: string,
    ): Promise<unknown> {
        return this.orderService.createOrder(user, { type: 'edit', orderId: id, dto });
    }

    // 주문 취소
    @Delete('/:id')
    async cancel(
        @Body() dto: CancelDto,
        @GetUser() user: User,
        @Param('id') id: string,
    ): Promise<unknown> {
        return this.orderService.createOrder(user, { type: 'cancel', orderId: id, dto });
    }
}
