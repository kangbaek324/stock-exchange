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
import { AuthGuard } from '@nestjs/passport';
import { BuyDto } from './dto/buy.dto';
import { SellDto } from './dto/sell.dto';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { EditDto } from './dto/edit.dto';
import { CancelDto } from './dto/cancel.dto';
import { GetOrderDto } from './dto/get-order.dto';
import { User } from '@prisma/client';
import { OrderValidationService } from './order-validation.service';
import { OrderService } from './order.service';

@Controller()
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

    @Post('/buy')
    async buy(@Body() data: BuyDto, @GetUser() user: User): Promise<unknown> {
        const resultMessage = await this.orderValidationService.buySellValidate(data, user, 'buy');

        if (resultMessage) {
            throw new BadRequestException(resultMessage);
        }

        return await this.orderService.sendMQ(data, user, 'buy');
    }

    @Post('/sell')
    async sell(@Body() data: SellDto, @GetUser() user: User): Promise<unknown> {
        const resultMessage = await this.orderValidationService.buySellValidate(data, user, 'sell');

        if (resultMessage) {
            throw new BadRequestException(resultMessage);
        }

        return this.orderService.sendMQ(data, user, 'sell');
    }

    @Put('/')
    async edit(@Body() data: EditDto, @GetUser() user: User): Promise<unknown> {
        const resultMessage = await this.orderValidationService.editValidate(data, user);

        if (resultMessage) {
            throw new BadRequestException(resultMessage);
        }

        return this.orderService.sendMQ(data, user, 'edit');
    }

    @Delete('/')
    async cancel(@Body() data: CancelDto, @GetUser() user: User): Promise<unknown> {
        const resultMessage = await this.orderValidationService.cancelValidate(data, user);

        if (resultMessage) {
            throw new BadRequestException(resultMessage);
        }

        return this.orderService.sendMQ(data, user, 'cancel');
    }
}
