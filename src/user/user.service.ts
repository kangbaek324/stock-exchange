import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BuyDto } from './dto/buy.dto';
import { SellDto } from './dto/sell.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) { }

  async getOrder(query) {
    // 그냥 덜 만들었음 ㅎ.ㅎ
    console.log(query)
    if (query.status) {
      if (query.status == "match") {
        await this.prisma.accounts.findMany({
          where: { account_number: query.account_number },
          include: { order: true }
        })
      } else {

      }
    } else {

    }
  }

  async buy(data: BuyDto, user) {
    let errorNumber;
    try {
      // 유효성 검사
      const accountCheck = await this.prisma.accounts.findUnique({
        where: { account_number: data.account_number },
      });

      if (!accountCheck) {
        errorNumber = 1;
        throw Error("잘못된 계좌번호");
      } else if (accountCheck.user_id != user.id) {
        errorNumber = 2;
        throw Error("올바르지 않은 계좌번호")
      }

      const stockIdCheck = await this.prisma.stocks.findUnique({
        where: { id: data.stock_id },
        select: { id: true }
      });

      if (!stockIdCheck) {
        errorNumber = 3;
        throw Error("올바르지 않은 stock_id")
      }

      await this.prisma.$transaction(async (prisma) => {
        let submitOrder;
        if (data.order_type == "market") {
          submitOrder = await prisma.order.create({
            data: {
              account_id: accountCheck.id,
              stock_id: data.stock_id,
              price: 0,
              number: data.number,
              order_type: "market",
              trading_type: "buy"
            }
          });
        } else if(data.order_type == "limit") {
          submitOrder = await prisma.order.create({
            data: {
              account_id: accountCheck.id,
              stock_id: data.stock_id,
              price: data.price,
              number: data.number,
              order_type: "limit",
              trading_type: "buy"
            }
          });
        }

        while (true) {
          submitOrder = await prisma.order.findUnique({
            where: { id: submitOrder.id }
          });

          let findOrder;

          if (data.order_type == "market") {
            findOrder = await prisma.order.findFirst({
              where: {
                stock_id: data.stock_id,
                trading_type: "sell",
                status: "n",
              },
              orderBy: [
                { price: "asc" },
                { created_at: "asc" },
              ],
            });
          } else if (data.order_type == "limit") {
            findOrder = await prisma.order.findFirst({
              where: {
                stock_id: data.stock_id,
                trading_type: "sell",
                status: "n",
                price: {
                  lte: data.price,
                },
              },
              orderBy: [
                { price: "asc" },
                { created_at: "asc" },
              ],
            });
          }

          if (findOrder) {
            if (submitOrder.number - submitOrder.match_number == findOrder.number - findOrder.match_number) {
              await prisma.order.update({
                where: {
                  id: submitOrder.id
                },
                data: {
                  status: "y",
                  match_number: submitOrder.number
                }
              });
        
              await prisma.order.update({
                where: {
                  id: findOrder.id
                },
                data: {
                  status: "y",
                  match_number: findOrder.number
                }
              });
        
              await prisma.order_match.create({
                data: {
                  stock_id: data.stock_id,
                  number: submitOrder.number - submitOrder.match_number,
                  initial_order_id: findOrder.id,
                  order_id: submitOrder.id
                }
              });

              await prisma.stocks.update({
                where : { id : data.stock_id },
                data : {
                  price : findOrder.price
                }
              });

              return;
            }
            else if (submitOrder.number - submitOrder.match_number < findOrder.number - findOrder.match_number) {
              await prisma.order.update({
                where: {
                  id: submitOrder.id
                },
                data: {
                  status: "y",
                  match_number: submitOrder.number
                }
              });
        
              await prisma.order.update({
                where: {
                  id: findOrder.id
                },
                data: {
                  match_number: findOrder.match_number + (submitOrder.number - submitOrder.match_number)
                }
              });
        
              await prisma.order_match.create({
                data: {
                  stock_id: data.stock_id,
                  number: submitOrder.number - submitOrder.match_number,
                  initial_order_id: findOrder.id,
                  order_id: submitOrder.id
                }
              });

              await prisma.stocks.update({
                where : { id : data.stock_id },
                data : {
                  price : findOrder.price
                }
              });

              return;
            }
            else if (submitOrder.number - submitOrder.match_number > findOrder.number - findOrder.match_number) {
              await prisma.order.update({
                where: {
                  id: submitOrder.id
                },
                data: {
                  match_number: submitOrder.match_number + (findOrder.number - findOrder.match_number)
                }
              });
        
              await prisma.order.update({
                where: {
                  id: findOrder.id
                },
                data: {
                  status: "y",
                  match_number: findOrder.number
                }
              });
        
              await prisma.order_match.create({
                data: {
                  stock_id: data.stock_id,
                  number: findOrder.number - findOrder.match_number,
                  initial_order_id: findOrder.id,
                  order_id: submitOrder.id
                }
              });

              await prisma.stocks.update({
                where : { id : data.stock_id },
                data : {
                  price : findOrder.price
                }
              });

            }
          } else {
            if (submitOrder.number != submitOrder.match_number && submitOrder.order_type == "market") {
              const stockPriceNow = await prisma.stocks.findUnique({
                where : { id : submitOrder.stock_id },
                select : { price : true }
              }); 
              await prisma.order.update({
                where : { id : submitOrder.id },
                data : { price : stockPriceNow.price }
              });
            }
            return;
          }
        }
      });
    } catch (err) {
      console.log(err)
      if (errorNumber == 1) {
        throw new BadRequestException("잘못된 계좌번호 입니다");
      } else if (errorNumber == 2) {
        throw new BadRequestException("올바르지 않은 계좌번호 입니다")
      } else if (errorNumber == 3) {
        throw new BadRequestException("올바르지 않은 stock_id 입니다")
      } else {
        throw new InternalServerErrorException("서버에 오류가 발생했습니다");
      } 
    }
  }


  async sell(data: SellDto, user) {
    let errorNumber;
    try {
      // 유효성 검사
      const accountCheck = await this.prisma.accounts.findUnique({
        where: { account_number: data.account_number },
      });

      if (!accountCheck) {
        errorNumber = 1;
        throw Error("잘못된 계좌번호");
      } else if (accountCheck.user_id != user.id) {
        errorNumber = 2;
        throw Error("올바르지 않은 계좌번호")
      }

      const stockIdCheck = await this.prisma.stocks.findUnique({
        where: { id: data.stock_id },
        select: { id: true }
      });

      if (!stockIdCheck) {
        errorNumber = 3;
        throw Error("올바르지 않은 stock_id")
      }

      //주문 등록 및 즉시 체결가능한 주문 체결
      await this.prisma.$transaction(async (prisma) => {
        let submitOrder;
        if (data.order_type == "market") {
          submitOrder = await prisma.order.create({
            data: {
              account_id: accountCheck.id,
              stock_id: data.stock_id,
              price: 0,
              number: data.number,
              order_type: "market",
              trading_type: "sell"
            }
          });
        } else if (data.order_type == "limit") {
          submitOrder = await prisma.order.create({
            data: {
              account_id: accountCheck.id,
              stock_id: data.stock_id,
              price: data.price,
              number: data.number,
              order_type: "limit",
              trading_type: "sell"
            }
          });
        }

        while (true) {
          submitOrder = await prisma.order.findUnique({
            where: { id: submitOrder.id }
          });

          let findOrder;

          if (data.order_type == "market") {
            findOrder = await prisma.order.findFirst({
              where: {
                stock_id: data.stock_id,
                trading_type: "buy",
                status: "n",
              },
              orderBy: [
                { price: "desc" },
                { created_at: "asc" },
              ],
            });
          } else if (data.order_type == "limit") {
            findOrder = await prisma.order.findFirst({
              where: {
                stock_id: data.stock_id,
                trading_type: "buy",
                status: "n",
                price: {
                  gte: data.price,
                },
              },
              orderBy: [
                { price: "desc" },
                { created_at: "asc" },
              ],
            });
          }
          if (findOrder) {
            if (submitOrder.number - submitOrder.match_number == findOrder.number - findOrder.match_number) {
              await prisma.order.update({
                where: {
                  id: submitOrder.id
                },
                data: {
                  status: "y",
                  match_number: submitOrder.number
                }
              });
        
              await prisma.order.update({
                where: {
                  id: findOrder.id
                },
                data: {
                  status: "y",
                  match_number: findOrder.number
                }
              });
        
              await prisma.order_match.create({
                data: {
                  stock_id: data.stock_id,
                  number: submitOrder.number - submitOrder.match_number,
                  initial_order_id: findOrder.id,
                  order_id: submitOrder.id
                }
              });

              await prisma.stocks.update({
                where : { id : data.stock_id },
                data : {
                  price : findOrder.price
                }
              });

              return;
            }
            else if (submitOrder.number - submitOrder.match_number < findOrder.number - findOrder.match_number) {
              await prisma.order.update({
                where: {
                  id: submitOrder.id
                },
                data: {
                  status: "y",
                  match_number: submitOrder.number
                }
              });
        
              await prisma.order.update({
                where: {
                  id: findOrder.id
                },
                data: {
                  match_number: findOrder.match_number + (submitOrder.number - submitOrder.match_number)
                }
              });
        
              await prisma.order_match.create({
                data: {
                  stock_id: data.stock_id,
                  number: submitOrder.number - submitOrder.match_number,
                  initial_order_id: findOrder.id,
                  order_id: submitOrder.id
                }
              });

              await prisma.stocks.update({
                where : { id : data.stock_id },
                data : {
                  price : findOrder.price
                }
              });

              return;
            }
            else if (submitOrder.number - submitOrder.match_number > findOrder.number - findOrder.match_number) {
              await prisma.order.update({
                where: {
                  id: submitOrder.id
                },
                data: {
                  match_number: submitOrder.match_number + (findOrder.number - findOrder.match_number)
                }
              });
        
              await prisma.order.update({
                where: {
                  id: findOrder.id
                },
                data: {
                  status: "y",
                  match_number: findOrder.number
                }
              });
        
              await prisma.order_match.create({
                data: {
                  stock_id: data.stock_id,
                  number: findOrder.number - findOrder.match_number,
                  initial_order_id: findOrder.id,
                  order_id: submitOrder.id
                }
              });

              await prisma.stocks.update({
                where : { id : data.stock_id },
                data : {
                  price : findOrder.price
                }
              });

            }
          } else {
            if (submitOrder.number != submitOrder.match_number && submitOrder.order_type == "market") {
              const stockPriceNow = await prisma.stocks.findUnique({
                where : { id : submitOrder.stock_id },
                select : { price : true }
              }); 
              await prisma.order.update({
                where : { id : submitOrder.id },
                data : { price : stockPriceNow.price }
              });
            }
            return;
          }
        }

      })
    } catch (err) {
      console.log(err)
      if (errorNumber == 1) {
        throw new BadRequestException("잘못된 계좌번호 입니다");
      } else if (errorNumber == 2) {
        throw new BadRequestException("올바르지 않은 계좌번호 입니다")
      } else if (errorNumber == 3) {
        throw new BadRequestException("올바르지 않은 stock_id 입니다")
      } else {
        throw new InternalServerErrorException("서버에 오류가 발생했습니다");
      } 
    }
  }
}