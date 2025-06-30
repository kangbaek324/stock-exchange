import { Controller, Get, Post, Delete, UseGuards, Put, Query, Body, InternalServerErrorException, BadRequestException, HttpException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AuthGuard } from '@nestjs/passport';
import { BuyDto } from './dtos/buy.dto';
import { SellDto } from './dtos/sell.dto';
import { GetUser } from 'src/common/decorator/get-user.decorator';
import { EditDto } from './dtos/edit.dto';
import { CancelDto } from './dtos/cancel.dto';
import { GetOrderDto } from './dtos/get-order.dto';
import { Ctx, MessagePattern, Payload, RmqContext } from '@nestjs/microservices';
import { OrdersValidationService } from './orders-validation.service';

@Controller()
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly ordersValidationService: OrdersValidationService
  ) {}
  
  @Get("/")
  @UseGuards(AuthGuard("jwt"))
  async getOrder(@Query() query: GetOrderDto, @GetUser() user) {
    return this.ordersService.getOrder(query, user);
  }

  @MessagePattern("order")
  async sendOrder(@Payload() mqData: any, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      await this.ordersService.sendOrder(mqData);
      return {
        statusCode: "201",
        message: "주문이 접수되었습니다"
      };
    } catch(err) {
      return {
        statusCode: 500,
        message: err.message
      }
    } finally {
      channel.ack(originalMsg);
    }
  }
  
  @Post("/buy")
  @UseGuards(AuthGuard("jwt"))
  async buy(@Body() data: BuyDto, @GetUser() user): Promise<unknown> {
    const resultMessage = await this.ordersValidationService.buySellValidate(data, user, "buy");
    if (resultMessage) {
      throw new BadRequestException(resultMessage);
    }
    return await this.ordersService.sendMQ(data, user, "buy");
  }
  @Post("/sell")
  @UseGuards(AuthGuard("jwt"))
  async sell(@Body() data: SellDto, @GetUser() user): Promise<unknown> {
    const resultMessage = await this.ordersValidationService.buySellValidate(data, user, "sell");
    if (resultMessage) {
      throw new BadRequestException(resultMessage);
    }
    return this.ordersService.sendMQ(data, user, "sell");
  }

  @Put("/")
  @UseGuards(AuthGuard("jwt"))
  async edit(@Body() data: EditDto, @GetUser() user): Promise<unknown> {
    const resultMessage = await this.ordersValidationService.editValidate(data, user);
    if (resultMessage) {
      throw new BadRequestException(resultMessage);
    }
    return this.ordersService.sendMQ(data, user, "edit");
  } 

  @Delete("/")
  @UseGuards(AuthGuard("jwt"))
  async cancel(@Body() data: CancelDto , @GetUser() user): Promise<unknown> {
    const resultMessage = await this.ordersValidationService.cancelValidate(data, user);
    if (resultMessage) {
      throw new BadRequestException(resultMessage);
    }
    return this.ordersService.sendMQ(data, user, "cancel");
  }
}
