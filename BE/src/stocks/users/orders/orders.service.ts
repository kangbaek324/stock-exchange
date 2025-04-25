import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { BuyDto } from './dtos/buy.dto';
import { SellDto } from './dtos/sell.dto';
import { CancelDto } from './dtos/cancel.dto';
import { OrdersValidationService } from './orders-validation.service';
import { OrdersLogicService } from './orders-logic.service';
import { GetOrderDto } from './dtos/get-order.dto';
import { WebsocketGateway } from 'src/websocket/websocket.gateway';
import { EditDto } from './dtos/edit.dto';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersValidation: OrdersValidationService,
    private readonly ordersLogic: OrdersLogicService,
    private readonly websocket: WebsocketGateway
  ) {}

  async getOrder(query: GetOrderDto, user) {
    const resultMessage = await this.ordersValidation.getOrderValidate(query, user)
    if (resultMessage) {
      throw new BadRequestException(resultMessage);
    }

    try {
      const accountId = await this.prisma.accounts.findUnique({
        where : {
          account_number : query.accountnumber
        },
        select : {
          id : true
        }
      });
      
      if (query.status) {
        if (query.status == "matched") {
          return await this.prisma.order.findMany({
            where : {
              account_id : accountId.id,
              status : "y"
            },
            include : {
              stocks : {
                select : {
                  name : true
                }
              }
            }
          });
        } else {
          return await this.prisma.order.findMany({
            where : {
              account_id : accountId.id,
              status : "n"
            },
            include : {
              stocks : {
                select : {
                  name : true
                }
              }
            }
          });
        }
      } else {
        return await this.prisma.order.findMany({
          where : {
            account_id : accountId.id
          },
          include : {
            stocks : {
              select : {
                name : true
              }
            }
          }
        });
      }
    } catch(err) {
      console.log(err);
      throw new BadRequestException("서버에 오류가 발생했습니다");
    }
  }

  async buy(data: BuyDto, user) {
    const resultMessage = await this.ordersValidation.buySellValidate(data, user, "buy");
    if (resultMessage) {
      throw new BadRequestException(resultMessage)
    }
    try {
      await this.prisma.$transaction(async (prisma: PrismaClient) => {
        const maxRetries = 5;
        let attempt = 0;
        let success = false;
        const getAccountId = await this.prisma.accounts.findUnique({
          where: { account_number: data.accountNumber },
          select : { id : true }
        });
        while(attempt < maxRetries && !success) {
          let submitOrder;
          if (data.orderType == "market") {
            submitOrder = await prisma.order.create({
              data: {
                account_id: getAccountId.id,
                stock_id: data.stockId,
                price: 0,
                number: data.number,
                order_type: "market",
                trading_type: "buy"
              }
            });
          } else if(data.orderType == "limit") {
            submitOrder = await prisma.order.create({
              data: {
                account_id: getAccountId.id,
                stock_id: data.stockId,
                price: data.price,
                number: data.number,
                order_type: "limit",
                trading_type: "buy"
              }
            });
          }
          try {
            await this.ordersLogic.order(prisma, data, submitOrder, "buy");
            success = true;
            return;
          } catch (error) {
            if (error.code === 'P2034') {
                attempt++;
                console.log(`Retrying transaction... Attempt ${attempt}`);
                await new Promise(resolve => setTimeout(resolve, 100));
            } else {
                console.log(error)
                throw Error("Internet server Error")
            }
          }
        }
      });
      await this.websocket.stockUpdate();
    } catch (err) {
      console.log(err)
      throw new InternalServerErrorException("서버에 오류가 발생했습니다");
    }
  }

  async sell(data: SellDto, user) {
    const resultMessage = await this.ordersValidation.buySellValidate(data, user, "sell");
    if (resultMessage) {
      throw new BadRequestException(resultMessage)
    }
    try {
      await this.prisma.$transaction(async (prisma: PrismaClient) => {
        const maxRetries = 5;
        let attempt = 0;
        let success = false;
        const getAccountId = await this.prisma.accounts.findUnique({
          where: { account_number: data.accountNumber },
          select : { id : true }
        });
        while(attempt < maxRetries && !success) {
          let submitOrder;
          if (data.orderType == "market") {
            submitOrder = await prisma.order.create({
              data: {
                account_id: getAccountId.id,
                stock_id: data.stockId,
                price: 0,
                number: data.number,
                order_type: "market",
                trading_type: "sell"
              }
            });
          } else if (data.orderType == "limit") {
            submitOrder = await prisma.order.create({
              data: {
                account_id: getAccountId.id,
                stock_id: data.stockId,
                price: data.price,
                number: data.number,
                order_type: "limit",
                trading_type: "sell"
              }
            });
          }

          try {
            await this.ordersLogic.order(prisma, data, submitOrder, "sell");
            success = true;
            return;
          } catch (error) {
            if (error.code === 'P2034') {
                attempt++;
                console.log(`Retrying transaction... Attempt ${attempt}`);
                await new Promise(resolve => setTimeout(resolve, 100));
            } else {
                console.log(error)
                throw Error("Internet server Error")
            }
          }
        }
      });
      await this.websocket.stockUpdate();
    } catch (err) {
      console.log(err)
      throw new InternalServerErrorException("서버에 오류가 발생했습니다");
    }
  }

  async edit(data: EditDto, user) {
    const resultMessage = await this.ordersValidation.editValidate(data, user);
    if (resultMessage) {
      throw new BadRequestException(resultMessage);
    }
    try {
      await this.prisma.order.update({
        data : {
          price : data.price
        },
        where : {
          id : data.orderId
        }
      });
      await this.websocket.stockUpdate();
    } catch(err) {
      console.log(err)
      throw new InternalServerErrorException("서버에 오류가 발생했습니다")
    }
  }

  async cancel(data: CancelDto, user) {
    const resultMessage = await this.ordersValidation.cancelValidate(data, user);
    if (resultMessage) {
      throw new BadRequestException(resultMessage);
    }
    try {
      const order = await this.prisma.order.update({
        data : {
          status : "c"
        },
        where : {
          id : data.orderId
        }
      });
      
      if (order.trading_type = "sell") {
        const userStock = await this.prisma.user_stocks.findFirst({
          where :{
            stock_id : order.stock_id,
            account_id : order.account_id
          }
        })

        await this.prisma.user_stocks.update({
          where : {
            id : userStock.id
          },
          data : {
            can_number : userStock.can_number + (order.number - order.match_number) 
          }
        });
      }
      else {
        console.log("money");
      }

      await this.websocket.stockUpdate();
    } catch(err) {
      console.log(err)
      throw new InternalServerErrorException("서버에 오류가 발생했습니다");
    }
  }
}