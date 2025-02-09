import { Controller, Get, Post, Delete, UseGuards, Put, Query, Body, UsePipes } from '@nestjs/common';
import { UserService } from './user.service';
import { AuthGuard } from '@nestjs/passport';
import { GetOrderStatus } from './type/get-order-status.type';
import { BuyDto } from './dto/buy.dto';
import { SellDto } from './dto/sell.dto';
import { GetUser } from 'src/auth/decorator/get-user.decorator';

@Controller('user/stock/orders')
@UseGuards(AuthGuard("jwt"))
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async getOrder(
    @Query() query: { status? : GetOrderStatus },
  ) {
    return await this.userService.getOrder(query);
  }

  @Post("/buy")
  async buy(@Body() data: BuyDto, @GetUser() user): Promise<void> {
    return await this.userService.buy(data, user);
  }

  @Post("/sell")
  async sell(@Body() data: SellDto, @GetUser() user): Promise<void> {
    return await this.userService.sell(data, user)
  }

  @Put("/:order_id")
  async edit(): Promise<void> {

  } 

  @Delete("/:order_id")
  async cancell(): Promise<void> {

  }
}
