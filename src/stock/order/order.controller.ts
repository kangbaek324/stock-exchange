import {
    Controller,
    Get,
    UseGuards,
    Query,
    Put,
    Delete,
    Body,
    BadRequestException,
    Param,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { GetOrderDto } from './dto/get-order.dto';
import { User } from '@prisma/client';
import { OrderService } from './order.service';
import { CancelDto } from './dto/cancel.dto';
import { EditDto } from './dto/edit.dto';
import { OrderValidationService } from './order-validation.service';

@Controller('orders')
@UseGuards(AuthGuard('jwt'))
export class OrderController {
    constructor(
        private readonly orderService: OrderService,
        private readonly orderValidationService: OrderValidationService,
    ) {}

    @Get('/')
    async getOrder(@Query() query: GetOrderDto, @GetUser() user: User) {
        return this.orderService.getOrder(query, user);
    }

    @Put('/:id')
    async edit(
        @Body() dto: EditDto,
        @GetUser() user: User,
        @Param('id') id: number,
    ): Promise<unknown> {
        const data = {
            ...dto,
            orderId: id,
        };
        await this.orderValidationService.editValidate(data, user);

        return this.orderService.sendMQ(data, user, 'edit');
    }

    @Delete('/:id')
    async cancel(
        @Body() dto: CancelDto,
        @GetUser() user: User,
        @Param('id') id: number,
    ): Promise<unknown> {
        const data = {
            ...dto,
            orderId: id,
        };
        await this.orderValidationService.cancelValidate(data, user);

        return this.orderService.sendMQ(data, user, 'cancel');
    }
}
