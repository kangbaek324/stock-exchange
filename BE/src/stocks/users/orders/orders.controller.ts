import { Controller, Get, Post, Delete, UseGuards, Put, Query, Body } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AuthGuard } from '@nestjs/passport';
import { BuyDto } from './dtos/buy.dto';
import { SellDto } from './dtos/sell.dto';
import { GetUser } from 'src/common/decorator/get-user.decorator';
import { EditDto } from './dtos/edit.dto';
import { CancelDto } from './dtos/cancel.dto';
import { GetOrderDto } from './dtos/get-order.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags("stock")
@Controller("stock/user/orders")
@UseGuards(AuthGuard("jwt"))
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
        },
        {
          "id": 184222,
          "account_id": 12,
          "stock_id": 1,
          "price": 0,
          "number": 5,
          "match_number": 5,
          "order_type": "market",
          "status": "y",
          "trading_type": "buy",
          "created_at": "2025-03-28T11:53:40.569Z",
          "stocks": {
            "name": "Nest소프트"
          }
        }
    ]
    `
  })
  @Get("/")
  async getOrder(@Query() query: GetOrderDto, @GetUser() user) {
    return this.OrdersService.getOrder(query, user);
  }
  
  @ApiOperation({ summary: "주식 매수" })
  @ApiBearerAuth("access-token")
  @Post("/buy")
  async buy(@Body() data: BuyDto, @GetUser() user): Promise<void> {
    return this.OrdersService.buy(data, user);
  }

  @ApiOperation({ summary: "주식 매도" })
  @ApiBearerAuth("access-token")
  @Post("/sell")
  async sell(@Body() data: SellDto, @GetUser() user): Promise<void> {
    return this.OrdersService.sell(data, user)
  }

  @ApiOperation({ summary: "주식 주문 정정" })
  @ApiBearerAuth("access-token")
  @Put("/")
  async edit(@Body() data: EditDto, @GetUser() user): Promise<void> {
    return this.OrdersService.edit(data, user);
  } 

  @ApiOperation({ summary: "주식 주문 취소" })
  @ApiBearerAuth("access-token")
  @Delete("/")
  async cancel(@Body() data: CancelDto , @GetUser() user): Promise<void> {
    return this.OrdersService.cancel(data, user);
  }
}
