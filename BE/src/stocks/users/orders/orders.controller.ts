import { Controller, Get, Post, Delete, UseGuards, Put, Query, Body, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AuthGuard } from '@nestjs/passport';
import { BuyDto } from './dtos/buy.dto';
import { SellDto } from './dtos/sell.dto';
import { GetUser } from 'src/common/decorator/get-user.decorator';
import { EditDto } from './dtos/edit.dto';
import { CancelDto } from './dtos/cancel.dto';
import { GetOrderDto } from './dtos/get-order.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Ctx, EventPattern, MessagePattern, Payload, RmqContext } from '@nestjs/microservices';

@ApiTags("stock")
@Controller("stock/user/orders")
export class OrdersController {
  constructor(private readonly OrdersService: OrdersService) {}
  
  @ApiOperation({ summary: "주문 조회" })
  @ApiBearerAuth("access-token")
  @ApiResponse({
    status : "2XX", description : `
    [
      {
        "id": 184220,
        "account_id": 12,
        "stock_id": 1,
        "price": 0,
        "number": 5,
        "match_number": 5,
        "order_type": "market",
        "status": "y",
        "trading_type": "buy",
        "created_at": "2025-03-28T11:53:31.468Z",
        "stocks": {
          "name": "Nest소프트"
          }
          },
          {
            "id": 184221,
            "account_id": 12,
            "stock_id": 1,
            "price": 0,
            "number": 5,
          "match_number": 5,
          "order_type": "market",
          "status": "y",
          "trading_type": "buy",
          "created_at": "2025-03-28T11:53:39.111Z",
          "stocks": {
            "name": "Nest소프트"
            }
            }
            ]
            `
  })
  @UseGuards(AuthGuard("jwt"))
  @Get("/")
  async getOrder(@Query() query: GetOrderDto, @GetUser() user) {
    return this.OrdersService.getOrder(query, user);
  }

  @MessagePattern("order")
  async sendOrder(@Payload() mqData: any, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      await this.OrdersService.sendOrder(mqData);
      return {
        statusCode: "201",
        message: "주문이 접수되었습니다"
      };
    } catch(err) {
      if (err instanceof BadRequestException) {
        return {
          status: 400,
          message: err.message
        }
      }
      else {
        return {
          status: 500,
          message: "서버에 오류가 발생했습니다"
        }
      }
    } finally {
      channel.ack(originalMsg);
    }
  }
  
  @ApiOperation({ summary: "주식 매수" })
  @ApiBearerAuth("access-token")
  @UseGuards(AuthGuard("jwt"))
  @Post("/buy")
  async buy(@Body() data: BuyDto, @GetUser() user): Promise<unknown> {
    return this.OrdersService.sendMQ(data, user, "buy");
  }

  @ApiOperation({ summary: "주식 매도" })
  @ApiBearerAuth("access-token")
  @UseGuards(AuthGuard("jwt"))
  @Post("/sell")
  async sell(@Body() data: SellDto, @GetUser() user): Promise<unknown> {
    return this.OrdersService.sendMQ(data, user, "sell");
  }

  @ApiOperation({ summary: "주식 주문 정정" })
  @ApiBearerAuth("access-token")
  @UseGuards(AuthGuard("jwt"))
  @Put("/")
  async edit(@Body() data: EditDto, @GetUser() user): Promise<unknown> {
    return this.OrdersService.sendMQ(data, user, "edit");
  } 

  @ApiOperation({ summary: "주식 주문 취소" })
  @ApiBearerAuth("access-token")
  @UseGuards(AuthGuard("jwt"))
  @Delete("/")
  async cancel(@Body() data: CancelDto , @GetUser() user): Promise<unknown> {
    return this.OrdersService.sendMQ(data, user, "cancell");
  }
}
