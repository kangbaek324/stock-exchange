import {
    Controller,
    Get,
    Post,
    Delete,
    UseGuards,
    Put,
    Query,
    Body,
    BadRequestException,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AuthGuard } from '@nestjs/passport';
import { BuyDto } from './dtos/buy.dto';
import { SellDto } from './dtos/sell.dto';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { EditDto } from './dtos/edit.dto';
import { CancelDto } from './dtos/cancel.dto';
import { GetOrderDto } from './dtos/get-order.dto';
import { OrdersValidationService } from './orders-validation.service';
import { User } from '@prisma/client';

@Controller()
@UseGuards(AuthGuard('jwt'))
export class OrdersController {
    constructor(
        private readonly ordersService: OrdersService,
        private readonly ordersValidationService: OrdersValidationService,
    ) {}

    @Get('/')
    async getOrder(@Query() query: GetOrderDto, @GetUser() user: User) {
        return this.ordersService.getOrder(query, user);
    }

    @Post('/buy')
    async buy(@Body() data: BuyDto, @GetUser() user: User): Promise<unknown> {
        const resultMessage = await this.ordersValidationService.buySellValidate(data, user, 'buy');

        if (resultMessage) {
            throw new BadRequestException(resultMessage);
        }

        return await this.ordersService.sendMQ(data, user, 'buy');
    }

    @Post('/sell')
    async sell(@Body() data: SellDto, @GetUser() user: User): Promise<unknown> {
        const resultMessage = await this.ordersValidationService.buySellValidate(
            data,
            user,
            'sell',
        );

        if (resultMessage) {
            throw new BadRequestException(resultMessage);
        }

        return this.ordersService.sendMQ(data, user, 'sell');
    }

    @Put('/')
    async edit(@Body() data: EditDto, @GetUser() user: User): Promise<unknown> {
        const resultMessage = await this.ordersValidationService.editValidate(data, user);

        if (resultMessage) {
            throw new BadRequestException(resultMessage);
        }

        return this.ordersService.sendMQ(data, user, 'edit');
    }

    @Delete('/')
    async cancel(@Body() data: CancelDto, @GetUser() user: User): Promise<unknown> {
        const resultMessage = await this.ordersValidationService.cancelValidate(data, user);

        if (resultMessage) {
            throw new BadRequestException(resultMessage);
        }

        return this.ordersService.sendMQ(data, user, 'cancel');
    }
}
