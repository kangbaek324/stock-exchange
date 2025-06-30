import { BadRequestException, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { BuyDto } from './dtos/buy.dto';
import { SellDto } from './dtos/sell.dto';
import { CancelDto } from './dtos/cancel.dto';
import { OrdersValidationService } from './orders-validation.service';
import { OrdersExecutionService } from './orders-execution.service';
import { GetOrderDto } from './dtos/get-order.dto';
import { WebsocketGateway } from 'src/websocket/websocket.gateway';
import { EditDto } from './dtos/edit.dto';
import { PrismaClient } from '@prisma/client';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class OrdersService {
  constructor(
    @Inject("ORDER_SERVICE") private client: ClientProxy,
    private readonly prisma: PrismaService,
    private readonly ordersValidation: OrdersValidationService,
    private readonly ordersExecution: OrdersExecutionService,
    private readonly websocket: WebsocketGateway
  ) {}

  async sendMQ(
    data: BuyDto | SellDto | CancelDto | EditDto,
    user,
    type: "buy" | "sell" | "cancel" | "edit"
  ) {
    const mqData = {
      data,
      type: type,
      user,
      timestamp: Number(process.hrtime.bigint()),
    }

    return await this.client.send("order", mqData);
  } 

  async sendOrder(mqData) {
    if (mqData.type === "buy") {
      return await this.buy(mqData.data, mqData.user);
    }
    else if (mqData.type === "sell") {
      return await this.sell(mqData.data, mqData.user);
    }
    else if (mqData.type === "cancel") {
      return await this.cancel(mqData.data, mqData.user);
    }
    else if (mqData.type === "edit") {
      return await this.edit(mqData.data, mqData.user);
    }
  }

  async getOrder(query: GetOrderDto, user) {
    const resultMessage = await this.ordersValidation.getOrderValidate(query, user)
    if (resultMessage) {
      throw new BadRequestException(resultMessage);
    }
    try {
      const account = await this.prisma.accounts.findUnique({
        where: {
          account_number: query.accountnumber
        },
        select: {
          id: true
        }
      });

      const findConditions: any = {
        account_id: account.id,
      }

      if (query.status) {
        findConditions.status = query.status;
      }
      
      return await this.prisma.order.findMany({
        where: findConditions, 
        include: {
          stocks: {
            select: {
              name: true
            }
          }
        }
      });
    } catch(err) {
      console.error(err);
      throw new BadRequestException("서버에 오류가 발생했습니다");
    }
  }

  async buy(data: BuyDto, user) {
    let result;
    // 매수 주문
    try {
      await this.prisma.$transaction(async (prisma: PrismaClient) => {
        const account = await this.prisma.accounts.findUnique({
          where: { account_number: data.accountNumber }
        })
        
        let submitOrder = await this.prisma.order.create({
          data: {
            account_id: account.id,
            stock_id: data.stockId,
            price: 0,
            number: data.number,
            order_type: data.orderType,
            trading_type: "buy"
          }
        });
        try {
          result = await this.ordersExecution.order(prisma, data, submitOrder, "buy");
        } catch (error) {
          console.error(error)
          throw new InternalServerErrorException("주문 체결중 오류가 발생했습니다");
        }
      });
    } catch (err) {
      console.error(err);
      throw new InternalServerErrorException("주문 처리중 오류가 발생했습니다");
    }

    // 웹 소켓 전송
    try {
      await this.websocket.stockUpdate(data.stockId);
      if (result[0]) {
        await this.websocket.orderStatus(result[0]);
      }
      await this.websocket.orderStatus(result[1]);
      const userStocks = await this.prisma.user_stocks.findMany({
        where: {
          stock_id: data.stockId
        }
      });
      for(let i = 0; i < userStocks.length; i++) {
        await this.websocket.accountUpdate(userStocks[i].account_id);  
      }
    } catch(err) {
      console.error("웹소켓 전송오류" + err);
    }
  }

  async sell(data: SellDto, user) {
    let result;

    // 매도 주문
    try {
      await this.prisma.$transaction(async (prisma: PrismaClient) => {
        const account = await this.prisma.accounts.findUnique({
          where: { account_number: data.accountNumber }
        })

        let submitOrder = await this.prisma.order.create({
          data: {
            account_id: account.id,
            stock_id: data.stockId,
            price: 0,
            number: data.number,
            order_type: data.orderType,
            trading_type: "buy"
          }
        });
        try {
          result = await this.ordersExecution.order(prisma, data, submitOrder, "sell");
        } catch (error) {
          console.error(error)
          throw Error("주문 체결중 오류가 발생했습니다");
        }
      });
    } catch (err) {
      console.error(err)
      throw new InternalServerErrorException("주문 처리중 오류가 발생했습니다");
    }

    // 웹소켓 전송
    try {
      await this.websocket.stockUpdate(data.stockId);
      if (result[0]) {
        await this.websocket.orderStatus(result[0]);
      }
      await this.websocket.orderStatus(result[1]);
      const userStocks = await this.prisma.user_stocks.findMany({
        where: {
          stock_id: data.stockId
        }
      });
      for(let i = 0; i < userStocks.length; i++) {
        await this.websocket.accountUpdate(userStocks[i].account_id);  
      }
    } catch(err) {
      console.error("웹소켓 전송오류" + err);
    }
  }

  async edit(data: EditDto, user) {
    let result;

    // 주문 정정
    try {
      result = await this.prisma.order.update({
        data: {
          price: data.price
        },
        where: {
          id: data.orderId
        }
      });
    } catch(err) {
      console.error(err)
      throw new InternalServerErrorException("주문 처리중 오류가 발생했습니다")
    }
    
    // 웹소켓 전송
    try {
      await this.websocket.stockUpdate(result.stock_id);
      await this.websocket.accountUpdate(result.account_id);
      await this.websocket.orderStatus(result.account_id);
    } catch(err) {
      console.error("웹소켓 전송오류" + err);
    }
  }

  async cancel(data: CancelDto, user) {
    let order;

    // 취소 주문
    try {
      await this.prisma.$transaction(async () => {
        order = await this.prisma.order.update({
          data: {
            status: "c"
          },
          where: {
            id: data.orderId
          }
        });
  
        if (order.trading_type == "sell") {        
          const userStock = await this.prisma.user_stocks.findFirst({
            where: {
              stock_id: order.stock_id,
              account_id: order.account_id
            }
          })
    
          await this.prisma.user_stocks.update({
            where: {
              id: userStock.id
            },
            data: {
              can_number: userStock.can_number + order.number - order.match_number
            }
          });
        }
      });

    } catch(err) {
      console.error(err)
      throw new InternalServerErrorException("주문 처리중 오류가 발생했습니다");
    }

    // 웹소켓 전송
    try {
      await this.websocket.stockUpdate(order.stock_id);
      await this.websocket.accountUpdate(order.account_id);
      await this.websocket.orderStatus(order.account_id);
    } catch(err) {
      console.error("웹소켓 전송오류" + err);
    }
  }
}