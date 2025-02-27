import { Controller, Get, Post, Delete, UseGuards, Put, Query, Body } from '@nestjs/common';
import { UserService } from './user.service';
import { AuthGuard } from '@nestjs/passport';
import { BuyDto } from './dtos/buy.dto';
import { SellDto } from './dtos/sell.dto';
import { GetUser } from 'src/common/decorator/get-user.decorator';
import { EditDto } from './dtos/edit.dto';
import { CancellDto } from './dtos/cancell.dto';
import { GetOrderDto } from './dtos/get-order.dto';

@Controller("stock/user/orders")
@UseGuards(AuthGuard("jwt"))
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get("/")
  async getOrder(@Query() query: GetOrderDto, @GetUser() user) {
    return await this.userService.getOrder(query, user);
  }

  @Post("/buy")
  async buy(@Body() data: BuyDto, @GetUser() user): Promise<void> {
    return await this.userService.buy(data, user);
  }

  @Post("/sell")
  async sell(@Body() data: SellDto, @GetUser() user): Promise<void> {
    return await this.userService.sell(data, user)
  }

  @Put("/edit")
  async edit(@Body() data: EditDto, @GetUser() user): Promise<void> {
    return await this.userService.edit(data, user);
  } 

  @Delete("/cancell")
  async cancell(@Body() data: CancellDto , @GetUser() user): Promise<void> {
    return await this.userService.cancell(data, user);
  }
}
