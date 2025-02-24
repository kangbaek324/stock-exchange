import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BuyDto } from './dtos/buy.dto';
import { SellDto } from './dtos/sell.dto';
import { CancellDto } from './dtos/cancell.dto';
import { OrderValidationService } from './order-validation.service';
import { OrderService } from './order.service';
import { GetOrderDto } from './dtos/get-order.dto';
import { WebsocketGateway } from 'src/websocket/websocket.gateway';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderValidation: OrderValidationService,
    private readonly order: OrderService,
    private readonly websocket: WebsocketGateway
  ) {}

  async getOrder(query: GetOrderDto, user) {
    const validationResultCode = await this.orderValidation.getOrderValidate(query, user)
    if (validationResultCode == 1) {
      throw new BadRequestException("잘못된 계좌번호입니다")
    } else if (validationResultCode == 2) {
      throw new BadRequestException("올바르지 않은 계좌번호입니다")
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
      console.log(err)
      throw new BadRequestException("서버에 오류가 발생했습니다");
    }
  }

  async buy(data: BuyDto, user) {
    const validationResultCode = await this.orderValidation.buySellValidate(data, user);
    if (validationResultCode == 1) {
      throw new BadRequestException("잘못된 계좌번호입니다")
    } else if (validationResultCode == 2) {
      throw new BadRequestException("올바르지 않은 계좌번호입니다")
    } else if (validationResultCode == 3) {
      throw new BadRequestException("잘못된 stock_id입니다")
    }

    try {
      await this.prisma.$transaction(async (prisma) => {
        const getAccountId = await this.prisma.accounts.findUnique({
          where: { account_number: data.accountNumber },
          select : { id : true }
        });
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
        await this.order.order(prisma, data, submitOrder, "buy");
      });
      await this.websocket.stockUpdate();
    } catch (err) {
      console.log(err)
      throw new InternalServerErrorException("서버에 오류가 발생했습니다");
    }
  }


  async sell(data: SellDto, user) {
    const validationResultCode = await this.orderValidation.buySellValidate(data, user);
    if (validationResultCode == 1) {
      throw new BadRequestException("잘못된 계좌번호입니다")
    } else if (validationResultCode == 2) {
      throw new BadRequestException("올바르지 않은 계좌번호입니다")
    } else if (validationResultCode == 3) {
      throw new BadRequestException("잘못된 stock_id입니다")
    }

    try {
      const getAccountId = await this.prisma.accounts.findUnique({
        where: { account_number: data.accountNumber },
        select : { id : true }
      });
      //주문 등록 및 즉시 체결가능한 주문 체결
      await this.prisma.$transaction(async (prisma) => {
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
        await this.order.order(prisma, data, submitOrder, "sell");
      });
      await this.websocket.stockUpdate();
    } catch (err) {
      console.log(err)
      throw new InternalServerErrorException("서버에 오류가 발생했습니다");
    }
  }

  async edit(data, user) {

  }

  async cancell(data: CancellDto, user) {
    const validationResultCode = await this.orderValidation.cancellValidate(data, user);
    if (validationResultCode == 1) {
      throw new BadRequestException("잘못된 계좌번호입니다")
    } else if (validationResultCode == 2) {
      throw new BadRequestException("올바르지 않은 계좌번호입니다")
    } else if (validationResultCode == 3) {
      throw new BadRequestException("잘못된 order_id 입니다")
    } else if (validationResultCode == 4) {
      throw new BadRequestException("올바르지 않은 order_id 입니다")
    } else if (validationResultCode == 5) {
      throw new BadRequestException("이미 취소된 주문 입니다")
    }
    try {
      await this.prisma.order.update({
        data : {
          status : "c"
        },
        where : {
          id : data.orderId
        }
      });
      await this.websocket.stockUpdate();
    } catch(err) {
      console.log(err)
      throw new InternalServerErrorException("서버에 오류가 발생했습니다");
    }
  }
}